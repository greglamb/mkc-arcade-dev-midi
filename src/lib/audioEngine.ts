import { WorkletSynthesizer } from 'spessasynth_lib'

const WORKLET_URL = `${import.meta.env.BASE_URL}spessasynth/spessasynth_processor.min.js`
const SOUNDFONT_URL = `${import.meta.env.BASE_URL}SalC5Light2.sf2`

let audioContextPromise: Promise<AudioContext> | null = null
let synthPromise: Promise<WorkletSynthesizer> | null = null
let soundFontPromise: Promise<ArrayBuffer> | null = null

export type SoundFontProgress = { loaded: number; total: number; done: boolean }
type ProgressListener = (progress: SoundFontProgress) => void
let currentProgress: SoundFontProgress = { loaded: 0, total: 0, done: false }
const progressListeners = new Set<ProgressListener>()

function emitProgress(next: SoundFontProgress) {
  currentProgress = next
  progressListeners.forEach((listener) => listener(next))
}

export function subscribeSoundFontProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener)
  listener(currentProgress)
  return () => {
    progressListeners.delete(listener)
  }
}

export function prefetchSoundFont(): Promise<ArrayBuffer> {
  if (!soundFontPromise) {
    soundFontPromise = (async () => {
      const response = await fetch(SOUNDFONT_URL)
      if (!response.ok) {
        throw new Error(`Failed to load SoundFont (${response.status})`)
      }
      const total = Number(response.headers.get('content-length') || 0)

      if (!response.body) {
        const buffer = await response.arrayBuffer()
        emitProgress({ loaded: buffer.byteLength, total: buffer.byteLength, done: true })
        return buffer
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.byteLength
        emitProgress({ loaded, total, done: false })
      }

      const merged = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.byteLength
      }
      emitProgress({ loaded, total: loaded, done: true })
      return merged.buffer
    })()
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
