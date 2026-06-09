// Timezone-aware formatting helpers. Every match's kickoff is stored as an
// absolute instant (ISO string with offset), so the same instant can be
// rendered into whatever timezone the viewer selects.

// The viewer's own IANA timezone, e.g. "America/Chicago" or "Europe/London".
export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// A curated list of common timezones for the picker, plus the viewer's own
// detected zone (deduped) so they can always switch back to it.
export function timezoneOptions(detected) {
  const common = [
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Toronto',
    'America/Vancouver',
    'UTC',
    'Europe/London',
    'Europe/Paris',
    'Europe/Madrid',
    'Europe/Berlin',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'Asia/Riyadh',
    'Asia/Tehran',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
  ]
  const set = new Set([detected, ...common])
  return [...set]
}

export function formatTime(iso, tz) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Long date in a given timezone, e.g. "Thursday, June 11, 2026".
export function formatDateLong(iso, tz) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Stable key for grouping matches by their calendar day *in the viewer's tz*.
// (A 10pm ET match can fall on a different calendar day in Tokyo — this keeps
// the date headers correct for the viewer.)
export function dayKey(iso, tz) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
}

// Short timezone abbreviation for a given instant, e.g. "CDT", "GMT+1".
export function tzAbbrev(iso, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(new Date(iso))
  const part = parts.find((p) => p.type === 'timeZoneName')
  return part ? part.value : ''
}

// Match status relative to "now". Group/knockout games run ~2 hours; we treat
// a match as live for 2h15m after kickoff to cover stoppage and halftime.
const MATCH_MINUTES = 135
export function matchStatus(iso, now = Date.now()) {
  const start = new Date(iso).getTime()
  const end = start + MATCH_MINUTES * 60 * 1000
  if (now < start) return 'upcoming'
  if (now <= end) return 'live'
  return 'finished'
}
