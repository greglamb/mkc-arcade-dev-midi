import { MAKECODE_MELODIC_INSTRUMENT_PRESETS, type MidiTrackSummary } from '../lib/makecodeSong'

interface TrackCardProps {
  track: MidiTrackSummary
  isDrum: boolean
  instrumentPresetId: string
  onDrumToggle: (trackId: number, isDrum: boolean) => void
  onInstrumentChange: (trackId: number, presetId: string) => void
}

export function TrackCard({ track, isDrum, instrumentPresetId, onDrumToggle, onInstrumentChange }: TrackCardProps) {
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
    </article>
  )
}
