import { WorkletSynthesizer } from 'spessasynth_lib'

const WORKLET_URL = `${import.meta.env.BASE_URL}spessasynth/spessasynth_processor.min.js`
const SOUNDFONT_URL = `${import.meta.env.BASE_URL}SalC5Light2.sf2`

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
