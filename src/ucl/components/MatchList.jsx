import { useMemo, useState } from 'react'
import { STAGE_COLORS } from '../data/season.js'
import { aggregateFor, isPlayed, matchTitle, roundLabel } from '../utils/rounds.js'
import { dayKey, formatTime, tzAbbrev } from '../../utils/time.js'
import { useDetail } from '../../context/detail.js'
import LiveBadge from '../../components/LiveBadge.jsx'
import ClubSelect from './ClubSelect.jsx'
import Crest from './Crest.jsx'

// "Tue · Oct 20 · Matchday 3" for a day-group header, in the viewer's timezone.
// A UEFA match night is a single round, so the round lives here rather than on
// every row — which leaves the rows room for full club names on a phone.
function dayHeaderLabel(matches, tz) {
  const d = new Date(matches[0].ko)
  const wd = d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' })
  const md = d.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })
  const rounds = [...new Set(matches.map(roundLabel))]
  return [`${wd} · ${md}`, ...rounds].join(' · ')
}

function scoreText(m) {
  return `${m.score[0]}–${m.score[1]}${m.pens ? ` (p ${m.pens[0]}–${m.pens[1]})` : m.aet ? ' AET' : ''}`
}

function MatchRow({ m, tie, tz, hideScores }) {
  const openDetail = useDetail()
  const color = STAGE_COLORS[m.stage]
  const showScore = Array.isArray(m.score) && !hideScores
  const agg = showScore && !m.live ? aggregateFor(tie, m) : null
  const middle = m.postponed ? 'PPD' : showScore ? scoreText(m) : 'v'
  const aria = `${matchTitle(m)}, ${m.t1.name} ${showScore ? scoreText(m) : 'versus'} ${m.t2.name}, ${formatTime(m.ko, tz)}`

  return (
    <button
      type="button"
      className="ml-row"
      style={{ borderLeftColor: color }}
      onClick={() => openDetail(m)}
      aria-label={aria}
    >
      <span className="ml-time">
        <span className="ml-ko">{formatTime(m.ko, tz)}</span>
        <span className="ml-tz">{tzAbbrev(m.ko, tz)}</span>
      </span>
      <span className="ml-team ml-team-1">
        <span className="ml-name">{m.t1.short}</span>
        <Crest club={m.t1} className="ml-crest" />
      </span>
      <span className="ml-score">
        {m.live ? <LiveBadge match={m} className="ml-live" /> : middle}
        {agg && <span className="ml-agg">agg {agg[0]}–{agg[1]}</span>}
      </span>
      <span className="ml-team ml-team-2">
        <Crest club={m.t2} className="ml-crest" />
        <span className="ml-name">{m.t2.short}</span>
      </span>
    </button>
  )
}

export default function MatchList({
  matches,
  ties,
  clubs,
  club,
  setClub,
  tz,
  hideScores,
  setHideScores = () => {},
  feed = 'ok',
}) {
  const [tab, setTab] = useState('upcoming') // 'upcoming' | 'played'
  const [pickerOpen, setPickerOpen] = useState(false)

  const groups = useMemo(() => {
    const want = tab === 'played'
    const filtered = matches.filter(
      (m) => isPlayed(m) === want && (!club || m.t1.id === club.id || m.t2.id === club.id),
    )
    const byDay = {}
    for (const m of filtered) {
      const k = dayKey(m.ko, tz)
      ;(byDay[k] ||= []).push(m)
    }
    // Within a day, chronological; played days flip to most-recent-first.
    for (const k in byDay) {
      byDay[k].sort((a, b) => new Date(a.ko) - new Date(b.ko))
      if (want) byDay[k].reverse()
    }
    const keys = Object.keys(byDay).sort()
    if (want) keys.reverse()
    return keys.map((k) => ({ key: k, matches: byDay[k] }))
  }, [matches, tz, tab, club])

  const total = groups.reduce((n, g) => n + g.matches.length, 0)

  let empty = null
  if (total === 0) {
    if (!matches.length && feed === 'loading') empty = 'Loading fixtures…'
    else if (!matches.length && feed === 'error') empty = 'Couldn’t reach the score feed — retrying shortly.'
    else empty = `No ${tab} matches${club ? ` for ${club.name}` : ''}.`
  }

  return (
    <div className="matchlist">
      <div className="ml-controls">
        <div className="ml-toggle" role="tablist" aria-label="Match list filter">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upcoming'}
            className={`ml-tab${tab === 'upcoming' ? ' active' : ''}`}
            onClick={() => setTab('upcoming')}
          >
            Upcoming
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'played'}
            className={`ml-tab${tab === 'played' ? ' active' : ''}`}
            onClick={() => setTab('played')}
          >
            Played
          </button>
        </div>

        <div className="ml-filter">
          <button
            type="button"
            className={`ml-country${club ? ' active' : ''}`}
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-label={club ? `Filtering by ${club.name}. Change club` : 'Filter by club'}
          >
            {club ? <Crest club={club} className="ml-country-crest" /> : <span className="ml-country-flag">⭐</span>}
            <span className="ml-country-name">{club ? club.name : 'All Clubs'}</span>
            <span className="ml-country-caret" aria-hidden="true">▾</span>
          </button>
          {club && (
            <button
              type="button"
              className="ml-country-clear"
              onClick={() => setClub(null)}
              aria-label="Clear club filter, show all clubs"
            >
              ✕
            </button>
          )}
        </div>

        <label className="scores-toggle" title="Toggle spoiler-free mode for all scores">
          <span className="scores-toggle-label">{hideScores ? '🙈' : '👁'} Scores</span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Show scores"
            checked={!hideScores}
            onChange={() => setHideScores((h) => !h)}
          />
          <span className="switch-track"><span className="switch-thumb" /></span>
        </label>
      </div>

      {empty ? (
        <p className="ml-empty">{empty}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="ml-day">
            <h3 className="ml-day-head">{dayHeaderLabel(g.matches, tz)}</h3>
            <div className="ml-rows">
              {g.matches.map((m) => (
                <MatchRow key={m.id} m={m} tie={ties?.get(m.tieKey)} tz={tz} hideScores={hideScores} />
              ))}
            </div>
          </section>
        ))
      )}

      {pickerOpen && (
        <ClubSelect clubs={clubs} selected={club} onSelect={setClub} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
