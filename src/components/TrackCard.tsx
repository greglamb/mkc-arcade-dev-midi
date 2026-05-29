import {
  analyzeTrackRange,
  MAKECODE_MELODIC_INSTRUMENT_PRESETS,
  type MidiTrackSummary,
} from '../lib/makecodeSong'

interface TrackCardProps {
  track: MidiTrackSummary
  isDrum: boolean
  instrumentPresetId: string
  transposeOctaves: number
  onDrumToggle: (trackId: number, isDrum: boolean) => void
  onInstrumentChange: (trackId: number, presetId: string) => void
}

export function TrackCard({
  track,
  isDrum,
  instrumentPresetId,
  transposeOctaves,
  onDrumToggle,
  onInstrumentChange,
}: TrackCardProps) {
  const effectivePresetId = instrumentPresetId || MAKECODE_MELODIC_INSTRUMENT_PRESETS[0].id
  const rangeReport = isDrum ? null : analyzeTrackRange(track.midiNotes, effectivePresetId, transposeOctaves)
  const outOfRange = rangeReport ? rangeReport.below + rangeReport.above : 0

  const rangeParts: string[] = []
  if (rangeReport?.below) rangeParts.push(`${rangeReport.below} below`)
  if (rangeReport?.above) rangeParts.push(`${rangeReport.above} above`)
  const transposeSuffix =
    transposeOctaves !== 0 ? ` · after ${transposeOctaves > 0 ? '+' : ''}${transposeOctaves} oct` : ''

  return (
    <article className={`track-card${isDrum ? ' track-card--drum' : ''}`}>
      <div className="track-meta">
        <h3>{track.name}</h3>
        <p>
          Notes: {track.noteCount} · MIDI: {track.minMidiNote}-{track.maxMidiNote}
          {track.channel !== null && ` · Ch ${track.channel + 1}`}
        </p>
      </div>
      <label className="drum-toggle">
        <input
          type="checkbox"
          checked={isDrum}
          onChange={(event) => onDrumToggle(track.id, event.target.checked)}
        />
        Drum track
      </label>
      {!isDrum && (
        <label>
          MakeCode Instrument
          <select
            value={instrumentPresetId || MAKECODE_MELODIC_INSTRUMENT_PRESETS[0].id}
            onChange={(event) => onInstrumentChange(track.id, event.target.value)}
          >
            {MAKECODE_MELODIC_INSTRUMENT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {isDrum && <p className="drum-info">Uses MakeCode built-in drum kit</p>}
      {!isDrum && outOfRange > 0 && rangeReport && (
        <p className="track-range-warning">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{' '}
          {rangeParts.join(', ')} of {track.midiNotes.length} notes outside {effectivePresetId}'s range (
          {rangeReport.lo}–{rangeReport.hi}){transposeSuffix}
        </p>
      )}
    </article>
  )
}
