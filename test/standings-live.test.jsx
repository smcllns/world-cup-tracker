import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FollowProvider } from '../src/context/follow.jsx'
import Standings from '../src/components/Standings.jsx'
import { MATCHES } from '../src/data/matches.js'

const renderStandings = (matches) =>
  render(
    <FollowProvider>
      <Standings matches={matches} hideScores={false} clinch={{}} />
    </FollowProvider>,
  )

describe('Standings live (in-progress) markers', () => {
  it('blinks a LIVE marker on the group and a dot on both playing teams', () => {
    // M28 = Mexico v South Korea (Group A) — mark it in progress.
    const matches = MATCHES.map((m) =>
      m.num === 28 ? { ...m, live: { clock: "45'" }, score: [1, 0] } : m,
    )
    const { container } = renderStandings(matches)

    const groupA = screen.getByText('Group A').closest('.group-card')
    expect(within(groupA).getByText(/● LIVE/)).toBeInTheDocument()
    // Both teams in the live match get a provisional dot; no other group does.
    expect(container.querySelectorAll('.row-live-dot')).toHaveLength(2)
    expect(screen.getByText('Group B').closest('.group-card').querySelector('.group-live')).toBeNull()
  })

  it('shows no LIVE markers when nothing is in progress', () => {
    const { container } = renderStandings(MATCHES)
    expect(container.querySelector('.group-live')).toBeNull()
    expect(container.querySelectorAll('.row-live-dot')).toHaveLength(0)
  })
})
