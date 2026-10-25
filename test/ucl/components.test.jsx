import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import MatchList from '../../src/ucl/components/MatchList.jsx'
import MatchDetail from '../../src/ucl/components/MatchDetail.jsx'
import LeagueTable from '../../src/ucl/components/LeagueTable.jsx'
import Knockout, { focusLeg } from '../../src/ucl/components/Knockout.jsx'
import Crest, { crestSrc } from '../../src/ucl/components/Crest.jsx'
import { DetailContext } from '../../src/context/detail.js'
import { buildTies } from '../../src/ucl/utils/rounds.js'
import { CLUBS, espnEvent, tagged } from './fixtures.js'

const { ars, bar, psg, liv, rma, bay } = CLUBS
const TZ = 'America/New_York'

const withDetail = (ui) => {
  const openDetail = vi.fn()
  render(<DetailContext.Provider value={openDetail}>{ui}</DetailContext.Provider>)
  return openDetail
}

// A small season: two played league games, a live one, one upcoming, a
// postponed one, and a finished two-legged Round of 16 tie.
const matches = tagged([
  espnEvent({ id: 1, date: '2026-10-20T19:00Z', home: ars, away: bar, state: 'post', score: [2, 1] }),
  espnEvent({ id: 2, date: '2026-10-21T19:00Z', home: liv, away: psg, state: 'post', score: [0, 0] }),
  espnEvent({ id: 3, date: '2026-11-04T20:00Z', home: rma, away: bay, state: 'in', score: [1, 0] }),
  espnEvent({ id: 4, date: '2026-11-25T20:00Z', home: psg, away: ars }),
  espnEvent({ id: 5, date: '2026-11-24T20:00Z', home: bar, away: liv, state: 'post', name: 'STATUS_POSTPONED', shortDetail: 'Postponed' }),
  espnEvent({ id: 10, date: '2027-03-10T20:00Z', home: ars, away: bay, state: 'post', score: [2, 0] }),
  espnEvent({ id: 11, date: '2027-03-17T20:00Z', home: bay, away: ars, state: 'post', score: [3, 1], name: 'STATUS_FINAL_AET' }),
])
const ties = buildTies(matches)
const clubs = [ars, bar, psg, liv, rma, bay].map((t) => matches.flatMap((m) => [m.t1, m.t2]).find((c) => c.id === t.id))
const byId = (id) => matches.find((m) => m.id === String(id))

function List(props) {
  return (
    <MatchList matches={matches} ties={ties} clubs={clubs} club={null} setClub={() => {}} tz={TZ} hideScores={false} {...props} />
  )
}

describe('MatchList', () => {
  it('shows upcoming, live and postponed matches by default, with crests', () => {
    withDetail(<List />)
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Real Madrid')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent("● 67'") // live badge, not the running score
    expect(screen.getByText('PPD')).toBeInTheDocument()
    expect(screen.queryByText('2–1')).not.toBeInTheDocument()
    expect(document.querySelectorAll('img.crest').length).toBeGreaterThan(0)
  })

  it('Played lists results newest first, with the round and the 2nd-leg aggregate', () => {
    withDetail(<List />)
    fireEvent.click(screen.getByRole('tab', { name: 'Played' }))
    const rows = screen.getAllByRole('button', { name: /versus|–/ })
    expect(rows[0]).toHaveAccessibleName(/Round of 16 · 2nd leg, Bayern Munich 3–1 AET Arsenal/)
    expect(within(rows[0]).getByText('agg 3–3')).toBeInTheDocument()
    expect(screen.getByText('2–1')).toBeInTheDocument()
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Wed · Mar 17 · Round of 16 · 2nd leg',
      'Wed · Mar 10 · Round of 16 · 1st leg',
      'Wed · Oct 21 · Matchday 3',
      'Tue · Oct 20 · Matchday 3',
    ])
  })

  it('hides scores in spoiler mode and toggles it', () => {
    const setHideScores = vi.fn()
    withDetail(<List hideScores setHideScores={setHideScores} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Played' }))
    expect(screen.queryByText('2–1')).not.toBeInTheDocument()
    expect(screen.queryByText(/agg/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Show scores' }))
    expect(setHideScores).toHaveBeenCalled()
    expect(setHideScores.mock.calls[0][0](true)).toBe(false)
  })

  it('opens the detail view for a row', () => {
    const openDetail = withDetail(<List />)
    fireEvent.click(screen.getByRole('button', { name: /Matchday 4, Real Madrid 1–0 Bayern Munich/ }))
    expect(openDetail).toHaveBeenCalledWith(byId(3))
  })

  it('filters by club through the picker, and clears', () => {
    const setClub = vi.fn()
    const { rerender } = render(<List setClub={setClub} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filter by club' }))
    const dialog = screen.getByRole('dialog', { name: 'Filter by club' })
    fireEvent.click(within(dialog).getByRole('button', { name: /Liverpool/ }))
    expect(setClub).toHaveBeenCalledWith(clubs[3])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<List club={clubs[4]} setClub={setClub} />)
    expect(screen.getByRole('button', { name: /Filtering by Real Madrid/ })).toBeInTheDocument()
    expect(screen.queryByText('Arsenal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Clear club filter/ }))
    expect(setClub).toHaveBeenLastCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: /Filtering by Real Madrid/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /All clubs/ }))
    expect(setClub).toHaveBeenLastCalledWith(null)
  })

  it('closes the picker with its close button', () => {
    render(<List />)
    fireEvent.click(screen.getByRole('button', { name: 'Filter by club' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains an empty list: loading, feed down, or nothing left', () => {
    const { rerender } = render(<List matches={[]} feed="loading" />)
    expect(screen.getByText('Loading fixtures…')).toBeInTheDocument()
    rerender(<List matches={[]} feed="error" />)
    expect(screen.getByText(/Couldn’t reach the score feed/)).toBeInTheDocument()
    rerender(<List matches={[]} />)
    expect(screen.getByText('No upcoming matches.')).toBeInTheDocument()
    rerender(<List club={clubs[4]} matches={matches.filter((m) => m.id === '1')} />)
    expect(screen.getByText('No upcoming matches for Real Madrid.')).toBeInTheDocument()
  })

  it('renders without a ties map', () => {
    render(<List ties={undefined} />)
    expect(screen.getByText('Real Madrid')).toBeInTheDocument()
  })
})

describe('MatchDetail', () => {
  const open = (id, props = {}) => {
    const onClose = vi.fn()
    const m = byId(id)
    render(<MatchDetail match={m} tie={ties.get(m.tieKey)} tz={TZ} hideScores={false} onClose={onClose} {...props} />)
    return onClose
  }

  it('shows a 2nd leg with extra time, aggregate and the 1st leg', () => {
    open(11)
    expect(screen.getByText('Round of 16 · 2nd leg')).toBeInTheDocument()
    expect(screen.getByText('after extra time')).toBeInTheDocument()
    expect(screen.getByText('aggregate 3–3')).toBeInTheDocument()
    expect(screen.getByText(/Arsenal 2–0 Bayern Munich · Wed, Mar 10/)).toBeInTheDocument()
  })

  it('points a 1st leg at the 2nd and shows venue + TV when known', () => {
    const m = {
      ...byId(10),
      venue: { name: 'Emirates Stadium', city: 'London', country: '' },
      tv: ['Paramount+', 'CBS'],
    }
    render(<MatchDetail match={m} tie={ties.get(m.tieKey)} tz={TZ} hideScores={false} onClose={() => {}} />)
    expect(screen.getByText('Round of 16 · 1st leg')).toBeInTheDocument()
    expect(screen.getByText(/Bayern Munich 3–1 Arsenal · Wed, Mar 17/)).toBeInTheDocument()
    expect(screen.queryByText(/aggregate/)).not.toBeInTheDocument()
    expect(screen.getByText('Emirates Stadium, London')).toBeInTheDocument()
    expect(screen.getByText('Paramount+ · CBS')).toBeInTheDocument()
  })

  it('gives the kickoff of a 2nd leg still to come', () => {
    const ms = tagged([
      espnEvent({ id: 10, date: '2027-03-10T20:00Z', home: ars, away: bay, state: 'post', score: [2, 0] }),
      espnEvent({ id: 11, date: '2027-03-17T20:00Z', home: bay, away: ars }),
    ])
    render(<MatchDetail match={ms[0]} tie={buildTies(ms).get(ms[0].tieKey)} tz={TZ} hideScores={false} onClose={() => {}} />)
    expect(screen.getByText(/Bayern Munich v Arsenal · Wed, Mar 17, 4:00 PM EDT/)).toBeInTheDocument()
  })

  it('hides the score in spoiler mode until revealed', () => {
    open(11, { hideScores: true })
    expect(screen.queryByText('aggregate 3–3')).not.toBeInTheDocument()
    expect(screen.getByText(/Arsenal v Bayern Munich/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reveal/ }))
    expect(screen.getByText('aggregate 3–3')).toBeInTheDocument()
    expect(screen.getByText('Match events')).toBeInTheDocument()
  })

  it('shows penalties, live and postponed states', () => {
    const pens = { ...byId(11), pens: [4, 2] }
    const { unmount } = render(<MatchDetail match={pens} tz={TZ} hideScores={false} onClose={() => {}} />)
    expect(screen.getByText(/penalties/)).toHaveTextContent('penalties4–2')
    unmount()
    const live = render(<MatchDetail match={byId(3)} tz={TZ} hideScores={false} onClose={() => {}} />)
    expect(screen.getByText('League phase · Matchday 4')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    live.unmount()
    render(<MatchDetail match={byId(5)} tz={TZ} hideScores={false} onClose={() => {}} />)
    expect(screen.getByText('Postponed')).toBeInTheDocument()
    expect(screen.getByText('vs')).toBeInTheDocument()
  })

  it('closes from the button and the backdrop, not the card', () => {
    const onClose = open(4)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByText('vs'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders nothing without a match', () => {
    const { container } = render(<MatchDetail match={null} tz={TZ} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('LeagueTable', () => {
  it('ranks clubs with zones, live markers, and selects a club on tap', () => {
    const onSelectClub = vi.fn()
    render(<LeagueTable matches={matches} hideScores={false} onSelectClub={onSelectClub} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveClass('zone-r16')
    expect(within(rows[0]).getByText('Arsenal')).toBeInTheDocument()
    expect(screen.getAllByTitle(/Playing now/)).toHaveLength(2)
    expect(screen.getByText(/9–24 Knockout play-offs/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bayern/ }))
    expect(onSelectClub).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bayern Munich' }))
  })

  it('shows positive goal difference with a plus', () => {
    render(<LeagueTable matches={matches} hideScores={false} />)
    expect(within(screen.getAllByRole('row')[1]).getByText('+1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Arsenal/ })) // no handler: no-op
  })

  it('is hidden in spoiler mode until revealed', () => {
    render(<LeagueTable matches={matches} hideScores />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal table' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('waits for fixtures', () => {
    render(<LeagueTable matches={[]} hideScores={false} />)
    expect(screen.getByText(/once fixtures load/)).toBeInTheDocument()
  })
})

describe('Knockout', () => {
  const ko = tagged([
    espnEvent({ id: 10, date: '2027-03-10T20:00Z', home: ars, away: bay, state: 'post', score: [2, 0] }),
    espnEvent({ id: 11, date: '2027-03-17T20:00Z', home: bay, away: ars, state: 'post', score: [1, 1] }),
    espnEvent({ id: 12, date: '2027-03-10T20:00Z', home: liv, away: psg, state: 'post', score: [1, 0] }),
    espnEvent({ id: 13, date: '2027-03-17T20:00Z', home: psg, away: liv, state: 'in', score: [2, 0] }),
    espnEvent({ id: 14, date: '2027-02-24T20:00Z', home: rma, away: bar, state: 'post', score: [1, 1], pens: [3, 4] }),
    espnEvent({ id: 20, date: '2027-06-05T19:00Z', home: rma, away: { displayName: 'TBD' } }),
  ])
  const koTies = [...buildTies(ko).values()]

  it('lays ties out by round with aggregates, winners and placeholders', () => {
    const openDetail = withDetail(<Knockout ties={koTies} tz={TZ} hideScores={false} />)
    expect(screen.getByText('Quarter-finals').nextSibling).toHaveTextContent('To be drawn')
    const tie = screen.getByRole('button', { name: 'Arsenal versus Bayern Munich, Round of 16' })
    expect(within(tie).getByText('3')).toBeInTheDocument()
    expect(within(tie).getByText('agg')).toBeInTheDocument()
    expect(within(tie).getByText('Arsenal').closest('.bx-side')).toHaveClass('ucl-winner')
    expect(within(tie).getByText('Bayern').closest('.bx-side')).toHaveClass('ucl-out')
    // A tie with a leg in progress shows the clock, not a running aggregate.
    const live = screen.getByRole('button', { name: /Liverpool versus/ })
    expect(within(live).getByRole('status')).toBeInTheDocument()
    expect(within(live).queryByText('agg')).not.toBeInTheDocument()
    // Single-leg play-off fixture decided on penalties; a TBD final.
    const po = screen.getByRole('button', { name: /Real Madrid versus Barcelona/ })
    expect(within(po).getByText('p 3–4')).toBeInTheDocument()
    expect(document.querySelector('.bx-tbd')).toHaveTextContent('TBD')
    fireEvent.click(tie)
    expect(openDetail).toHaveBeenCalledWith(expect.objectContaining({ id: '11' }))
    fireEvent.keyDown(live, { key: 'Enter' })
    expect(openDetail).toHaveBeenLastCalledWith(expect.objectContaining({ id: '13' }))
    fireEvent.keyDown(live, { key: 'x' })
    expect(openDetail).toHaveBeenCalledTimes(2)
  })

  it('shows AET when extra time settled it, and hides results in spoiler mode', () => {
    const aet = tagged([
      espnEvent({ id: 10, date: '2027-04-06T19:00Z', home: ars, away: bay, state: 'post', score: [0, 0] }),
      espnEvent({ id: 11, date: '2027-04-13T19:00Z', home: bay, away: ars, state: 'post', score: [1, 2], name: 'STATUS_FINAL_AET' }),
    ])
    withDetail(<Knockout ties={[...buildTies(aet).values()]} tz={TZ} hideScores={false} />)
    expect(screen.getByText('AET')).toBeInTheDocument()
    cleanup()
    withDetail(<Knockout ties={koTies} tz={TZ} hideScores />)
    expect(screen.queryByText('agg')).not.toBeInTheDocument()
    expect(document.querySelector('.ucl-winner')).toBeNull()
  })

  it('opens the next leg to be played', () => {
    const next = tagged([
      espnEvent({ id: 10, date: '2027-04-06T19:00Z', home: ars, away: bay, state: 'post', score: [0, 0] }),
      espnEvent({ id: 11, date: '2027-04-13T19:00Z', home: bay, away: ars }),
    ])
    expect(focusLeg([...buildTies(next).values()][0]).id).toBe('11')
  })
})

describe('Crest', () => {
  it('requests a resized ESPN crest', () => {
    expect(crestSrc('https://a.espncdn.com/i/teamlogos/soccer/500/83.png')).toBe(
      'https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/83.png&w=128&h=128',
    )
    expect(crestSrc('https://a.espncdn.com/combiner/i?img=/x.png')).toBe('https://a.espncdn.com/combiner/i?img=/x.png')
    expect(crestSrc('https://example.com/x.png')).toBe('https://example.com/x.png')
    expect(crestSrc('not a url')).toBe('not a url')
    expect(crestSrc(null)).toBeNull()
  })

  it('falls back to the original logo, then to initials in the club colour', () => {
    const club = { name: 'Arsenal', abbr: 'ARS', color: '#e20520', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' }
    const { container, rerender } = render(<Crest club={club} />)
    const img = () => container.querySelector('img')
    expect(img().getAttribute('src')).toContain('combiner')
    fireEvent.error(img())
    expect(img().getAttribute('src')).toBe(club.logo)
    fireEvent.error(img())
    expect(container.querySelector('.crest-initials')).toHaveTextContent('ARS')
    expect(container.querySelector('.crest-initials')).toHaveStyle({ background: '#e20520' })
    // A different club starts over from its own crest.
    rerender(<Crest club={{ ...club, logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png' }} />)
    expect(img()).not.toBeNull()
  })

  it('prefers our own SVG crest, then falls back to ESPN', () => {
    const club = { name: 'Arsenal', abbr: 'ARS', crest: 'crests/arsenal.svg', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' }
    const { container } = render(<Crest club={club} />)
    const img = () => container.querySelector('img')
    expect(img().getAttribute('src')).toBe('crests/arsenal.svg')
    fireEvent.error(img())
    expect(img().getAttribute('src')).toContain('combiner')
    fireEvent.error(img())
    expect(img().getAttribute('src')).toBe(club.logo)
    fireEvent.error(img())
    expect(container.querySelector('.crest-initials')).toHaveTextContent('ARS')
  })

  it('uses initials straight away without a logo', () => {
    const { container, rerender } = render(<Crest club={{ name: 'Slavia Praha' }} />)
    expect(container.querySelector('.crest-initials')).toHaveTextContent('SLA')
    expect(container.querySelector('.crest-initials').getAttribute('style')).toBeNull()
    rerender(<Crest />)
    expect(container.querySelector('.crest-initials')).toHaveTextContent('?')
  })
})
