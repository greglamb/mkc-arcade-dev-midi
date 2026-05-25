import { useEffect, useState } from 'react'
import { type ParsedMidiSummary } from '../lib/makecodeSong'
import { useMidiPlayer } from '../hooks/useMidiPlayer'

interface PlaybackPanelProps {
  parsedMidi: ParsedMidiSummary
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function PlaybackPanel({ parsedMidi }: PlaybackPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [parsedMidi.files])

  const selected = parsedMidi.files[selectedIndex] ?? parsedMidi.files[0]
  const { isPlaying, isLoading, error, elapsedMs, durationMs, play, pause, restart } =
    useMidiPlayer(selected?.buffer ?? null)

  if (!parsedMidi.files.length) return null

  const transportDisabled = isLoading || Boolean(error)

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
        <span className="playback-time">
          {formatTime(elapsedMs)} / {formatTime(durationMs)}
        </span>
      </div>

      {error && <p className="status error">{error}</p>}
    </section>
  )
}
