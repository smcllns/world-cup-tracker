// ESPN-scoreboard-shaped events for the Champions League tests, plus the
// parsed + tagged matches built from them.
import { parseEvent } from '../../src/ucl/services/espn.js'
import { tagMatches } from '../../src/ucl/utils/rounds.js'

export const CLUBS = {
  ars: { id: '359', displayName: 'Arsenal', shortDisplayName: 'Arsenal', abbreviation: 'ARS', color: 'e20520', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' },
  bar: { id: '83', displayName: 'Barcelona', shortDisplayName: 'Barcelona', abbreviation: 'BAR', color: '004d98', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png' },
  psg: { id: '160', displayName: 'Paris Saint-Germain', shortDisplayName: 'PSG', abbreviation: 'PSG', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png' },
  liv: { id: '364', displayName: 'Liverpool', shortDisplayName: 'Liverpool', abbreviation: 'LIV' },
  rma: { id: '86', displayName: 'Real Madrid', shortDisplayName: 'Real Madrid', abbreviation: 'RMA' },
  bay: { id: '132', displayName: 'Bayern Munich', shortDisplayName: 'Bayern', abbreviation: 'BAY' },
}

// One scoreboard event. `score` is [home, away]; `state` 'pre' | 'in' | 'post'.
export function espnEvent({
  id,
  date,
  home,
  away,
  state = 'pre',
  score = [0, 0],
  name,
  shortDetail,
  pens,
  details = [],
  venue,
  broadcasts,
}) {
  const typeName = name || { pre: 'STATUS_SCHEDULED', in: 'STATUS_SECOND_HALF', post: 'STATUS_FULL_TIME' }[state]
  const comp = {
    competitors: [
      { homeAway: 'home', team: home, score: String(score[0]), ...(pens ? { shootoutScore: pens[0] } : {}) },
      { homeAway: 'away', team: away, score: String(score[1]), ...(pens ? { shootoutScore: pens[1] } : {}) },
    ],
    details,
  }
  if (venue) comp.venue = venue
  if (broadcasts) comp.broadcasts = broadcasts
  return {
    id,
    date,
    status: {
      displayClock: "67'",
      type: { state, name: typeName, shortDetail: shortDetail ?? (state === 'in' ? "67'" : state === 'post' ? 'FT' : '10/21 - 3:00 PM EDT'), description: state === 'in' ? 'Second Half' : '' },
    },
    competitions: [comp],
  }
}

export const parsed = (events) => events.map(parseEvent).filter(Boolean)
export const tagged = (events) => tagMatches(parsed(events))
