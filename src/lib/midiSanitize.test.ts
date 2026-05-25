import { describe, expect, it } from 'vitest'
import { parseMidi, writeMidi } from 'midi-file'
import { sanitizeMidi } from './midiSanitize'

describe('sanitizeMidi', () => {
  it('removes bank-select CCs and rewrites every programChange to 0', () => {
    const input = {
      header: { format: 1, numTracks: 1, ticksPerBeat: 480 },
      tracks: [
        [
          { deltaTime: 0, type: 'controller', channel: 0, controllerType: 0, value: 1 },
          { deltaTime: 0, type: 'controller', channel: 0, controllerType: 32, value: 2 },
          { deltaTime: 0, type: 'controller', channel: 0, controllerType: 7, value: 100 },
          { deltaTime: 0, type: 'programChange', channel: 0, programNumber: 42 },
          { deltaTime: 0, type: 'noteOn', channel: 0, noteNumber: 60, velocity: 80 },
          { deltaTime: 240, type: 'noteOff', channel: 0, noteNumber: 60, velocity: 0 },
          { deltaTime: 0, type: 'endOfTrack', meta: true },
        ],
      ],
    }

    const inputBytes = new Uint8Array(writeMidi(input as Parameters<typeof writeMidi>[0]))
    const cleaned = sanitizeMidi(inputBytes.buffer)
    const parsed = parseMidi(cleaned)
    const track = parsed.tracks[0]

    const controllerTypes = track
      .filter((event) => event.type === 'controller')
      .map((event) => (event as { controllerType: number }).controllerType)

    expect(controllerTypes).not.toContain(0)
    expect(controllerTypes).not.toContain(32)
    expect(controllerTypes).toContain(7)

    const programChanges = track.filter((event) => event.type === 'programChange')
    expect(programChanges).toHaveLength(1)
    expect((programChanges[0] as { programNumber: number }).programNumber).toBe(0)

    expect(track.filter((event) => event.type === 'noteOn')).toHaveLength(1)
    expect(track.filter((event) => event.type === 'noteOff')).toHaveLength(1)
  })
})
