// SVG club crests, served from /ucl/crests/<slug>.svg. The files come from
// FootyLogos (footylogos.com), keyed here by ESPN team id -> FootyLogos slug
// (the club's page is footylogos.com/logos/<slug>). To add or refresh a club,
// edit this map and run `npm run ucl:crests`, which downloads its current crest.
//
// FootyLogos is a reference index, not a rights holder: the crests remain the
// clubs' trademarks (see footylogos.com/logo-usage-right). We use them only to
// identify the clubs.

export const CRESTS = {
  887: 'aek-athens',
  104: 'roma',
  359: 'arsenal',
  362: 'aston-villa',
  1068: 'atletico-madrid',
  83: 'fc-barcelona',
  132: 'bayern-munich',
  2980: 'fk-bodo-glimt',
  124: 'borussia-dortmund',
  570: 'club-brugge',
  2572: 'como-1907',
  437: 'fc-porto',
  436: 'fenerbahce',
  142: 'feyenoord',
  432: 'galatasaray',
  110: 'inter-milan',
  4411: 'lask',
  175: 'rc-lens',
  166: 'losc-lille',
  364: 'liverpool-fc',
  382: 'manchester-city',
  360: 'manchester-united',
  114: 'napoli',
  148: 'psv-eindhoven',
  160: 'paris-saint-germain-psg',
  11420: 'rb-leipzig',
  244: 'real-betis-balompie',
  86: 'real-madrid',
  21922: 'sabah-fk',
  493: 'shakhtar-donetsk',
  494: 'slavia-praha',
  521: 'sk-slovan-bratislava',
  2250: 'sporting-cp',
  134: 'vfb-stuttgart',
  510: 'viking-fk',
  102: 'villarreal-cf',
}

// Page-relative URL of a club's local crest, or null if we don't have one.
export function crestFile(espnId) {
  const slug = CRESTS[espnId]
  return slug ? `crests/${slug}.svg` : null
}
