// Inline SVG piano showing an instrument's safe playable range.
// Displays a fixed window (C1–C8) so every instrument's keyboard lines up,
// highlights the in-range keys, and marks middle C (C4).

const DISPLAY_LO = 24 // C1
const DISPLAY_HI = 108 // C8
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
}

export function PianoRange({ lo, hi }: PianoRangeProps) {
  const whiteKeys: number[] = []
  const blackKeys: number[] = []
  for (let midi = DISPLAY_LO; midi <= DISPLAY_HI; midi++) {
    if (isBlackKey(midi)) blackKeys.push(midi)
    else whiteKeys.push(midi)
  }

  const whiteIndex = new Map<number, number>()
  whiteKeys.forEach((midi, index) => whiteIndex.set(midi, index))

  const totalWidth = whiteKeys.length * WHITE_W
  const totalHeight = WHITE_H + LABEL_H
  const inRange = (midi: number) => midi >= lo && midi <= hi

  const middleCx = (whiteIndex.get(MIDDLE_C) ?? 0) * WHITE_W + WHITE_W / 2

  return (
    <svg
      className="piano-range"
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={`Playable range MIDI ${lo} to ${hi}; middle C marked`}
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

      <circle className="piano-middle-c-dot" cx={middleCx} cy={WHITE_H - 9} r={3.2} />
      <text className="piano-middle-c-label" x={middleCx} y={totalHeight - 2} textAnchor="middle">
        C4
      </text>
    </svg>
  )
}
