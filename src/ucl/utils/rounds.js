// Stage, matchday and leg for each match, and two-legged knockout ties.
//
// ESPN's feed doesn't reliably say which round a fixture belongs to, so we
// place each match on UEFA's calendar (data/season.js) by its kickoff date, then
// pair a knockout round's two meetings of the same clubs into a tie: the
// earlier one is the 1st leg, and the aggregate decides who goes through (no
// away-goals rule; a level aggregate goes to extra time and penalties in the
// 2nd leg). The Final is a single match, kept as a one-leg tie.

import { ROUNDS, STAGE_LABELS } from '../data/season.js'

const DAY = 86_400_000
const dayIndex = (ms) => Math.floor(ms / DAY)

// The calendar round with a match date nearest to this kickoff (UTC dates — the
// 18:45 / 21:00 CET kickoffs fall on the same calendar day in UTC).
export function roundFor(iso, rounds = ROUNDS) {
  const day = dayIndex(new Date(iso).getTime())
  let best = null
  let bestGap = Infinity
  for (const r of rounds) {
    for (const d of r.dates) {
      const gap = Math.abs(dayIndex(Date.parse(`${d}T00:00:00Z`)) - day)
      if (gap < bestGap) {
        best = r
        bestGap = gap
      }
    }
  }
  return best
}

// Finished (final whistle) vs live; a postponed match is neither.
export const isPlayed = (m) => m.state === 'post' && !m.postponed && Array.isArray(m.score)
export const isLive = (m) => Boolean(m.live)

// Knockout pairs are keyed by the two club ids; a placeholder side (no id yet)
// can't be paired, so that match stands alone.
function tieKey(m) {
  if (!m.t1.id || !m.t2.id) return `${m.stage}:${m.id}`
  return `${m.stage}:${[m.t1.id, m.t2.id].sort().join('-')}`
}

// Matches sorted by kickoff, each tagged with { stage, matchday?, leg?, tieKey? }.
export function tagMatches(matches) {
  const tagged = matches
    .map((m) => {
      const r = roundFor(m.ko)
      const out = { ...m, stage: r?.stage || 'League' }
      if (out.stage === 'League') out.matchday = r?.matchday
      else out.tieKey = tieKey(out)
      return out
    })
    .sort((a, b) => new Date(a.ko) - new Date(b.ko) || a.id.localeCompare(b.id))
  // Legs in kickoff order (tagged is already sorted).
  const seen = {}
  for (const m of tagged) {
    if (!m.tieKey || m.stage === 'Final') continue
    m.leg = (seen[m.tieKey] = (seen[m.tieKey] || 0) + 1)
  }
  return tagged
}

// Winner of a tie by club id, once it's over (every leg finished): higher
// aggregate, else the shootout at the end of the last leg. Null otherwise.
function tieWinner(tie) {
  const last = tie.legs[tie.legs.length - 1]
  const complete = tie.stage === 'Final' ? tie.legs.length === 1 : tie.legs.length === 2
  if (!complete || !tie.legs.every(isPlayed)) return null
  const [a, b] = tie.clubs
  const ga = tie.agg[a.id]
  const gb = tie.agg[b.id]
  if (ga !== gb) return ga > gb ? a.id : b.id
  if (!last.pens) return null
  const [p1, p2] = last.pens
  if (p1 === p2) return null
  return p1 > p2 ? last.t1.id : last.t2.id
}

// Knockout ties from tagged matches: Map<tieKey, { key, stage, clubs, legs,
// agg: { [clubId]: goals }, winner }>, in first-leg kickoff order. The aggregate
// counts every leg with a score, so it runs live during a 2nd leg.
export function buildTies(tagged) {
  const ties = new Map()
  for (const m of tagged) {
    if (!m.tieKey) continue
    if (!ties.has(m.tieKey)) {
      ties.set(m.tieKey, { key: m.tieKey, stage: m.stage, clubs: [m.t1, m.t2], legs: [] })
    }
    ties.get(m.tieKey).legs.push(m)
  }
  for (const tie of ties.values()) {
    tie.agg = Object.fromEntries(tie.clubs.map((c) => [c.id, 0]))
    tie.scored = false
    for (const leg of tie.legs) {
      if (!Array.isArray(leg.score)) continue
      tie.scored = true
      tie.agg[leg.t1.id] += leg.score[0]
      tie.agg[leg.t2.id] += leg.score[1]
    }
    tie.winner = tie.clubs.every((c) => c.id) ? tieWinner(tie) : null
  }
  return ties
}

// Aggregate oriented to one leg's (t1, t2), or null when there's nothing to add
// up yet. Only meaningful on a 2nd leg (after the 1st, it *is* the leg score).
export function aggregateFor(tie, m) {
  if (!tie || m.leg !== 2 || !tie.scored || !m.t1.id || !m.t2.id) return null
  return [tie.agg[m.t1.id], tie.agg[m.t2.id]]
}

// "Matchday 3", "Round of 16 · 2nd leg", "Final" — a match-list day header.
export function roundLabel(m) {
  if (m.stage === 'League' && m.matchday) return `Matchday ${m.matchday}`
  return matchTitle(m)
}

// "League phase · Matchday 3", "Round of 16 · 2nd leg" — the detail heading.
export function matchTitle(m) {
  if (m.stage === 'League') return m.matchday ? `${STAGE_LABELS.League} · Matchday ${m.matchday}` : STAGE_LABELS.League
  if (m.stage === 'Final' || !m.leg) return STAGE_LABELS[m.stage]
  return `${STAGE_LABELS[m.stage]} · ${m.leg === 1 ? '1st' : '2nd'} leg`
}
