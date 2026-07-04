// "As it stands" — project the Round of 32 from the CURRENT group standings, so
// each group can show where its 1st / 2nd / (qualifying) 3rd would land right now.
//
// Winner and runner-up slots resolve directly from the live standings. The 3rd-
// place slots ("3rd C/E/F/H/I") are assigned per FIFA's official Annexe C table
// (data/thirdPlaceCombinations.js): given which eight of the twelve groups
// currently produce a qualifying third, the table says which third each of the
// eight "winner v third" hosts plays. If fewer than eight thirds have data yet
// (early in the group stage) the combination isn't in the table, so we fall back
// to constraint-matching the candidate-group lists — always a valid bracket.

import { TEAMS } from '../data/teams.js'
import { computeQualification } from './qualification.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../data/thirdPlaceCombinations.js'

const GROUPS = Object.keys(TEAMS)
const ADVANCING_THIRDS = 8

function parseSlot(label) {
  let m = /^Winner Group ([A-L])$/.exec(label)
  if (m) return { type: 'winner', group: m[1] }
  m = /^Runner-up Group ([A-L])$/.exec(label)
  if (m) return { type: 'runner', group: m[1] }
  m = /^3rd ([A-L/]+)$/.exec(label)
  if (m) return { type: 'third', groups: m[1].split('/') }
  return { type: 'other', label }
}

// Fallback only: bipartite matching (Kuhn's) of qualifying third-place groups to
// 3rd-place slots over the candidate lists. Used when the current combination
// isn't a complete 8-group set the Annexe C table covers.
export function matchThirds(groups, slots) {
  const groupForSlot = new Map()
  const assign = (group, visited) => {
    for (const s of slots) {
      if (!s.slot.groups.includes(group) || visited.has(s)) continue
      visited.add(s)
      if (!groupForSlot.has(s) || assign(groupForSlot.get(s), visited)) {
        groupForSlot.set(s, group)
        return true
      }
    }
    return false
  }
  for (const g of groups) assign(g, new Set())
  return groupForSlot
}

// Returns { perGroup, complete, official } where perGroup[g] = {
//   first / second / third: { team, opponent, matchNum } | null,
//   thirdTeam, thirdQualifies,
// }. `official` is true when the third-place slots came from the Annexe C table.
export function projectKnockout(matches) {
  const qual = computeQualification(matches)
  const first = {}
  const second = {}
  const third = {}
  for (const g of GROUPS) {
    first[g] = qual.groups[g]?.[0] || null
    second[g] = qual.groups[g]?.[1] || null
    third[g] = qual.groups[g]?.[2] || null
  }

  const qualifyingThirdGroups = qual.thirds.slice(0, ADVANCING_THIRDS).map((t) => t.group)
  const qualifyingSet = new Set(qualifyingThirdGroups)

  // Every R32 side, with its parsed slot, indexed by match.
  const sides = []
  for (const m of matches) {
    if (m.stage !== 'R32') continue
    sides.push({ matchNum: m.num, sideIdx: 0, slot: parseSlot(m.t1) })
    sides.push({ matchNum: m.num, sideIdx: 1, slot: parseSlot(m.t2) })
  }
  const byMatch = new Map()
  for (const s of sides) {
    if (!byMatch.has(s.matchNum)) byMatch.set(s.matchNum, [])
    byMatch.get(s.matchNum).push(s)
  }
  const thirdSides = sides.filter((s) => s.slot.type === 'third')

  // Resolve each third-slot to a group: prefer the official Annexe C table.
  const thirdSlotGroup = new Map()
  let official = false
  const key = qualifyingThirdGroups.length === ADVANCING_THIRDS ? [...qualifyingThirdGroups].sort().join('') : null
  const combo = key ? THIRD_PLACE_COMBINATIONS[key] : null
  if (combo) {
    official = true
    const winnerToThird = {}
    THIRD_WINNER_ORDER.forEach((w, i) => (winnerToThird[w] = combo[i]))
    for (const s of thirdSides) {
      const winnerSide = (byMatch.get(s.matchNum) || []).find((o) => o.slot.type === 'winner')
      const w = winnerSide?.slot.group
      if (w && winnerToThird[w]) thirdSlotGroup.set(s, winnerToThird[w])
    }
  } /* v8 ignore start */ else {
    // Unreachable via the public API: the Annexe C table holds all C(12,8)=495
    // eight-group combos, and there are always exactly 12 thirds (one per real
    // group), so a combo is always found. matchThirds is unit-tested directly.
    for (const [s, g] of matchThirds(qualifyingThirdGroups, thirdSides)) thirdSlotGroup.set(s, g)
  } /* v8 ignore stop */

  const teamForSide = (s) => {
    if (!s) return null
    if (s.slot.type === 'winner') return first[s.slot.group]
    if (s.slot.type === 'runner') return second[s.slot.group]
    if (s.slot.type === 'third') {
      const g = thirdSlotGroup.get(s)
      return g ? third[g] : null
    }
    return null
  }
  const opponentOf = (s) => teamForSide((byMatch.get(s.matchNum) || []).find((o) => o !== s))

  // Per-side resolution keyed by `${matchNum}:${sideIdx}`, so the bracket can
  // substitute a slot once its outcome is CERTAIN (see resolveGroupSlots). The
  // resolved `group` is the group whose placing fills the slot — for a third-
  // place slot that's the Annexe C assignment, not the group letters in the
  // label. Null when the slot can't be resolved from the current standings.
  const slotTeams = {}
  for (const s of sides) {
    const t = teamForSide(s)
    slotTeams[`${s.matchNum}:${s.sideIdx}`] = t
      ? { name: t.name, type: s.slot.type, group: s.slot.type === 'third' ? thirdSlotGroup.get(s) : s.slot.group }
      : null
  }

  const perGroup = {}
  for (const g of GROUPS) {
    perGroup[g] = {
      first: null,
      second: null,
      thirdTeam: third[g]?.name || null,
      thirdQualifies: qualifyingSet.has(g),
      third: null,
    }
  }
  let complete = true
  for (const s of sides) {
    const opp = opponentOf(s)
    if (s.slot.type === 'winner') {
      perGroup[s.slot.group].first = { team: first[s.slot.group]?.name || null, opponent: opp?.name || null, matchNum: s.matchNum }
      if (!teamForSide(s) || !opp) complete = false
    } else if (s.slot.type === 'runner') {
      perGroup[s.slot.group].second = { team: second[s.slot.group]?.name || null, opponent: opp?.name || null, matchNum: s.matchNum }
      if (!teamForSide(s) || !opp) complete = false
    } else if (s.slot.type === 'third') {
      const g = thirdSlotGroup.get(s)
      if (g) perGroup[g].third = { team: third[g]?.name || null, opponent: opp?.name || null, matchNum: s.matchNum }
    }
  }
  return { perGroup, complete, official, slotTeams }
}

// A group is "settled" once every one of its matches has a FINAL score — a live
// match (which carries a running score) does not count, so we never lock a
// placing off an in-progress game.
function groupSettled(group, matches) {
  const gm = matches.filter((m) => m.stage === 'Group' && m.group === group)
  return gm.length > 0 && gm.every((m) => Array.isArray(m.score) && !m.live)
}

// Fill the Round-of-32 group-stage placeholders ("Runner-up Group X", "3rd
// A/B/C…", and any still-unresolved "Winner Group X") with real teams — but ONLY
// where the outcome is already locked, so the bracket never shows a guess.
// Winner/runner-up of a group lock once that group is settled; third-place slots
// depend on the cross-group best-8 ranking, so they lock only once EVERY group
// is settled. (Early group winners are also handled by resolveClinchedSlots,
// which can fill them before the group finishes.)
export function resolveGroupSlots(matches) {
  const { slotTeams } = projectKnockout(matches)
  const settled = {}
  for (const g of GROUPS) settled[g] = groupSettled(g, matches)
  const allSettled = GROUPS.every((g) => settled[g])
  let changed = false
  const out = matches.map((m) => {
    if (m.stage !== 'R32') return m
    const sub = (label, sideIdx) => {
      const info = slotTeams[`${m.num}:${sideIdx}`]
      if (!info?.name) return label
      const locked = info.type === 'third' ? allSettled : settled[info.group]
      return locked ? info.name : label
    }
    const t1 = sub(m.t1, 0)
    const t2 = sub(m.t2, 1)
    if (t1 === m.t1 && t2 === m.t2) return m
    changed = true
    return { ...m, t1, t2 }
  })
  return changed ? out : matches
}
