// Pure comparison of our stored kickoff times against ESPN's scheduled times.
// Group matches are keyed by team pair, reusing the app's own normalization so
// ESPN spellings ("United States", "Congo DR", …) align; knockout placeholders
// ("Winner Group A") have no real teams yet, so they're matched by venue +
// calendar day instead.

import { normalizeTeam, isRealTeam, pairKey } from '../src/services/results.js'
import { VENUES } from '../src/data/venues.js'

const utcDay = (iso) => new Date(iso).toISOString().slice(0, 10)
const normVenue = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ESPN renamed some stadiums for 2026 (e.g. Estadio Azteca → Estadio Banorte).
const VENUE_ALIASES = { estadioazteca: 'estadiobanorte', estadiobanorte: 'estadioazteca' }

function venueMatch(a, b) {
  const x = normVenue(a)
  const y = normVenue(b)
  if (!x || !y) return false
  return x.includes(y) || y.includes(x) || VENUE_ALIASES[x] === y || VENUE_ALIASES[y] === x
}

// matches: our schedule (src/data/matches.js shape).
// recs: [{ key, date, venue }] — key = pairKey of normalized ESPN team names, or
//   null when ESPN still lists the fixture as TBD.
// Returns { drifts, unmatched }. A drift means our kickoff and ESPN's differ by
// >= thresholdMin. Only matches at/after fromMs are considered (the upcoming
// window), so already-played games never raise noise.
export function compareSchedule(matches, recs, { thresholdMin = 5, fromMs = -Infinity } = {}) {
  const byKey = new Map()
  for (const r of recs) if (r.key) byKey.set(r.key, r)

  const drifts = []
  const unmatched = []
  for (const m of matches) {
    const koMs = new Date(m.ko).getTime()
    if (koMs < fromMs) continue

    let rec = null
    if (isRealTeam(m.t1) && isRealTeam(m.t2)) {
      rec = byKey.get(pairKey(normalizeTeam(m.t1), normalizeTeam(m.t2))) || null
    } else {
      const vname = VENUES[m.venue]?.name
      const day = utcDay(m.ko)
      const cands = recs.filter((r) => venueMatch(r.venue, vname) && utcDay(r.date) === day)
      if (cands.length === 1) rec = cands[0]
    }

    if (!rec) {
      unmatched.push({ num: m.num, stage: m.stage, t1: m.t1, t2: m.t2, ko: m.ko })
      continue
    }
    const diffMin = Math.round((new Date(rec.date).getTime() - koMs) / 60000)
    if (Math.abs(diffMin) >= thresholdMin) {
      drifts.push({
        num: m.num,
        stage: m.stage,
        t1: m.t1,
        t2: m.t2,
        storedISO: new Date(m.ko).toISOString(),
        espnISO: new Date(rec.date).toISOString(),
        diffMin,
      })
    }
  }
  return { drifts, unmatched }
}
