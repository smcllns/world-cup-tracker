import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import App, { THEME_KEY } from '../../src/ucl/App.jsx'
import { CLUBS, espnEvent } from './fixtures.js'

const { ars, bar, liv, psg } = CLUBS

// Fake ESPN keyed by the `dates` query value; records every request. Like a
// browser, an aborted request rejects.
function serve(routes) {
  const fn = vi.fn(async (url, opts) => {
    await Promise.resolve()
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const dates = new URL(url).searchParams.get('dates')
    const hit = typeof routes === 'function' ? routes(dates) : routes[dates]
    if (hit === 'down') throw new TypeError('offline')
    return { ok: true, json: async () => ({ events: hit || [] }) }
  })
  global.fetch = fn
  return fn
}
const datesOf = (fn) => fn.mock.calls.map((c) => new URL(c[0]).searchParams.get('dates'))

const realFetch = global.fetch
beforeEach(() => {
  window.history.replaceState(null, '', '/ucl/')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  global.fetch = realFetch
  vi.useRealTimers()
  delete document.documentElement.dataset.theme
})

const upcoming = espnEvent({ id: 40, date: '2026-11-04T20:00Z', home: liv, away: psg })
const played = espnEvent({ id: 30, date: '2026-10-21T19:00Z', home: ars, away: bar, state: 'post', score: [2, 1] })

describe('UCL App', () => {
  it('loads the season and lists fixtures with the timezone picker', async () => {
    const fetch = serve({ '202610': [played], '202611': [upcoming] })
    render(<App />)
    expect(screen.getByRole('heading', { name: /Champions League/ })).toBeInTheDocument()
    expect(screen.getByText('Loading fixtures…')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Liverpool versus/ })).toBeInTheDocument()
    expect(datesOf(fetch)).toContain('202609')
    // No knockout fixtures yet, so no knockout section.
    expect(screen.queryByText('Round of 16')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Timezone' }), { target: { value: 'Asia/Tokyo' } })
    expect(window.location.search).toBe('?tz=Asia%2FTokyo')
  })

  it('loads under StrictMode’s mount / unmount / remount', async () => {
    serve({ '202611': [upcoming] })
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    expect(await screen.findByRole('button', { name: /Liverpool versus/ })).toBeInTheDocument()
  })

  it('opens and closes a match, following its live record', async () => {
    serve({ '202611': [upcoming] })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Liverpool versus Paris Saint-Germain/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('League phase · Matchday 4')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filters the list from the league table', async () => {
    serve({ '202610': [played], '202611': [upcoming] })
    render(<App />)
    await screen.findByRole('button', { name: /Liverpool versus/ })
    fireEvent.click(screen.getByText('📊 Show league table'))
    fireEvent.click(screen.getByTitle('Show Liverpool matches'))
    expect(screen.getByRole('button', { name: /Filtering by Liverpool/ })).toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('shows the knockout section once knockout fixtures exist', async () => {
    serve({
      '202703': [espnEvent({ id: 50, date: '2027-03-10T20:00Z', home: ars, away: bar })],
    })
    render(<App />)
    expect(await screen.findByText('Round of 16')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Arsenal versus Barcelona, Round of 16' })).toBeInTheDocument()
  })

  it('says when the feed is unreachable', async () => {
    serve(() => 'down')
    render(<App />)
    expect(await screen.findByText(/Couldn’t reach the score feed/)).toBeInTheDocument()
  })

  it('polls recent days, faster while a match is live, and catches up on resume', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-04T20:30:00Z') })
    const live = espnEvent({ id: 40, date: '2026-11-04T20:00Z', home: liv, away: psg, state: 'in', score: [1, 0] })
    const fetch = serve({ '202611': [upcoming], 20261104: [live] })
    render(<App />)
    await screen.findByRole('button', { name: /Liverpool versus/ })

    fetch.mockClear()
    await act(() => vi.advanceTimersByTimeAsync(120_000))
    expect(datesOf(fetch)).toEqual(['20261103', '20261104', '20261105'])
    expect(await screen.findByRole('status')).toHaveTextContent("67'")

    // Live now: the next poll comes after 30s, not 2 minutes.
    fetch.mockClear()
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(fetch).toHaveBeenCalledTimes(3)

    // Coming back to the app refreshes straight away; hiding it doesn't.
    fetch.mockClear()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(fetch).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('keeps showing fixtures when a later poll fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-04T12:00:00Z') })
    let down = false
    serve((dates) => (down ? 'down' : dates === '202611' ? [upcoming] : []))
    render(<App />)
    await screen.findByRole('button', { name: /Liverpool versus/ })
    down = true
    await act(() => vi.advanceTimersByTimeAsync(120_000))
    expect(screen.getByRole('button', { name: /Liverpool versus/ })).toBeInTheDocument()
    expect(screen.queryByText(/Couldn’t reach/)).not.toBeInTheDocument()
  })

  it('toggles and remembers the theme', async () => {
    serve({})
    render(<App />)
    const btn = screen.getByRole('button', { name: 'Toggle theme' })
    expect(btn).toHaveTextContent('🌞')
    fireEvent.click(btn)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(btn).toHaveTextContent('🌙')
    fireEvent.click(btn)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('survives storage being unavailable', () => {
    serve({})
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    spy.mockRestore()
  })
})
