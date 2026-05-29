import { describe, expect, it } from 'vitest'
import { analyzeTrackRange, suggestMelodicTranspose } from './makecodeSong'

describe('analyzeTrackRange', () => {
  it('counts notes below and above the documented range', () => {
    // Dog is 51-91. 20 is below, 100 is above, 60 is in range.
    const report = analyzeTrackRange([20, 60, 100], 'Dog', 0)
    expect(report).toEqual({ below: 1, above: 1, lo: 51, hi: 91 })
  })

  it('applies the whole-octave transpose before comparing', () => {
    // −1 octave (−12): 60→48 (below 51), 100→88 (in range), 20→8 (below)
    const report = analyzeTrackRange([20, 60, 100], 'Dog', -1)
    expect(report).toEqual({ below: 2, above: 0, lo: 51, hi: 91 })
  })

  it('reports zero when every note is in range', () => {
    expect(analyzeTrackRange([60, 70, 80], 'Dog', 0)).toEqual({ below: 0, above: 0, lo: 51, hi: 91 })
  })

  it('treats range boundaries as in range', () => {
    expect(analyzeTrackRange([51, 91], 'Dog', 0)).toEqual({ below: 0, above: 0, lo: 51, hi: 91 })
  })

  it('returns null for unknown or missing presets', () => {
    expect(analyzeTrackRange([60], 'Drums', 0)).toBeNull()
    expect(analyzeTrackRange([60], undefined, 0)).toBeNull()
  })
})

describe('suggestMelodicTranspose', () => {
  it('suggests a shift that pulls notes into range', () => {
    // All notes at 100 (above Dog's 91). −1 octave → 88, in range.
    const suggestion = suggestMelodicTranspose([{ midiNotes: [100, 100], presetId: 'Dog' }], 0)
    expect(suggestion).toBe(-1)
  })

  it('returns null when nothing is out of range', () => {
    expect(suggestMelodicTranspose([{ midiNotes: [60], presetId: 'Dog' }], 0)).toBeNull()
  })

  it('returns null when no shift improves on the current one', () => {
    // A note 1000 semitones high cannot be fixed within ±4 octaves.
    expect(suggestMelodicTranspose([{ midiNotes: [1000], presetId: 'Dog' }], 0)).toBeNull()
  })

  it('balances conflicting tracks toward the fewest total out-of-range notes', () => {
    // Track A wants a downward shift, Track B is already centered.
    const suggestion = suggestMelodicTranspose(
      [
        { midiNotes: [103, 103, 103], presetId: 'Dog' }, // above 91 → wants −1
        { midiNotes: [60], presetId: 'Dog' }, // in range at 0, leaves range at −1
      ],
      0,
    )
    // −1 fixes 3 notes and breaks at most 1 → net improvement.
    expect(suggestion).toBe(-1)
  })
})
