import { describe, it, expect } from 'vitest'
import {
  roundFor,
  tagMatches,
  buildTies,
  aggregateFor,
  roundLabel,
  matchTitle,
  isPlayed,
  isLive,
} from '../../src/ucl/utils/rounds.js'
import { CLUBS, espnEvent, parsed, tagged } from './fixtures.js'

const { ars, bar, psg, liv, rma, bay } = CLUBS

describe('roundFor', () => {
  it('places a kickoff on the nearest calendar round', () => {
    expect(roundFor('2026-09-10T19:00Z')).toMatchObject({ stage: 'League', matchday: 1 })
    expect(roundFor('2026-10-14T16:45Z')).toMatchObject({ stage: 'League', matchday: 2 })
    expect(roundFor('2026-10-21T19:00Z')).toMatchObject({ stage: 'League', matchday: 3 })
    expect(roundFor('2027-01-27T20:00Z')).toMatchObject({ stage: 'League', matchday: 8 })
    expect(roundFor('2027-02-24T20:00Z').stage).toBe('PO')
    expect(roundFor('2027-03-10T20:00Z').stage).toBe('R16')
    expect(roundFor('2027-04-14T19:00Z').stage).toBe('QF')
    expect(roundFor('2027-05-05T19:00Z').stage).toBe('SF')
    expect(roundFor('2027-06-05T19:00Z').stage).toBe('Final')
  })

  it('absorbs a rescheduled date a few days off the calendar', () => {
    expect(roundFor('2026-11-06T19:00Z')).toMatchObject({ matchday: 4 })
  })

  it('returns null with no calendar', () => {
    expect(roundFor('2026-11-06T19:00Z', [])).toBeNull()
  })
})

const leg = (id, date, home, away, extra = {}) => espnEvent({ id, date, home, away, ...extra })

describe('tagMatches', () => {
  it('tags league matches with their matchday and sorts by kickoff', () => {
    const out = tagged([
      leg(2, '2026-10-21T19:00Z', ars, bar),
      leg(1, '2026-10-21T16:45Z', liv, psg),
    ])
    expect(out.map((m) => m.id)).toEqual(['1', '2'])
    expect(out[0]).toMatchObject({ stage: 'League', matchday: 3 })
    expect(out[0].tieKey).toBeUndefined()
  })

  it('orders simultaneous kickoffs by id', () => {
    const out = tagged([leg('b', '2026-10-21T19:00Z', ars, bar), leg('a', '2026-10-21T19:00Z', liv, psg)])
    expect(out.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('pairs a knockout round into legs regardless of home side', () => {
    const out = tagged([
      leg(11, '2027-03-17T20:00Z', bar, ars),
      leg(10, '2027-03-10T20:00Z', ars, bar),
      leg(12, '2027-03-10T20:00Z', liv, psg),
    ])
    const byId = Object.fromEntries(out.map((m) => [m.id, m]))
    expect(byId[10]).toMatchObject({ stage: 'R16', leg: 1 })
    expect(byId[11]).toMatchObject({ stage: 'R16', leg: 2, tieKey: byId[10].tieKey })
    expect(byId[12]).toMatchObject({ leg: 1 })
    expect(byId[12].tieKey).not.toBe(byId[10].tieKey)
  })

  it('prefers ESPN’s round to the calendar', () => {
    const out = tagged([
      leg(1, '2027-05-30T19:00Z', ars, bar, { slug: 'final' }), // a final off our calendar's date
      leg(2, '2026-10-21T19:00Z', liv, psg, { slug: 'league-phase' }),
      leg(3, '2027-02-17T20:00Z', rma, bay, { slug: 'league-phase' }), // rescheduled into the play-off weeks
    ])
    const [ko, league, lateLeague] = ['1', '2', '3'].map((id) => out.find((m) => m.id === id))
    expect(ko).toMatchObject({ stage: 'Final', tieKey: 'Final:359-83' })
    expect(league).toMatchObject({ stage: 'League', matchday: 3 })
    expect(lateLeague).toMatchObject({ stage: 'League', matchday: undefined })
    expect(lateLeague.tieKey).toBeUndefined()
  })

  it('keeps the Final legless and a placeholder side unpaired', () => {
    const out = tagged([
      leg(20, '2027-06-05T19:00Z', ars, bar),
      leg(21, '2027-03-10T20:00Z', ars, { displayName: 'TBD' }),
      leg(22, '2027-03-17T20:00Z', { displayName: 'TBD' }, ars),
    ])
    const byId = Object.fromEntries(out.map((m) => [m.id, m]))
    expect(byId[20].leg).toBeUndefined()
    expect(byId[20].stage).toBe('Final')
    expect(byId[21].tieKey).toBe('R16:21')
    expect(byId[22].tieKey).toBe('R16:22')
    expect(byId[22].leg).toBe(1)
  })

  it('defaults to the league phase off-calendar', async () => {
    const { ROUNDS } = await import('../../src/ucl/data/season.js')
    const saved = ROUNDS.splice(0, ROUNDS.length)
    try {
      expect(tagged([leg(1, '2026-10-21T19:00Z', ars, bar)])[0]).toMatchObject({ stage: 'League', matchday: undefined })
    } finally {
      ROUNDS.push(...saved)
    }
  })
})

describe('buildTies', () => {
  const post = (score, more = {}) => ({ state: 'post', score, ...more })

  it('adds up the aggregate by club and names the winner', () => {
    const ties = buildTies(
      tagged([
        leg(10, '2027-03-10T20:00Z', ars, bar, post([2, 1])),
        leg(11, '2027-03-17T20:00Z', bar, ars, post([1, 0])),
        leg(12, '2027-03-10T20:00Z', liv, psg, post([0, 2])),
        leg(13, '2027-03-17T20:00Z', psg, liv, post([1, 1])),
      ]),
    )
    const [first, second] = [...ties.values()]
    expect(first.clubs.map((c) => c.name)).toEqual(['Arsenal', 'Barcelona'])
    expect(first.agg).toEqual({ 359: 2, 83: 2 })
    expect(first.winner).toBeNull() // level, no shootout recorded
    expect(second.agg).toEqual({ 364: 1, 160: 3 })
    expect(second.winner).toBe('160')
    expect(ties.get(first.key).legs.map((l) => l.id)).toEqual(['10', '11'])
  })

  it('settles a level aggregate on the 2nd-leg shootout', () => {
    const ties = buildTies(
      tagged([
        leg(10, '2027-03-10T20:00Z', ars, bar, post([2, 1])),
        leg(11, '2027-03-17T20:00Z', bar, ars, post([1, 0], { pens: [3, 4], name: 'STATUS_FINAL_PEN' })),
      ]),
    )
    expect([...ties.values()][0].winner).toBe('359')
    const homeWins = buildTies(
      tagged([
        leg(10, '2027-03-10T20:00Z', ars, bar, post([2, 1])),
        leg(11, '2027-03-17T20:00Z', bar, ars, post([1, 0], { pens: [5, 4] })),
      ]),
    )
    expect([...homeWins.values()][0].winner).toBe('83')
    const level = buildTies(
      tagged([
        leg(10, '2027-03-10T20:00Z', ars, bar, post([2, 1])),
        leg(11, '2027-03-17T20:00Z', bar, ars, post([1, 0], { pens: [4, 4] })),
      ]),
    )
    expect([...level.values()][0].winner).toBeNull()
  })

  it('has no winner until both legs are over, and runs the aggregate live', () => {
    const ties = buildTies(
      tagged([
        leg(10, '2027-03-10T20:00Z', ars, bar, post([2, 1])),
        leg(11, '2027-03-17T20:00Z', bar, ars, { state: 'in', score: [3, 0] }),
      ]),
    )
    const tie = [...ties.values()][0]
    expect(tie.winner).toBeNull()
    expect(tie.agg).toEqual({ 359: 2, 83: 4 })
    const one = buildTies(tagged([leg(10, '2027-03-10T20:00Z', ars, bar, post([2, 1]))]))
    expect([...one.values()][0].winner).toBeNull()
  })

  it('decides the Final on the night', () => {
    const won = buildTies(tagged([leg(20, '2027-06-05T19:00Z', rma, bay, post([1, 2]))]))
    expect([...won.values()][0].winner).toBe('132')
    const pens = buildTies(tagged([leg(20, '2027-06-05T19:00Z', rma, bay, post([1, 1], { pens: [5, 3] }))]))
    expect([...pens.values()][0].winner).toBe('86')
  })

  it('never names a winner for a placeholder tie', () => {
    const ties = buildTies(tagged([leg(21, '2027-06-05T19:00Z', ars, { displayName: 'TBD' }, post([1, 0]))]))
    expect([...ties.values()][0].winner).toBeNull()
  })

  it('skips league matches and unscored legs', () => {
    const ties = buildTies(tagged([leg(1, '2026-10-21T19:00Z', ars, bar), leg(10, '2027-03-10T20:00Z', liv, psg)]))
    expect(ties.size).toBe(1)
    expect([...ties.values()][0]).toMatchObject({ scored: false, agg: { 364: 0, 160: 0 } })
  })
})

describe('aggregateFor', () => {
  const ms = tagged([
    leg(10, '2027-03-10T20:00Z', ars, bar, { state: 'post', score: [2, 1] }),
    leg(11, '2027-03-17T20:00Z', bar, ars, { state: 'post', score: [1, 0] }),
  ])
  const ties = buildTies(ms)

  it('orients the aggregate to the 2nd leg', () => {
    expect(aggregateFor(ties.get(ms[1].tieKey), ms[1])).toEqual([2, 2])
  })

  it('is null on a 1st leg, without a tie, or before any score', () => {
    expect(aggregateFor(ties.get(ms[0].tieKey), ms[0])).toBeNull()
    expect(aggregateFor(undefined, ms[1])).toBeNull()
    const fresh = tagged([leg(10, '2027-03-10T20:00Z', ars, bar), leg(11, '2027-03-17T20:00Z', bar, ars)])
    expect(aggregateFor(buildTies(fresh).get(fresh[1].tieKey), fresh[1])).toBeNull()
  })
})

describe('labels', () => {
  const [md, r16a, r16b, fin] = tagged([
    leg(1, '2026-10-21T19:00Z', ars, bar),
    leg(10, '2027-03-10T20:00Z', liv, psg),
    leg(11, '2027-03-17T20:00Z', psg, liv),
    leg(20, '2027-06-05T19:00Z', rma, bay),
  ])

  it('labels match-list day headers', () => {
    expect(roundLabel(md)).toBe('Matchday 3')
    expect(roundLabel(r16a)).toBe('Round of 16 · 1st leg')
    expect(roundLabel(fin)).toBe('Final')
    expect(roundLabel({ stage: 'League' })).toBe('League phase')
  })

  it('titles the detail view in full', () => {
    expect(matchTitle(md)).toBe('League phase · Matchday 3')
    expect(matchTitle(r16a)).toBe('Round of 16 · 1st leg')
    expect(matchTitle(r16b)).toBe('Round of 16 · 2nd leg')
    expect(matchTitle(fin)).toBe('Final')
    expect(matchTitle({ stage: 'League' })).toBe('League phase')
    expect(matchTitle({ stage: 'PO' })).toBe('Knockout play-offs')
  })
})

describe('status helpers', () => {
  it('tells played from live from postponed', () => {
    const [done, live, ppd, pre] = parsed([
      espnEvent({ id: 1, date: '2026-10-21T19:00Z', home: ars, away: bar, state: 'post', score: [1, 0] }),
      espnEvent({ id: 2, date: '2026-10-21T19:00Z', home: liv, away: psg, state: 'in' }),
      espnEvent({ id: 3, date: '2026-10-21T19:00Z', home: rma, away: bay, state: 'post', name: 'STATUS_POSTPONED' }),
      espnEvent({ id: 4, date: '2026-10-21T19:00Z', home: rma, away: bay }),
    ])
    expect([done, live, ppd, pre].map(isPlayed)).toEqual([true, false, false, false])
    expect([done, live, ppd, pre].map(isLive)).toEqual([false, true, false, false])
  })
})
