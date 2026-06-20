// Pure helpers for the schedule auto-fix: turn FIFA's UTC kickoff into the two
// representations our data uses, and rewrite both files in place. Kept separate
// (and side-effect-free) so the conversion + regex edits are unit-tested; the
// network, git and PR plumbing lives in check-schedule-drift.mjs / the workflow.

// Kickoffs are stored at a fixed -04:00 ET offset (the kickoff-times invariant —
// the whole tournament is within EDT). Express the wall-clock at UTC-4.
export function etStrings(ms) {
  const iso = new Date(ms - 4 * 3600 * 1000).toISOString() // wall-clock digits at UTC-4
  return {
    ko: `${iso.slice(0, 19)}-04:00`, // src/data/matches.js → 2026-06-19T23:00:00-04:00
    fixture: `${iso.slice(0, 10)} ${iso.slice(11, 16)}`, // fixture → 2026-06-19 23:00
  }
}

// Replace the `ko: '…'` for match `num` in src/data/matches.js source text.
// Each match is one object on a line; the trailing comma in `num: N,` prevents
// matching a longer number, and [^}] keeps the edit inside that one object.
export function editMatches(src, num, ko) {
  const re = new RegExp(`(\\{\\s*num:\\s*${num},[^}]*\\bko:\\s*')[^']*(')`)
  if (!re.test(src)) return { text: src, changed: false }
  return { text: src.replace(re, `$1${ko}$2`), changed: true }
}

// Replace the value for option `num` in the official-kickoffs fixture, keeping
// any trailing comment on the line.
export function editFixture(src, num, fixture) {
  const re = new RegExp(`(^\\s*${num}:\\s*')[^']*(')`, 'm')
  if (!re.test(src)) return { text: src, changed: false }
  return { text: src.replace(re, `$1${fixture}$2`), changed: true }
}
