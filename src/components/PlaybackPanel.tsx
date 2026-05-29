import { useEffect, useMemo, useState } from 'react'
import { MELODIC_INSTRUMENT_RANGES, type ParsedMidiSummary } from '../lib/makecodeSong'
import { useMidiPlayer } from '../hooks/useMidiPlayer'
import { PianoRange, type RangeMarker } from './PianoRange'

interface PlaybackPanelProps {
  parsedMidi: ParsedMidiSummary
  instrumentAssignments: Record<number, string>
  drumTrackIds: Set<number>
  transposeOctaves: number
}

// Full 88-key piano window (A0–C8) so any piano recording fits.
const PIANO_LO = 21
const PIANO_HI = 108

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${octave}`
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function PlaybackPanel({
  parsedMidi,
  instrumentAssignments,
  drumTrackIds,
  transposeOctaves,
}: PlaybackPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [parsedMidi.files])

  const selected = parsedMidi.files[selectedIndex] ?? parsedMidi.files[0]
  const {
    isPlaying,
    isLoading,
    error,
    elapsedMs,
    durationMs,
    soundFontProgress,
    play,
    pause,
    restart,
    seek,
  } = useMidiPlayer(selected?.buffer ?? null)

  const [scrubMs, setScrubMs] = useState<number | null>(null)

  const fileTracks = useMemo(
    () => parsedMidi.tracks.filter((track) => track.sourceFileName === selected?.name),
    [parsedMidi.tracks, selected?.name],
  )

  // Melodic tracks of the selected file that map to a known instrument range.
  const melodicTracks = useMemo(
    () =>
      fileTracks.filter(
        (track) =>
          !drumTrackIds.has(track.id) &&
          instrumentAssignments[track.id] &&
          MELODIC_INSTRUMENT_RANGES[instrumentAssignments[track.id]],
      ),
    [fileTracks, drumTrackIds, instrumentAssignments],
  )

  // Conversion-result view: notes are shifted by the melodic transpose to show
  // where they actually land, and brackets sit at each instrument's true range.
  // Notes spilling past a bracket are what convert out of range.
  const displayedRange = useMemo(() => {
    const shift = transposeOctaves * 12
    if (melodicTracks.length) {
      const lo = Math.min(...melodicTracks.map((track) => track.minMidiNote)) + shift
      const hi = Math.max(...melodicTracks.map((track) => track.maxMidiNote)) + shift
      return { lo, hi }
    }
    if (!fileTracks.length) return null
    return {
      lo: Math.min(...fileTracks.map((track) => track.minMidiNote)),
      hi: Math.max(...fileTracks.map((track) => track.maxMidiNote)),
    }
  }, [melodicTracks, fileTracks, transposeOctaves])

  const rangeMarkers = useMemo<RangeMarker[]>(
    () =>
      melodicTracks.map((track) => {
        const presetId = instrumentAssignments[track.id]
        const range = MELODIC_INSTRUMENT_RANGES[presetId]
        return { lo: range.lo, hi: range.hi, label: `${track.name} → ${presetId}` }
      }),
    [melodicTracks, instrumentAssignments],
  )

  if (!parsedMidi.files.length) return null

  const transportDisabled = isLoading || Boolean(error)
  const displayedMs = scrubMs ?? elapsedMs
  const scrubDisabled = transportDisabled || !durationMs

  const commitScrub = () => {
    if (scrubMs !== null) {
      seek(scrubMs)
      setScrubMs(null)
    }
  }

  return (
    <section className="panel playback-panel">
      <div className="panel-head">
        <h2>Preview</h2>
        <p>Listen to the uploaded MIDI before converting.</p>
      </div>

      {parsedMidi.files.length > 1 && (
        <label className="playback-file-select">
          Preview file
          <select
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
          >
            {parsedMidi.files.map((file, index) => (
              <option key={`${file.name}-${index}`} value={index}>
                {file.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="playback-transport">
        <button
          type="button"
          className="action"
          onClick={isPlaying ? pause : play}
          disabled={transportDisabled}
        >
          <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>
        <button
          type="button"
          className="action"
          onClick={restart}
          disabled={transportDisabled || (elapsedMs === 0 && !isPlaying)}
        >
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
          <span>Restart</span>
        </button>
        <input
          type="range"
          className="playback-scrubber"
          min={0}
          max={durationMs || 1}
          step={100}
          value={displayedMs}
          aria-label="Seek"
          onChange={(event) => setScrubMs(Number(event.target.value))}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
          disabled={scrubDisabled}
        />
        <span className="playback-time">
          {formatTime(displayedMs)} / {formatTime(durationMs)}
        </span>
      </div>

      {displayedRange && (
        <div className="playback-keyboard">
          <PianoRange
            lo={displayedRange.lo}
            hi={displayedRange.hi}
            displayLo={PIANO_LO}
            displayHi={PIANO_HI}
            markers={rangeMarkers}
          />
          <p className="playback-keyboard-caption">
            {rangeMarkers.length > 0 && transposeOctaves !== 0
              ? `After ${transposeOctaves > 0 ? '+' : ''}${transposeOctaves} oct, notes land at ${noteName(displayedRange.lo)}–${noteName(displayedRange.hi)} · brackets = each track’s instrument range`
              : rangeMarkers.length > 0
                ? `Notes used: ${noteName(displayedRange.lo)}–${noteName(displayedRange.hi)} · brackets = each track’s instrument range`
                : `Notes used: ${noteName(displayedRange.lo)}–${noteName(displayedRange.hi)} (MIDI ${displayedRange.lo}–${displayedRange.hi})`}
          </p>
        </div>
      )}

      {!error && !soundFontProgress.done && soundFontProgress.total > 0 && (
        <p className="status">
          Loading piano sound… {Math.round((soundFontProgress.loaded / soundFontProgress.total) * 100)}%
        </p>
      )}

      {error && <p className="status error">{error}</p>}
    </section>
  )
}
