import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseEvent, seasonMonths, fetchSeason, fetchRecent, SCOREBOARD } from '../../src/ucl/services/espn.js'
import { CLUBS, espnEvent } from './fixtures.js'

const { ars, bar, psg, liv } = CLUBS

describe('parseEvent', () => {
  it('maps a finished match with the home club as t1', () => {
    const m = parseEvent(
      espnEvent({
        id: 1,
        date: '2026-10-21T19:00Z',
        home: ars,
        away: bar,
        state: 'post',
        score: [2, 1],
        venue: { fullName: 'Emirates Stadium', address: { city: 'London', country: 'England' } },
        broadcasts: [{ names: ['Paramount+'] }, { names: ['Paramount+', 'CBS'] }],
        details: [
          { scoringPlay: true, team: { id: '359' }, clock: { displayValue: "12'" }, athletesInvolved: [{ shortName: 'B. Saka' }] },
          { yellowCard: true, team: { id: '83' }, clock: { displayValue: "45'+2'" }, athletesInvolved: [{ displayName: 'Pedri' }] },
        ],
      }),
    )
    expect(m).toMatchObject({
      id: '1',
      ko: '2026-10-21T19:00:00.000Z',
      state: 'post',
      score: [2, 1],
      venue: { name: 'Emirates Stadium', city: 'London', country: 'England' },
      tv: ['Paramount+', 'CBS'],
    })
    expect(m.t1).toEqual({
      id: '359',
      crest: 'crests/arsenal.svg',
      name: 'Arsenal',
      short: 'Arsenal',
      abbr: 'ARS',
      logo: ars.logo,
      color: '#e20520',
    })
    expect(m.goals.t1).toEqual([{ name: 'B. Saka', minute: 12, extra: undefined, penalty: false, og: false }])
    expect(m.cards.t2[0]).toMatchObject({ name: 'Pedri', minute: 45, extra: 2, color: 'yellow' })
    expect(m.live).toBeUndefined()
  })

  it('has no score before kickoff, even though ESPN sends "0"', () => {
    const m = parseEvent(espnEvent({ id: 2, date: '2026-11-04T20:00Z', home: liv, away: psg }))
    expect(m.score).toBeNull()
    expect(m.venue).toBeNull()
    expect(m.tv).toEqual([])
  })

  it('carries the live clock while in play', () => {
    const m = parseEvent(espnEvent({ id: 3, date: '2026-10-21T19:00Z', home: ars, away: bar, state: 'in', score: [1, 1] }))
    expect(m.live).toEqual({ clock: "67'", detail: 'Second Half' })
    expect(m.score).toEqual([1, 1])
  })

  it('falls back to the display clock and blank detail', () => {
    const ev = espnEvent({ id: 3, date: '2026-10-21T19:00Z', home: ars, away: bar, state: 'in', shortDetail: '' })
    ev.status.type.description = undefined
    expect(parseEvent(ev).live).toEqual({ clock: "67'", detail: '' })
    ev.status.displayClock = undefined
    expect(parseEvent(ev).live.clock).toBe('')
  })

  it('records penalties and extra time', () => {
    const m = parseEvent(
      espnEvent({ id: 4, date: '2027-03-17T20:00Z', home: ars, away: bar, state: 'post', score: [1, 1], pens: [4, 3], name: 'STATUS_FINAL_PEN' }),
    )
    expect(m.pens).toEqual([4, 3])
    expect(m.aet).toBe(true)
    const aet = parseEvent(espnEvent({ id: 5, date: '2027-03-17T20:00Z', home: ars, away: bar, state: 'post', score: [2, 1], name: 'STATUS_FINAL_AET' }))
    expect(aet.aet).toBe(true)
    expect(aet.pens).toBeUndefined()
  })

  it('flags a postponed match and drops its score', () => {
    const m = parseEvent(
      espnEvent({ id: 6, date: '2026-11-04T20:00Z', home: ars, away: bar, state: 'post', name: 'STATUS_POSTPONED', shortDetail: 'Postponed' }),
    )
    expect(m.postponed).toBe('Postponed')
    expect(m.score).toBeNull()
    expect(m.live).toBeUndefined()
    const bare = espnEvent({ id: 6, date: '2026-11-04T20:00Z', home: ars, away: bar, name: 'STATUS_CANCELED', shortDetail: '' })
    expect(parseEvent(bare).postponed).toBe('Postponed')
  })

  it('builds a crest URL from the team id when the logo is missing', () => {
    const m = parseEvent(espnEvent({ id: 7, date: '2026-11-04T20:00Z', home: liv, away: { displayName: 'TBD' } }))
    expect(m.t1.logo).toBe('https://a.espncdn.com/i/teamlogos/soccer/500/364.png')
    expect(m.t1.color).toBeNull()
    expect(m.t1.crest).toBe('crests/liverpool-fc.svg')
    expect(m.t2).toMatchObject({ id: null, name: 'TBD', short: 'TBD', crest: null, logo: null, abbr: '' })
  })

  it('names a team by `name` when there is no displayName, else TBD', () => {
    const m = parseEvent(espnEvent({ id: 8, date: '2026-11-04T20:00Z', home: { id: 9, name: 'Club' }, away: {} }))
    expect(m.t1).toMatchObject({ id: '9', name: 'Club', short: 'Club', crest: null })
    expect(m.t2.name).toBe('TBD')
  })

  it('reads competitors without home/away flags in order, and status off the competition', () => {
    const ev = espnEvent({ id: 9, date: '2026-11-04T20:00Z', home: ars, away: bar, state: 'post', score: [3, 0] })
    for (const c of ev.competitions[0].competitors) delete c.homeAway
    ev.competitions[0].status = ev.status
    delete ev.status
    const m = parseEvent(ev)
    expect(m.t1.name).toBe('Arsenal')
    expect(m.score).toEqual([3, 0])
  })

  it('falls back to a synthetic id and tolerates a bare event', () => {
    const ev = espnEvent({ date: '2026-11-04T20:00Z', home: ars, away: bar })
    delete ev.status
    const m = parseEvent(ev)
    expect(m.id).toBe('2026-11-04T20:00Z:359:83')
    expect(m.state).toBe('pre')
  })

  it('rejects events that are not two-club fixtures', () => {
    expect(parseEvent(null)).toBeNull()
    expect(parseEvent({ date: 'x', competitions: [{}] })).toBeNull()
    expect(parseEvent({ competitions: [{ competitors: [] }] })).toBeNull()
    expect(parseEvent({ date: '2026-11-04T20:00Z', competitions: [{ competitors: [{ team: ars }] }] })).toBeNull()
    expect(parseEvent({ ...espnEvent({ id: 1, date: '2026-11-04T20:00Z', home: ars, away: bar }), date: 'TBD' })).toBeNull()
  })
})

describe('seasonMonths', () => {
  it('spans each calendar month the season is played in', () => {
    const months = seasonMonths()
    expect(months.map((m) => m.first)).toEqual([
      '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01',
      '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01',
    ])
    expect(months[0]).toEqual({
      month: '202609',
      first: '2026-09-01',
      last: '2026-09-30',
      days: ['2026-09-08', '2026-09-09', '2026-09-10'],
    })
    expect(months[1].days).toEqual(['2026-10-13', '2026-10-14', '2026-10-20', '2026-10-21'])
    expect(months[5].last).toBe('2027-02-28')
  })
})

// A fake ESPN: `routes` maps a `dates` query value to its events (or an HTTP
// status to fail with); anything unlisted returns no events.
function stubFetch(routes) {
  const fn = vi.fn(async (url) => {
    const dates = new URL(url).searchParams.get('dates')
    const hit = routes[dates]
    if (typeof hit === 'number') return { ok: false, status: hit, json: async () => ({}) }
    if (hit instanceof Error) throw hit
    return { ok: true, json: async () => (hit === 'bad' ? {} : { events: hit || [] }) }
  })
  global.fetch = fn
  return fn
}

const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
})

const md3 = espnEvent({ id: 30, date: '2026-10-21T19:00Z', home: ars, away: bar, state: 'post', score: [2, 1] })
const md4 = espnEvent({ id: 40, date: '2026-11-04T20:00Z', home: liv, away: psg })

describe('fetchSeason', () => {
  it('fetches one request per month and keeps only that month’s events', async () => {
    const fetch = stubFetch({
      202610: [md3, md4], // md4 is outside October: ignored here…
      202611: [md4], // …and picked up by its own month
    })
    const map = await fetchSeason()
    expect([...map.keys()].sort()).toEqual(['30', '40'])
    const urls = fetch.mock.calls.map((c) => c[0])
    expect(urls[0]).toBe(`${SCOREBOARD.url}?dates=202609&limit=200`)
    expect(urls).toHaveLength(10) // one per month; empty months aren't retried
  })

  it('re-fetches a month day by day when its request fails', async () => {
    const fetch = stubFetch({
      202610: 400,
      20261021: [md3],
      20261014: 'bad', // a 200 without events[] counts as empty
    })
    const map = await fetchSeason()
    expect([...map.keys()]).toEqual(['30'])
    const days = fetch.mock.calls.map((c) => new URL(c[0]).searchParams.get('dates'))
    expect(days).toEqual(expect.arrayContaining(['20261013', '20261014', '20261020', '20261021']))
    expect(days).not.toContain('20261104')
  })

  it('re-fetches a month that comes back with only other months’ events', async () => {
    stubFetch({ 202609: [md3], 202610: [md4], 20261021: [md3] })
    expect([...(await fetchSeason()).keys()].sort()).toEqual(['30'])
  })

  it('drops events outside the season window', async () => {
    const old = espnEvent({ id: 99, date: '2026-09-30T23:00Z', home: ars, away: bar })
    old.date = '2026-05-30T19:00Z'
    stubFetch({ 202609: 500, 20260908: [old, { competitions: [] }, { date: 'soon' }, null] })
    expect((await fetchSeason()).size).toBe(0)
  })

  it('throws when ESPN is unreachable', async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError('offline')
    })
    await expect(fetchSeason()).rejects.toThrow('Scoreboard unreachable')
  })
})

describe('fetchRecent', () => {
  it('polls yesterday, today and tomorrow', async () => {
    const fetch = stubFetch({ 20261021: [md3], 20261022: 503 })
    const map = await fetchRecent(undefined, new Date('2026-10-21T20:00Z'))
    expect([...map.keys()]).toEqual(['30'])
    expect(fetch.mock.calls.map((c) => new URL(c[0]).searchParams.get('dates'))).toEqual(['20261020', '20261021', '20261022'])
  })

  it('throws when every day fails', async () => {
    stubFetch({ 20261020: 500, 20261021: 500, 20261022: 500 })
    await expect(fetchRecent(undefined, new Date('2026-10-21T20:00Z'))).rejects.toThrow('Scoreboard unreachable')
  })
})
