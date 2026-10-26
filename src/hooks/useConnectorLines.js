import { useLayoutEffect, useState } from 'react'

// Bracket connector lines, computed as an SVG overlay from the cards' real
// boxes. Reading each card's box (relative to the bracket) means the elbows land
// exactly between a node and its feeders regardless of card height, gaps, or
// column spacing — which a pure-CSS pseudo-element approach can't guarantee.
//
// `edges` is [{ parent, children: [id, …] }] of DOM element ids inside the
// container. Each child gets a stub out of its right edge to a shared midpoint,
// a vertical join runs between the children (and the parent), and one stub runs
// into the parent — so two children make the classic elbow and a single child
// level with its parent makes a straight line. Missing elements are skipped.
// The SVG is sized to the lines themselves, never to the container's scroll
// size: it counts towards that size, so measuring it back could widen the
// scroll area on every recompute and leave empty space past the last column.
// Recomputes when `deps` change, on resize, and once fonts settle.
export function useConnectorLines(containerRef, edges, deps = []) {
  const [lines, setLines] = useState([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const wrap = containerRef.current
    if (!wrap) return
    const compute = () => {
      const base = wrap.getBoundingClientRect()
      const pos = (id) => {
        const el = wrap.querySelector(`#${id}`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        const x0 = r.left - base.left + wrap.scrollLeft
        const y0 = r.top - base.top + wrap.scrollTop
        return { left: x0, right: x0 + r.width, midY: y0 + r.height / 2 }
      }
      const segs = []
      let w = 0
      let h = 0
      for (const { parent, children } of edges) {
        const pp = pos(parent)
        const kids = children.map(pos).filter(Boolean)
        if (!pp || !kids.length) continue
        const childRight = Math.max(...kids.map((k) => k.right))
        const midX = Math.round((childRight + pp.left) / 2)
        const yp = Math.round(pp.midY)
        const ys = kids.map((k) => Math.round(k.midY))
        for (const [i, k] of kids.entries()) segs.push(`M${Math.round(k.right)} ${ys[i]}H${midX}`)
        const top = Math.min(...ys, yp)
        const bottom = Math.max(...ys, yp)
        if (bottom > top) segs.push(`M${midX} ${top}V${bottom}`)
        segs.push(`M${midX} ${yp}H${Math.round(pp.left)}`)
        w = Math.max(w, childRight, pp.left)
        h = Math.max(h, bottom)
      }
      setLines(segs)
      // A couple of pixels' room for the stroke.
      setSize({ w: Math.ceil(w) + 2, h: Math.ceil(h) + 2 })
    }
    compute()
    // ResizeObserver is absent in some environments (e.g. jsdom); degrade to a
    // one-shot compute + window-resize there rather than crashing.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null
    ro?.observe(wrap)
    window.addEventListener('resize', compute)
    // Fonts can settle after first paint and shift card heights; recompute once.
    if (document.fonts?.ready) document.fonts.ready.then(compute)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [containerRef, edges, ...deps])

  return { lines, size }
}
