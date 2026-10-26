import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SEASON } from './data/season.js'
import { fetchSeason, fetchRecent, SCOREBOARD } from './services/espn.js'
import { buildTies, tagMatches } from './utils/rounds.js'
import MatchList from './components/MatchList.jsx'
import MatchDetail from './components/MatchDetail.jsx'
import LeagueTable from './components/LeagueTable.jsx'
import Knockout from './components/Knockout.jsx'
import { detectTimezone, timezoneOptions } from '../utils/time.js'
import { readState, writeState } from '../utils/urlState.js'
import { DetailContext } from '../context/detail.js'

export const THEME_KEY = 'ucl:theme'
const REFRESH_MS = 120000 // poll every 2 minutes when nothing is live
const LIVE_REFRESH_MS = 30000 // every 30s while a match is in progress
const SEASON_REFRESH_MS = 30 * 60000 // full fixture list: every 30 minutes

export default function App() {
  const detectedTz = useMemo(detectTimezone, [])
  const initial = useMemo(() => readState(detectedTz), [detectedTz])

  const [theme, setTheme] = useState(
    () => (typeof document !== 'undefined' && document.documentElement.dataset.theme) || 'dark',
  )
  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })

  const [tz, setTz] = useState(initial.tz)
  const [hideScores, setHideScores] = useState(initial.hideScores)
  const [club, setClub] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const listRef = useRef(null)

  // Every fixture we've seen, by ESPN event id. Each fetch merges in (fresher
  // records replace older ones), so the fast live poll and the occasional full
  // season fetch never fight.
  const [byId, setById] = useState(() => new Map())
  const [feed, setFeed] = useState('loading') // 'loading' | 'ok' | 'error'
  const seasonAt = useRef(0)
  const inflight = useRef(null) // AbortController of the fetch under way, if any

  const refresh = useCallback(async () => {
    if (inflight.current) return // one at a time; a slow poll isn't stacked
    const ctrl = new AbortController()
    inflight.current = ctrl
    const full = Date.now() - seasonAt.current > SEASON_REFRESH_MS
    try {
      const fresh = await (full ? fetchSeason(ctrl.signal) : fetchRecent(ctrl.signal))
      if (full) seasonAt.current = Date.now()
      setById((prev) => {
        const next = new Map(prev)
        for (const [id, m] of fresh) next.set(id, m)
        return next
      })
      setFeed('ok')
    } catch {
      if (!ctrl.signal.aborted) setFeed((f) => (f === 'ok' ? 'ok' : 'error'))
    } finally {
      if (inflight.current === ctrl) inflight.current = null
    }
  }, [])

  useEffect(() => {
    refresh()
    // A home-screen app is resumed, not reloaded — catch up as soon as it's back.
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      inflight.current?.abort()
      inflight.current = null
    }
  }, [refresh])

  const matches = useMemo(() => tagMatches([...byId.values()]), [byId])
  const ties = useMemo(() => buildTies(matches), [matches])
  const liveCount = useMemo(() => matches.filter((m) => m.live).length, [matches])
  const clubs = useMemo(() => {
    const seen = new Map()
    for (const m of matches) {
      if (m.stage !== 'League') continue
      for (const c of [m.t1, m.t2]) if (c.id && !seen.has(c.id)) seen.set(c.id, c)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [matches])

  // Poll fast while a match is live, slowly otherwise (always on, silent).
  useEffect(() => {
    const id = setInterval(refresh, liveCount > 0 ? LIVE_REFRESH_MS : REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh, liveCount])

  useEffect(() => {
    writeState({ tz, hideScores }, detectedTz)
  }, [tz, hideScores, detectedTz])

  // The modal follows the live record, so an open match keeps updating.
  const detail = detailId ? matches.find((m) => m.id === detailId) : null
  const openDetail = useCallback((m) => setDetailId(m.id), [])
  // Stable, so the modal's focus handling doesn't re-run on every poll.
  const closeDetail = useCallback(() => setDetailId(null), [])

  const showClub = (c) => {
    setClub(c)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <DetailContext.Provider value={openDetail}>
    <div className="app">
      <header className="app-header">
        <div className="hero-corner">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title="Toggle light / dark theme"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '🌞'}
          </button>
        </div>
        <div className="title-block">
          <h1>
            <span className="trophy">⭐</span> {SEASON.name}
          </h1>
          <p className="subtitle">
            {SEASON.label} · 36 clubs · shown in{' '}
            <select
              className="tz-inline"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              aria-label="Timezone"
            >
              {timezoneOptions(detectedTz).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>{' '}
            timezone
          </p>
        </div>
      </header>

      <section className="bracket-view">
        <Knockout ties={[...ties.values()]} tz={tz} hideScores={hideScores} />
      </section>
      <hr className="section-rule" />

      <section ref={listRef} className="list-view">
        <MatchList
          matches={matches}
          ties={ties}
          clubs={clubs}
          club={club}
          setClub={setClub}
          tz={tz}
          hideScores={hideScores}
          setHideScores={setHideScores}
          feed={feed}
        />
      </section>

      <hr className="section-rule" />

      <footer className="app-footer">
        <details className="groups-disclosure">
          <summary>📊 Show league table</summary>
          <div className="groups-view">
            <LeagueTable matches={matches} hideScores={hideScores} onSelectClub={showClub} />
          </div>
        </details>

        <div className="footer-fineprint">
          <p>
            Kickoff times convert automatically to your selected timezone. Fixtures and scores
            update live from ESPN&rsquo;s public scoreboard; matchday and knockout-round labels
            follow UEFA&rsquo;s {SEASON.label} calendar. Your timezone &amp; spoiler mode are saved to
            the URL — bookmark or share it.
          </p>
          <p className="disclaimer">
            An unofficial fan-made project. Not affiliated with, endorsed by, or sponsored by UEFA.
            “Champions League”, club names and crests are trademarks of their respective owners.
            Fixtures &amp; results via{' '}
            <a href={SCOREBOARD.homepage} target="_blank" rel="noopener noreferrer">ESPN</a>; crest
            files via{' '}
            <a href="https://www.footylogos.com/logo-usage-right" target="_blank" rel="noopener noreferrer">
              FootyLogos
            </a>
            .
          </p>
          <p className="credit">
            Created by{' '}
            <a href="https://samcollins.blog" target="_blank" rel="noopener noreferrer">
              Sam Collins
            </a>{' '}
            ·{' '}
            <a href="https://github.com/smcllns/world-cup-tracker" target="_blank" rel="noopener noreferrer">
              github
            </a>{' '}
            · <a href="../">World Cup tracker</a>
          </p>
        </div>
      </footer>

      {detail && (
        <MatchDetail
          match={detail}
          tie={ties.get(detail.tieKey)}
          tz={tz}
          hideScores={hideScores}
          onClose={closeDetail}
        />
      )}
    </div>
    </DetailContext.Provider>
  )
}
