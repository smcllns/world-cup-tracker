import { describe, it, expect } from 'vitest'
import { computeTable } from '../../src/ucl/utils/table.js'
import { zoneFor, ZONES } from '../../src/ucl/data/season.js'
import { CLUBS, espnEvent, tagged } from './fixtures.js'

const { ars, bar, psg, liv, rma, bay } = CLUBS
const game = (id, date, home, away, score, state = 'post') =>
  espnEvent({ id, date, home, away, state, score: score || [0, 0] })

const names = (rows) => rows.map((r) => r.club.name)

describe('computeTable', () => {
  it('awards points and sorts by points, then goal difference', () => {
    const rows = computeTable(
      tagged([
        game(1, '2026-09-08T19:00Z', ars, bar, [3, 0]),
        game(2, '2026-09-08T19:00Z', liv, psg, [1, 1]),
        game(3, '2026-10-21T19:00Z', bar, liv, [0, 2]),
      ]),
    )
    expect(names(rows)).toEqual(['Liverpool', 'Arsenal', 'Paris Saint-Germain', 'Barcelona'])
    expect(rows[0]).toMatchObject({ P: 2, W: 1, D: 1, L: 0, GF: 3, GA: 1, GD: 2, Pts: 4, rank: 1, zone: 'r16' })
    expect(rows[3]).toMatchObject({ P: 2, W: 0, L: 2, GD: -5, Pts: 0 })
  })

  it('lists every club with a fixture, scored or not, and ignores knockouts', () => {
    const rows = computeTable(
      tagged([
        game(1, '2026-11-04T19:00Z', rma, bay, null, 'pre'),
        game(2, '2027-03-10T20:00Z', ars, bar, [5, 0]),
      ]),
    )
    expect(names(rows)).toEqual(['Bayern Munich', 'Real Madrid'])
    expect(rows.every((r) => r.P === 0)).toBe(true)
  })

  it('counts a live score provisionally but not a postponed match', () => {
    const live = espnEvent({ id: 1, date: '2026-10-21T19:00Z', home: ars, away: bar, state: 'in', score: [0, 1] })
    const ppd = espnEvent({ id: 2, date: '2026-10-21T19:00Z', home: liv, away: psg, state: 'post', name: 'STATUS_POSTPONED', score: [2, 0] })
    const rows = computeTable(tagged([live, ppd]))
    expect(rows[0]).toMatchObject({ club: expect.objectContaining({ name: 'Barcelona' }), Pts: 3, awayW: 1, awayGF: 1 })
    expect(rows.find((r) => r.club.name === 'Liverpool').P).toBe(0)
  })

  it('breaks ties on goals scored, then away goals', () => {
    // Arsenal and Liverpool: 3 pts, +1 GD, 2 GF each — Liverpool scored theirs away.
    const rows = computeTable(
      tagged([
        game(1, '2026-09-08T19:00Z', ars, bar, [2, 1]),
        game(2, '2026-09-08T19:00Z', psg, liv, [1, 2]),
      ]),
    )
    expect(names(rows).slice(0, 2)).toEqual(['Liverpool', 'Arsenal'])
  })

  it('then wins, then opponents’ collective points', () => {
    // Bayern and Real Madrid level on everything of their own; Bayern's
    // opponent (Liverpool, 4 pts) outscored Real Madrid's (PSG, 1 pt).
    const rows = computeTable(
      tagged([
        game(1, '2026-09-08T19:00Z', bay, liv, [1, 1]),
        game(2, '2026-09-08T19:00Z', rma, psg, [1, 1]),
        game(3, '2026-10-21T19:00Z', liv, ars, [1, 0]),
        game(4, '2026-10-21T19:00Z', psg, bar, [0, 1]),
      ]),
    )
    const order = names(rows)
    expect(order.indexOf('Bayern Munich')).toBeLessThan(order.indexOf('Real Madrid'))
    expect(rows.find((r) => r.club.name === 'Bayern Munich').oppPts).toBe(4)
  })

  it('falls back to name when everything is level, and skips placeholder sides', () => {
    const rows = computeTable(
      tagged([
        game(1, '2026-09-08T19:00Z', rma, ars, null, 'pre'),
        game(2, '2026-09-08T19:00Z', ars, { displayName: 'TBD' }, [1, 0]),
      ]),
    )
    expect(names(rows)).toEqual(['Arsenal', 'Real Madrid'])
  })
})

describe('zones', () => {
  it('maps positions to where they lead', () => {
    expect([1, 8, 9, 24, 25, 36, 37].map(zoneFor)).toEqual(['r16', 'r16', 'po', 'po', 'out', 'out', 'out'])
    expect(ZONES.map((z) => z.key)).toEqual(['r16', 'po', 'out'])
  })
})
