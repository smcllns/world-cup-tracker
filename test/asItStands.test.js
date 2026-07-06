import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { projectKnockout, resolveGroupSlots } from '../src/utils/asItStands.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../src/data/thirdPlaceCombinations.js'

const GROUPS = Object.keys(TEAMS)

// R32 match number for each "winner v third" host (Winner Group W's match).
function winnerMatchNum(w) {
  const m = MATCHES.find((x) => x.stage === 'R32' && (x.t1 === `Winner Group ${w}` || x.t2 === `Winner Group ${w}`))
  return m?.num
}

// A complete group stage with a strict 9/6/3/0 hierarchy per group; the 3rd-vs-
// 4th margin varies by group so every third place has a distinct goal difference
// (the best-8 cut is then unambiguous).
function buildComplete() {
  const score = {}
  GROUPS.forEach((g, i) => {
    const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
    for (const m of MATCHES) {
      if (m.stage !== 'Group' || m.group !== g) continue
      const a = idx[m.t1]
      const b = idx[m.t2]
      const hi = Math.min(a, b)
      const lo = Math.max(a, b)
      const margin = hi === 2 && lo === 3 ? i + 1 : 1
      score[m.num] = a < b ? [margin, 0] : [0, margin]
    }
  })
  return MATCHES.map((m) => (score[m.num] ? { ...m, score: score[m.num] } : m))
}

// Candidate group lists for each R32 third-place slot, parsed from the bracket.
function thirdSlots() {
  const slots = []
  for (const m of MATCHES) {
    if (m.stage !== 'R32') continue
    for (const side of [m.t1, m.t2]) {
      const hit = /^3rd ([A-L/]+)$/.exec(side)
      if (hit) slots.push({ matchNum: m.num, groups: hit[1].split('/') })
    }
  }
  return slots
}

describe('projectKnockout — "as it stands" R32', () => {
  const complete = buildComplete()
  const { perGroup, complete: resolved, official } = projectKnockout(complete)

  it('resolves a full, complete bracket from the official table', () => {
    expect(resolved).toBe(true)
    expect(official).toBe(true)
  })

  it('assigns thirds exactly per FIFA Annexe C for the current combination', () => {
    // buildComplete sends groups E–L through as the eight qualifying thirds.
    const qualifying = GROUPS.filter((g) => perGroup[g].thirdQualifies)
    const key = [...qualifying].sort().join('')
    const combo = THIRD_PLACE_COMBINATIONS[key]
    expect(combo, `Annexe C must contain combination ${key}`).toBeTruthy()
    // For each winner W facing a third, that third's group is combo[i]; its
    // destination must be W's match, facing W's group winner (team index 0 here).
    THIRD_WINNER_ORDER.forEach((w, i) => {
      const thirdGroup = combo[i]
      const dest = perGroup[thirdGroup].third
      expect(dest, `3rd of ${thirdGroup} should have a destination`).toBeTruthy()
      expect(dest.matchNum).toBe(winnerMatchNum(w))
      expect(dest.opponent).toBe(TEAMS[w][0].name)
    })
  })

  it("places each group's 1st and 2nd against a concrete opponent", () => {
    for (const g of GROUPS) {
      expect(perGroup[g].first?.team).toBeTruthy()
      expect(perGroup[g].first?.opponent).toBeTruthy()
      expect(perGroup[g].second?.team).toBeTruthy()
      expect(perGroup[g].second?.opponent).toBeTruthy()
    }
  })

  it('assigns exactly 8 qualifying thirds, each to a slot whose candidate list allows it', () => {
    const slots = thirdSlots()
    const qualifying = GROUPS.filter((g) => perGroup[g].thirdQualifies)
    expect(qualifying).toHaveLength(8)
    const usedMatches = new Set()
    for (const g of qualifying) {
      const dest = perGroup[g].third
      expect(dest, `group ${g} third should have a destination`).toBeTruthy()
      const slot = slots.find((s) => s.matchNum === dest.matchNum)
      expect(slot, `M${dest.matchNum} should be a third-place slot`).toBeTruthy()
      // FIFA's per-slot candidate list must include this group.
      expect(slot.groups).toContain(g)
      usedMatches.add(dest.matchNum)
    }
    // No two thirds share a slot.
    expect(usedMatches.size).toBe(8)
  })

  it('marks the four non-qualifying thirds as outside the best 8 (no destination)', () => {
    const out = GROUPS.filter((g) => !perGroup[g].thirdQualifies)
    expect(out).toHaveLength(4)
    for (const g of out) expect(perGroup[g].third).toBeNull()
  })
})

describe('resolveGroupSlots — filling settled R32 placeholders', () => {
  const isPlaceholder = (s) => /^(Winner|Runner-up) Group /.test(s) || /^3rd /.test(s)
  const complete = buildComplete()

  it('resolves every R32 group placeholder once the whole group stage is settled', () => {
    const out = resolveGroupSlots(complete)
    for (const m of out.filter((x) => x.stage === 'R32')) {
      expect(isPlaceholder(m.t1), `M${m.num} t1=${m.t1}`).toBe(false)
      expect(isPlaceholder(m.t2), `M${m.num} t2=${m.t2}`).toBe(false)
    }
    // M73 = Runner-up A vs Runner-up B; buildComplete ranks by team index (2nd = index 1).
    const m73 = out.find((m) => m.num === 73)
    expect(m73.t1).toBe(TEAMS['A'][1].name)
    expect(m73.t2).toBe(TEAMS['B'][1].name)
  })

  it("resolves a settled group's runner-up but defers third-place slots until all groups settle", () => {
    // Keep only groups A and B settled; strip scores from the rest.
    const partial = complete.map((m) =>
      m.stage === 'Group' && m.group !== 'A' && m.group !== 'B' ? { ...m, score: undefined } : m,
    )
    const out = resolveGroupSlots(partial)
    const m73 = out.find((m) => m.num === 73)
    expect(m73.t1).toBe(TEAMS['A'][1].name)
    expect(m73.t2).toBe(TEAMS['B'][1].name)
    // Third-place slots need the cross-group best-8, so they stay placeholders.
    expect(out.some((m) => m.stage === 'R32' && (/^3rd /.test(m.t1) || /^3rd /.test(m.t2)))).toBe(true)
  })

  it('does not lock a placing off a still-live match', () => {
    // Group A fully scored but one of its matches is still live → A not settled.
    let flipped = false
    const withLive = complete.map((m) => {
      if (!flipped && m.stage === 'Group' && m.group === 'A') {
        flipped = true
        return { ...m, live: { clock: "80'" } }
      }
      return m
    })
    const m73 = resolveGroupSlots(withLive).find((m) => m.num === 73)
    expect(m73.t1).toBe('Runner-up Group A') // A unsettled → placeholder kept
    expect(m73.t2).toBe(TEAMS['B'][1].name) // B settled → resolved
  })

  it('does not lock a placing that hinges on an approximate tiebreak', () => {
    // Group A finishes all-square (every match 0-0): all four teams identical on
    // points/GD/goals, so their order is decided only by conduct/ranking — not
    // reliable — so A's placings must stay placeholders even though A is settled.
    const ambiguousA = complete.map((m) =>
      m.stage === 'Group' && m.group === 'A' ? { ...m, score: [0, 0] } : m,
    )
    const m73 = resolveGroupSlots(ambiguousA).find((m) => m.num === 73) // Runner-up A vs Runner-up B
    expect(m73.t1).toBe('Runner-up Group A') // A ambiguous → not locked
    expect(m73.t2).toBe(TEAMS['B'][1].name) // B has a clean 9/6/3/0 table → locked
  })

  it('returns the same array when nothing is settled', () => {
    expect(resolveGroupSlots(MATCHES)).toBe(MATCHES)
  })
})

describe('FIFA Annexe C combinations table', () => {
  const CAND = { A: 'CEFHI', B: 'EFGIJ', D: 'BEFIJ', E: 'ABCDF', G: 'AEHIJ', I: 'CDFGH', K: 'DEIJL', L: 'EHIJK' }

  it('has all 495 combinations of the 12 groups taken 8 at a time', () => {
    const keys = Object.keys(THIRD_PLACE_COMBINATIONS)
    expect(keys).toHaveLength(495)
    for (const k of keys) {
      // key is 8 distinct group letters, sorted
      expect(k).toMatch(/^[A-L]{8}$/)
      expect(new Set(k).size).toBe(8)
      expect([...k].join('')).toBe([...k].sort().join(''))
    }
  })

  it('every row assigns each winner a third within its candidate list, and the thirds are the key set', () => {
    for (const [key, val] of Object.entries(THIRD_PLACE_COMBINATIONS)) {
      expect(val).toMatch(/^[A-L]{8}$/)
      // the eight assigned thirds are exactly the eight groups in the key
      expect([...val].sort().join('')).toBe(key)
      // each winner's assigned third is permitted by FIFA's candidate list
      THIRD_WINNER_ORDER.forEach((w, i) => expect(CAND[w]).toContain(val[i]))
    }
  })
})
