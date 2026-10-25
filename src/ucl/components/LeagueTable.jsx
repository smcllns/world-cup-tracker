import { useMemo, useState } from 'react'
import { ZONES } from '../data/season.js'
import { computeTable } from '../utils/table.js'
import Crest from './Crest.jsx'

const TIEBREAK_TIP =
  'Tie-breakers: points → goal difference → goals scored → away goals → wins → away wins → opponents’ collective points, goal difference and goals'

// The 36-club league-phase table, coloured by where each position leads. Tapping
// a club filters the match list to its fixtures.
export default function LeagueTable({ matches, hideScores, onSelectClub }) {
  const [revealed, setRevealed] = useState(false)
  const rows = useMemo(() => computeTable(matches), [matches])

  if (hideScores && !revealed) {
    return (
      <div className="standings-hidden">
        <p>🙈 The table is hidden in spoiler-free mode.</p>
        <button className="reveal-btn" onClick={() => setRevealed(true)}>Reveal table</button>
      </div>
    )
  }
  if (!rows.length) return <p className="ml-empty">The table appears once fixtures load.</p>

  // Clubs playing a league-phase match right now: their row is provisional.
  const live = new Set()
  for (const m of matches) {
    if (m.stage === 'League' && m.live) {
      live.add(m.t1.id)
      live.add(m.t2.id)
    }
  }

  return (
    <>
      <p className="standings-legend">
        {ZONES.map((z) => (
          <span key={z.key} className="ucl-legend-item">
            <span className={`legend-swatch ucl-swatch-${z.key}`} /> {z.from}–{z.to} {z.label}
          </span>
        ))}
        ·{' '}
        <span className="legend-tb" tabIndex={0} role="note" aria-label={TIEBREAK_TIP} data-tip={TIEBREAK_TIP}>
          tie-breakers
        </span>
      </p>
      <div className="group-card ucl-table-card">
        <table className="standings-table ucl-table">
          <thead>
            <tr>
              <th className="col-team">Club</th>
              <th>P</th><th>W</th><th>D</th><th>L</th>
              <th>GD</th><th className="col-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.club.id} className={`zone-${r.zone}`}>
                <td className="col-team">
                  <button
                    type="button"
                    className="ucl-club-btn"
                    onClick={() => onSelectClub?.(r.club)}
                    title={`Show ${r.club.name} matches`}
                  >
                    <span className="rank">{r.rank}</span>
                    <Crest club={r.club} className="ucl-table-crest" />
                    <span className="row-team">{r.club.short}</span>
                  </button>
                  {live.has(r.club.id) && (
                    <span className="row-live-dot" title="Playing now — score is provisional">●</span>
                  )}
                </td>
                <td>{r.P}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td>
                <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                <td className="col-pts">{r.Pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
