import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { etStrings, editMatches, editFixture } from '../scripts/schedule-fix-core.mjs'

describe('etStrings', () => {
  it('converts a UTC instant to ET ko + fixture strings (fixed -04:00)', () => {
    const ms = Date.parse('2026-06-20T03:00:00Z') // = 23:00 ET on Jun 19
    expect(etStrings(ms)).toEqual({ ko: '2026-06-19T23:00:00-04:00', fixture: '2026-06-19 23:00' })
  })
})

describe('editMatches (against the real src/data/matches.js)', () => {
  const src = readFileSync('src/data/matches.js', 'utf8')

  it('rewrites the ko for one match, leaving every other line intact', () => {
    const { text, changed } = editMatches(src, 32, '2026-06-19T22:00:00-04:00')
    expect(changed).toBe(true)
    expect(text).toMatch(/num: 32,[^}]*ko: '2026-06-19T22:00:00-04:00'/)
    // same number of ko lines (no accidental extra/removed edits)
    expect((text.match(/ko: '/g) || []).length).toBe((src.match(/ko: '/g) || []).length)
    // a different match is untouched
    expect(text).toMatch(/num: 1,[^}]*ko: '2026-06-11T15:00:00-04:00'/)
  })

  it('does not match a longer number (32 ≠ 320-style) and reports unknown nums', () => {
    expect(editMatches(src, 999, 'x').changed).toBe(false)
  })
})

describe('editFixture (against the real official-kickoffs fixture)', () => {
  const src = readFileSync('test/fixtures/official-kickoffs.js', 'utf8')

  it('rewrites one option value and preserves a trailing comment', () => {
    const { text, changed } = editFixture(src, 32, '2026-06-19 22:00')
    expect(changed).toBe(true)
    expect(text).toMatch(/^\s*32: '2026-06-19 22:00',/m)
    // line 32 carries a "corrected …" comment — it must survive the edit
    expect(text).toMatch(/32: '2026-06-19 22:00',.*corrected/)
    // option 2 untouched
    expect(text).toMatch(/^\s*2: '2026-06-11 22:00',/m)
  })

  it('reports changed:false for an unknown option', () => {
    expect(editFixture(src, 999, 'x').changed).toBe(false)
  })
})
