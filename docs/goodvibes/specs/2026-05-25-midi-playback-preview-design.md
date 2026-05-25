# MIDI Playback Preview — Design

**Date:** 2026-05-25
**Status:** Approved
**Scope:** Add an in-browser audio preview of the uploaded MIDI file(s), rendered through a piano SoundFont, above the existing Track Instrument Mapping panel.

---

## Goal

Let the user hear what they just uploaded before they convert it to a MakeCode song. The MIDI files come from a Yamaha CLP-745 digital piano, so playback uses a piano-only SoundFont and remaps all non-GM voices to GM Acoustic Grand Piano.

## Non-goals

- Multi-instrument timbral fidelity (everything plays as piano).
- Seek/scrub bar.
- Volume control.
- Live MIDI input.
- Tempo or pitch manipulation during playback.
- A test framework (this codebase has none today; adding one is a separate decision).

## Requirements

1. New "Preview" panel sits between `FileUploadPanel` and `TracksPanel` and renders only when at least one MIDI file is parsed.
2. Transport: Play/Pause (single toggle) and Restart buttons.
3. Time readout: `mm:ss / mm:ss` (elapsed / total), tabular numerals.
4. When more than one file is uploaded, a `<select>` lets the user choose which file to preview; default is the first file. Switching files stops playback and resets elapsed to 0:00.
5. Audio uses the Salamander C5 Light SoundFont (~25 MB), served from `public/`.
6. Failures (sf2 fetch error, AudioContext init error, MIDI sanitize error) disable the transport and surface a one-line error message.

## Stack additions

- `midi-file` (npm) — used only to round-trip MIDI binaries for sanitization. Display-side parsing continues to use `@tonejs/midi`.
- `spessasynth_lib` (npm) — Web Audio synthesizer and sequencer.
- `public/SalamanderC5-Lite.sf2` — piano SoundFont (committed).
- `public/spessasynth/worklet_processor.js` — copied from `spessasynth_lib` (mechanism decided at implementation time; either Vite static-asset copy or a `?url` import).

## Architecture

```
public/
  SalamanderC5-Lite.sf2
  spessasynth/worklet_processor.js

src/
  lib/
    midiSanitize.ts          (new) — sanitizeMidi(raw: ArrayBuffer): Uint8Array
    audioEngine.ts           (new) — module-singleton: ensureAudioContext(),
                                       ensureSynth(sf2Buffer)
  hooks/
    useMidiPlayer.ts         (new) — wraps Sequencer; exposes transport state
  components/
    PlaybackPanel.tsx        (new) — file dropdown + transport + time readout
  App.tsx                    (edit) — render <PlaybackPanel> between
                                       FileUploadPanel and TracksPanel
  lib/makecodeSong.ts        (edit) — ParsedMidiSummary gains
                                       files: { name: string; buffer: ArrayBuffer }[]
  App.css                    (edit) — playback panel styles
```

The split matches existing conventions:
- `lib/` for pure data work.
- Stateful audio lifecycle isolated in a single hook.
- Presentational component consumes the hook.
- App.tsx adds one JSX line and the new prop flows through existing state.

## Components

### `audioEngine.ts`

Module-level singletons, no React.

- `ensureAudioContext(): Promise<AudioContext>` — creates `AudioContext` on first call, registers the SpessaSynth worklet module, returns the same instance on subsequent calls.
- `ensureSynth(sf2Buffer: ArrayBuffer): Promise<Synthetizer>` — instantiates `Synthetizer` once with the SoundFont; idempotent.

### `midiSanitize.ts`

Pure function:

- `sanitizeMidi(raw: ArrayBuffer): Uint8Array`
  - Parse with `midi-file`.
  - For every track event: drop `controller` events where `controllerType` is 0 or 32 (Bank Select MSB/LSB).
  - Rewrite every `programChange` event so `programNumber === 0` (GM Acoustic Grand Piano).
  - Re-serialize via `writeMidi` and return as `Uint8Array`.

Rationale: the CLP-745 emits Yamaha XG bank addresses; without remap, the synth falls back unpredictably and many notes go silent or wrong-timbre.

### `useMidiPlayer(rawBuffer: ArrayBuffer | null)`

Custom hook owning all transport state.

- State: `isPlaying`, `elapsedMs`, `durationMs`, `isLoading`, `error`.
- Effect on `rawBuffer` change: tear down any existing `Sequencer`, sanitize the new buffer, instantiate a fresh `Sequencer`, read `duration`, reset `elapsedMs` to 0.
- Effect on mount: kick off SoundFont prefetch (network only, no AudioContext yet).
- `play()` — first call invokes `ensureAudioContext()` + `ensureSynth(sf2)` (awaiting the prefetch), then `sequencer.play()`. Sets `isLoading` true during init.
- `pause()` — `sequencer.pause()`.
- `restart()` — `sequencer.currentTime = 0`; auto-play if previously playing.
- A `requestAnimationFrame` loop polls `sequencer.currentTime` while playing and updates `elapsedMs`. Cancelled on pause and unmount.
- Cleanup on unmount: stop sequencer, cancel rAF, leave AudioContext + Synth alive (they're module singletons).

### `PlaybackPanel.tsx`

Presentational. Props: `parsedMidi: ParsedMidiSummary`.

- Local state: `selectedFileIndex` (default 0).
- Renders a `<select>` when `parsedMidi.files.length > 1`.
- Calls `useMidiPlayer(parsedMidi.files[selectedFileIndex].buffer)`.
- Renders Play/Pause toggle, Restart, and time readout.
- Renders an inline error row when `error` is non-empty; disables transport in that state.

## Data flow

```
FileUploadPanel
   ↓ onFilesSelected(File[])
App.handleFilesSelected
   ↓ parseMidiFiles(files)   ← captures raw ArrayBuffers alongside parsed data
ParsedMidiSummary { files: [{name, buffer}], tracks, ... }
   ↓ prop
PlaybackPanel
   ↓ useMidiPlayer(files[selectedFileIndex].buffer)
sanitize → Sequencer → AudioContext destination → speakers
```

App.tsx changes:
1. No new state in App itself — the existing `parsedMidi` carries the raw buffers.
2. One new JSX block: `{parsedMidi && <PlaybackPanel parsedMidi={parsedMidi} />}` between FileUploadPanel and TracksPanel.

## UI

```
┌─ section.panel.playback-panel ─────────────────────────────┐
│  ┌─ panel-head ─────────────────────────────────────────┐  │
│  │  <h2>Preview</h2>                                    │  │
│  │  <p>Listen to the uploaded MIDI before converting.</p>│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [▼ song-name.mid       ]    ← only when files.length > 1  │
│                                                             │
│  [▶ Play] [↺ Restart]              0:14 / 2:37              │
└─────────────────────────────────────────────────────────────┘
```

- Section uses existing `.panel` class.
- Buttons reuse `.action`.
- Icons via existing FontAwesome lib: `fa-solid fa-play`, `fa-pause`, `fa-rotate-left`.
- Play/Pause is a single toggle button (swaps icon + label based on `isPlaying`).
- Time readout right-aligned, `font-variant-numeric: tabular-nums`.
- Dropdown styled to match existing instrument `<select>` in `TrackCard`.

New CSS lives in `App.css` under a `/* playback panel */` section, ~30–40 lines.

## Error handling

| Failure | Surface |
|---|---|
| SoundFont fetch fails | `error` set in hook; PlaybackPanel renders `<p className="status error">`; transport disabled. Retry implicit via next Play click. |
| AudioContext init fails | Same channel and disabled state. |
| `sanitizeMidi` throws (corrupt MIDI) | Same channel. Upload-time `@tonejs/midi` parse usually catches truly broken files first; this is a backstop. |

Non-errors:
- Play clicked before sf2 prefetch finishes: `isLoading: true`, the click is honored by deferring `sequencer.play()` until ready. No error.
- File switch mid-playback: teardown + rebuild via the effect. No error.

## Init timing decision

Hybrid:
- SoundFont fetched on PlaybackPanel mount (network only, no audio resources).
- AudioContext + Synth instantiated on first Play click (satisfies browser autoplay policy without wasting resources for visitors who never preview).

Rejected alternatives:
- Lazy everything → ~1s delay on first Play feels sluggish.
- Eager on upload → conflates file-parse with audio init; the upload gesture is the eligible user-gesture but binding audio there means audio resources get spun up even for users who never preview.

## State location decision

Custom hook + single presentational component.

Rejected alternatives:
- All state in App.tsx → App is already growing; new transport state (isPlaying, elapsedMs, durationMs, isLoading, error) plus selectedFileIndex would bloat it further. The codebase's existing pattern is "App owns *cross-component* state" — playback transport is local to one component.
- Context provider → only one consumer; pure overhead.

## Verification (manual)

No test framework exists in this repo. Verification is against the dev server:

1. Upload a single `.mid` from a CLP-745 → Play → confirm piano timbre (not the GM-fallback sine that would prove sanitization is broken).
2. Pause mid-song → Play → resumes at same elapsed.
3. Restart → returns to 0:00 and continues playing.
4. Upload 2 files → dropdown appears → switching mid-play stops and resets.
5. Hard-reload offline, upload, Play → error surfaces, transport disabled.

## Attribution

Add to footer or About-equivalent (mechanism deferred to impl):

> Piano samples derived from Salamander Grand Piano by Alexander Holm (public domain).

## Risks & open questions

- **Vite + AudioWorklet asset path**: SpessaSynth ships `worklet_processor.js` inside the package. The exact path (`?url` import vs. manual copy into `public/spessasynth/`) is decided at implementation time after inspecting the package layout.
- **Build size**: committing the 25 MB sf2 grows the repo. Acceptable per user decision; first visit downloads it once, then browser-cached.
- **Vite SSR / dev-mode oddities**: AudioWorklet only works in browser context. Vite dev should be fine; flagged here for awareness.

## Rejected approaches

- Concatenating multi-file playback into a single sequencer queue — preview wouldn't match the converted song's combined timing anyway; dropdown is simpler and more controllable.
- CDN-hosted soundfont — adds a third-party dependency; sites.google.com (the canonical Salamander C5 Light home) is not hotlink-friendly.
- git-lfs for the sf2 — GH Pages doesn't serve LFS files directly; would need extra CI plumbing.
