import { describe, it, expect, beforeEach } from 'vitest'
import { readState, writeState } from '../src/utils/urlState.js'

const TZ = 'America/New_York'

beforeEach(() => window.history.replaceState(null, '', '/'))

describe('urlState', () => {
  it('reads sensible defaults from a bare URL', () => {
    const s = readState(TZ)
    expect(s.tz).toBe(TZ)
    expect(s.hideScores).toBe(false)
  })

  it('writes nothing for an all-default state (clean URL)', () => {
    writeState({ tz: TZ, hideScores: false }, TZ)
    expect(window.location.search).toBe('')
  })

  it('round-trips a non-default state through write then read', () => {
    writeState({ tz: 'Europe/London', hideScores: true }, TZ)
    expect(window.location.search).not.toBe('') // non-defaults are persisted
    const read = readState(TZ)
    expect(read.tz).toBe('Europe/London')
    expect(read.hideScores).toBe(true)
  })

  it('keeps tz out of the URL when it matches the detected zone', () => {
    writeState({ tz: TZ, hideScores: false }, TZ)
    expect(window.location.search).not.toMatch(/tz=/)
    // but a different tz IS written and read back
    writeState({ tz: 'Asia/Tokyo', hideScores: false }, TZ)
    expect(readState(TZ).tz).toBe('Asia/Tokyo')
  })
})
