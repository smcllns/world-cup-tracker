import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { layoutBracket, slotId, SLOTS } from '../../src/ucl/utils/tree.js'
import { buildTies } from '../../src/ucl/utils/rounds.js'
import { tagged } from './fixtures.js'

// The real 2025/26 knockout phase, as ESPN served it (play-offs to the final).
const REAL = JSON.parse(readFileSync(join(__dirname, 'fixtures/espn-ko-2025-26.json'), 'utf8')).events
const tiesOf = (events) => [...buildTies(tagged(events)).values()]
const names = (slot) => slot.tie?.clubs.map((c) => c.short).join(' v ') ?? null
const column = (layout, stage) => layout.slots[stage].map(names)
// Drop whole rounds, as if they hadn't been played yet.
const upTo = (...stages) => REAL.filter((e) => stages.includes(e.season.slug))

describe('layoutBracket — undrawn, linked from the fixtures', () => {
  const full = layoutBracket(tiesOf(REAL), [])

  it('rebuilds last season’s whole tree from ESPN’s fixtures alone', () => {
    expect(full.drawn).toBe(false)
    expect(column(full, 'Final')).toEqual(['PSG v Arsenal'])
    expect(column(full, 'SF')).toEqual(['PSG v Bayern', 'Atlético v Arsenal'])
    expect(column(full, 'QF')).toEqual(['PSG v Liverpool', 'Real Madrid v Bayern', 'Barcelona v Atlético', 'Sporting v Arsenal'])
    expect(column(full, 'R16')).toEqual([
      'PSG v Chelsea', 'Galatasaray v Liverpool', 'Real Madrid v Man City', 'Atalanta v Bayern',
      'Newcastle v Barcelona', 'Atlético v Spurs', 'Bodo/Glimt v Sporting', 'Leverkusen v Arsenal',
    ])
    // Each play-off tie sits level with the round-of-16 tie its winner joined.
    expect(column(full, 'PO')).toEqual([
      'Monaco v PSG', 'Galatasaray v Juventus', 'Benfica v Real Madrid', 'Dortmund v Atalanta',
      'FK Qarabag v Newcastle', 'Club Brugge v Atlético', 'Bodo/Glimt v Inter Milan', 'Olympiacos v Leverkusen',
    ])
  })

  it('links every round, so the whole tree gets lines', () => {
    for (const stage of ['R16', 'QF', 'SF', 'Final']) {
      for (const s of full.slots[stage]) expect(s.show, s.key).toBe('tie')
    }
    for (const stage of ['QF', 'SF', 'Final']) for (const s of full.slots[stage]) expect(s.known, s.key).toBe(true)
    expect(full.edges).toHaveLength(8 + 4 + 2 + 1)
    expect(full.edges).toContainEqual({ parent: 'ucl-R16-0', children: ['ucl-PO-0'] })
    expect(full.edges).toContainEqual({ parent: 'ucl-QF-0', children: ['ucl-R16-0', 'ucl-R16-1'] })
    expect(full.edges).toContainEqual({ parent: 'ucl-Final-0', children: ['ucl-SF-0', 'ucl-SF-1'] })
    expect(full.slots.Final[0].tie.winner).toBe('160') // PSG, on penalties
  })

  it('after the play-offs only: later rounds wait, the final is a placeholder', () => {
    const po = layoutBracket(tiesOf(upTo('knockout-round-playoffs')), [])
    expect(po.slots.PO.every((s) => s.show === 'tie')).toBe(true)
    for (const stage of ['R16', 'QF', 'SF']) expect(po.slots[stage].every((s) => s.show === null)).toBe(true)
    expect(po.slots.Final[0].show).toBe('placeholder')
    expect(po.edges).toEqual([])
  })

  it('mid-round-of-16: play-offs link up, quarter-finals not yet', () => {
    const r16 = layoutBracket(tiesOf(upTo('knockout-round-playoffs', 'round-of-16')), [])
    expect(r16.slots.R16.every((s) => s.show === 'tie')).toBe(true)
    expect(r16.slots.QF.every((s) => s.show === null)).toBe(true)
    expect(r16.edges).toHaveLength(8) // PO -> R16 only
    // Round of 16 in kickoff order until the quarter-finals say otherwise.
    expect(names(r16.slots.R16[0])).toBe('Galatasaray v Liverpool')
    expect(names(r16.slots.PO[0])).toBe('Galatasaray v Juventus')
  })

  it('leaves out ties with a placeholder side', () => {
    const tbd = { stage: 'QF', clubs: [{ id: '1', short: 'A' }, { id: null, short: 'TBD' }], legs: [] }
    const out = layoutBracket([tbd], [])
    expect(out.slots.QF.every((s) => s.tie === null)).toBe(true)
  })
})

describe('layoutBracket — drawn from BRACKET', () => {
  // Last season's bracket order, named the way someone would type it.
  const BRACKET = ['psg', 'Liverpool', 'Real Madrid', 'Bayern Munich', 'Barcelona', 'Atletico Madrid', 'Sporting CP', 'ARS']

  it('places the round of 16 by the draw and agrees with the played tree', () => {
    const drawn = layoutBracket(tiesOf(REAL), BRACKET)
    const linked = layoutBracket(tiesOf(REAL), [])
    expect(drawn.drawn).toBe(true)
    for (const stage of Object.keys(SLOTS)) expect(column(drawn, stage)).toEqual(column(linked, stage))
    expect(drawn.edges).toEqual(linked.edges)
  })

  it('shows the path ahead as placeholders straight after the draw', () => {
    const out = layoutBracket(tiesOf(upTo('knockout-round-playoffs', 'round-of-16')), BRACKET)
    expect(out.slots.QF.every((s) => s.show === 'placeholder' && s.known)).toBe(true)
    expect(out.slots.QF[0].kids.map(names)).toEqual(['PSG v Chelsea', 'Galatasaray v Liverpool'])
    expect(out.slots.SF[1].kids.map((k) => k.key)).toEqual(['QF-2', 'QF-3'])
    expect(out.edges).toHaveLength(8 + 4 + 2 + 1)
    expect(out.edges).toContainEqual({ parent: 'ucl-SF-0', children: ['ucl-QF-0', 'ucl-QF-1'] })
  })

  it('keeps a seeded slot whose fixture isn’t in the feed yet', () => {
    const out = layoutBracket(tiesOf(upTo('knockout-round-playoffs')), BRACKET)
    expect(out.slots.R16[7]).toMatchObject({ show: 'placeholder', seed: 'ARS', tie: null })
    // The play-offs can't line up with fixtures that don't exist yet.
    expect(out.edges.filter((e) => e.parent.startsWith('ucl-R16'))).toEqual([])
  })

  it('ignores a bracket that isn’t eight ties long', () => {
    expect(layoutBracket(tiesOf(REAL), BRACKET.slice(0, 7)).drawn).toBe(false)
  })

  it('still places a tie that doesn’t match the drawn bracket', () => {
    const swapped = ['Chelsea', 'Galatasaray', 'Arsenal', 'Sporting', 'Barcelona', 'Atlético', 'Real Madrid', 'Bayern']
    const out = layoutBracket(tiesOf(REAL), swapped)
    const placed = Object.values(out.slots).flat().filter((s) => s.tie).length
    expect(placed).toBe(8 + 8 + 4 + 2 + 1)
  })
})

describe('slotId', () => {
  it('names a slot’s card in the DOM', () => {
    expect(slotId({ key: 'QF-2' })).toBe('ucl-QF-2')
  })
})
