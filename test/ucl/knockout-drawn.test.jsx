import { describe, it, expect, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Knockout from '../../src/ucl/components/Knockout.jsx'
import { buildTies } from '../../src/ucl/utils/rounds.js'
import { tagged } from './fixtures.js'

// As if BRACKET had been filled in after last season's round-of-16 draw.
vi.mock('../../src/ucl/data/bracket.js', () => ({
  BRACKET: ['PSG', 'Liverpool', 'Real Madrid', 'Bayern', 'Barcelona', 'Atlético', 'Sporting', 'Arsenal'],
}))

const REAL = JSON.parse(readFileSync(join(__dirname, 'fixtures/espn-ko-2025-26.json'), 'utf8')).events
const tiesOf = (...slugs) => [...buildTies(tagged(REAL.filter((e) => slugs.includes(e.season.slug)))).values()]
const card = (id) => document.getElementById(id)

describe('Knockout tree (drawn)', () => {
  it('shows the path to the final as soon as the round of 16 is drawn', () => {
    render(<Knockout ties={tiesOf('knockout-round-playoffs', 'round-of-16')} tz="UTC" hideScores={false} />)
    expect(document.querySelectorAll('.ucl-placeholder')).toHaveLength(4 + 2 + 1)
    // Round-of-16 winners already known go straight into their quarter-final.
    expect(card('ucl-QF-0')).toHaveAccessibleName('Quarter-finals: Paris Saint-Germain versus Liverpool')
    expect(within(card('ucl-QF-0')).getByText('Apr 6')).toBeInTheDocument()
    expect(within(card('ucl-QF-0')).getByText('Apr 14')).toBeInTheDocument()
    // Deeper rounds name the ties they're waiting on.
    expect(within(card('ucl-SF-0')).getByText('PSG / Liverpool')).toBeInTheDocument()
    expect(card('ucl-Final-0')).toHaveAccessibleName('Final: TBD versus TBD')
  })

  it('holds a drawn slot open until its fixture appears', () => {
    render(<Knockout ties={tiesOf('knockout-round-playoffs')} tz="UTC" hideScores={false} />)
    expect(card('ucl-R16-0')).toHaveAccessibleName('Round of 16: PSG versus TBD')
  })
})
