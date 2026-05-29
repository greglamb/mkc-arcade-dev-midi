# CLAUDE.md

Project notes for future Claude sessions. Keep concise; prefer code over prose.

## What this project is

A browser-based tool that converts MIDI files into [MakeCode Arcade](https://arcade.makecode.com/) song hex blobs. Forked from [riknoll/makecode-midi-converter](https://github.com/riknoll/makecode-midi-converter); deployed to GitHub Pages at https://greglamb.github.io/mkc-arcade-dev-midi/.

The user's primary input is MIDI recorded on a **Yamaha CLP-745** digital piano. Two distinct outputs:
1. **Preview player** — plays the MIDI as recorded, using the Salamander C5 Light piano SoundFont (`public/SalC5Light2.sf2`, 24 MB).
2. **MakeCode hex snippet** — embeds the song into MakeCode Arcade's constrained sound palette.

These two outputs sound quite different *by design*. The preview is the truth of what was recorded; the MakeCode output is a constrained projection.

## Hard constraints from the MakeCode target

These shape every conversion decision; don't fight them:

- **16 ticks per beat, fixed.** Anything finer than a 1/16th note quantizes. `scaleTiming` in `src/lib/makecodeSong.ts` does the rescaling.
- **Instruments cover narrow ranges** (e.g., Dog D#3–G6, Computer D#1–G4). See `InstrumentRangeTable.tsx`. Notes outside an instrument's range may play silent or wrong. The converter applies a default −3-octave melodic transpose and −2-octave drum transpose to shoehorn piano-range MIDI into instrument ranges.
- **Drums are a 16-slot kit** (kick, snare, hats, toms…), not GM drum-map. Arbitrary drum MIDIs won't map sensibly; users either remap manually or limit themselves.
- The asset-editor "Grid" dropdown controls the default duration for *newly placed* notes only — it does not rescale the canvas and does not retroactively change imported notes.

The upstream author's stated intent: *compose in a DAW knowing MakeCode's limits, then convert.* Not: import arbitrary pop-song MIDIs.

## Yamaha CLP-745 quirk

The CLP-745 emits Yamaha XG bank-select CCs (controller 0 and 32) plus non-zero program changes for its various voices. SpessaSynth's playback synth can't resolve XG bank addresses against a GM-only SoundFont and falls back unpredictably — many notes go silent or play wrong-timbre.

`src/lib/midiSanitize.ts` runs before playback:
- Strips every CC0 and CC32 event
- Rewrites every `programChange.programNumber` to `0` (GM Acoustic Grand Piano)

Test in `midiSanitize.test.ts`. **If you touch sanitization, run `npm test`.**

The MakeCode conversion path doesn't go through this sanitizer — MakeCode ignores program changes anyway since the user picks instruments per track in the UI.

## Architecture conventions

- **State lives in `App.tsx`**, components are presentational. The one exception is `useMidiPlayer` (transport state is too local to lift).
- **Sections** use `<section className="panel ...">` with a `panel-head` containing `<h2>` and a subtitle `<p>`.
- **Buttons** use the `.action` class.
- **Icons** via FontAwesome class names (`fa-solid fa-play`, etc.) — the lib is already in deps.
- **Styles**: plain CSS in `src/App.css`. No CSS-in-JS.
- `src/lib/` — pure data functions. `makecodeSong.ts` does the parse/encode pipeline; `pxt.ts` is the MakeCode hex encoder (large, mostly untouched).
- `src/hooks/` — stateful logic.
- `src/components/` — presentational React.
- **No barrel re-export files.** Import directly.

## Playback subsystem (added 2026-05-25)

- `audioEngine.ts` — module-singletons: `ensureAudioContext()`, `ensureSynth()`, `prefetchSoundFont()`, `subscribeSoundFontProgress()`. AudioContext + synth boot on first Play (autoplay policy); SoundFont prefetch starts on mount.
- `useMidiPlayer.ts` — wraps a SpessaSynth `Sequencer`; exposes `play / pause / restart / seek` + transport state. Notes:
  - `Sequencer.duration` is **not synchronously available** after `loadNewSongList`. Read it from the `songChange` event (already wired).
  - rAF loop polls `seq.currentTime`; pauses while user is scrubbing (`scrubMs` overrides displayed elapsed).
- `PlaybackPanel.tsx` is **lazy-loaded** via `React.lazy` in `App.tsx` to keep initial JS small (~250 KB vs ~510 KB unsplit).

## MakeCode asset editor iframe

Lives in `MakeCodeSongPreview.tsx`, loads `https://arcade.makecode.com/v4.1.4--asseteditor` in an iframe and exchanges postMessages.

**The asset editor ignores repeat `open` messages**, even with a different `assetId`. To refresh the preview when the song changes, we **remount the iframe** via `key={assetId}` where `assetId` is derived from a slice of the hex. A loading overlay shows "Updating preview…" until the next `ready` event fires.

Don't try to "fix" this by adding more postMessage protocol — we already tried that. Iframe remount is the working solution.

## Asset hosting

- `public/SalC5Light2.sf2` — 24 MB SoundFont, committed to git. Decision deliberate: keeps the app self-contained on GH Pages.
- `public/spessasynth/spessasynth_processor.min.js` — AudioWorklet processor, copied from `node_modules/spessasynth_lib/dist/`. If `spessasynth_lib` is upgraded, re-copy this file.
- Vite's `base: './'` means asset URLs need `import.meta.env.BASE_URL` to work on both localhost and the GH Pages subpath.

## Build, test, run

```bash
npm run dev       # vite dev server
npm run build     # tsc -b && vite build (also closest thing to a verify step)
npm test          # vitest run
npm run lint      # eslint
```

There are very few unit tests by intent — only `midiSanitize.test.ts`. The rest is verified by `npm run build` (TypeScript strict) and manual smoke tests against `npm run dev`. Don't add tests speculatively; do add tests for any new pure-data logic that has subtle correctness requirements (like sanitize).

## Deployment

- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Pages source: "GitHub Actions" (not branch-based)
- Pushes to `main` auto-build and deploy
- Vite `base: './'` produces relative asset paths that work at both `localhost:5173/` and `greglamb.github.io/mkc-arcade-dev-midi/`

The `gh-pages` npm package and `predeploy`/`deploy` scripts in `package.json` are leftover from upstream; they're not the live deploy path and can be ignored (or removed if they cause confusion).

## Git / commit conventions

- **Conventional Commits enforced by a hook** (`feat:`, `fix:`, `chore:`, `build:`, `style:`, `test:`, `docs:`, `refactor:`, `perf:`, `revert:`, `ci:`).
- First line ≤ 72 chars (also enforced).
- No `TODO.md` or `CHANGELOG.md` in this repo. The post-commit hook reminds about them; safe to dismiss every time.
- User prefers feature branches on the main worktree (not separate worktrees) for non-trivial features, and small fixes/polish straight to `main`. Push when ready; CI deploys automatically.

## Things that did *not* work and shouldn't be tried again

- Sending repeated `open` postMessages with the same assetId to the MakeCode asset editor — ignored. Use iframe remount.
- Using `gh-pages` package as the live deploy mechanism — was set up but never actually used; current deploy is via Actions.
- Reading `Sequencer.duration` synchronously after `loadNewSongList` — returns 0. Wait for `songChange`.

## Specs and plans

Long-form design decisions live in `docs/goodvibes/specs/` and `docs/goodvibes/plans/`. The MIDI preview player's design and plan are at:

- `docs/goodvibes/specs/2026-05-25-midi-playback-preview-design.md`
- `docs/goodvibes/plans/2026-05-25-midi-playback-preview.md`

Read these before making non-trivial changes to the playback subsystem.
