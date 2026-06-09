// Group ranking + qualification using the official FIFA World Cup tie-breakers
// (Regulations, Art. on group ranking). Order of criteria:
//   1. Points in all group matches
//   2. Goal difference in all group matches
//   3. Goals scored in all group matches
//   If two or more teams are still equal, apply, AMONG THOSE TIED TEAMS only:
//   4. Points in head-to-head matches
//   5. Goal difference in head-to-head matches
//   6. Goals scored in head-to-head matches
//   7. Fair-play points, then 8. drawing of lots — NOT computable here (no card
//      data); we fall back to a deterministic alphabetical order and flag it.
//
// Top two of each group advance; the eight best third-placed teams (ranked by
// criteria 1–3 across groups) also advance to the Round of 32.

import { TEAMS } from '../data/teams.js'

const GROUPS = Object.keys(TEAMS)
const GROUP_MATCH_COUNT = 6 // 4 teams => 6 matches per group

function blank(team, group) {
  return { ...team, group, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 }
}

function baseStats(group, matches) {
  const rows = {}
  for (const t of TEAMS[group]) rows[t.name] = blank(t, group)
  for (const m of matches) {
    if (m.stage !== 'Group' || m.group !== group || !m.score) continue
    const [g1, g2] = m.score
    const a = rows[m.t1]
    const b = rows[m.t2]
    if (!a || !b) continue
    a.P++; b.P++
    a.GF += g1; a.GA += g2
    b.GF += g2; b.GA += g1
    if (g1 > g2) { a.W++; b.L++; a.Pts += 3 }
    else if (g1 < g2) { b.W++; a.L++; b.Pts += 3 }
    else { a.D++; b.D++; a.Pts++; b.Pts++ }
  }
  for (const k in rows) rows[k].GD = rows[k].GF - rows[k].GA
  return rows
}

// Head-to-head sub-table among exactly the given (tied) team names.
function headToHead(names, group, matches) {
  const set = new Set(names)
  const sub = {}
  for (const n of names) sub[n] = { Pts: 0, GD: 0, GF: 0 }
  for (const m of matches) {
    if (m.stage !== 'Group' || m.group !== group || !m.score) continue
    if (!set.has(m.t1) || !set.has(m.t2)) continue
    const [g1, g2] = m.score
    sub[m.t1].GF += g1; sub[m.t2].GF += g2
    sub[m.t1].GD += g1 - g2; sub[m.t2].GD += g2 - g1
    if (g1 > g2) sub[m.t1].Pts += 3
    else if (g1 < g2) sub[m.t2].Pts += 3
    else { sub[m.t1].Pts++; sub[m.t2].Pts++ }
  }
  return sub
}

export function rankGroup(group, matches) {
  const rows = Object.values(baseStats(group, matches))
  // Criteria 1–3 (overall).
  rows.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF)

  // Resolve clusters tied on all of (Pts, GD, GF) via head-to-head (4–6).
  const ordered = []
  let i = 0
  while (i < rows.length) {
    let j = i + 1
    while (
      j < rows.length &&
      rows[j].Pts === rows[i].Pts &&
      rows[j].GD === rows[i].GD &&
      rows[j].GF === rows[i].GF
    ) j++
    const tied = rows.slice(i, j)
    if (tied.length > 1) {
      const sub = headToHead(tied.map((t) => t.name), group, matches)
      tied.sort(
        (a, b) =>
          sub[b.name].Pts - sub[a.name].Pts ||
          sub[b.name].GD - sub[a.name].GD ||
          sub[b.name].GF - sub[a.name].GF ||
          a.name.localeCompare(b.name), // fair-play/lots unavailable -> stable fallback
      )
    }
    ordered.push(...tied)
    i = j
  }
  return ordered.map((r, idx) => ({ ...r, rank: idx + 1 }))
}

export function groupComplete(group, matches) {
  return (
    matches.filter((m) => m.stage === 'Group' && m.group === group && m.score).length >=
    GROUP_MATCH_COUNT
  )
}

// Full tournament qualification picture.
export function computeQualification(matches) {
  const groups = {}
  const completion = {}
  for (const g of GROUPS) {
    groups[g] = rankGroup(g, matches)
    completion[g] = groupComplete(g, matches)
  }

  // Third-placed teams ranked across groups by criteria 1–3 (no H2H across groups).
  const thirds = GROUPS.map((g) => groups[g][2]).filter(Boolean)
  thirds.sort(
    (a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name),
  )

  const allComplete = GROUPS.every((g) => completion[g])
  const best8 = new Set(thirds.slice(0, 8).map((t) => t.name))

  return { groups, completion, thirds, best8, allComplete }
}

// Per-row qualification status for the standings UI.
// 'in'  = advances (1st/2nd, or a confirmed best-3rd once all groups are done)
// 'best3' = currently inside the 8 best third-placed (still provisional)
// 'out' / null otherwise.
export function rowStatus(row, group, qual) {
  if (!qual.completion[group]) return null // group still in progress
  if (row.rank <= 2) return 'in'
  if (row.rank === 3) {
    if (!qual.allComplete) return qual.best8.has(row.name) ? 'best3' : 'out3'
    return qual.best8.has(row.name) ? 'in' : 'out'
  }
  return 'out'
}
