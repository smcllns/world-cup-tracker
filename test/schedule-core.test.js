import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { normEspn } from '../src/services/espn.js'
import { pairKey } from '../src/services/results.js'
import { compareSchedule } from '../scripts/schedule-core.mjs'

const m4 = MATCHES.find((m) => m.num === 4) // USA v Paraguay (group)
const m79 = MATCHES.find((m) => m.num === 79) // Winner Group A v 3rd… (knockout @ Azteca)

// ESPN lists the USA as "United States" — the rec key must still match ours.
const groupRec = (date) => ({
  key: pairKey(normEspn('United States'), normEspn('Paraguay')),
  date,
  venue: "Levi's Stadium",
})
// ESPN lists the Mexico City venue under its renamed name.
const koRec = (date) => ({ key: null, date, venue: 'Estadio Banorte' })
const shift = (iso, min) => new Date(new Date(iso).getTime() + min * 60000).toISOString()

describe('compareSchedule', () => {
  it('reports no drift when a group match matches (team aliases resolve)', () => {
    const { drifts } = compareSchedule([m4], [groupRec(m4.ko)], { fromMs: 0 })
    expect(drifts).toHaveLength(0)
  })

  it('flags a drifted group match and reports the signed minute delta', () => {
    const { drifts } = compareSchedule([m4], [groupRec(shift(m4.ko, 60))], { fromMs: 0 })
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toMatchObject({ num: 4, diffMin: 60 })
  })

  it('matches a knockout placeholder by venue (Azteca↔Banorte) and flags drift', () => {
    const { drifts } = compareSchedule([m79], [koRec(shift(m79.ko, -30))], { fromMs: 0 })
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toMatchObject({ num: 79, diffMin: -30 })
  })

  it('ignores matches before the upcoming-window cutoff', () => {
    const { drifts } = compareSchedule([m4], [groupRec(shift(m4.ko, 60))], {
      fromMs: new Date(m4.ko).getTime() + 1,
    })
    expect(drifts).toHaveLength(0)
  })

  it('reports a match as unmatched when ESPN has no corresponding fixture', () => {
    const { drifts, unmatched } = compareSchedule([m4], [], { fromMs: 0 })
    expect(drifts).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
  })
})
