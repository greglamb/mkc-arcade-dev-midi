# MIDI Playback Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `goodvibes:executing-plans` (default) or `goodvibes:subagent-driven-development` (opt-in for high-risk or unfamiliar work) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-browser MIDI playback preview above the Track Instrument Mapping panel, rendered through the Salamander C5 Light piano SoundFont, with play / pause / restart controls and elapsed-total time readout.

**Architecture:** A module-singleton audio engine (`audioEngine.ts`) lazily boots the Web Audio context and SpessaSynth synthesizer on first Play. A custom hook (`useMidiPlayer`) owns transport state per file and drives a presentational `PlaybackPanel`. Raw MIDI buffers flow through the existing `ParsedMidiSummary` shape; before each playback the buffer is sanitized (strip Bank Select CCs, force Program Change → 0) to compensate for the Yamaha CLP-745's XG bank addresses.

**Tech Stack:** React 19 + Vite, `spessasynth_lib` (Web Audio synth + sequencer), `midi-file` (binary round-trip for sanitization), `@tonejs/midi` (already in use for display parsing — unchanged), Salamander C5 Light `.sf2` (public domain piano SoundFont).

**Reference spec:** `docs/goodvibes/specs/2026-05-25-midi-playback-preview-design.md`

**Testing note:** This repo has no test framework. Verification is `npm run build` (TS typecheck + Vite build) plus a short manual smoke list at the end. Do **not** add a test framework as part of this plan.

---

## File Map

**Create:**
- `src/lib/midiSanitize.ts` — pure function, ArrayBuffer in → Uint8Array out
- `src/lib/audioEngine.ts` — `ensureAudioContext()`, `ensureSynth()` singletons
- `src/hooks/useMidiPlayer.ts` — transport state hook
- `src/components/PlaybackPanel.tsx` — preview UI
- `public/SalamanderC5-Lite.sf2` — SoundFont (user-supplied)
- `public/spessasynth/spessasynth_processor.min.js` — worklet processor (copied from node_modules)

**Modify:**
- `package.json` — add `midi-file`, `spessasynth_lib` deps
- `src/lib/makecodeSong.ts` — extend `ParsedMidiSummary` with `files: { name: string; buffer: ArrayBuffer }[]`; populate in `parseMidi`/`parseMidiFiles`
- `src/App.tsx` — render `<PlaybackPanel parsedMidi={parsedMidi} />` between `FileUploadPanel` and `TracksPanel`
- `src/App.css` — playback panel styles

---

## Task 1 — Install dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Add the two new runtime deps**

Run:
```bash
npm install midi-file spessasynth_lib
```

- [ ] **Step 2: Verify install succeeded**

Run:
```bash
node -e "console.log(require('spessasynth_lib/package.json').version, require('midi-file/package.json').version)"
```
Expected: prints two version numbers, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "add midi-file and spessasynth_lib deps"
```

---

## Task 2 — Place static audio assets

**Files:** `public/SalamanderC5-Lite.sf2`, `public/spessasynth/spessasynth_processor.min.js`

- [ ] **Step 1: User supplies the SoundFont**

The Salamander C5 Light `.sf2` is ~25 MB and not redistributable through npm. The user must download it from <https://sites.google.com/view/hed-sounds/salamander-c5-light> and save it to `public/SalamanderC5-Lite.sf2` before this plan can be verified end-to-end. If the file is not present, pause and ask the user to place it.

Run to check:
```bash
ls -lh public/SalamanderC5-Lite.sf2
```
Expected: file exists, ~25 MB.

- [ ] **Step 2: Locate the spessasynth worklet processor in node_modules**

Run:
```bash
find node_modules/spessasynth_lib -name "*processor*.js" -not -path "*/node_modules/*"
```
Expected: prints at least one path; the file named `spessasynth_processor.min.js` is the one to use. If the filename differs in your installed version, use that name throughout the plan (and update the import path in Task 4).

- [ ] **Step 3: Copy it into public/**

Run (substitute the path found above if different):
```bash
mkdir -p public/spessasynth
cp node_modules/spessasynth_lib/dist/spessasynth_processor.min.js public/spessasynth/spessasynth_processor.min.js
```

- [ ] **Step 4: Verify it serves**

Run:
```bash
npm run build
ls -lh dist/spessasynth/ dist/SalamanderC5-Lite.sf2
```
Expected: both assets present in `dist/`.

- [ ] **Step 5: Commit**

```bash
git add public/SalamanderC5-Lite.sf2 public/spessasynth/spessasynth_processor.min.js
git commit -m "add salamander soundfont and spessasynth worklet assets"
```

---

## Task 3 — Implement `midiSanitize.ts`

**Files:**
- Create: `src/lib/midiSanitize.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/midiSanitize.ts`:

```typescript
import { parseMidi, writeMidi } from 'midi-file'

export function sanitizeMidi(raw: ArrayBuffer): Uint8Array {
  const parsed = parseMidi(new Uint8Array(raw))

  parsed.tracks = parsed.tracks.map((track) =>
    track
      .filter((event) => {
        if (event.type !== 'controller') return true
        return event.controllerType !== 0 && event.controllerType !== 32
      })
      .map((event) =>
        event.type === 'programChange' ? { ...event, programNumber: 0 } : event,
      ),
  )

  return new Uint8Array(writeMidi(parsed))
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run build
```
Expected: build succeeds. If `midi-file` types are missing, install `@types/midi-file` if it exists, otherwise add a one-line module declaration in `src/vite-env.d.ts` (`declare module 'midi-file'`). Prefer real types if available.

- [ ] **Step 3: Commit**

```bash
git add src/lib/midiSanitize.ts
git commit -m "add midiSanitize: strip bank-select CCs, force program change to 0"
```

---

## Task 4 — Implement `audioEngine.ts`

**Files:**
- Create: `src/lib/audioEngine.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/audioEngine.ts`:

```typescript
import { WorkletSynthesizer } from 'spessasynth_lib'

const WORKLET_URL = '/spessasynth/spessasynth_processor.min.js'
const SOUNDFONT_URL = '/SalamanderC5-Lite.sf2'

let audioContextPromise: Promise<AudioContext> | null = null
let synthPromise: Promise<WorkletSynthesizer> | null = null
let soundFontPromise: Promise<ArrayBuffer> | null = null

export function prefetchSoundFont(): Promise<ArrayBuffer> {
  if (!soundFontPromise) {
    soundFontPromise = fetch(SOUNDFONT_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load SoundFont (${response.status})`)
      }
      return response.arrayBuffer()
    })
  }
  return soundFontPromise
}

export function ensureAudioContext(): Promise<AudioContext> {
  if (!audioContextPromise) {
    audioContextPromise = (async () => {
      const ctx = new AudioContext()
      await ctx.audioWorklet.addModule(WORKLET_URL)
      return ctx
    })()
  }
  return audioContextPromise
}

export function ensureSynth(): Promise<WorkletSynthesizer> {
  if (!synthPromise) {
    synthPromise = (async () => {
      const [ctx, sf2] = await Promise.all([ensureAudioContext(), prefetchSoundFont()])
      const synth = new WorkletSynthesizer(ctx)
      synth.connect(ctx.destination)
      await synth.soundBankManager.addSoundBank(sf2, 'main')
      await synth.isReady
      return synth
    })()
  }
  return synthPromise
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/audioEngine.ts
git commit -m "add audioEngine: lazy singletons for AudioContext and WorkletSynthesizer"
```

---

## Task 5 — Extend `ParsedMidiSummary` with raw buffers

**Files:**
- Modify: `src/lib/makecodeSong.ts`

- [ ] **Step 1: Add `files` to the type**

In `src/lib/makecodeSong.ts`, change `ParsedMidiSummary`:

```typescript
export type ParsedMidiSummary = {
    fileNames: string[]
    files: { name: string; buffer: ArrayBuffer }[]
    beatsPerMinute: number
    beatsPerMeasure: number
    tracks: MidiTrackSummary[]
}
```

- [ ] **Step 2: Populate `files` in `parseMidi`**

In the same file, in the `parseMidi` function, retain the buffer and include it in the return value. Replace the existing return-shape construction so the function reads:

```typescript
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
```

- [ ] **Step 3: Merge `files` in `parseMidiFiles`**

In the same file, find `parseMidiFiles` (around line 95) and ensure its merge step concatenates `files` from each parsed result. The combined return must include:

```typescript
files: parsedFiles.flatMap((parsed) => parsed.files),
```

Add this alongside the existing `fileNames: parsedFiles.flatMap((parsed) => parsed.fileNames)`.

- [ ] **Step 4: Typecheck**

Run:
```bash
npm run build
```
Expected: build succeeds. If TS complains anywhere consuming `ParsedMidiSummary` because of the new required field, add the field to those construction sites — but it should only be `parseMidi` and `parseMidiFiles`.

- [ ] **Step 5: Manual smoke check**

Run:
```bash
npm run dev
```
Open the printed URL, upload a `.mid`, and confirm the existing app still works (tracks render, BPM populates). The new `files` field is unused by consumers so far, so behavior is unchanged.

Stop the dev server (`Ctrl-C`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/makecodeSong.ts
git commit -m "retain raw MIDI buffers on ParsedMidiSummary for playback preview"
```

---

## Task 6 — Implement `useMidiPlayer` hook

**Files:**
- Create: `src/hooks/useMidiPlayer.ts`

- [ ] **Step 1: Create the hooks directory and write the module**

Run:
```bash
mkdir -p src/hooks
```

Create `src/hooks/useMidiPlayer.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sequencer } from 'spessasynth_lib'
import { ensureAudioContext, ensureSynth, prefetchSoundFont } from '../lib/audioEngine'
import { sanitizeMidi } from '../lib/midiSanitize'

interface UseMidiPlayerResult {
  isPlaying: boolean
  isLoading: boolean
  error: string
  elapsedMs: number
  durationMs: number
  play: () => Promise<void>
  pause: () => void
  restart: () => Promise<void>
}

export function useMidiPlayer(rawBuffer: ArrayBuffer | null): UseMidiPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)

  const sequencerRef = useRef<Sequencer | null>(null)
  const rafRef = useRef<number | null>(null)
  const cleanedBufferRef = useRef<Uint8Array | null>(null)

  // Prefetch SoundFont when the hook is first used.
  useEffect(() => {
    prefetchSoundFont().catch((caught) => {
      const message = caught instanceof Error ? caught.message : 'Failed to load piano sound.'
      setError(message)
    })
  }, [])

  // Sanitize and stage the buffer when it changes.
  useEffect(() => {
    setIsPlaying(false)
    setElapsedMs(0)
    setDurationMs(0)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (sequencerRef.current) {
      try {
        sequencerRef.current.pause()
      } catch {
        // sequencer may already be torn down; ignore
      }
      sequencerRef.current = null
    }

    if (!rawBuffer) {
      cleanedBufferRef.current = null
      return
    }

    try {
      cleanedBufferRef.current = sanitizeMidi(rawBuffer)
      setError('')
    } catch (caught) {
      cleanedBufferRef.current = null
      const message = caught instanceof Error ? caught.message : 'Failed to read MIDI file.'
      setError(message)
    }
  }, [rawBuffer])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (sequencerRef.current) {
        try {
          sequencerRef.current.pause()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const startRafLoop = useCallback(() => {
    const tick = () => {
      const seq = sequencerRef.current
      if (!seq) return
      setElapsedMs(Math.round(seq.currentTime * 1000))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stopRafLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const play = useCallback(async () => {
    const cleaned = cleanedBufferRef.current
    if (!cleaned) return
    setIsLoading(true)
    try {
      const ctx = await ensureAudioContext()
      const synth = await ensureSynth()
      if (ctx.state === 'suspended') await ctx.resume()

      if (!sequencerRef.current) {
        const seq = new Sequencer(synth, { skipToFirstNoteOn: false })
        seq.loadNewSongList([{ binary: cleaned.buffer as ArrayBuffer, fileName: 'preview.mid' }])
        sequencerRef.current = seq
        setDurationMs(Math.round(seq.duration * 1000))
      }

      sequencerRef.current.play()
      setIsPlaying(true)
      setError('')
      startRafLoop()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to start playback.'
      setError(message)
      setIsPlaying(false)
    } finally {
      setIsLoading(false)
    }
  }, [startRafLoop])

  const pause = useCallback(() => {
    if (!sequencerRef.current) return
    sequencerRef.current.pause()
    setIsPlaying(false)
    stopRafLoop()
  }, [stopRafLoop])

  const restart = useCallback(async () => {
    const wasPlaying = isPlaying
    if (sequencerRef.current) {
      sequencerRef.current.currentTime = 0
      setElapsedMs(0)
    }
    if (!wasPlaying) {
      await play()
    }
  }, [isPlaying, play])

  return { isPlaying, isLoading, error, elapsedMs, durationMs, play, pause, restart }
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run build
```
Expected: build succeeds. If TS errors come from `Sequencer` constructor or property shapes, inspect `node_modules/spessasynth_lib/dist/*.d.ts` and align the call — the SpessaSynth API may differ slightly across minor versions. Prefer adjusting the call site over `as any`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMidiPlayer.ts
git commit -m "add useMidiPlayer hook: transport state over spessasynth sequencer"
```

---

## Task 7 — Implement `PlaybackPanel` component

**Files:**
- Create: `src/components/PlaybackPanel.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/PlaybackPanel.tsx`:

```tsx
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

  // Reset selection whenever the file list changes.
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
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlaybackPanel.tsx
git commit -m "add PlaybackPanel: preview UI with play/pause/restart and time readout"
```

---

## Task 8 — Wire `PlaybackPanel` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the component**

In `src/App.tsx`, add to the imports block (after the existing component imports):

```tsx
import { PlaybackPanel } from './components/PlaybackPanel'
```

- [ ] **Step 2: Render it between FileUploadPanel and TracksPanel**

In `src/App.tsx`, the JSX currently reads:

```tsx
      <FileUploadPanel isLoading={isLoading} error={error} onFilesSelected={handleFilesSelected} />

      {parsedMidi && (
        <TracksPanel
```

Insert the new block between them:

```tsx
      <FileUploadPanel isLoading={isLoading} error={error} onFilesSelected={handleFilesSelected} />

      {parsedMidi && <PlaybackPanel parsedMidi={parsedMidi} />}

      {parsedMidi && (
        <TracksPanel
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "wire PlaybackPanel between upload and tracks panels"
```

---

## Task 9 — Add CSS for the playback panel

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Append the styles**

Append to `src/App.css`:

```css
/* playback panel */
.playback-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.playback-file-select {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.875rem;
  max-width: 24rem;
}

.playback-file-select select {
  padding: 0.4rem 0.5rem;
  font: inherit;
}

.playback-transport {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.playback-transport .action {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.playback-time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-size: 0.95rem;
  opacity: 0.85;
}
```

- [ ] **Step 2: Visual smoke check**

Run:
```bash
npm run dev
```
Open the printed URL, upload a MIDI file, and confirm: the Preview panel appears above Track Instrument Mapping with the panel chrome, the two buttons sit on a row, and the time readout is right-aligned with monospace digits. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "style playback panel: transport row and tabular time readout"
```

---

## Task 10 — End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run:
```bash
npm run dev
```

- [ ] **Step 2: Single-file happy path**

1. Open the printed URL in a browser (Chrome or Safari).
2. Upload one `.mid` recorded on a CLP-745 (or any standard MIDI file).
3. Click **Play**.
4. Confirm: piano timbre (not a sine-fallback drone — that would prove sanitization is broken), elapsed time advances, total time shows a sensible value (not `0:00`).
5. Click **Pause** mid-song. Confirm elapsed freezes.
6. Click **Play**. Confirm playback resumes from the same position.
7. Click **Restart**. Confirm elapsed jumps to `0:00` and playback continues from the start.

- [ ] **Step 3: Multi-file switching**

1. Without reloading, upload two `.mid` files at once.
2. Confirm the file dropdown appears.
3. Start playback on file #1, then switch the dropdown to file #2 mid-play.
4. Confirm playback stops, elapsed resets to `0:00`, and total time updates to file #2's duration.
5. Click **Play**. Confirm file #2 plays.

- [ ] **Step 4: Error surface**

1. Stop the dev server.
2. Temporarily rename `public/SalamanderC5-Lite.sf2` to `.sf2.bak`.
3. Restart the dev server, upload, click Play.
4. Confirm: an error message appears in the panel and the transport buttons are disabled.
5. Stop the dev server. Restore the filename.

- [ ] **Step 5: Build still passes**

Run:
```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 6: No commit needed**

Verification only. If any step above fails, file a follow-up; do not mark the feature done.

---

## Self-review notes (filled in by plan author)

- **Spec coverage:** Every spec section is covered. Requirement 1 (placement) → Task 8. Requirement 2 (controls) → Task 7. Requirement 3 (time readout) → Tasks 7, 9. Requirement 4 (multi-file dropdown) → Tasks 7, 10. Requirement 5 (sf2 in public/) → Task 2. Requirement 6 (error surface) → Tasks 6, 7, 10.
- **Type consistency:** `ParsedMidiSummary.files` is `{ name; buffer }[]` everywhere it appears. `useMidiPlayer` returns the same shape consumed in `PlaybackPanel`.
- **Placeholder scan:** No TBD/TODO. The "if the worklet file is named differently in your version" instruction in Task 2 Step 2 is a real conditional, not a placeholder.
- **API risk:** `Sequencer.loadNewSongList` / `Sequencer.currentTime` / `Sequencer.duration` are documented in spessasynth_lib. The exact event-handler shape isn't relied on by this plan — we poll via rAF — so we won't be tripped up by version drift in the event names.
- **Rejected approach during plan construction:** Considered batching Tasks 3+4 into one "audio infra" commit; kept them separate because `midiSanitize` is independently usable and reviewable.
