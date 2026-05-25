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
