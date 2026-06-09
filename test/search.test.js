import { describe, it, expect } from 'vitest'
import { parseQuery, matchesSearch } from '../src/utils/search.js'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'

const count = (q) => {
  const p = parseQuery(q)
  return MATCHES.filter((m) => matchesSearch(m, VENUES[m.venue], p)).length
}

describe('parseQuery', () => {
  it('treats bare text as free text', () => {
    expect(parseQuery('Mexico')).toEqual({ free: 'Mexico', tokens: [] })
  })

  it('parses a single scoped token', () => {
    expect(parseQuery('team: Mexico')).toEqual({ free: '', tokens: [{ field: 'team', value: 'Mexico' }] })
  })

  it('parses multiple tokens, with or without spaces after the colon', () => {
    expect(parseQuery('team:USA city:Seattle')).toEqual({
      free: '',
      tokens: [
        { field: 'team', value: 'USA' },
        { field: 'city', value: 'Seattle' },
      ],
    })
  })

  it('maps field aliases (venue -> stadium, host -> country)', () => {
    expect(parseQuery('venue: SoFi').tokens[0].field).toBe('stadium')
    expect(parseQuery('host: Canada').tokens[0].field).toBe('country')
  })
})

describe('matchesSearch counts', () => {
  it('team: Mexico -> 3 group matches', () => {
    expect(count('team: Mexico')).toBe(3)
  })
  it('city: Dallas -> 9 (AT&T hosts the most)', () => {
    expect(count('city: Dallas')).toBe(9)
  })
  it('country: Canada -> 13', () => {
    expect(count('country: Canada')).toBe(13)
  })
  it('group: C -> 6', () => {
    expect(count('group: C')).toBe(6)
  })
  it('stage: Final -> 1', () => {
    expect(count('stage: Final')).toBe(1)
  })
  it('stadium: SoFi -> 8', () => {
    expect(count('stadium: SoFi')).toBe(8)
  })
  it('combines tokens: team: Brazil stage: group -> 3', () => {
    expect(count('team: Brazil stage: group')).toBe(3)
  })
  it('stage synonyms work (semi -> SF -> 2)', () => {
    expect(count('stage: semi')).toBe(2)
  })
  it('no-space form team:USA city:Seattle -> 1', () => {
    expect(count('team:USA city:Seattle')).toBe(1)
  })
})
