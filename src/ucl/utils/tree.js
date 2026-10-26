// Knockout tree layout: which tie goes in which slot of each round, and which
// slots feed which, so the bracket can be drawn with connector lines.
//
// Each round-of-16 tie is fed by one play-off tie (its other club came straight
// from the league phase's top eight), so the play-off column lines up one to
// one with the round of 16; from there it's a binary tree to the final.
//
// UEFA's draw sets the path, and ESPN's feed doesn't carry it, so there are two
// ways to place the ties:
//   • drawn — BRACKET (data/bracket.js) lists the round-of-16 ties in bracket
//     order, which fixes every slot to the final; unplayed rounds become
//     "winner of …" placeholders;
//   • undrawn — work down from the final: each tie's two clubs say which ties of
//     the round before fed it. Slots we can't link yet stay unconnected.

import { BRACKET } from '../data/bracket.js'

export const SLOTS = { PO: 8, R16: 8, QF: 4, SF: 2, Final: 1 }
const CHILD = { R16: 'PO', QF: 'R16', SF: 'QF', Final: 'SF' }

const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
const named = (club, name) => [club.id, club.name, club.short, club.abbr].some((v) => v && fold(v) === fold(name))
const has = (tie, club) => tie.clubs.some((c) => c.id === club.id)
const shares = (a, b) => a.clubs.some((c) => has(b, c))

export const slotId = (slot) => `ucl-${slot.key}`

// ties: knockout ties (see buildTies), in first-leg order. Returns
// { slots: { [stage]: slot[] }, edges, drawn } where a slot is
// { key, stage, index, tie, known, show, kids?, seed? }:
//   tie   — the tie placed here, or null;
//   known — its feeders are known (lines can be drawn to it);
//   show  — 'tie' | 'placeholder' | null (an empty, unknown slot keeps its
//           place in the column but draws nothing);
//   kids  — the slots feeding it (QF, SF, Final); seed — a drawn R16 club name.
// edges are { parent, children } DOM ids for useConnectorLines.
export function layoutBracket(ties, bracket = BRACKET) {
  const pool = {}
  for (const stage of Object.keys(SLOTS)) {
    pool[stage] = ties.filter((t) => t.stage === stage && t.clubs.every((c) => c.id))
  }
  const take = (stage, pred = () => true) => {
    const i = pool[stage].findIndex(pred)
    return i < 0 ? null : pool[stage].splice(i, 1)[0]
  }
  const slots = {}
  for (const [stage, n] of Object.entries(SLOTS)) {
    slots[stage] = Array.from({ length: n }, (_, index) => ({
      key: `${stage}-${index}`,
      stage,
      index,
      tie: null,
      known: false,
    }))
  }
  const kids = (p) => [0, 1].map((j) => slots[CHILD[p.stage]][2 * p.index + j])

  const drawn = bracket.length === SLOTS.R16
  if (drawn) {
    slots.R16.forEach((s, i) => {
      s.seed = bracket[i]
      s.tie = take('R16', (t) => t.clubs.some((c) => named(c, bracket[i])))
    })
    for (const stage of ['QF', 'SF', 'Final']) {
      for (const p of slots[stage]) p.tie = take(stage, (t) => kids(p).some((k) => k.tie && shares(k.tie, t)))
    }
    for (const stage of ['R16', 'QF', 'SF', 'Final']) for (const s of slots[stage]) s.known = true
  } else {
    // The final is always fed by the two semi-finals, drawn or not.
    slots.Final[0].known = true
    slots.Final[0].tie = take('Final')
    for (const stage of ['Final', 'SF', 'QF']) {
      for (const p of slots[stage]) {
        if (!p.tie) continue
        const ks = kids(p)
        ks.forEach((k, j) => {
          k.tie = take(k.stage, (t) => has(t, p.tie.clubs[j]))
        })
        if (ks.every((k) => k.tie)) p.known = true
      }
      // The rest of the round before, in kickoff order, unlinked for now.
      for (const k of slots[CHILD[stage]]) if (!k.tie) k.tie = take(k.stage)
    }
  }
  // Anything still unplaced (a drawn bracket that doesn't match the fixtures)
  // takes a free slot rather than disappearing.
  for (const stage of ['R16', 'QF', 'SF', 'Final']) for (const s of slots[stage]) if (!s.tie) s.tie = take(stage)

  // Play-off ties line up with the round-of-16 tie their winner joined.
  const poLinked = new Set()
  for (const r of slots.R16) {
    if (!r.tie) continue
    const po = slots.PO[r.index]
    po.tie = take('PO', (t) => shares(t, r.tie))
    if (po.tie) poLinked.add(r.index)
  }
  for (const s of slots.PO) if (!s.tie) s.tie = take('PO')

  for (const col of Object.values(slots)) {
    for (const s of col) {
      s.show = s.tie ? 'tie' : s.known ? 'placeholder' : null
      if (s.stage !== 'PO' && s.stage !== 'R16') s.kids = kids(s)
    }
  }

  return { slots, edges: edgesFor(slots, poLinked), drawn }
}

// Connector edges: each round-of-16 slot to its play-off slot where linked, and
// each known QF / SF / Final slot to the slots feeding it.
function edgesFor(slots, poLinked) {
  const edges = []
  for (const r of slots.R16) {
    if (r.show && poLinked.has(r.index)) edges.push({ parent: slotId(r), children: [slotId(slots.PO[r.index])] })
  }
  for (const stage of ['QF', 'SF', 'Final']) {
    for (const p of slots[stage]) {
      const ks = p.known && p.show ? p.kids.filter((k) => k.show) : []
      if (ks.length) edges.push({ parent: slotId(p), children: ks.map(slotId) })
    }
  }
  return edges
}

// Before any knockout fixture exists: the shape UEFA's format fixes in advance,
// labelled by league-phase position. In each half of the bracket, 1st/2nd and
// 7th/8th meet in one quarter-final and 3rd/4th and 5th/6th in the other, each
// having played the winner of a play-off between the places listed (the draw
// decides which of each pair goes in which half).
const SEEDS = [
  ['1st/2nd', ['15th/16th', '17th/18th']],
  ['7th/8th', ['9th/10th', '23rd/24th']],
  ['3rd/4th', ['13th/14th', '19th/20th']],
  ['5th/6th', ['11th/12th', '21st/22nd']],
]

export function skeletonBracket() {
  const slots = {}
  for (const [stage, n] of Object.entries(SLOTS)) {
    slots[stage] = Array.from({ length: n }, (_, index) => ({
      key: `${stage}-${index}`,
      stage,
      index,
      tie: null,
      known: true,
      show: 'placeholder',
    }))
  }
  slots.PO.forEach((s, i) => (s.labels = SEEDS[i % 4][1]))
  slots.R16.forEach((s, i) => (s.labels = [SEEDS[i % 4][0], 'Play-off winner']))
  for (const stage of ['QF', 'SF', 'Final']) {
    for (const s of slots[stage]) s.kids = [0, 1].map((j) => slots[CHILD[stage]][2 * s.index + j])
  }
  return { slots, edges: edgesFor(slots, new Set(slots.R16.map((s) => s.index))), drawn: false, skeleton: true }
}
