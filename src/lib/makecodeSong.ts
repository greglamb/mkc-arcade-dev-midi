import { Midi } from '@tonejs/midi'

import { type Song, type Instrument, type NoteEvent, getEmptySong, encodeSongToHex, type Track } from "./pxt"


export type MidiTrackSummary = {
    id: number
    name: string
    sourceFileName: string
    sourcePpq: number
    noteCount: number
    channel: number | null
    minMidiNote: number
    maxMidiNote: number
    midiNotes: number[]
    notes: NoteEvent[]
}

type BuildSongOptions = {
    transposeOctaves?: number
    drumTransposeOctaves?: number
    drumTrackIds?: ReadonlySet<number>
    beatsPerMinute?: number
}

export type ParsedMidiSummary = {
    fileNames: string[]
    files: { name: string; buffer: ArrayBuffer }[]
    beatsPerMinute: number
    beatsPerMeasure: number
    tracks: MidiTrackSummary[]
}

export type InstrumentPreset = {
    id: string
    makecodeTrackId: number
    label: string
    instrument: Instrument
}

export const MAKECODE_INSTRUMENT_PRESETS: InstrumentPreset[] = getEmptySong(4).tracks.map(track => ({
    id: track.name!,
    makecodeTrackId: track.id,
    label: track.name!,
    instrument: track.instrument!
}))

const presetById = new Map(MAKECODE_INSTRUMENT_PRESETS.map((preset) => [preset.id, preset]))

// Presets that correspond to melodic (non-drum) tracks only
export const MAKECODE_MELODIC_INSTRUMENT_PRESETS = MAKECODE_INSTRUMENT_PRESETS.filter(p => {
    const track = getEmptySong(1).tracks.find(t => t.id === p.makecodeTrackId)
    return !track?.drums
})

// Documented playable MIDI range per melodic instrument (real MIDI note numbers).
// Mirrors the recommended ranges shown in InstrumentRangeTable. Keyed by preset id
// (which equals the instrument name, e.g. "Dog").
export const MELODIC_INSTRUMENT_RANGES: Record<string, { lo: number; hi: number }> = {
    Dog: { lo: 51, hi: 91 },
    Duck: { lo: 51, hi: 91 },
    Cat: { lo: 63, hi: 103 },
    Fish: { lo: 39, hi: 79 },
    Car: { lo: 51, hi: 91 },
    Computer: { lo: 27, hi: 67 },
    Burger: { lo: 27, hi: 67 },
    Cherry: { lo: 39, hi: 79 },
    Lemon: { lo: 27, hi: 67 },
}

export type TrackRangeReport = { below: number; above: number; lo: number; hi: number }

// Counts how many of a track's notes fall outside the chosen instrument's
// documented range after applying a whole-octave transpose. Compares raw MIDI
// note numbers against the documented range (octave-scale guidance; the encoder
// adds a ~1-semitone offset internally, so boundary notes may differ by one).
// Returns null when the preset has no documented range (e.g. drum/unknown).
export const analyzeTrackRange = (
    midiNotes: number[],
    presetId: string | undefined,
    transposeOctaves: number,
): TrackRangeReport | null => {
    if (!presetId) return null
    const range = MELODIC_INSTRUMENT_RANGES[presetId]
    if (!range) return null

    const shift = transposeOctaves * 12
    let below = 0
    let above = 0
    for (const note of midiNotes) {
        const value = note + shift
        if (value < range.lo) below++
        else if (value > range.hi) above++
    }
    return { below, above, lo: range.lo, hi: range.hi }
}

// Finds the whole-octave melodic transpose (within [minOctave, maxOctave]) that
// minimizes total out-of-range notes across all melodic tracks, each measured
// against its own instrument. Returns null when the current transpose is already
// as good as it gets (so the UI only nudges when there's a real improvement).
export const suggestMelodicTranspose = (
    tracks: { midiNotes: number[]; presetId: string | undefined }[],
    currentTranspose: number,
    minOctave = -4,
    maxOctave = 4,
): number | null => {
    const countOutOfRange = (shift: number) =>
        tracks.reduce((sum, track) => {
            const report = analyzeTrackRange(track.midiNotes, track.presetId, shift)
            return sum + (report ? report.below + report.above : 0)
        }, 0)

    const currentCount = countOutOfRange(currentTranspose)
    if (currentCount === 0) return null

    let best = currentTranspose
    let bestCount = currentCount
    for (let shift = minOctave; shift <= maxOctave; shift++) {
        if (shift === currentTranspose) continue
        const count = countOutOfRange(shift)
        const closer = Math.abs(shift - currentTranspose) < Math.abs(best - currentTranspose)
        if (count < bestCount || (count === bestCount && closer)) {
            best = shift
            bestCount = count
        }
    }

    return bestCount < currentCount ? best : null
}

export const parseMidi = async (file: File): Promise<ParsedMidiSummary> => {
    const arrayBuffer = await file.arrayBuffer()
    const midi = new Midi(arrayBuffer)

    const beatsPerMinute = Math.max(1, Math.round(midi.header.tempos[0]?.bpm || 120))
    const beatsPerMeasure = Math.min(Math.max(midi.header.timeSignatures[0]?.timeSignature?.[0] || 4, 1), 12)
    const ppq = midi.header.ppq || 480

    const tracks = midi.tracks.reduce<MidiTrackSummary[]>((result, track, index) => {
        if (!track.notes.length) return result

        const midiNotes = track.notes.map((note) => note.midi)
        const channel: number | null = typeof track.channel === 'number' ? track.channel : null

        result.push({
            id: index,
            name: track.name?.trim() || `Track ${index + 1}`,
            sourceFileName: file.name,
            sourcePpq: ppq,
            noteCount: track.notes.length,
            channel,
            minMidiNote: Math.min(...midiNotes),
            maxMidiNote: Math.max(...midiNotes),
            midiNotes,
            notes: extractNoteEvents(midi, index, false),
        })

        return result
    }, [])

    if (!tracks.length) {
        throw new Error('No note data found in this MIDI file.')
    }

    return {
        fileNames: [file.name],
        files: [{ name: file.name, buffer: arrayBuffer }],
        beatsPerMinute,
        beatsPerMeasure,
        tracks,
    }
}

export const parseMidiFiles = async (files: File[]): Promise<ParsedMidiSummary> => {
    if (!files.length) {
        throw new Error('Select at least one MIDI file.')
    }

    const parsedFiles = await Promise.all(files.map((file) => parseMidi(file)))
    const first = parsedFiles[0]
    let nextTrackId = 0

    const mergedTracks = parsedFiles.flatMap((parsed) => {
        const hasMultipleTracks = parsed.tracks.length > 1;

        return parsed.tracks.map((track, index) => {
            const displayName = hasMultipleTracks ? `${track.sourceFileName} - ${index}` : track.sourceFileName;
            const mergedTrack: MidiTrackSummary = {
                ...track,
                id: nextTrackId,
                name: displayName,
            }
            nextTrackId += 1
            return mergedTrack
        })
    })

    return {
        fileNames: parsedFiles.flatMap((parsed) => parsed.fileNames),
        files: parsedFiles.flatMap((parsed) => parsed.files),
        beatsPerMinute: first.beatsPerMinute,
        beatsPerMeasure: first.beatsPerMeasure,
        tracks: mergedTracks,
    }
}

export const extractNoteEvents = (midi: Midi, trackIndex: number, isDrumTrack: boolean) => {
    const makecodeEvents: NoteEvent[] = [];
    const track = midi.tracks[trackIndex];
    if (!track) {
        throw new Error(`Track index ${trackIndex} out of bounds for MIDI with ${midi.tracks.length} tracks`);
    }

    for (const event of track.notes) {
        const startTick = event.ticks;
        const endTick = startTick + event.durationTicks;

        const existing = makecodeEvents.find(e => e.startTick === startTick && Math.abs(e.endTick - endTick) <= 5);

        const spelling = isDrumTrack ? "normal" : (isBlackKey(event.midi) ? "sharp" : "normal");

        const velocity = event.velocity !== undefined ? Math.round(event.velocity * 127) : undefined;

        if (existing) {
            existing.notes.push({
                note: isDrumTrack ? event.midi : event.midi + 1,
                enharmonicSpelling: spelling
            });
            if (velocity !== undefined) {
                existing.velocity = Math.max(existing.velocity ?? 0, velocity);
            }
        }
        else {
            makecodeEvents.push({
                notes: [
                    {
                        note: isDrumTrack ? event.midi : event.midi + 1,
                        enharmonicSpelling: spelling
                    }
                ],
                startTick: startTick,
                endTick: endTick,
                velocity: velocity
            });
        }
    }

    console.log(`Generated ${makecodeEvents.length} makecode events for track`);
    for (const event of makecodeEvents) {
        if (makecodeEvents.some(e => {
            if (e === event) return false;

            if ((e.startTick >= event.startTick && e.startTick < event.endTick) || (e.endTick > event.startTick && e.endTick <= event.endTick)) {
                return true;
            }

            return false;
        })) {
            console.warn(`Event with notes ${event.notes.map(n => n.note).join(', ')} from tick ${event.startTick} to ${event.endTick} overlaps with another event`);
        }
    }

    return makecodeEvents;
}

const remapDrumNotes = (events: NoteEvent[], drumTransposeOctaves: number, numDrums: number): NoteEvent[] => {
    const semitones = drumTransposeOctaves * 12
    return events.map(event => ({
        ...event,
        notes: event.notes.map(note => {
            const rawMidi = note.note
            const transposed = rawMidi + semitones
            const drumIndex = ((transposed % numDrums) + numDrums) % numDrums
            return { ...note, note: drumIndex, enharmonicSpelling: "normal" }
        })
    }))
}

const transposeNoteEvents = (events: NoteEvent[], octaves: number): NoteEvent[] => {
    const semitones = octaves * 12;
    return events.map(event => ({
        ...event,
        notes: event.notes.map(note => ({
            ...note,
            note: note.note + semitones
        }))
    }));
}

const scaleTiming = (events: NoteEvent[], sourcePPQ: number, targetPPQ: number): NoteEvent[] => {
    const scale = targetPPQ / sourcePPQ;
    return events.map(event => {
        const startTick = Math.floor(event.startTick * scale);
        const endTick = Math.max(Math.floor(event.endTick * scale), startTick + 1);
        return {
            ...event,
            startTick,
            endTick
        };
    });
}

export const buildMakeCodeSongSnippet = (
    parsed: ParsedMidiSummary,
    instrumentAssignments: Record<number, string>,
    options: BuildSongOptions = {},
): string => {
    const ticksPerBeat = 16
    const transposeOctaves = options.transposeOctaves || 0
    const drumTransposeOctaves = options.drumTransposeOctaves || 0
    const drumTrackIds = options.drumTrackIds ?? new Set<number>()
    const beatsPerMinute = Math.max(1, Math.round(options.beatsPerMinute ?? parsed.beatsPerMinute))

    const defaultDrums = getEmptySong(1).tracks.find(t => t.drums)?.drums ?? []
    const numDrums = defaultDrums.length || 16

    const melodicSourceTracks = parsed.tracks.filter(t => !drumTrackIds.has(t.id))
    const drumSourceTracks = parsed.tracks.filter(t => drumTrackIds.has(t.id))

    const tracks: Track[] = melodicSourceTracks.map((track, index) => {
        const presetId = instrumentAssignments[track.id] || MAKECODE_MELODIC_INSTRUMENT_PRESETS[index % MAKECODE_MELODIC_INSTRUMENT_PRESETS.length].id
        const preset = presetById.get(presetId) || MAKECODE_MELODIC_INSTRUMENT_PRESETS[0]

        const instrument = {
            ...preset.instrument,
            ampEnvelope: { ...preset.instrument.ampEnvelope },
            pitchEnvelope: preset.instrument.pitchEnvelope && { ...preset.instrument.pitchEnvelope },
            ampLFO: preset.instrument.ampLFO && { ...preset.instrument.ampLFO },
            pitchLFO: preset.instrument.pitchLFO && { ...preset.instrument.pitchLFO },
        }

        const transposed = transposeNoteEvents(track.notes, transposeOctaves)
        const scaled = scaleTiming(transposed, track.sourcePpq, ticksPerBeat)

        return {
            id: preset.makecodeTrackId,
            instrument,
            notes: scaled,
        }
    })

    if (drumSourceTracks.length > 0) {
        const allDrumNotes: NoteEvent[] = []
        for (const drumTrack of drumSourceTracks) {
            const remapped = remapDrumNotes(drumTrack.notes, drumTransposeOctaves, numDrums)
            const scaled = scaleTiming(remapped, drumTrack.sourcePpq, ticksPerBeat)
            allDrumNotes.push(...scaled)
        }
        allDrumNotes.sort((a, b) => a.startTick - b.startTick)

        tracks.push({
            id: 9, // MakeCode drums track id
            instrument: { waveform: 0, ampEnvelope: { attack: 0, decay: 0, sustain: 0, release: 0, amplitude: 0 } },
            drums: defaultDrums,
            notes: allDrumNotes,
        })
    }

    const maxTick = tracks.reduce(
        (songMax, track) => Math.max(songMax, ...track.notes.map((note) => note.endTick), 0),
        0,
    )

    const ticksPerMeasure = ticksPerBeat * parsed.beatsPerMeasure
    const measures = Math.max(1, Math.ceil(maxTick / ticksPerMeasure))

    const song: Song = {
        beatsPerMinute,
        beatsPerMeasure: parsed.beatsPerMeasure,
        ticksPerBeat,
        measures,
        tracks,
    }

    const songHex = encodeSongToHex(song)

    const fileLabel =
        parsed.fileNames.length === 1 ? parsed.fileNames[0] : `${parsed.fileNames.length} MIDI files`

    const melodicTransposeLabel =
        transposeOctaves === 0 ? '' : `\n// Melodic tracks transposed ${transposeOctaves > 0 ? '+' : ''}${transposeOctaves} octave(s)`
    const drumTransposeLabel =
        drumTransposeOctaves === 0 ? '' : `\n// Drum tracks transposed ${drumTransposeOctaves > 0 ? '+' : ''}${drumTransposeOctaves} octave(s)`
    const bpmLabel =
        beatsPerMinute === parsed.beatsPerMinute ? '' : `\n// Tempo set to ${beatsPerMinute} BPM`

    return `// Generated from ${fileLabel}${melodicTransposeLabel}${drumTransposeLabel}${bpmLabel}\nconst song = music.createSong(hex\`${songHex}\`)\nmusic.play(song, music.PlaybackMode.LoopingInBackground)`
}

function isBlackKey(noteNumber: number) {
    const pitchClass = noteNumber % 12;
    return [1, 3, 6, 8, 10].includes(pitchClass);
}

export const guessInstrumentPreset = (trackName: string, index: number) => {
    const lowerName = trackName.toLowerCase()
    for (const preset of MAKECODE_MELODIC_INSTRUMENT_PRESETS) {
        if (lowerName.includes(preset.label.toLowerCase())) {
            return preset.id
        }
    }
    return MAKECODE_MELODIC_INSTRUMENT_PRESETS[index % MAKECODE_MELODIC_INSTRUMENT_PRESETS.length].id
}