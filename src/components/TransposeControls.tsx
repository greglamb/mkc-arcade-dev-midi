interface TransposeControlsProps {
  transposeOctaves: number
  drumTransposeOctaves: number
  onTransposeChange: (value: number) => void
  onDrumTransposeChange: (value: number) => void
}

function clampOctaves(value: number): number {
  return Number.isNaN(value) ? 0 : Math.max(-4, Math.min(4, value))
}

export function TransposeControls({
  transposeOctaves,
  drumTransposeOctaves,
  onTransposeChange,
  onDrumTransposeChange,
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
    </div>
  )
}
