import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'
import {
  formatTime,
  matchStatus,
  liveState,
  teamLocalKickoffs,
  teamKickoffTooltip,
} from '../src/utils/time.js'
import { TEAM_TIMEZONES } from '../src/data/teamTimezones.js'
import { ALL_TEAMS } from '../src/data/teams.js'
import { computeGroup } from '../src/utils/standings.js'

describe('time utils', () => {
  it('converts the opening match (3pm ET) to other zones', () => {
    const open = MATCHES.find((m) => m.num === 1).ko
    expect(formatTime(open, 'America/New_York')).toBe('3:00 PM')
    expect(formatTime(open, 'America/Los_Angeles')).toBe('12:00 PM')
    expect(formatTime(open, 'Europe/London')).toBe('8:00 PM')
  })

  it('classifies match status by time', () => {
    expect(matchStatus('2026-06-11T19:00:00Z', Date.parse('2026-06-10T00:00:00Z'))).toBe('upcoming')
    expect(matchStatus('2026-06-11T19:00:00Z', Date.parse('2026-06-11T19:30:00Z'))).toBe('live')
    expect(matchStatus('2026-06-11T19:00:00Z', Date.parse('2026-06-12T00:00:00Z'))).toBe('finished')
  })

  it('liveState prefers feed data over the clock', () => {
    const ko = '2026-06-11T19:00:00Z'
    const duringWindow = Date.parse('2026-06-11T19:30:00Z') // time-based "live"
    // A finished match (has a score) reads finished even inside the live window.
    expect(liveState({ ko, score: [2, 0] }, duringWindow)).toBe('finished')
    // ESPN's live flag wins regardless of clock.
    expect(liveState({ ko, score: [1, 0], live: { clock: "HT" } }, duringWindow)).toBe('live')
    // No feed data yet -> fall back to the time-based guess.
    expect(liveState({ ko }, duringWindow)).toBe('live')
    expect(liveState({ ko }, Date.parse('2026-06-10T00:00:00Z'))).toBe('upcoming')
  })
})

describe('team local kickoff tooltip', () => {
  const open = MATCHES.find((m) => m.num === 1).ko // opener, 3pm EDT

  it('gives a single home-time line for a single-zone country', () => {
    // Abbrev rendering of Europe/London varies by ICU build (BST vs GMT+1), so
    // assert the wall-clock and that exactly one line comes back.
    const lines = teamLocalKickoffs(open, 'England')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^Jun 11, 8:00 PM /)
  })

  it('lists one line per distinct wall-clock for a multi-zone country', () => {
    // USA spans Hawaii→Eastern; the opener (3pm EDT) reads differently in each.
    const lines = teamLocalKickoffs(open, 'USA')
    expect(lines).toEqual([
      'Jun 11, 9:00 AM HST',
      'Jun 11, 11:00 AM AKDT',
      'Jun 11, 12:00 PM PDT',
      'Jun 11, 1:00 PM MDT',
      'Jun 11, 2:00 PM CDT',
      'Jun 11, 3:00 PM EDT',
    ])
  })

  it('collapses zones that read the same clock at the instant', () => {
    // Mexico lists 4 zones, but Tijuana (PDT) & Hermosillo (MST) share -7 in June.
    expect(TEAM_TIMEZONES.Mexico).toHaveLength(4)
    expect(teamLocalKickoffs(open, 'Mexico')).toHaveLength(3)
  })

  it('returns empty for unknown teams (e.g. knockout placeholders)', () => {
    expect(teamLocalKickoffs(open, 'Winner Group A')).toEqual([])
    expect(teamKickoffTooltip(open, 'Winner Group A')).toBe('')
  })

  it('builds a labelled multi-line tooltip', () => {
    expect(teamKickoffTooltip(open, 'England')).toMatch(/^Kickoff in England:\nJun 11, 8:00 PM /)
    expect(teamKickoffTooltip(open, 'USA')).toMatch(/^Kickoff in USA \(local times\):\n/)
  })

  it('has a timezone entry for every qualified team', () => {
    for (const name of ALL_TEAMS) {
      expect(TEAM_TIMEZONES[name], `${name} missing a home timezone`).toBeTruthy()
      expect(TEAM_TIMEZONES[name].length).toBeGreaterThan(0)
    }
  })
})

describe('standings', () => {
  it('tallies points, GD and ordering from scored matches', () => {
    const scored = MATCHES.map((m) =>
      m.num === 1 ? { ...m, score: [2, 1] } : m, // Mexico 2-1 South Africa
    )
    const table = computeGroup('A', scored)
    const mex = table.find((r) => r.name === 'Mexico')
    const rsa = table.find((r) => r.name === 'South Africa')
    expect(mex.Pts).toBe(3)
    expect(mex.GD).toBe(1)
    expect(rsa.Pts).toBe(0)
    expect(rsa.GD).toBe(-1)
    expect(table[0].name).toBe('Mexico') // sorted to top
  })
})

describe('venue timezones', () => {
  it('every venue has a valid IANA timezone', () => {
    for (const v of Object.values(VENUES)) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: v.tz })).not.toThrow()
    }
  })
})
