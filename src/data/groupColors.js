// Distinct colors for the 12 groups, used to color-code the weekly calendar
// (and the legend). Knockout matches share one accent color.
export const GROUP_COLORS = {
  A: '#e6194b',
  B: '#3cb44b',
  C: '#4363d8',
  D: '#f58231',
  E: '#a955f7',
  F: '#42d4f4',
  G: '#f032e6',
  H: '#9acd32',
  I: '#ec8fb0',
  J: '#469990',
  K: '#c9a0ff',
  L: '#c0843a',
}

export const KNOCKOUT_COLOR = '#f4c542'

export function colorForMatch(m) {
  return m.stage === 'Group' ? GROUP_COLORS[m.group] : KNOCKOUT_COLOR
}
