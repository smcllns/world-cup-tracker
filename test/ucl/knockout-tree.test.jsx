import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Knockout from '../../src/ucl/components/Knockout.jsx'
import { DetailContext } from '../../src/context/detail.js'
import { buildTies } from '../../src/ucl/utils/rounds.js'
import { tagged } from './fixtures.js'

// Real 2025/26 knockout data (see tree.test.js).
const REAL = JSON.parse(readFileSync(join(__dirname, 'fixtures/espn-ko-2025-26.json'), 'utf8')).events
const tiesOf = (...slugs) => [...buildTies(tagged(REAL.filter((e) => slugs.includes(e.season.slug)))).values()]
const ALL = ['knockout-round-playoffs', 'round-of-16', 'quarterfinals', 'semifinals', 'final']

const show = (ties, hideScores = false) => {
  const openDetail = vi.fn()
  render(
    <DetailContext.Provider value={openDetail}>
      <Knockout ties={ties} tz="America/New_York" hideScores={hideScores} />
    </DetailContext.Provider>,
  )
  return openDetail
}
const card = (id) => document.getElementById(id)

describe('Knockout tree (before the knockouts)', () => {
  it('shows the outline, labelled by league position, with a note', () => {
    show([])
    expect(screen.getByText(/fills in after the league phase ends on 27 January/)).toBeInTheDocument()
    expect(card('ucl-PO-0')).toHaveAccessibleName('Knockout play-offs: 15th/16th versus 17th/18th')
    expect(card('ucl-R16-0')).toHaveAccessibleName('Round of 16: 1st/2nd versus Play-off winner')
    expect(card('ucl-QF-0')).toHaveAccessibleName('Quarter-finals: TBD versus TBD')
    expect(within(card('ucl-Final-0')).getByText('Jun 5')).toBeInTheDocument()
    expect(screen.queryByText('To be drawn')).not.toBeInTheDocument()
  })
})

describe('Knockout tree (undrawn)', () => {
  it('draws the whole played tree with connector lines', () => {
    show(tiesOf(...ALL))
    expect(document.querySelectorAll('.bx-match')).toHaveLength(8 + 8 + 4 + 2 + 1)
    expect(document.querySelectorAll('.ucl-placeholder')).toHaveLength(0)
    // jsdom has no layout, but every linked edge still yields its segments.
    expect(document.querySelectorAll('.bx-lines path').length).toBeGreaterThan(0)
    expect(within(card('ucl-Final-0')).getByText('PSG').closest('.bx-side')).toHaveClass('ucl-winner')
    expect(within(card('ucl-Final-0')).getByText('p 4–3')).toBeInTheDocument()
  })

  it('names the semi-final winners in the final before it’s in the feed', () => {
    show(tiesOf('knockout-round-playoffs', 'round-of-16', 'quarterfinals', 'semifinals'))
    const final = card('ucl-Final-0')
    expect(final).toHaveClass('ucl-placeholder')
    expect(final).toHaveAccessibleName('Final: Paris Saint-Germain versus Arsenal')
    expect(within(final).getByText('Jun 5')).toBeInTheDocument()
  })

  it('keeps winners hidden in spoiler-free mode', () => {
    show(tiesOf('knockout-round-playoffs', 'round-of-16', 'quarterfinals', 'semifinals'), true)
    const final = card('ucl-Final-0')
    expect(within(final).getByText('PSG / Bayern')).toBeInTheDocument()
    expect(within(final).getByTitle('Winner of Paris Saint-Germain v Bayern Munich')).toBeInTheDocument()
  })

  it('says “To be drawn” for rounds with nothing to show', () => {
    show(tiesOf('knockout-round-playoffs'))
    expect(screen.getAllByText('To be drawn')).toHaveLength(3) // R16, QF, SF
    expect(card('ucl-Final-0')).toHaveAccessibleName('Final: TBD versus TBD')
  })

  it('opens a tie’s leg from its card', () => {
    const openDetail = show(tiesOf(...ALL))
    fireEvent.click(card('ucl-QF-0'))
    expect(openDetail).toHaveBeenCalledWith(expect.objectContaining({ stage: 'QF', leg: 2 }))
  })
})
