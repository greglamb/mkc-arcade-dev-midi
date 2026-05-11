interface TransposeControlsProps {
  transposeOctaves: number
  drumTransposeOctaves: number
  beatsPerMinute: number
  onTransposeChange: (value: number) => void
  onDrumTransposeChange: (value: number) => void
  onBeatsPerMinuteChange: (value: number) => void
}

function clampOctaves(value: number): number {
  return Number.isNaN(value) ? 0 : Math.max(-4, Math.min(4, value))
}

function clampBeatsPerMinute(value: number): number {
  return Number.isNaN(value) ? 120 : Math.max(1, Math.min(400, Math.round(value)))
}

export function TransposeControls({
  transposeOctaves,
  drumTransposeOctaves,
  beatsPerMinute,
  onTransposeChange,
  onDrumTransposeChange,
  onBeatsPerMinuteChange,
}: TransposeControlsProps) {
  return (
    <div className="transpose-row">
      <label>
        Transpose Melodic Tracks
        <input
          type="number"
          min={-4}
          max={4}
          step={1}
          value={transposeOctaves}
          onChange={(event) => onTransposeChange(clampOctaves(Number(event.target.value)))}
        />
        <span className="unit-label">octaves</span>
      </label>
      <label>
        Transpose Drum Tracks
        <input
          type="number"
          min={-4}
          max={4}
          step={1}
          value={drumTransposeOctaves}
          onChange={(event) => onDrumTransposeChange(clampOctaves(Number(event.target.value)))}
        />
        <span className="unit-label">octaves</span>
      </label>
      <label>
        BPM
        <input
          type="number"
          min={1}
          max={400}
          step={1}
          value={beatsPerMinute}
          onChange={(event) => onBeatsPerMinuteChange(clampBeatsPerMinute(Number(event.target.value)))}
        />
        <span className="unit-label">beats/min</span>
      </label>
    </div>
  )
}
