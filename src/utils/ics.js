// Generate and download an .ics (iCalendar) file for a match so viewers can
// drop kickoff into Apple Calendar / Google Calendar / Outlook. Times are
// written in UTC (the trailing "Z"), which every calendar app localizes
// automatically — so the event lands at the right moment in any timezone.

import { VENUES } from '../data/venues.js'
import { STAGE_LABELS } from '../data/matches.js'
import { US_BROADCAST } from '../data/broadcast.js'

const MATCH_MINUTES = 135

function toICSDate(date) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    date.getUTCFullYear() +
    p(date.getUTCMonth() + 1) +
    p(date.getUTCDate()) +
    'T' +
    p(date.getUTCHours()) +
    p(date.getUTCMinutes()) +
    p(date.getUTCSeconds()) +
    'Z'
  )
}

// Fold/escape text per RFC 5545.
function esc(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function buildICS(match) {
  const venue = VENUES[match.venue]
  const start = new Date(match.ko)
  const end = new Date(start.getTime() + MATCH_MINUTES * 60 * 1000)
  const stageLabel = match.stage === 'Group' ? `Group ${match.group}` : STAGE_LABELS[match.stage]

  const summary = `World Cup: ${match.t1} vs ${match.t2}`
  const location = `${venue.name}, ${venue.city}, ${venue.country}`
  const description = [
    `${stageLabel} · Match ${match.num}`,
    `English: ${US_BROADCAST.english.tv.join(' / ')} (stream: ${US_BROADCAST.english.streaming.join(', ')})`,
    `Spanish: ${US_BROADCAST.spanish.tv.join(' / ')} (stream: ${US_BROADCAST.spanish.streaming.join(', ')})`,
  ].join('\\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//World Cup 2026 Viewer//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:wc2026-match-${match.num}@worldcupviewer`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${esc(summary)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadICS(match) {
  const blob = new Blob([buildICS(match)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wc2026-match-${match.num}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
