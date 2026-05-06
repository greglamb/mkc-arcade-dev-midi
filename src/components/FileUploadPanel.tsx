interface FileUploadPanelProps {
  isLoading: boolean
  error: string
  onFilesSelected: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function FileUploadPanel({ isLoading, error, onFilesSelected }: FileUploadPanelProps) {
  return (
    <section className="panel upload-panel">
      <label className="upload-label" htmlFor="midi-file">
        <span className="upload-title">Select MIDI File(s)</span>
        <span className="upload-subtitle">
          Supports standard .mid and .midi files and combines them into one song
        </span>
        <input
          id="midi-file"
          type="file"
          accept=".mid,.midi,audio/midi,audio/x-midi"
          multiple
          onChange={onFilesSelected}
          disabled={isLoading}
        />
      </label>
      {isLoading && <p className="status">Parsing MIDI files...</p>}
      {error && <p className="status error">{error}</p>}
    </section>
  )
}
