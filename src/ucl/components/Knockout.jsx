import { useMemo, useRef } from 'react'
import { KNOCKOUT_STAGES, ROUNDS, STAGE_LABELS } from '../data/season.js'
import { isPlayed } from '../utils/rounds.js'
import { layoutBracket, slotId } from '../utils/tree.js'
import { useConnectorLines } from '../../hooks/useConnectorLines.js'
import { useDetail } from '../../context/detail.js'
import LiveBadge from '../../components/LiveBadge.jsx'
import Crest from './Crest.jsx'

const shortDate = (iso, tz) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })
// A calendar day (YYYY-MM-DD), not an instant: format it as written.
const calendarDay = (day) => shortDate(`${day}T12:00:00Z`, 'UTC')

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

function TieCard({ id, tie, tz, hideScores }) {
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
      id={id}
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

// "A / B": whichever of two clubs comes through.
const either = (a, b) => ({ label: `${a.short} / ${b.short}`, title: `Winner of ${a.name} v ${b.name}` })

// Who fills one side of a placeholder, from the slot feeding it: the winner of
// its tie once decided (unless scores are hidden), else its two clubs; for a
// feeder that's a placeholder itself, its two clubs once both are known.
function feeder(slot, hideScores) {
  const tie = slot?.tie
  if (tie) {
    const winner = !hideScores && tie.winner && tie.clubs.find((c) => c.id === tie.winner)
    return winner ? { club: winner } : either(...tie.clubs)
  }
  if (slot?.kids) {
    const [a, b] = slot.kids.map((k) => feeder(k, hideScores).club)
    if (a && b) return either(a, b)
  }
  return { label: slot?.seed || 'TBD' }
}

// A slot whose feeders are known but whose fixture isn't in the feed yet.
function PlaceholderCard({ slot, hideScores }) {
  const sides = slot.kids ? slot.kids.map((k) => feeder(k, hideScores)) : [feeder(slot), { label: 'TBD' }]
  const days = ROUNDS.filter((r) => r.stage === slot.stage).flatMap((r) => r.dates)
  const span = [...new Set([days[0], days[days.length - 1]])].filter(Boolean)
  const text = (s) => s.club?.name || s.label
  return (
    <div className="bx-match ucl-placeholder" id={slotId(slot)} aria-label={`${STAGE_LABELS[slot.stage]}: ${sides.map(text).join(' versus ')}`}>
      <div className="bx-card-row">
        <div className="bx-meta">
          {span.map((d) => (
            <span key={d} className="bx-date">{calendarDay(d)}</span>
          ))}
        </div>
        <div className="bx-teams">
          {sides.map((s, i) =>
            s.club ? (
              <Side key={i} club={s.club} />
            ) : (
              <div key={i} className="bx-side" title={s.title}>
                <span className="bx-tbd">{s.label}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

// The knockout phase as a tree, play-offs → Final, shown once the draw puts
// knockout fixtures in the feed. utils/tree.js decides where each tie sits and
// which slots feed which; the connector lines follow those links only, so a
// round whose path isn't known yet simply isn't joined up.
export default function Knockout({ ties, tz, hideScores }) {
  const { slots, edges } = useMemo(() => layoutBracket(ties), [ties])
  const bracketRef = useRef(null)
  const { lines, size } = useConnectorLines(bracketRef, edges, [tz, hideScores])
  return (
    <div className="bracket-wrap">
      <div className="bracket ucl-knockout" ref={bracketRef}>
        <svg className="bx-lines" width={size.w} height={size.h} aria-hidden="true">
          {lines.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
        {KNOCKOUT_STAGES.map((stage) => {
          const col = slots[stage]
          const any = col.some((s) => s.show)
          const final = stage === 'Final'
          return (
            <div key={stage} className={`bx-col${final ? ' bx-col-final' : ''}`}>
              <div className={`bx-col-head${final ? ' bx-final-head' : ''}`}>
                {final ? '🏆 ' : ''}
                {STAGE_LABELS[stage]}
              </div>
              <div className="bx-col-body">
                {any ? (
                  col.map((s) => (
                    <div className="bx-cell" key={s.key}>
                      {s.show === 'tie' && <TieCard id={slotId(s)} tie={s.tie} tz={tz} hideScores={hideScores} />}
                      {s.show === 'placeholder' && <PlaceholderCard slot={s} hideScores={hideScores} />}
                    </div>
                  ))
                ) : (
                  <p className="ucl-tbd-note">To be drawn</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
