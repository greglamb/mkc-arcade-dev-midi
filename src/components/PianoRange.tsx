// Inline SVG piano showing a playable/used note range.
// The display window defaults to C1–C8 (instrument table); callers can widen
// it (e.g. the preview player uses the full 88-key A0–C8). In-range keys are
// highlighted and middle C (C4) is marked when it falls inside the window.

const DEFAULT_DISPLAY_LO = 24 // C1
const DEFAULT_DISPLAY_HI = 108 // C8
const MIDDLE_C = 60 // C4

const WHITE_W = 14
const WHITE_H = 58
const BLACK_W = 9
const BLACK_H = 36
const LABEL_H = 14

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])
const isBlackKey = (midi: number) => BLACK_PITCH_CLASSES.has(((midi % 12) + 12) % 12)

interface PianoRangeProps {
  lo: number
  hi: number
  displayLo?: number
  displayHi?: number
}

export function PianoRange({
  lo,
  hi,
  displayLo = DEFAULT_DISPLAY_LO,
  displayHi = DEFAULT_DISPLAY_HI,
}: PianoRangeProps) {
  const whiteKeys: number[] = []
  const blackKeys: number[] = []
  for (let midi = displayLo; midi <= displayHi; midi++) {
    if (isBlackKey(midi)) blackKeys.push(midi)
    else whiteKeys.push(midi)
  }

  const whiteIndex = new Map<number, number>()
  whiteKeys.forEach((midi, index) => whiteIndex.set(midi, index))

  const totalWidth = whiteKeys.length * WHITE_W
  const totalHeight = WHITE_H + LABEL_H

  // Clamp the highlighted range to the display window so we never draw outside.
  const rangeLo = Math.max(lo, displayLo)
  const rangeHi = Math.min(hi, displayHi)
  const inRange = (midi: number) => midi >= rangeLo && midi <= rangeHi

  const showMiddleC = MIDDLE_C >= displayLo && MIDDLE_C <= displayHi
  const middleCx = (whiteIndex.get(MIDDLE_C) ?? 0) * WHITE_W + WHITE_W / 2

  return (
    <svg
      className="piano-range"
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={`Note range MIDI ${lo} to ${hi}${showMiddleC ? '; middle C marked' : ''}`}
    >
      {whiteKeys.map((midi) => (
        <rect
          key={`w${midi}`}
          x={(whiteIndex.get(midi) ?? 0) * WHITE_W}
          y={0}
          width={WHITE_W}
          height={WHITE_H}
          className={`piano-white${inRange(midi) ? ' piano-in' : ''}`}
        />
      ))}

      {blackKeys.map((midi) => {
        const leftWhite = whiteIndex.get(midi - 1) ?? 0
        return (
          <rect
            key={`b${midi}`}
            x={(leftWhite + 1) * WHITE_W - BLACK_W / 2}
            y={0}
            width={BLACK_W}
            height={BLACK_H}
            rx={1}
            className={`piano-black${inRange(midi) ? ' piano-in' : ''}`}
          />
        )
      })}

      {showMiddleC && (
        <>
          <circle className="piano-middle-c-dot" cx={middleCx} cy={WHITE_H - 9} r={3.2} />
          <text className="piano-middle-c-label" x={middleCx} y={totalHeight - 2} textAnchor="middle">
            C4
          </text>
        </>
      )}
    </svg>
  )
}
