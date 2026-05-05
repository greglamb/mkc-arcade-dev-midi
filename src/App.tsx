import { useMemo, useState } from 'react'
import './App.css'
import {
  buildMakeCodeSongSnippet,
  guessInstrumentPreset,
  MAKECODE_MELODIC_INSTRUMENT_PRESETS,
  parseMidiFiles,
  type ParsedMidiSummary,
} from './lib/makecodeSong'
import { MakeCodeSongPreview } from './components/MakeCodeSongPreview'

function App() {
  const [parsedMidi, setParsedMidi] = useState<ParsedMidiSummary | null>(null)
  const [instrumentAssignments, setInstrumentAssignments] = useState<Record<number, string>>({})
  const [drumTrackIds, setDrumTrackIds] = useState<Set<number>>(new Set())
  const [transposeOctaves, setTransposeOctaves] = useState(0)
  const [drumTransposeOctaves, setDrumTransposeOctaves] = useState(0)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const totalNotes = useMemo(
    () => parsedMidi?.tracks.reduce((sum, track) => sum + track.noteCount, 0) || 0,
    [parsedMidi],
  )

  const generatedSongHex = useMemo(() => {
    const match = /hex`([a-fA-F0-9]+)`/.exec(output)
    return match?.[1] || ''
  }, [output])

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    if (!files.length) return

    try {
      setIsLoading(true)
      setError('')
      setOutput('')
      setCopyState('idle')
      setTransposeOctaves(0)
      setDrumTransposeOctaves(0)
      const drumTrackIds = new Set<number>();

      const parsed = await parseMidiFiles(files)
      setParsedMidi(parsed)

      const defaults: Record<number, string> = {}
      parsed.tracks.forEach((track, index) => {
        defaults[track.id] = guessInstrumentPreset(track.name, index)
        if (track.name.toLowerCase().includes('drum') || track.name.toLowerCase().includes('percussion')) {
          drumTrackIds.add(track.id)
        }
      })

      setInstrumentAssignments(defaults)
      setDrumTrackIds(drumTrackIds)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to parse MIDI files.'
      setParsedMidi(null)
      setInstrumentAssignments({})
      setError(message)
    } finally {
      setIsLoading(false)
      event.target.value = ''
    }
  }

  const generateSong = () => {
    if (!parsedMidi) {
      setError('Load a MIDI file before generating output.')
      return
    }

    try {
      setError('')
      const snippet = buildMakeCodeSongSnippet(parsedMidi, instrumentAssignments, {
        transposeOctaves,
        drumTransposeOctaves,
        drumTrackIds,
      })
      setOutput(snippet)
      setCopyState('idle')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to generate MakeCode song output.'
      setError(message)
    }
  }

  const copyToClipboard = async () => {
    if (!output) return

    try {
      await navigator.clipboard.writeText(output)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">MIDI to MakeCode Arcade</p>
        <h1>Turn Any MIDI into an Arcade Song Asset</h1>
        <p className="hero-copy">
          Upload one or more MIDI files, choose a MakeCode instrument for each track, then copy the generated
          TypeScript snippet.
        </p>
      </header>

      <section className="panel upload-panel">
        <label className="upload-label" htmlFor="midi-file">
          <span className="upload-title">Select MIDI File(s)</span>
          <span className="upload-subtitle">Supports standard .mid and .midi files and combines them into one song</span>
          <input
            id="midi-file"
            type="file"
            accept=".mid,.midi,audio/midi,audio/x-midi"
            multiple
            onChange={handleFileSelected}
            disabled={isLoading}
          />
        </label>
        {isLoading && <p className="status">Parsing MIDI files...</p>}
        {error && <p className="status error">{error}</p>}
      </section>

      {parsedMidi && (
        <section className="panel tracks-panel">
          <div className="panel-head">
            <h2>Track Instrument Mapping</h2>
            <p>
              {parsedMidi.fileNames.length} file(s) · {parsedMidi.tracks.length} tracks · {totalNotes} notes ·{' '}
              {parsedMidi.beatsPerMinute} BPM
            </p>
          </div>

          <div className="transpose-row">
            <label>
              Transpose Melodic Tracks
              <input
                type="number"
                min={-4}
                max={4}
                step={1}
                value={transposeOctaves}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setTransposeOctaves(Number.isNaN(next) ? 0 : Math.max(-4, Math.min(4, next)))
                }}
              />
              <span className="unit-label">octaves</span>
            </label>
            <label>
              Transpose Drum Tracks
              <input
                type="number"
                min={-4}
                max={4}
                step={1}
                value={drumTransposeOctaves}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setDrumTransposeOctaves(Number.isNaN(next) ? 0 : Math.max(-4, Math.min(4, next)))
                }}
              />
              <span className="unit-label">octaves</span>
            </label>
          </div>

          <div className="track-grid">
            {parsedMidi.tracks.map((track) => (
              <article
                key={track.id}
                className={`track-card${drumTrackIds.has(track.id) ? ' track-card--drum' : ''}`}
              >
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
                    checked={drumTrackIds.has(track.id)}
                    onChange={(event) => {
                      setDrumTrackIds((prev) => {
                        const next = new Set(prev)
                        if (event.target.checked) next.add(track.id)
                        else next.delete(track.id)
                        return next
                      })
                    }}
                  />
                  Drum track
                </label>
                {!drumTrackIds.has(track.id) && (
                  <label>
                    MakeCode Instrument
                    <select
                      value={instrumentAssignments[track.id] || MAKECODE_MELODIC_INSTRUMENT_PRESETS[0].id}
                      onChange={(event) => {
                        const next = event.target.value
                        setInstrumentAssignments((current) => ({
                          ...current,
                          [track.id]: next,
                        }))
                      }}
                    >
                      {MAKECODE_MELODIC_INSTRUMENT_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {drumTrackIds.has(track.id) && (
                  <p className="drum-info">Uses MakeCode built-in drum kit</p>
                )}
              </article>
            ))}
          </div>

          <button type="button" className="action" onClick={generateSong}>
            Generate MakeCode Song Snippet
          </button>
        </section>
      )}

      <section className="panel output-panel">
        <div className="panel-head">
          <h2>MakeCode Arcade Output</h2>
          <p>Copy this and paste it into your MakeCode Arcade TypeScript project.</p>
        </div>

        <textarea
          value={output}
          onChange={(event) => setOutput(event.target.value)}
          placeholder="Generated TypeScript appears here after conversion..."
          spellCheck={false}
          rows={14}
        />

        <button type="button" className="action" onClick={copyToClipboard} disabled={!output}>
          Copy to Clipboard
        </button>
        {copyState === 'copied' && <p className="status success">Copied.</p>}
        {copyState === 'failed' && (
          <p className="status error">Clipboard failed. Select and copy manually.</p>
        )}
      </section>

      {generatedSongHex && <MakeCodeSongPreview songHex={generatedSongHex} />}
    </main>
  )
}

export default App
