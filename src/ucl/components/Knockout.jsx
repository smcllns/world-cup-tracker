import { KNOCKOUT_STAGES, STAGE_LABELS } from '../data/season.js'
import { isPlayed } from '../utils/rounds.js'
import { useDetail } from '../../context/detail.js'
import LiveBadge from '../../components/LiveBadge.jsx'
import Crest from './Crest.jsx'

const shortDate = (iso, tz) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })

// The leg worth opening from a tie card: the live one, else the next to be
// played, else the last.
export function focusLeg(tie) {
  return tie.legs.find((l) => l.live) || tie.legs.find((l) => !isPlayed(l)) || tie.legs[tie.legs.length - 1]
}

function Side({ club, goals, winner, decided }) {
  const out = decided && !winner
  return (
    <div className={`bx-side${winner ? ' ucl-winner' : ''}${out ? ' ucl-out' : ''}`}>
      <Crest club={club} className="bx-crest" />
      <span className={club.id ? 'bx-team' : 'bx-tbd'}>{club.short}</span>
      {goals != null && <span className="bx-side-score">{goals}</span>}
    </div>
  )
}

function TieCard({ tie, tz, hideScores }) {
  const openDetail = useDetail()
  const [a, b] = tie.clubs
  const live = tie.legs.find((l) => l.live)
  // The aggregate is the headline score, but not mid-leg (that'd read as a
  // settled result) and never in spoiler-free mode.
  const showAgg = tie.scored && !hideScores && !live
  const last = tie.legs[tie.legs.length - 1]
  const decided = Boolean(tie.winner) && !hideScores
  const leg = focusLeg(tie)
  let extra = null
  if (showAgg) {
    if (last.pens) extra = `p ${last.pens[0]}–${last.pens[1]}`
    else if (last.aet && isPlayed(last)) extra = 'AET'
    else if (tie.legs.length === 2) extra = 'agg'
  }
  return (
    <div
      className="bx-match"
      role="button"
      tabIndex={0}
      aria-label={`${a.name} versus ${b.name}, ${STAGE_LABELS[tie.stage]}`}
      onClick={() => openDetail(leg)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDetail(leg)}
    >
      <div className="bx-card-row">
        <div className="bx-meta">
          {live ? (
            <LiveBadge match={live} />
          ) : (
            tie.legs.map((l) => (
              <span key={l.id} className="bx-date">{shortDate(l.ko, tz)}</span>
            ))
          )}
        </div>
        <div className="bx-teams">
          <Side club={a} goals={showAgg ? tie.agg[a.id] : null} winner={decided && tie.winner === a.id} decided={decided} />
          <Side club={b} goals={showAgg ? tie.agg[b.id] : null} winner={decided && tie.winner === b.id} decided={decided} />
          {extra && <div className="bx-score-extra">{extra}</div>}
        </div>
      </div>
    </div>
  )
}

// Knockout phase as columns of ties, play-offs → Final. Shown once the draw
// puts knockout fixtures in the feed. No connector lines: which tie feeds which
// is set by UEFA's draw, not derivable from the fixtures alone.
export default function Knockout({ ties, tz, hideScores }) {
  const byStage = Object.fromEntries(KNOCKOUT_STAGES.map((s) => [s, []]))
  for (const tie of ties) byStage[tie.stage]?.push(tie)
  return (
    <div className="bracket-wrap">
      <div className="bracket ucl-knockout">
        {KNOCKOUT_STAGES.map((stage) => (
          <div key={stage} className={`bx-col${stage === 'Final' ? ' bx-col-final' : ''}`}>
            <div className={`bx-col-head${stage === 'Final' ? ' bx-final-head' : ''}`}>
              {stage === 'Final' ? '🏆 ' : ''}
              {STAGE_LABELS[stage]}
            </div>
            <div className="bx-col-body">
              {byStage[stage].length ? (
                byStage[stage].map((tie) => (
                  <div className="bx-cell" key={tie.key}>
                    <TieCard tie={tie} tz={tz} hideScores={hideScores} />
                  </div>
                ))
              ) : (
                <p className="ucl-tbd-note">To be drawn</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
