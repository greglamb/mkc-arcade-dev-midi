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
  seek: (ms: number) => void
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

  useEffect(() => {
    prefetchSoundFont().catch((caught) => {
      const message = caught instanceof Error ? caught.message : 'Failed to load piano sound.'
      setError(message)
    })
  }, [])

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
        seq.eventHandler.addEvent('songChange', 'useMidiPlayer-duration', () => {
          setDurationMs(Math.round(seq.duration * 1000))
        })
        seq.loadNewSongList([{ binary: cleaned.buffer as ArrayBuffer, fileName: 'preview.mid' }])
        sequencerRef.current = seq
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

  const seek = useCallback((ms: number) => {
    const seq = sequencerRef.current
    if (!seq) return
    const clamped = Math.max(0, Math.min(ms, durationMs))
    seq.currentTime = clamped / 1000
    setElapsedMs(clamped)
  }, [durationMs])

  return { isPlaying, isLoading, error, elapsedMs, durationMs, play, pause, restart, seek }
}
