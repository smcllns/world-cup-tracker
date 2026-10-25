// Champions League feed: ESPN's public soccer scoreboard — free, no API key and
// CORS-open, the same source the World Cup tracker uses for its live overlay.
// Here it is the only source: it carries the whole season's fixtures (with each
// club's crest), live scores + clock, and final results.
//
// Two fetches feed the app (see App.jsx):
//   • fetchSeason — every fixture of the season, one request per calendar month
//     (ESPN accepts a YYYYMMDD-YYYYMMDD range), refreshed occasionally;
//   • fetchRecent — yesterday / today / tomorrow, polled often for live scores.
// Both return Map<id, match>; ESPN event ids are stable, so merging is a set.

import { parseEspnEvents, scoreboardDates } from '../../services/espn.js'
import { SEASON, ROUNDS } from '../data/season.js'

export const SCOREBOARD = {
  name: 'ESPN',
  url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${SEASON.espnLeague}/scoreboard`,
  homepage: `https://www.espn.com/soccer/league/_/name/${SEASON.espnLeague}`,
}

const toNum = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
// YYYY-MM-DD (UTC) of an ESPN date, or '' if it doesn't parse.
const utcDay = (iso) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10)
}

// ESPN team -> our club shape. The crest falls back to ESPN's predictable logo
// path when the scoreboard omits `logo`; a club without an id (a knockout
// placeholder) has no crest and renders as initials.
function club(team) {
  const id = team.id != null ? String(team.id) : null
  const name = team.displayName || team.name || 'TBD'
  return {
    id,
    name,
    short: team.shortDisplayName || name,
    abbr: team.abbreviation || '',
    logo: team.logo || (id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` : null),
    color: /^[0-9a-f]{6}$/i.test(team.color || '') ? `#${team.color}` : null,
  }
}

const OFF = /POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED/

// One ESPN event -> one match, home side as t1 (UEFA lists the home club first).
// Returns null for anything that isn't a two-club fixture.
export function parseEvent(ev) {
  const comp = ev?.competitions?.[0]
  if (!comp || !Array.isArray(comp.competitors) || !utcDay(ev.date)) return null
  const home = comp.competitors.find((c) => c.homeAway === 'home') || comp.competitors[0]
  const away = comp.competitors.find((c) => c.homeAway === 'away') || comp.competitors[1]
  if (!home?.team || !away?.team) return null

  const st = ev.status || comp.status || {}
  const type = st.type || {}
  const state = type.state || 'pre' // 'pre' | 'in' | 'post'
  const off = OFF.test(type.name || '')
  const h = toNum(home.score)
  const a = toNum(away.score)
  const events = parseEspnEvents(comp, home.team.id, away.team.id)
  const venue = comp.venue
  const tv = [...new Set((comp.broadcasts || []).flatMap((b) => b.names || []))]

  const m = {
    id: String(ev.id ?? `${ev.date}:${home.team.id}:${away.team.id}`),
    ko: new Date(ev.date).toISOString(),
    t1: club(home.team),
    t2: club(away.team),
    state,
    score: state !== 'pre' && !off && h != null && a != null ? [h, a] : null,
    goals: { t1: events.goals.home, t2: events.goals.away },
    cards: { t1: events.cards.home, t2: events.cards.away },
    subs: { t1: events.subs.home, t2: events.subs.away },
    venue: venue?.fullName
      ? { name: venue.fullName, city: venue.address?.city || '', country: venue.address?.country || '' }
      : null,
    tv,
  }
  if (off) m.postponed = type.shortDetail || 'Postponed'
  // shortDetail is the running clock during play ("23'", "45'+2'") and the break
  // label at stoppages ("HT") — the same contract the shared LiveBadge reads.
  if (state === 'in' && !off) m.live = { clock: type.shortDetail || st.displayClock || '', detail: type.description || '' }
  const hp = toNum(home.shootoutScore)
  const ap = toNum(away.shootoutScore)
  if (m.score && hp != null && ap != null) m.pens = [hp, ap]
  if (m.score && (/AET|PEN/i.test(type.name || '') || m.pens)) m.aet = true
  return m
}

// Parse + dedupe raw events, keeping only this season's fixtures.
function toMatches(events) {
  const out = new Map()
  for (const ev of events) {
    const m = parseEvent(ev)
    if (!m) continue
    const day = utcDay(m.ko)
    if (day < SEASON.first || day > SEASON.last) continue
    out.set(m.id, m)
  }
  return out
}

async function getEvents(dates, signal) {
  const res = await fetch(`${SCOREBOARD.url}?dates=${dates}&limit=200`, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`Scoreboard request failed (HTTP ${res.status})`)
  const data = await res.json()
  return Array.isArray(data?.events) ? data.events : []
}

const ymd = (day) => day.replace(/-/g, '')

// One ESPN date range per calendar month the season is played in, plus that
// month's match days (the per-day fallback below).
export function seasonMonths(rounds = ROUNDS) {
  const byMonth = new Map()
  for (const r of rounds) {
    for (const day of r.dates) {
      const ym = day.slice(0, 7)
      if (!byMonth.has(ym)) byMonth.set(ym, [])
      byMonth.get(ym).push(day)
    }
  }
  return [...byMonth].map(([ym, days]) => {
    const [y, mo] = ym.split('-').map(Number)
    const lastDay = String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')
    return { first: `${ym}-01`, last: `${ym}-${lastDay}`, days }
  })
}

// Every fixture of the season. A month whose range fails or comes back with
// nothing inside it (ESPN ignored or rejected the range) is re-fetched day by day
// from the calendar, so a format quirk can't blank the schedule. Throws only if
// ESPN couldn't be reached at all.
export async function fetchSeason(signal) {
  const months = seasonMonths()
  const ranged = await Promise.allSettled(
    months.map((mo) => getEvents(`${ymd(mo.first)}-${ymd(mo.last)}`, signal)),
  )
  let reached = false
  const events = []
  const retry = []
  months.forEach((mo, i) => {
    const r = ranged[i]
    if (r.status === 'fulfilled') reached = true
    const inMonth = (r.value || []).filter((ev) => {
      const day = utcDay(ev?.date)
      return day >= mo.first && day <= mo.last
    })
    if (inMonth.length) events.push(...inMonth)
    else retry.push(...mo.days)
  })
  const daily = await Promise.allSettled(retry.map((d) => getEvents(ymd(d), signal)))
  for (const r of daily) {
    if (r.status !== 'fulfilled') continue
    reached = true
    events.push(...r.value)
  }
  if (!reached) throw new Error('Scoreboard unreachable')
  return toMatches(events)
}

// Yesterday / today / tomorrow (UTC) — the fast live poll.
export async function fetchRecent(signal, base = new Date()) {
  const results = await Promise.allSettled(scoreboardDates(base).map((d) => getEvents(d, signal)))
  if (results.every((r) => r.status === 'rejected')) throw new Error('Scoreboard unreachable')
  return toMatches(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
}
