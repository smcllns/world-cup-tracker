import { useEffect } from 'react'
import { STAGE_LABELS } from '../data/matches.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { BRACKET, matchesByNum } from '../utils/bracket.js'
import { teamKickoffTooltip } from '../utils/time.js'
import { useFollow } from '../context/follow.jsx'
import { useDetail } from '../context/detail.js'
import LiveBadge from './LiveBadge.jsx'
import ScoreCheck from './ScoreCheck.jsx'

// Team names are pre-resolved upstream (clinched "Winner Group X" slots are
// already filled in the match data), so this just renders whatever it's given.
function Side({ name, ko }) {
  const { isFollowed } = useFollow()
  const flag = FLAG_BY_TEAM[name]
  const on = Boolean(flag) && isFollowed(name)
  return (
    <div className={`bx-side${on ? ' followed' : ''}`} title={teamKickoffTooltip(ko, name) || undefined}>
      <span className="bx-flag">{flag || '·'}</span>
      <span className={flag ? 'bx-team' : 'bx-tbd'}>{name}</span>
    </div>
  )
}

function BracketMatch({ num, byNum, tz, hideScores }) {
  const openDetail = useDetail()
  const m = byNum[num]
  if (!m) return null
  // Compact date only ("Jun 13") — no year, no timezone abbrev, to save width.
  const date = new Date(m.ko).toLocaleDateString('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
  })
  const showScore = m.score && !hideScores
  return (
    <div className="bx-match" id={`bx-m${m.num}`} role="button" tabIndex={0}
      aria-label={`${m.t1} versus ${m.t2}, ${STAGE_LABELS[m.stage]}, Match ${m.num}`}
      onClick={() => openDetail(m)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDetail(m)}>
      <div className="bx-meta">
        <span className="bx-num">M{m.num}</span>
        {m.live ? <LiveBadge match={m} /> : <span className="bx-date">{date}</span>}
      </div>
      <Side name={m.t1} ko={m.ko} />
      <Side name={m.t2} ko={m.ko} />
      {showScore && (
        <div className="bx-score">
          {m.score[0]}–{m.score[1]}
          {m.pens && <span className="bx-pens"> (p {m.pens[0]}–{m.pens[1]})</span>}
          {m.aet && !m.pens && <span className="bx-pens"> AET</span>}
          <ScoreCheck match={m} compact />
        </div>
      )}
    </div>
  )
}

// `connect` controls which elbow connectors a column draws ('right' for the
// left half feeding rightward, 'left' for the right half feeding leftward,
// 'none' for the outermost R32 columns and the Final).
function Column({ title, nums, connect, byNum, tz, hideScores }) {
  return (
    <div className={`bx-col bx-connect-${connect}`}>
      <div className="bx-col-head">{title}</div>
      <div className="bx-col-body">
        {nums.map((n) => (
          <div className="bx-cell" key={n}>
            <BracketMatch num={n} byNum={byNum} tz={tz} hideScores={hideScores} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Bracket({ matches, tz, hideScores, focusMatch, onFocusHandled }) {
  const byNum = matchesByNum(matches)
  const common = { byNum, tz, hideScores }

  // When arriving from an "As it stands" link, scroll the target match into
  // view (the bracket can scroll horizontally on narrow screens) and flash a
  // highlight, then clear.
  useEffect(() => {
    if (focusMatch == null) return
    const el = document.getElementById(`bx-m${focusMatch}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' })
      el.classList.add('bx-focus')
      setTimeout(() => el.classList.remove('bx-focus'), 2200)
    }
    onFocusHandled?.()
  }, [focusMatch, onFocusHandled])

  return (
    <div className="bracket-wrap">
      <div className="bracket">
        <Column title={STAGE_LABELS.R32} nums={BRACKET.left.R32} connect="none" {...common} />
        <Column title={STAGE_LABELS.R16} nums={BRACKET.left.R16} connect="right" {...common} />
        <Column title={STAGE_LABELS.QF} nums={BRACKET.left.QF} connect="right" {...common} />
        <Column title={STAGE_LABELS.SF} nums={BRACKET.left.SF} connect="right" {...common} />

        <div className="bx-col bx-col-final bx-connect-none">
          <div className="bx-col-head bx-final-head">🏆 {STAGE_LABELS.Final}</div>
          <div className="bx-col-body">
            <div className="bx-cell">
              <BracketMatch num={BRACKET.final[0]} {...common} />
            </div>
            <div className="bx-third-label">{STAGE_LABELS['3rd']}</div>
            <div className="bx-cell">
              <BracketMatch num={BRACKET.third[0]} {...common} />
            </div>
          </div>
        </div>

        <Column title={STAGE_LABELS.SF} nums={BRACKET.right.SF} connect="left" {...common} />
        <Column title={STAGE_LABELS.QF} nums={BRACKET.right.QF} connect="left" {...common} />
        <Column title={STAGE_LABELS.R16} nums={BRACKET.right.R16} connect="left" {...common} />
        <Column title={STAGE_LABELS.R32} nums={BRACKET.right.R32} connect="none" {...common} />
      </div>
    </div>
  )
}
