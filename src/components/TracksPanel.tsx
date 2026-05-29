import { useMemo } from 'react'
import {
  MAKECODE_MELODIC_INSTRUMENT_PRESETS,
  suggestMelodicTranspose,
  type ParsedMidiSummary,
} from '../lib/makecodeSong'
import { TrackCard } from './TrackCard'
import { TransposeControls } from './TransposeControls'

interface TracksPanelProps {
  parsedMidi: ParsedMidiSummary
  instrumentAssignments: Record<number, string>
  drumTrackIds: Set<number>
  transposeOctaves: number
  drumTransposeOctaves: number
  beatsPerMinute: number
  onInstrumentChange: (trackId: number, presetId: string) => void
  onDrumToggle: (trackId: number, isDrum: boolean) => void
  onTransposeChange: (value: number) => void
  onDrumTransposeChange: (value: number) => void
  onBeatsPerMinuteChange: (value: number) => void
  onGenerate: () => void
}

export function TracksPanel({
  parsedMidi,
  instrumentAssignments,
  drumTrackIds,
  transposeOctaves,
  drumTransposeOctaves,
  beatsPerMinute,
  onInstrumentChange,
  onDrumToggle,
  onTransposeChange,
  onDrumTransposeChange,
  onBeatsPerMinuteChange,
  onGenerate,
}: TracksPanelProps) {
  const totalNotes = useMemo(
    () => parsedMidi.tracks.reduce((sum, track) => sum + track.noteCount, 0),
    [parsedMidi],
  )

  const transposeSuggestion = useMemo(() => {
    const melodic = parsedMidi.tracks
      .filter((track) => !drumTrackIds.has(track.id))
      .map((track) => ({
        midiNotes: track.midiNotes,
        presetId: instrumentAssignments[track.id] || MAKECODE_MELODIC_INSTRUMENT_PRESETS[0].id,
      }))
    return suggestMelodicTranspose(melodic, transposeOctaves)
  }, [parsedMidi.tracks, drumTrackIds, instrumentAssignments, transposeOctaves])

  return (
    <section className="panel tracks-panel">
      <div className="panel-head">
        <h2>Track Instrument Mapping</h2>
        <p>
          {parsedMidi.fileNames.length} file(s) · {parsedMidi.tracks.length} tracks · {totalNotes} notes ·{' '}
          {beatsPerMinute} BPM
        </p>
      </div>

      <TransposeControls
        transposeOctaves={transposeOctaves}
        drumTransposeOctaves={drumTransposeOctaves}
        beatsPerMinute={beatsPerMinute}
        onTransposeChange={onTransposeChange}
        onDrumTransposeChange={onDrumTransposeChange}
        onBeatsPerMinuteChange={onBeatsPerMinuteChange}
      />

      {transposeSuggestion !== null && (
        <p className="transpose-suggestion">
          <i className="fa-solid fa-lightbulb" aria-hidden="true" /> Tip: set melodic transpose to{' '}
          {transposeSuggestion > 0 ? '+' : ''}
          {transposeSuggestion} octave{Math.abs(transposeSuggestion) === 1 ? '' : 's'} to fit more notes in range.
        </p>
      )}

      <div className="track-grid">
        {parsedMidi.tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            isDrum={drumTrackIds.has(track.id)}
            instrumentPresetId={instrumentAssignments[track.id]}
            transposeOctaves={transposeOctaves}
            onDrumToggle={onDrumToggle}
            onInstrumentChange={onInstrumentChange}
          />
        ))}
      </div>

      <button type="button" className="action" onClick={onGenerate}>
        Generate MakeCode Song Snippet
      </button>
    </section>
  )
}
