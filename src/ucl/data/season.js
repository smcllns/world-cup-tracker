// The 2026/27 UEFA Champions League: competition config + the official calendar.
//
// Everything else — fixtures, clubs, crests, scores — comes live from ESPN's
// public scoreboard (see ../services/espn.js). This file only knows *when* each
// round is played, which is what lets us label a match "Matchday 3" or "Round
// of 16 · 2nd leg" without depending on ESPN's free-text round names. Next
// season, update SEASON and ROUNDS from UEFA's published calendar.

export const SEASON = {
  name: 'Champions League',
  label: '2026/27',
  espnLeague: 'uefa.champions',
  // Inclusive window (UTC dates). Keeps the previous season and the summer
  // qualifiers out of the live "yesterday / today / tomorrow" poll.
  first: '2026-09-01',
  last: '2027-06-30',
}

export const STAGE_LABELS = {
  League: 'League phase',
  PO: 'Knockout play-offs',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  Final: 'Final',
}

export const KNOCKOUT_STAGES = ['PO', 'R16', 'QF', 'SF', 'Final']

// Left-edge colour per stage in the match list.
export const STAGE_COLORS = {
  League: '#4cc3ff',
  PO: '#a78bfa',
  R16: '#34d399',
  QF: '#f5b942',
  SF: '#fb7185',
  Final: '#f4c542',
}

// Official calendar (UEFA): the dates (YYYY-MM-DD) each round's games are played.
export const ROUNDS = [
  { stage: 'League', matchday: 1, dates: ['2026-09-08', '2026-09-09', '2026-09-10'] },
  { stage: 'League', matchday: 2, dates: ['2026-10-13', '2026-10-14'] },
  { stage: 'League', matchday: 3, dates: ['2026-10-20', '2026-10-21'] },
  { stage: 'League', matchday: 4, dates: ['2026-11-03', '2026-11-04'] },
  { stage: 'League', matchday: 5, dates: ['2026-11-24', '2026-11-25'] },
  { stage: 'League', matchday: 6, dates: ['2026-12-08', '2026-12-09'] },
  { stage: 'League', matchday: 7, dates: ['2027-01-19', '2027-01-20'] },
  { stage: 'League', matchday: 8, dates: ['2027-01-27'] },
  { stage: 'PO', dates: ['2027-02-16', '2027-02-17', '2027-02-23', '2027-02-24'] },
  { stage: 'R16', dates: ['2027-03-09', '2027-03-10', '2027-03-16', '2027-03-17'] },
  { stage: 'QF', dates: ['2027-04-06', '2027-04-07', '2027-04-13', '2027-04-14'] },
  { stage: 'SF', dates: ['2027-04-27', '2027-04-28', '2027-05-04', '2027-05-05'] },
  { stage: 'Final', dates: ['2027-06-05'] },
]

// Where a final league-phase position leads.
export const ZONES = [
  { key: 'r16', from: 1, to: 8, label: 'Round of 16' },
  { key: 'po', from: 9, to: 24, label: 'Knockout play-offs' },
  { key: 'out', from: 25, to: 36, label: 'Eliminated' },
]

export function zoneFor(rank) {
  return ZONES.find((z) => rank >= z.from && rank <= z.to)?.key || 'out'
}
