import { describe, it, expect, vi } from 'vitest'
import {
  openFootballFinalScore,
  fetchResults,
  isRealTeam,
  pairKey,
} from '../src/services/results.js'
import { MATCHES } from '../src/data/matches.js'

const match1 = MATCHES.find((m) => m.num === 1) // Mexico v South Africa

describe('openFootballFinalScore (getter for the reconciler)', () => {
  it('returns null when there is no map', () => {
    expect(openFootballFinalScore(match1, null)).toBeNull()
  })

  it('returns null when the record has no final score', () => {
    const map = new Map([[pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', score: null }]])
    expect(openFootballFinalScore(match1, map)).toBeNull()
  })

  it('returns an oriented final when the record has a ft score', () => {
    const map = new Map([
      [pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', score: { ft: [2, 1] } }],
    ])
    expect(openFootballFinalScore(match1, map)).toEqual({ home: 'Mexico', away: 'South Africa', ft: [2, 1] })
  })
})

describe('fetchResults (goal parsing + error branches)', () => {
  it('parses goals (player/offset/penalty/owngoal) for both teams', async () => {
    const feed = {
      matches: [
        {
          round: 'Matchday 1',
          team1: 'Mexico',
          team2: 'South Africa',
          score: { ft: [1, 1] },
          goals1: [{ player: 'Scorer One', offset: 23, penalty: true }],
          goals2: [{ name: 'Scorer Two', minute: 67, owngoal: true }],
        },
        // goals not an array -> parseGoals returns []
        { round: 'Matchday 1', team1: 'Spain', team2: 'Morocco', score: { ft: [0, 0] }, goals1: null },
        // apiKey returns null (no num, not a known round) -> skipped
        { round: 'Unknown Round', team1: 'X', team2: 'Y' },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))

    const map = await fetchResults()
    const rec = map.get(pairKey('Mexico', 'South Africa'))
    expect(rec.g1).toEqual([{ name: 'Scorer One', minute: 23, penalty: true, og: false }])
    expect(rec.g2).toEqual([{ name: 'Scorer Two', minute: 67, penalty: false, og: true }])

    const spain = map.get(pairKey('Spain', 'Morocco'))
    expect(spain.g1).toEqual([])

    expect(map.has('pair:' + ['X', 'Y'].sort().join('|'))).toBe(false)
  })

  it('handles a goal with no name/minute (empty-name, null minute defaults)', async () => {
    const feed = {
      matches: [
        { round: 'Matchday 1', team1: 'Mexico', team2: 'South Africa', score: { ft: [1, 0] }, goals1: [{}] },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchResults()
    expect(map.get(pairKey('Mexico', 'South Africa')).g1).toEqual([
      { name: '', minute: null, penalty: false, og: false },
    ])
  })

  it('throws when the body is not valid JSON', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad json')
      },
    }))
    await expect(fetchResults()).rejects.toThrow(/not valid JSON/)
  })

  it('throws when matches[] is missing', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ notMatches: [] }) }))
    await expect(fetchResults()).rejects.toThrow(/missing a matches/)
  })

  it('parses a bare-array score (score is itself the ft pair)', async () => {
    const feed = {
      matches: [{ round: 'Matchday 1', team1: 'Mexico', team2: 'South Africa', score: [3, 2] }],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchResults()
    expect(map.get(pairKey('Mexico', 'South Africa')).score.ft).toEqual([3, 2])
  })

  it('treats an incomplete ft (null element) as no score', async () => {
    const feed = {
      matches: [{ round: 'Matchday 1', team1: 'Mexico', team2: 'South Africa', score: { ft: [1, null] } }],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchResults()
    expect(map.get(pairKey('Mexico', 'South Africa')).score).toBeNull()
  })
})

describe('isRealTeam', () => {
  it('false for placeholders, true for qualified sides', () => {
    expect(isRealTeam('2A')).toBe(false)
    expect(isRealTeam('Mexico')).toBe(true)
  })
})
