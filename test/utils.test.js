import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'
import { weekStartOf, addDays } from '../src/utils/week.js'
import { dayKey, formatTime, matchStatus } from '../src/utils/time.js'
import { buildICS } from '../src/utils/ics.js'
import { computeGroup } from '../src/utils/standings.js'

describe('week utils', () => {
  it('weekStartOf returns the preceding Sunday', () => {
    expect(weekStartOf('2026-06-11')).toBe('2026-06-07') // Thu -> Sun
    expect(weekStartOf('2026-06-07')).toBe('2026-06-07') // Sun -> itself
  })

  it('addDays does calendar math across month boundaries', () => {
    expect(addDays('2026-06-28', 6)).toBe('2026-07-04')
  })

  it('every match falls inside exactly one listed week', () => {
    const tz = 'America/New_York'
    const weeks = [...new Set(MATCHES.map((m) => weekStartOf(dayKey(m.ko, tz))))]
    for (const m of MATCHES) {
      const k = dayKey(m.ko, tz)
      const hits = weeks.filter((w) =>
        Array.from({ length: 7 }, (_, i) => addDays(w, i)).includes(k),
      )
      expect(hits).toHaveLength(1)
    }
  })
})

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
})

describe('ICS export', () => {
  it('emits a valid VEVENT with correct UTC start/end', () => {
    const final = MATCHES.find((m) => m.stage === 'Final')
    const ics = buildICS(final)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20260719T190000Z') // 3pm EDT -> 19:00 UTC
    expect(ics).toContain('DTEND:20260719T211500Z') // +2h15m
    expect(ics).toContain('LOCATION:MetLife Stadium')
    expect(ics).toContain('END:VCALENDAR')
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
