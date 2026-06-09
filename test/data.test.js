import { describe, it, expect } from 'vitest'
import { MATCHES, STAGE_ORDER } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'
import { TEAMS, ALL_TEAMS } from '../src/data/teams.js'
import { BRACKET } from '../src/utils/bracket.js'

describe('schedule data integrity', () => {
  it('has all 104 matches', () => {
    expect(MATCHES).toHaveLength(104)
  })

  it('has the correct stage distribution', () => {
    const counts = MATCHES.reduce((a, m) => ((a[m.stage] = (a[m.stage] || 0) + 1), a), {})
    expect(counts).toEqual({ Group: 72, R32: 16, R16: 8, QF: 4, SF: 2, '3rd': 1, Final: 1 })
  })

  it('has unique match numbers 1–104', () => {
    const nums = MATCHES.map((m) => m.num).sort((a, b) => a - b)
    expect(new Set(nums).size).toBe(104)
    expect(nums[0]).toBe(1)
    expect(nums[103]).toBe(104)
  })

  it('references only known venues', () => {
    expect(MATCHES.every((m) => VENUES[m.venue])).toBe(true)
  })

  it('has a parseable kickoff instant for every match', () => {
    expect(MATCHES.every((m) => !Number.isNaN(new Date(m.ko).getTime()))).toBe(true)
  })

  it('is sorted chronologically', () => {
    for (let i = 1; i < MATCHES.length; i++) {
      expect(new Date(MATCHES[i].ko).getTime()).toBeGreaterThanOrEqual(
        new Date(MATCHES[i - 1].ko).getTime(),
      )
    }
  })

  it('every group match references a real team in its group', () => {
    for (const m of MATCHES.filter((m) => m.stage === 'Group')) {
      const names = TEAMS[m.group].map((t) => t.name)
      expect(names).toContain(m.t1)
      expect(names).toContain(m.t2)
    }
  })

  it('has 48 teams across 12 groups', () => {
    expect(Object.keys(TEAMS)).toHaveLength(12)
    expect(ALL_TEAMS).toHaveLength(48)
  })

  it('has 16 venues', () => {
    expect(Object.keys(VENUES)).toHaveLength(16)
  })

  it('bracket covers every knockout match exactly once', () => {
    const bracketNums = [
      ...BRACKET.left.R32, ...BRACKET.left.R16, ...BRACKET.left.QF, ...BRACKET.left.SF,
      ...BRACKET.final,
      ...BRACKET.right.SF, ...BRACKET.right.QF, ...BRACKET.right.R16, ...BRACKET.right.R32,
      ...BRACKET.third,
    ].sort((a, b) => a - b)
    const knockoutNums = MATCHES.filter((m) => m.stage !== 'Group')
      .map((m) => m.num)
      .sort((a, b) => a - b)
    expect(bracketNums).toEqual(knockoutNums)
  })

  it('exposes stages in tournament order', () => {
    expect(STAGE_ORDER).toEqual(['Group', 'R32', 'R16', 'QF', 'SF', '3rd', 'Final'])
  })
})
