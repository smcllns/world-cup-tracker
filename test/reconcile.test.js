import { describe, it, expect } from 'vitest'
import { crossCheck, reconcileScores } from '../src/services/reconcile.js'
import { MATCHES } from '../src/data/matches.js'

const match1 = MATCHES.find((m) => m.num === 1) // Mexico v South Africa

// A source is { name, score(match) -> {home, away, ft} | null }.
const src = (name, rec) => ({ name, score: () => rec })

describe('crossCheck', () => {
  it('returns null when fewer than two sources have a final', () => {
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', null),
    ]
    expect(crossCheck(match1, sources)).toBeNull()
  })

  it('agrees across sources even when home/away orientation differs', () => {
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', { home: 'South Africa', away: 'Mexico', ft: [1, 2] }), // flipped, same result
      src('C', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
    ]
    const cc = crossCheck(match1, sources)
    expect(cc.count).toBe(3)
    expect(cc.agree).toBe(true)
  })

  it('flags disagreement', () => {
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', { home: 'Mexico', away: 'South Africa', ft: [2, 2] }),
    ]
    expect(crossCheck(match1, sources).agree).toBe(false)
  })
})

describe('reconcileScores', () => {
  it('lists every source score for disagreeing matches only', () => {
    const agree = [
      { name: 'OpenFootball', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
      { name: 'ESPN', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
    ]
    expect(reconcileScores(MATCHES, agree)).toEqual([])

    const disagree = [
      { name: 'OpenFootball', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
      { name: 'ESPN', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
      { name: 'TheSportsDB', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [3, 1] } : null) },
    ]
    const diffs = reconcileScores(MATCHES, disagree)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].num).toBe(1)
    expect(diffs[0].reports.map((r) => r.source)).toEqual(['OpenFootball', 'ESPN', 'TheSportsDB'])
  })
})
