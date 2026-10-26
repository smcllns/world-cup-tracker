import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useRef } from 'react'
import { useConnectorLines } from '../src/hooks/useConnectorLines.js'

// Fake layout: each card id maps to a box { left, top, width, height }.
function withBoxes(boxes) {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const b = boxes[this.id] || { left: 0, top: 0, width: 0, height: 0 }
    return { ...b, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top }
  })
}

function Tree({ edges, ids, onLines }) {
  const ref = useRef(null)
  const { lines, size } = useConnectorLines(ref, edges, [])
  onLines(lines, size)
  return (
    <div id="wrap" ref={ref}>
      {ids.map((id) => (
        <div key={id} id={id} />
      ))}
    </div>
  )
}

afterEach(() => vi.restoreAllMocks())

describe('useConnectorLines', () => {
  it('draws an elbow from two children into their parent', () => {
    withBoxes({
      wrap: { left: 0, top: 0, width: 500, height: 300 },
      a: { left: 0, top: 0, width: 100, height: 40 },
      b: { left: 0, top: 100, width: 100, height: 40 },
      p: { left: 200, top: 50, width: 100, height: 40 },
    })
    let out
    let size
    render(
      <Tree
        ids={['a', 'b', 'p']}
        edges={[{ parent: 'p', children: ['a', 'b'] }]}
        onLines={(l, s) => {
          out = l
          size = s
        }}
      />,
    )
    expect(out).toEqual(['M100 20H150', 'M100 120H150', 'M150 20V120', 'M150 70H200'])
    // Sized to the lines (plus the stroke), not to the 500×300 container.
    expect(size).toEqual({ w: 202, h: 122 })
  })

  it('draws a straight line from a single child level with its parent', () => {
    withBoxes({
      wrap: { left: 0, top: 0, width: 500, height: 300 },
      c: { left: 0, top: 10, width: 100, height: 40 },
      p: { left: 200, top: 10, width: 100, height: 40 },
    })
    let out
    render(<Tree ids={['c', 'p']} edges={[{ parent: 'p', children: ['c'] }]} onLines={(l) => (out = l)} />)
    expect(out).toEqual(['M100 30H150', 'M150 30H200'])
  })

  it('skips edges whose cards are missing', () => {
    let out
    render(
      <Tree
        ids={['p']}
        edges={[{ parent: 'p', children: ['gone'] }, { parent: 'nope', children: ['p'] }]}
        onLines={(l) => (out = l)}
      />,
    )
    expect(out).toEqual([])
  })

  it('recomputes on resize and once fonts settle', async () => {
    const boxes = { wrap: { left: 0, top: 0, width: 500, height: 300 }, c: { left: 0, top: 0, width: 100, height: 40 }, p: { left: 200, top: 0, width: 100, height: 40 } }
    const spy = withBoxes(boxes)
    let ready
    Object.defineProperty(document, 'fonts', { value: { ready: new Promise((r) => (ready = r)) }, configurable: true })
    const observed = []
    global.ResizeObserver = class {
      constructor(cb) { this.cb = cb }
      observe(el) { observed.push(el) }
      disconnect() {}
    }
    const { unmount } = render(<Tree ids={['c', 'p']} edges={[{ parent: 'p', children: ['c'] }]} onLines={() => {}} />)
    const calls = spy.mock.calls.length
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(spy.mock.calls.length).toBeGreaterThan(calls)
    await act(async () => ready())
    expect(observed).toHaveLength(1)
    unmount()
    delete global.ResizeObserver
    delete document.fonts
  })
})
