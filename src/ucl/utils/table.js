// League-phase table: all 36 clubs in one standings table, computed from the
// league-phase results (finished + in-progress, so it moves live like the World
// Cup group tables).
//
// UEFA's league-phase order: points, then goal difference, goals scored, away
// goals scored, wins, away wins, then the collective points, goal difference
// and goals of the club's eight league-phase opponents. (The last criteria —
// disciplinary points and club coefficient — aren't in the feed; we fall back
// to name so the order is at least stable.)

import { zoneFor } from '../data/season.js'

const blank = (club) => ({
  club,
  P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0, awayGF: 0, awayW: 0,
  opponents: [],
})

const TIEBREAKS = ['Pts', 'GD', 'GF', 'awayGF', 'W', 'awayW', 'oppPts', 'oppGD', 'oppGF']

export function computeTable(tagged) {
  const rows = new Map()
  const row = (club) => {
    if (!rows.has(club.id)) rows.set(club.id, blank(club))
    return rows.get(club.id)
  }
  for (const m of tagged) {
    if (m.stage !== 'League' || !m.t1.id || !m.t2.id) continue
    const home = row(m.t1)
    const away = row(m.t2)
    home.opponents.push(m.t2.id)
    away.opponents.push(m.t1.id)
    if (!Array.isArray(m.score) || m.postponed) continue
    const [h, a] = m.score
    home.P++
    away.P++
    home.GF += h
    home.GA += a
    away.GF += a
    away.GA += h
    away.awayGF += a
    if (h > a) {
      home.W++
      home.Pts += 3
      away.L++
    } else if (a > h) {
      away.W++
      away.awayW++
      away.Pts += 3
      home.L++
    } else {
      home.D++
      away.D++
      home.Pts++
      away.Pts++
    }
  }
  for (const r of rows.values()) r.GD = r.GF - r.GA
  // Opponents' collective record (needs every club's own totals first).
  for (const r of rows.values()) {
    r.oppPts = r.oppGD = r.oppGF = 0
    for (const id of r.opponents) {
      const o = rows.get(id)
      r.oppPts += o.Pts
      r.oppGD += o.GD
      r.oppGF += o.GF
    }
  }
  const sorted = [...rows.values()].sort((x, y) => {
    for (const k of TIEBREAKS) if (x[k] !== y[k]) return y[k] - x[k]
    return x.club.name.localeCompare(y.club.name)
  })
  return sorted.map((r, i) => ({ ...r, rank: i + 1, zone: zoneFor(i + 1) }))
}
