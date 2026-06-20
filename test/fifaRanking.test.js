import { describe, it, expect } from 'vitest'
import { FIFA_RANK, byFifaRank } from '../src/data/fifaRanking.js'
import { TEAMS } from '../src/data/teams.js'

describe('FIFA ranking data', () => {
  it('covers all 48 teams with unique positions', () => {
    const names = Object.values(TEAMS).flat().map((t) => t.name)
    for (const n of names) expect(FIFA_RANK[n], `missing FIFA rank for ${n}`).toBeTypeOf('number')
    expect(new Set(names.map((n) => FIFA_RANK[n])).size).toBe(names.length)
  })
})

describe('byFifaRank', () => {
  it('orders the better-ranked (lower number) team first', () => {
    expect(byFifaRank('Argentina', 'France')).toBeLessThan(0) // 1 vs 3
    expect(byFifaRank('Spain', 'Cape Verde')).toBeLessThan(0) // 2 vs 67
    expect(byFifaRank('Cape Verde', 'Spain')).toBeGreaterThan(0)
    expect(byFifaRank('Spain', 'Spain')).toBe(0)
  })

  it('sorts a list by ranking', () => {
    const sorted = ['Cape Verde', 'Spain', 'USA', 'Argentina'].sort(byFifaRank)
    expect(sorted).toEqual(['Argentina', 'Spain', 'USA', 'Cape Verde'])
  })

  it('sends unlisted teams last, breaking ties alphabetically', () => {
    expect(byFifaRank('Spain', 'Atlantis')).toBeLessThan(0) // listed beats unlisted
    expect(byFifaRank('Atlantis', 'Spain')).toBeGreaterThan(0)
    expect(byFifaRank('Wakanda', 'Atlantis')).toBeGreaterThan(0) // both unlisted → alphabetical
  })
})
