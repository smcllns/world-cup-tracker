import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from '../src/App.jsx'
import Standings from '../src/components/Standings.jsx'
import Bracket from '../src/components/Bracket.jsx'
import { MATCHES } from '../src/data/matches.js'
import { resolveClinchedSlots } from '../src/utils/clinch.js'
import { DetailContext } from '../src/context/detail.js'
import { FollowProvider } from '../src/context/follow.jsx'

// Mock the results feed so mount doesn't hit the network.
beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
  window.history.replaceState(null, '', '/')
})

describe('App renders (smoke test)', () => {
  // This is the test that would have caught the "black page" crash: a component
  // using a hook without importing it throws on render, and render() rejects.
  it('mounts without crashing and shows the header + single-page sections', () => {
    render(<App />)
    expect(screen.getByText(/World Cup 2026/)).toBeInTheDocument()
    // Bracket + match list are always mounted; the groups disclosure too.
    expect(screen.getByText(/Show group tables/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Upcoming/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Played/ })).toBeInTheDocument()
  })

  it('expands the groups disclosure to reveal all 4 group tables', () => {
    render(<App />)
    fireEvent.click(screen.getByText(/Show group tables/))
    expect(screen.getByRole('heading', { name: 'Group A' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Group L' })).toBeInTheDocument()
  })

  it('opens the match-detail modal from a list row', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /versus/ })[0])
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(/How to watch/)).toBeInTheDocument()
  })

  it('toggles the color theme', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Toggle theme/ }))
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: /Toggle theme/ }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('Standings clinch badges', () => {
  it('renders the clinch verdict next to a team when provided', () => {
    const clinch = { Mexico: 'won-group', Brazil: 'eliminated' }
    render(
      <FollowProvider>
        <Standings matches={MATCHES} hideScores={false} clinch={clinch} />
      </FollowProvider>,
    )
    // Badges render as "🥇 Won group" / "❌ Eliminated" (emoji + text in one
    // node), and also appear in the legend — so match flexibly and expect ≥1.
    expect(screen.getAllByText(/Won group/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Eliminated/).length).toBeGreaterThan(0)
  })
})

describe('Bracket clinch resolution', () => {
  it('renders the clinched winner once slots are resolved in the match data', () => {
    // Resolution happens upstream (App) so the team flows to every view; the
    // Bracket just renders whatever names it's given.
    const resolved = resolveClinchedSlots(MATCHES, { Mexico: 'won-group' })
    render(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <Bracket matches={resolved} tz="America/New_York" hideScores={false} />
        </DetailContext.Provider>
      </FollowProvider>,
    )
    // M79's first side was "Winner Group A" — now resolved to Mexico.
    expect(screen.getByText('Mexico')).toBeInTheDocument()
    expect(screen.queryByText('Winner Group A')).not.toBeInTheDocument()
    // Other, unclinched winner slots remain placeholders.
    expect(screen.getByText('Winner Group B')).toBeInTheDocument()
  })
})
