import { useEffect, useMemo, useState } from 'react'
import { type ParsedMidiSummary } from '../lib/makecodeSong'
import { useMidiPlayer } from '../hooks/useMidiPlayer'
import { PianoRange } from './PianoRange'

interface PlaybackPanelProps {
  parsedMidi: ParsedMidiSummary
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

export function PlaybackPanel({ parsedMidi }: PlaybackPanelProps) {
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

  const noteRange = useMemo(() => {
    const tracks = parsedMidi.tracks.filter((track) => track.sourceFileName === selected?.name)
    if (!tracks.length) return null
    const lo = Math.min(...tracks.map((track) => track.minMidiNote))
    const hi = Math.max(...tracks.map((track) => track.maxMidiNote))
    return { lo, hi }
  }, [parsedMidi.tracks, selected?.name])

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

      {noteRange && (
        <div className="playback-keyboard">
          <PianoRange lo={noteRange.lo} hi={noteRange.hi} displayLo={PIANO_LO} displayHi={PIANO_HI} />
          <p className="playback-keyboard-caption">
            Notes used: {noteName(noteRange.lo)}–{noteName(noteRange.hi)} (MIDI {noteRange.lo}–{noteRange.hi})
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
