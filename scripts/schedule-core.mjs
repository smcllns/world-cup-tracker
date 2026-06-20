// Validate our stored kickoff times against independent feeds, anchored to an
// AUTHORITATIVE source (FIFA's own data). The point: never need a human to
// adjudicate, and don't trust the secondary feeds on their own.
//
//   • If the authority (FIFA) disagrees with our stored time → that's the
//     answer: report it as a drift, with how many secondary feeds corroborate.
//   • If the authority agrees with us but a feed doesn't → that's a feed glitch,
//     surfaced as a low-priority note (our time is confirmed correct).
//   • If the authority has no time for a match → fall back to requiring TWO
//     secondary feeds to agree before calling it a drift.
//
// Group matches are keyed by team pair (the caller builds each source's map with
// that source's own spelling normalised to our canonical names).

import { normalizeTeam, pairKey } from '../src/services/results.js'

const keyOf = (t1, t2) => pairKey(normalizeTeam(t1), normalizeTeam(t2))

function clusterByTime(items, thrMs) {
  const sorted = [...items].sort((a, b) => a.ms - b.ms)
  const clusters = []
  for (const it of sorted) {
    const last = clusters.at(-1)
    if (last && Math.abs(it.ms - last[0].ms) < thrMs) last.push(it)
    else clusters.push([it])
  }
  return clusters
}

// matches: rows to validate. sources: [{ name, byKey: Map(pairKey -> kickoff ms) }].
// authority: the name of the source treated as the source of truth (e.g. 'FIFA').
// Returns { drifts, notes, unmatched }:
//   drifts  — our stored time is wrong: { num, t1, t2, storedISO, authISO, diffMin,
//             via ('authority'|'consensus'), corroborators:[names] }
//   notes   — non-actionable observations: a feed disagreeing while the authority
//             confirms us, or the authority missing for a match.
//   unmatched — no source had the match at all.
export function compareSchedule(matches, sources, { thresholdMin = 5, fromMs = -Infinity, authority = 'FIFA' } = {}) {
  const thr = thresholdMin * 60000
  const drifts = []
  const notes = []
  const unmatched = []

  for (const m of matches) {
    const stored = new Date(m.ko).getTime()
    if (stored < fromMs) continue
    const key = keyOf(m.t1, m.t2)
    const reported = sources
      .map((s) => ({ name: s.name, ms: s.byKey.get(key) }))
      .filter((r) => r.ms != null)
    if (!reported.length) {
      unmatched.push({ num: m.num, t1: m.t1, t2: m.t2 })
      continue
    }
    const base = { num: m.num, t1: m.t1, t2: m.t2, storedISO: new Date(stored).toISOString() }
    const auth = reported.find((r) => r.name === authority)
    const others = reported.filter((r) => r.name !== authority)

    if (auth) {
      if (Math.abs(auth.ms - stored) >= thr) {
        // Authoritative change — this is the answer; note which feeds back it up.
        drifts.push({
          ...base,
          authISO: new Date(auth.ms).toISOString(),
          diffMin: Math.round((auth.ms - stored) / 60000),
          via: 'authority',
          corroborators: others.filter((r) => Math.abs(r.ms - auth.ms) < thr).map((r) => r.name),
        })
      } else {
        // Authority confirms our time; any feed that disagrees is a feed glitch.
        for (const r of others.filter((r) => Math.abs(r.ms - stored) >= thr)) {
          notes.push({
            ...base,
            kind: 'feed-discrepancy',
            source: r.name,
            theirISO: new Date(r.ms).toISOString(),
            diffMin: Math.round((r.ms - stored) / 60000),
          })
        }
      }
      continue
    }

    // Authority absent for this match → require two feeds to agree to call it.
    notes.push({ ...base, kind: 'authority-missing' })
    const dissent = reported.filter((r) => Math.abs(r.ms - stored) >= thr)
    for (const cluster of clusterByTime(dissent, thr)) {
      if (cluster.length >= 2) {
        drifts.push({
          ...base,
          authISO: new Date(cluster[0].ms).toISOString(),
          diffMin: Math.round((cluster[0].ms - stored) / 60000),
          via: 'consensus',
          corroborators: cluster.map((c) => c.name),
        })
      } else {
        notes.push({
          ...base,
          kind: 'single-source',
          source: cluster[0].name,
          theirISO: new Date(cluster[0].ms).toISOString(),
          diffMin: Math.round((cluster[0].ms - stored) / 60000),
        })
      }
    }
  }
  return { drifts, notes, unmatched }
}
