import { useState } from 'react'
import { TEAMS } from '../data/teams.js'
import { computeGroup, groupHasResults } from '../utils/standings.js'

const GROUPS = Object.keys(TEAMS)

function GroupTable({ group, matches }) {
  const rows = computeGroup(group, matches)
  const played = groupHasResults(group, matches)
  return (
    <div className="group-card">
      <h3 className="group-title">Group {group}</h3>
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-team">Team</th>
            <th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className={i < 2 ? 'qualifies' : ''}>
              <td className="col-team">
                <span className="rank">{i + 1}</span>
                <span className="team-flag">{r.flag}</span>
                <span className="row-team">{r.name}</span>
              </td>
              <td>{r.P}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td>
              <td>{r.GF}</td><td>{r.GA}</td>
              <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
              <td className="col-pts">{r.Pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!played && <p className="group-note">No matches played yet</p>}
    </div>
  )
}

export default function Standings({ matches, hideScores }) {
  const [revealed, setRevealed] = useState(false)

  if (hideScores && !revealed) {
    return (
      <div className="standings-hidden">
        <p>🙈 Standings are hidden in spoiler-free mode.</p>
        <button className="reveal-btn" onClick={() => setRevealed(true)}>
          Reveal standings
        </button>
      </div>
    )
  }

  return (
    <>
      <p className="standings-legend">
        <span className="legend-swatch" /> Top two in each group advance, along with the eight best
        third-placed teams.
      </p>
      <div className="standings-grid">
        {GROUPS.map((g) => (
          <GroupTable key={g} group={g} matches={matches} />
        ))}
      </div>
    </>
  )
}
