import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CRESTS, crestFile } from '../../src/ucl/data/crests.js'
import { prepareSvg } from '../../scripts/ucl-crests.mjs'

const DIR = join(__dirname, '../../public/ucl/crests')
const files = readdirSync(DIR).filter((f) => f.endsWith('.svg'))

describe('crest files', () => {
  it('has a file for every mapped club, and no unmapped files', () => {
    const slugs = new Set(Object.values(CRESTS))
    expect(slugs.size).toBe(Object.keys(CRESTS).length) // one club per slug
    expect(files.map((f) => f.replace(/\.svg$/, '')).sort()).toEqual([...slugs].sort())
  })

  it('only ships safe, scalable SVGs', () => {
    for (const f of files) {
      const svg = readFileSync(join(DIR, f), 'utf8')
      expect(prepareSvg(svg), f).toBe(svg) // passes the checks and already has a viewBox
    }
  })

  it('resolves a club id to its page-relative file', () => {
    expect(crestFile('359')).toBe('crests/arsenal.svg')
    expect(crestFile(86)).toBe('crests/real-madrid.svg')
    expect(crestFile('999999')).toBeNull()
  })
})

describe('prepareSvg', () => {
  it('adds a viewBox from width/height so the crest scales', () => {
    expect(prepareSvg('<svg width="550" height="705px"><path/></svg>')).toBe(
      '<svg viewBox="0 0 550 705" width="550" height="705px"><path/></svg>',
    )
    expect(prepareSvg('<svg viewBox="0 0 1 1"/>')).toBe('<svg viewBox="0 0 1 1"/>')
  })

  it('rejects anything that could run or load content on our origin', () => {
    expect(() => prepareSvg('<html></html>')).toThrow('not an SVG')
    expect(() => prepareSvg('<svg viewBox="0 0 1 1"><script>x()</script></svg>')).toThrow('script')
    expect(() => prepareSvg('<svg viewBox="0 0 1 1" onload="x()"/>')).toThrow('script')
    expect(() => prepareSvg('<svg viewBox="0 0 1 1"><a href="javascript:x()"/></svg>')).toThrow('script')
    expect(() => prepareSvg('<svg viewBox="0 0 1 1"><foreignObject/></svg>')).toThrow('script')
    expect(() => prepareSvg('<svg viewBox="0 0 1 1"><image href="https://x.test/a.png"/></svg>')).toThrow('external')
    expect(() => prepareSvg('<svg viewBox="0 0 1 1"><image xlink:href="data:image/png;base64,AA"/></svg>')).toThrow('external')
  })

  it('allows in-document references', () => {
    const svg = '<svg viewBox="0 0 1 1"><use xlink:href="#a"/><image href="data:image/svg+xml;base64,AA"/></svg>'
    expect(prepareSvg(svg)).toBe(svg)
  })

  it('needs a size to derive a missing viewBox', () => {
    expect(() => prepareSvg('<svg width="10"><path/></svg>')).toThrow('no viewBox')
  })
})
