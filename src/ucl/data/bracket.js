// UEFA's 2026/27 knockout bracket, entered by hand after the round-of-16 draw
// (expected around 26 February 2027; it also fixes the path to the final).
//
// Leave it empty until then: the knockout tree still fills itself in, linking
// each round to the one before as soon as that round's fixtures are in ESPN's
// feed. Filled in, it shows the whole path straight after the draw, with later
// rounds as "winner of …" placeholders before their fixtures exist.
//
// List the eight round-of-16 ties top to bottom in UEFA's bracket order, naming
// one club from each as ESPN spells it (full or short name, e.g. 'Real Madrid'
// or 'PSG'). Ties 1 and 2 meet in the first quarter-final, 3 and 4 in the
// second, and so on; the winners of quarter-finals 1 and 2 meet in the first
// semi-final.
export const BRACKET = []
