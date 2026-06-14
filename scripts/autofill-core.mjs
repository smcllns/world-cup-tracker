// Pure, unit-tested decision + parsing logic for the OpenFootball autofill,
// extracted from openfootball-autofill.mjs so the risky bits (when to sync, and
// how ESPN's event JSON maps to goals/penalties/extra-time) are covered by
// tests independent of the network. See test/autofill-core.test.js.

import { normEspn, parseClock } from './cuptxt.mjs'
import { normalizeTeam } from '../src/services/results.js'

export const eqFt = (a, b) => Boolean(a && b && a[0] === b[0] && a[1] === b[1])

// Decide what to do with one match, given the (already t1/t2-oriented) final from
// each source. ESPN is the trigger: the moment it reports the match final (it only
// returns a score when 'post'), we sync — no waiting for a second source, so a
// result lands within a poll (~5 min) of full time. TheSportsDB is kept only as a
// safety CHECK, never a wait: if it's present and CONTRADICTS ESPN we defer (a
// wrong score is worse than a slow one); if it's absent or agrees, we post.
//   { action: 'skip', reason }            — OpenFootball has it, or sources disagree
//   { action: 'sync', conf: 'both' }      — ESPN + TheSportsDB agree
//   { action: 'sync', conf: 'espn-only' } — ESPN final, TheSportsDB not in yet
//   { action: 'wait', reason }            — ESPN hasn't called it final yet
export function classifyMatch({ ofFt, espnFt, sdbFt }) {
  if (ofFt) return { action: 'skip', reason: 'openfootball-has-it' }
  if (!espnFt) return { action: 'wait', reason: 'no-espn-final' }
  if (sdbFt && !eqFt(espnFt, sdbFt)) return { action: 'skip', reason: 'sources-disagree' }
  return { action: 'sync', conf: sdbFt ? 'both' : 'espn-only' }
}

const toNum = (v) => (v == null || v === '' ? null : Number(v))

// Parse one ESPN scoreboard event into goals/penalties/extra-time, oriented to
// the match's t1/t2. Returns { t1Goals, t2Goals, pens, aet } or null when the
// event doesn't correspond to this match. Shootout kicks are excluded from the
// goal lists (cup.txt doesn't list shootout takers); `pens` carries the tally.
export function parseEspnEventDetail(ev, match) {
  const c = ev?.competitions?.[0]
  const hc = c?.competitors?.find((x) => x.homeAway === 'home')
  const ac = c?.competitors?.find((x) => x.homeAway === 'away')
  if (!hc?.team || !ac?.team) return null
  const hn = normEspn(hc.team.displayName)
  const an = normEspn(ac.team.displayName)
  const nt1 = normalizeTeam(match.t1)
  const nt2 = normalizeTeam(match.t2)
  if (!((hn === nt1 && an === nt2) || (hn === nt2 && an === nt1))) return null

  const home = []
  const away = []
  for (const d of c.details || []) {
    if (!d.scoringPlay || d.shootout) continue // exclude penalty-shootout kicks
    const tid = String(d.team?.id)
    const side = tid === String(hc.team.id) ? home : tid === String(ac.team.id) ? away : null
    if (!side) continue
    const { minute, extra } = parseClock(d.clock?.displayValue)
    const a = d.athletesInvolved?.[0] || {}
    side.push({
      name: (a.displayName || a.shortName || '').trim(),
      minute,
      extra,
      pen: Boolean(d.penaltyKick),
      og: Boolean(d.ownGoal),
    })
  }
  const ord = (g) => (g.minute || 0) * 100 + (g.extra || 0)
  home.sort((a, b) => ord(a) - ord(b))
  away.sort((a, b) => ord(a) - ord(b))

  const ph = toNum(hc.shootoutScore)
  const pa = toNum(ac.shootoutScore)
  const pensHA = ph != null && pa != null ? [ph, pa] : null
  const statusName = c.status?.type?.name || ''
  const aet =
    /PEN|AET|_ET\b/.test(statusName) ||
    Boolean(pensHA) ||
    home.concat(away).some((g) => g.minute != null && g.minute > 90)

  const orient = (pair) => (pair == null ? null : hn === nt1 ? pair : [pair[1], pair[0]])
  const goals = hn === nt1 ? { t1Goals: home, t2Goals: away } : { t1Goals: away, t2Goals: home }
  return { ...goals, pens: orient(pensHA), aet }
}
