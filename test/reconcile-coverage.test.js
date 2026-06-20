import { describe, it, expect } from 'vitest'
import { crossCheck } from '../src/services/reconcile.js'
import { MATCHES } from '../src/data/matches.js'

const match1 = MATCHES.find((m) => m.num === 1)
const src = (name, rec) => ({ name, score: () => rec })

describe('crossCheck — reportsAgree orientation branches', () => {
  it('disagrees when a flipped (home==away) orientation does not match', () => {
    // b.home === a.away path: a Mexico-home [2,1] vs b South-Africa-home [2,1]
    // flips to compare a.ft[0]===b.ft[1] (2 vs 1) -> disagree.
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', { home: 'South Africa', away: 'Mexico', ft: [2, 1] }),
    ]
    expect(crossCheck(match1, sources).agree).toBe(false)
  })

  it('treats entirely different teams as not in conflict (agree stays true)', () => {
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', { home: 'Brazil', away: 'Croatia', ft: [9, 9] }), // unrelated -> no conflict
    ]
    const cc = crossCheck(match1, sources)
    expect(cc.count).toBe(2)
    expect(cc.agree).toBe(true)
  })
})
