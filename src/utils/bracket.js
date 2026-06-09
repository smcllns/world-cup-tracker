// Knockout bracket layout. The "Winner Match N" feed labels don't line up by
// adjacent match number, so we hard-order each round so that the boxes that
// feed a later box sit next to each other vertically — producing a readable
// two-sided bracket that meets at the Final.

export const BRACKET = {
  left: {
    R32: [74, 77, 73, 75, 83, 84, 81, 82],
    R16: [89, 90, 93, 94],
    QF: [97, 98],
    SF: [101],
  },
  final: [104],
  right: {
    SF: [102],
    QF: [99, 100],
    R16: [91, 92, 95, 96],
    R32: [76, 78, 79, 80, 86, 88, 85, 87],
  },
  third: [103],
}

export function matchesByNum(matches) {
  return matches.reduce((acc, m) => {
    acc[m.num] = m
    return acc
  }, {})
}
