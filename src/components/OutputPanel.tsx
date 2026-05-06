interface OutputPanelProps {
  output: string
  copyState: 'idle' | 'copied' | 'failed'
  onOutputChange: (value: string) => void
  onCopy: () => void
}

export function OutputPanel({ output, copyState, onOutputChange, onCopy }: OutputPanelProps) {
  return (
    <section className="panel output-panel">
      <div className="panel-head">
        <h2>MakeCode Arcade Output</h2>
        <p>Copy this and paste it into your MakeCode Arcade TypeScript project.</p>
      </div>

      <textarea
        value={output}
        onChange={(event) => onOutputChange(event.target.value)}
        placeholder="Generated TypeScript appears here after conversion..."
        spellCheck={false}
        rows={14}
      />

      <button type="button" className="action" onClick={onCopy} disabled={!output}>
        Copy to Clipboard
      </button>
      {copyState === 'copied' && <p className="status success">Copied.</p>}
      {copyState === 'failed' && (
        <p className="status error">Clipboard failed. Select and copy manually.</p>
      )}
    </section>
  )
}
