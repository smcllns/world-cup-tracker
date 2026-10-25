import { useState } from 'react'
import { aggregateFor, matchTitle } from '../utils/rounds.js'
import { formatTime, formatDateLong, tzAbbrev } from '../../utils/time.js'
import { useModalA11y } from '../../hooks/useModalA11y.js'
import { Timeline } from '../../components/MatchDetail.jsx'
import LiveBadge from '../../components/LiveBadge.jsx'
import Crest from './Crest.jsx'

const shortDate = (iso, tz) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })

// The tie's other leg, one line: the 1st leg's result from a 2nd leg, or when
// the 2nd leg kicks off from a 1st.
function OtherLeg({ match, tie, tz, hidden }) {
  const other = tie?.legs.find((l) => l.id !== match.id)
  if (!other) return null
  const label = match.leg === 2 ? '1st leg' : '2nd leg'
  const result = Array.isArray(other.score) && !hidden
  return (
    <div>
      <strong>{label}</strong>{' '}
      {result
        ? `${other.t1.name} ${other.score[0]}–${other.score[1]} ${other.t2.name} · ${shortDate(other.ko, tz)}`
        : `${other.t1.name} v ${other.t2.name} · ${shortDate(other.ko, tz)}, ${formatTime(other.ko, tz)} ${tzAbbrev(other.ko, tz)}`}
    </div>
  )
}

export default function MatchDetail({ match, tie, tz, hideScores, onClose }) {
  const [reveal, setReveal] = useState(false)
  const cardRef = useModalA11y(onClose)

  if (!match) return null
  const hasScore = Array.isArray(match.score)
  const hidden = hideScores && !reveal
  const scoreHidden = hasScore && hidden
  const agg = aggregateFor(tie, match)
  const venue = match.venue

  return (
    <div className="md-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="md-card" ref={cardRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="md-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="md-head">
          <span className="md-stage">{matchTitle(match)}</span>
          <LiveBadge match={match} className="md-live" />
          {match.postponed && <span className="md-live">{match.postponed}</span>}
        </div>

        <div className="md-teams">
          <div className="md-team">
            <Crest club={match.t1} className="md-crest" />
            <span className="md-name">{match.t1.name}</span>
          </div>
          <div className="md-score">
            {hasScore ? (
              scoreHidden ? (
                <button className="md-reveal" onClick={() => setReveal(true)}>🙈 reveal</button>
              ) : (
                <>
                  {match.score[0]}–{match.score[1]}
                  {match.pens && <div className="md-extra">penalties<br />{match.pens[0]}–{match.pens[1]}</div>}
                  {match.aet && !match.pens && <div className="md-extra">after extra time</div>}
                  {agg && <div className="md-extra">aggregate {agg[0]}–{agg[1]}</div>}
                </>
              )
            ) : (
              <span className="md-vs">vs</span>
            )}
          </div>
          <div className="md-team">
            <Crest club={match.t2} className="md-crest" />
            <span className="md-name">{match.t2.name}</span>
          </div>
        </div>

        <div className="md-meta">
          <div className="md-when">
            <span className="md-when-label">When</span>
            <span className="md-when-value">
              {formatDateLong(match.ko, tz)} · {formatTime(match.ko, tz)} {tzAbbrev(match.ko, tz)}
            </span>
          </div>
          {venue && (
            <div>
              <strong>Venue</strong> {[venue.name, venue.city, venue.country].filter(Boolean).join(', ')}
            </div>
          )}
          <OtherLeg match={match} tie={tie} tz={tz} hidden={hidden} />
        </div>

        {hasScore && !scoreHidden && (
          <div className="md-section">
            <h4>Match events</h4>
            <Timeline match={match} />
          </div>
        )}

        {match.tv?.length > 0 && (
          <div className="md-section">
            <h4>How to watch (US)</h4>
            <div className="md-watch">
              <div>{match.tv.join(' · ')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
