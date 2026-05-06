import { useState, useRef } from 'react'

interface InstrumentInfo {
  name: string
  type: 'melodic' | 'drum'
  noteRange: string
  midiRange: string
}

const INSTRUMENT_INFO: InstrumentInfo[] = [
  // Melodic instruments
  { name: 'Dog', type: 'melodic', noteRange: 'D#3-G6', midiRange: '51-91' },
  { name: 'Duck', type: 'melodic', noteRange: 'D#3-G6', midiRange: '51-91' },
  { name: 'Cat', type: 'melodic', noteRange: 'D#4-G7', midiRange: '63-103' },
  { name: 'Fish', type: 'melodic', noteRange: 'D#2-G5', midiRange: '39-79' },
  { name: 'Car', type: 'melodic', noteRange: 'D#3-G6', midiRange: '51-91' },
  { name: 'Computer', type: 'melodic', noteRange: 'D#1-G4', midiRange: '27-67' },
  { name: 'Burger', type: 'melodic', noteRange: 'D#1-G4', midiRange: '27-67' },
  { name: 'Cherry', type: 'melodic', noteRange: 'D#2-G5', midiRange: '39-79' },
  { name: 'Lemon', type: 'melodic', noteRange: 'D#1-G4', midiRange: '27-67' },

  // Drum sounds
  { name: 'Neutral Kick', type: 'drum', noteRange: 'Note 0', midiRange: '0' },
  { name: 'Punchy Kick', type: 'drum', noteRange: 'Note 1', midiRange: '1' },
  { name: 'Booming Kick', type: 'drum', noteRange: 'Note 2', midiRange: '2' },
  { name: 'Snare 1', type: 'drum', noteRange: 'Note 3', midiRange: '3' },
  { name: 'Snare 2', type: 'drum', noteRange: 'Note 4', midiRange: '4' },
  { name: 'Hat 1', type: 'drum', noteRange: 'Note 5', midiRange: '5' },
  { name: 'Hat 2', type: 'drum', noteRange: 'Note 6', midiRange: '6' },
  { name: 'Hat 3', type: 'drum', noteRange: 'Note 7', midiRange: '7' },
  { name: 'Hat 4', type: 'drum', noteRange: 'Note 8', midiRange: '8' },
  { name: 'Double Hat', type: 'drum', noteRange: 'Note 9', midiRange: '9' },
  { name: 'Metallic', type: 'drum', noteRange: 'Note 10', midiRange: '10' },
  { name: 'Low Tom', type: 'drum', noteRange: 'Note 11', midiRange: '11' },
  { name: 'Mid Tom', type: 'drum', noteRange: 'Note 12', midiRange: '12' },
  { name: 'Hi Tom', type: 'drum', noteRange: 'Note 13', midiRange: '13' },
  { name: 'Lo Tom 2', type: 'drum', noteRange: 'Note 14', midiRange: '14' },
  { name: 'Mid Tom 2', type: 'drum', noteRange: 'Note 15', midiRange: '15' },
  { name: 'Hi Tom 2', type: 'drum', noteRange: 'Note 16', midiRange: '16' },
  { name: 'Thump 1', type: 'drum', noteRange: 'Note 17', midiRange: '17' },
  { name: 'Thump 2', type: 'drum', noteRange: 'Note 18', midiRange: '18' },
  { name: 'Cymbal', type: 'drum', noteRange: 'Note 19', midiRange: '19' },
  { name: 'Crash 1', type: 'drum', noteRange: 'Note 20', midiRange: '20' },
  { name: 'Crash 2', type: 'drum', noteRange: 'Note 21', midiRange: '21' },
  { name: 'Crash 3', type: 'drum', noteRange: 'Note 22', midiRange: '22' },
  { name: 'Buzzer', type: 'drum', noteRange: 'Note 23', midiRange: '23' }
]

export function InstrumentRangeTable() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [playingDrumIndex, setPlayingDrumIndex] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const melodicInstruments = INSTRUMENT_INFO.filter(i => i.type === 'melodic')
  const drumSounds = INSTRUMENT_INFO.filter(i => i.type === 'drum')

  const playDrumSound = async (drumIndex: number, drumName: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    setPlayingDrumIndex(drumIndex)

    const audioPath = `./samples/drum_instruments/drum_instrument_${drumIndex}_${drumName.toLowerCase().replace(/\s+/g, '_')}.wav`

    if (audioRef.current) {
      audioRef.current.src = audioPath
      try {
        await audioRef.current.play()
      } catch (error) {
        console.error('Failed to play audio:', error)
      }
    }
  }

  return (
    <section className="instrument-range-section">
      <div className="instrument-range-header">
        <h2>MakeCode Builtin Instrument & Drum Ranges</h2>
        <button
          className="collapse-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <>
          <p className="instrument-range-note">
            These are the recommended note ranges to use when composing songs for MakeCode Arcade.
          </p>

          <div className="instrument-tables">
            <div className="table-container">
              <h3>Melodic Instruments</h3>
              <table className="instrument-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Note Range</th>
                    <th>MIDI Notes</th>
                    <th>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {melodicInstruments.map(instrument => (
                    <tr key={instrument.name}>
                      <td>{instrument.name}</td>
                      <td>{instrument.noteRange}</td>
                      <td>{instrument.midiRange}</td>
                      <td>
                        <a
                          href={`./${instrument.name}-samples.zip`}
                          download
                          className="download-link"
                          title={`Download ${instrument.name} samples`}
                        >
                          ⬇ Samples
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-container">
              <div className="drum-header">
                <h3>Drum Sounds</h3>
                <a
                  href="./Drum-samples.zip"
                  download
                  className="download-link"
                  title="Download all drum samples"
                >
                  ⬇ Download All
                </a>
              </div>
              <table className="instrument-table">
                <thead>
                  <tr>
                    <th>Drum Sound</th>
                    <th>Note Range</th>
                    <th>MIDI Note</th>
                    <th>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {drumSounds.map((drum) => (
                    <tr key={drum.name}>
                      <td>{drum.name}</td>
                      <td>{drum.noteRange}</td>
                      <td>{drum.midiRange}</td>
                      <td>
                        <button
                          className={`play-button ${playingDrumIndex === parseInt(drum.midiRange) ? 'playing' : ''}`}
                          onClick={() => playDrumSound(parseInt(drum.midiRange), drum.name)}
                          title="Play preview"
                        >
                          ▶ Play
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <audio ref={audioRef} onEnded={() => setPlayingDrumIndex(null)} />
    </section>
  )
}
