// Schedule-drift check: compares our stored kickoff times against ESPN's
// scheduled times for every UPCOMING match and reports any that have moved.
// This is what would have caught M32 (Türkiye v Paraguay) moving an hour
// earlier — our times are static (validated once), so without this nothing in
// the pipeline notices a reschedule until a human sees a match live early.
//
// Two ways it runs:
//   • hourly via feed-freshness.yml — exits 1 on drift, so the job goes red and
//     GitHub emails you (a continuous backstop).
//   • each morning via schedule-check.yml (early MST, before the day's games) —
//     with SCHEDULE_REPORT_ONLY=1 it emails a report of changes for the week
//     ahead and exits 0 (a proactive daily review, not a gate).
//
// Uses only Node built-ins + repo source (no npm packages); email is sent via
// Gmail SMTP through python3 (preinstalled on the runner), same as the autofill.
//
// Run:   node scripts/check-schedule-drift.mjs
// Tune:  THRESHOLD_MIN=5 (default), SCHEDULE_REPORT_ONLY=1 (email + exit 0)

import { execSync } from 'node:child_process'
import { MATCHES } from '../src/data/matches.js'
import { LIVE_SOURCE, normEspn } from '../src/services/espn.js'
import { pairKey } from '../src/services/results.js'
import { compareSchedule } from './schedule-core.mjs'

// Every UTC day a match falls on, ±1 (ESPN files some games under an adjacent
// date), so the fetch window tracks the schedule rather than being hard-coded.
function matchDates() {
  const days = new Set()
  for (const m of MATCHES) {
    const base = new Date(m.ko)
    for (const off of [-1, 0, 1]) {
      const d = new Date(base)
      d.setUTCDate(d.getUTCDate() + off)
      days.add(d.toISOString().slice(0, 10).replace(/-/g, ''))
    }
  }
  return [...days].sort()
}

async function fetchEspnRecords() {
  const seen = new Set()
  const recs = []
  for (const d of matchDates()) {
    try {
      const r = await fetch(`${LIVE_SOURCE.url}?dates=${d}`, { cache: 'no-store' })
      if (!r.ok) continue
      for (const ev of (await r.json()).events || []) {
        const id = ev.id || ev.uid
        if (id && seen.has(id)) continue
        if (id) seen.add(id)
        const c = ev.competitions?.[0]
        const cs = c?.competitors || []
        const home = cs.find((x) => x.homeAway === 'home')?.team?.displayName
        const away = cs.find((x) => x.homeAway === 'away')?.team?.displayName
        recs.push({
          key: home && away ? pairKey(normEspn(home), normEspn(away)) : null,
          date: ev.date,
          venue: c?.venue?.fullName,
        })
      }
    } catch {
      /* best-effort per day */
    }
  }
  return recs
}

async function main() {
  const reportOnly = process.env.SCHEDULE_REPORT_ONLY === '1'
  const thresholdMin = Number(process.env.THRESHOLD_MIN) || 5

  const recs = await fetchEspnRecords()
  if (!recs.length) {
    console.error('Could not reach ESPN — skipping schedule check (no false alarm).')
    return
  }

  // Upcoming only, with a 3h buffer so an in-progress game still counts.
  const fromMs = Date.now() - 3 * 3600 * 1000
  const { drifts, unmatched } = compareSchedule(MATCHES, recs, { thresholdMin, fromMs })

  console.log(
    `Schedule check: ${drifts.length} drift(s) >= ${thresholdMin}min among upcoming matches; ` +
      `${unmatched.length} not matched to ESPN (likely TBD knockouts not yet posted).`,
  )
  for (const d of drifts) {
    console.log(
      `  DRIFT M${d.num} ${d.t1} v ${d.t2}: stored ${d.storedISO} | ESPN ${d.espnISO} | ` +
        `${d.diffMin > 0 ? '+' : ''}${d.diffMin}min`,
    )
  }

  if (drifts.length) {
    const lines = drifts.map(
      (d) =>
        `- M${d.num} ${d.t1} v ${d.t2}: ours ${d.storedISO} vs ESPN ${d.espnISO} ` +
        `(${d.diffMin > 0 ? '+' : ''}${d.diffMin} min)`,
    )
    sendEmail(
      `⏰ Schedule change: ${drifts.length} upcoming match${drifts.length === 1 ? '' : 'es'} differ from ESPN`,
      'The kickoff time(s) below no longer match ESPN. Update src/data/matches.js AND ' +
        'test/fixtures/official-kickoffs.js (the data.test.js invariant asserts they agree):\n\n' +
        `${lines.join('\n')}\n`,
    )
  }

  // Hourly backstop fails (→ GitHub email); the morning report-only run stays green.
  if (drifts.length && !reportOnly) process.exit(1)
}

// Gmail SMTP via Python's smtplib (preinstalled on the runner). No-op without
// mail secrets; best-effort, never throws. Mirrors scripts/openfootball-autofill.mjs.
function sendEmail(subject, body) {
  const user = process.env.MAIL_USERNAME
  const pass = process.env.MAIL_PASSWORD
  if (!user || !pass) {
    console.log('  (no mail secrets — skipping email)')
    return
  }
  const py = `import smtplib, os, ssl
from email.message import EmailMessage
m = EmailMessage()
m['From'] = os.environ['SMTP_FROM']; m['To'] = os.environ['SMTP_TO']
m['Subject'] = os.environ['SMTP_SUBJECT']; m.set_content(os.environ['SMTP_BODY'])
with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context()) as s:
    s.login(os.environ['SMTP_USER'], os.environ['SMTP_PASS'])
    s.send_message(m)
`
  try {
    execSync('python3 -', {
      input: py,
      env: {
        ...process.env,
        SMTP_FROM: `World Cup Schedule Check <${user}>`,
        SMTP_TO: process.env.MAIL_TO || 'chester.ismay@gmail.com',
        SMTP_SUBJECT: subject,
        SMTP_BODY: body,
        SMTP_USER: user,
        SMTP_PASS: pass,
      },
    })
    console.log(`  ✉ emailed ${process.env.MAIL_TO || 'chester.ismay@gmail.com'}`)
  } catch (err) {
    console.log(`  ✖ email failed: ${(err.stderr || err.message || '').toString().trim()}`)
  }
}

main()
