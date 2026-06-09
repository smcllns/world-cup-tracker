// Compute group standings from any group-stage matches that have a recorded
// `score` ([homeGoals, awayGoals]). With no results yet, every row is zeroed;
// as scores are filled in on the matches, the tables update automatically.

import { TEAMS } from '../data/teams.js'

function blankRow(team) {
  return { ...team, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 }
}

export function computeGroup(group, matches) {
  const rows = {}
  for (const t of TEAMS[group]) rows[t.name] = blankRow(t)

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

  return Object.values(rows)
    .map((r) => ({ ...r, GD: r.GF - r.GA }))
    .sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.name.localeCompare(y.name))
}

// True once at least one match in the group has been scored.
export function groupHasResults(group, matches) {
  return matches.some((m) => m.stage === 'Group' && m.group === group && m.score)
}
