import { useState } from 'react'

// ESPN's image combiner serves a resized crest (the raw logos are 500px PNGs);
// one size for every view keeps it to a single cached image per club.
export function crestSrc(logo, px = 128) {
  if (!logo) return null
  try {
    const u = new URL(logo)
    if (u.hostname !== 'a.espncdn.com' || u.pathname.startsWith('/combiner/')) return logo
    return `https://a.espncdn.com/combiner/i?img=${u.pathname}&w=${px}&h=${px}`
  } catch {
    return logo
  }
}

const initials = (club) => (club?.abbr || club?.name || '?').slice(0, 3).toUpperCase()

// Image sources to try, best first: our own SVG crest, ESPN's resized crest,
// ESPN's original logo.
const sources = (club) => [...new Set([club?.crest, crestSrc(club?.logo), club?.logo].filter(Boolean))]

// A club's crest. Each image that fails to load hands over to the next source,
// and after the last to an initials badge in the club's colour, so a missing
// image never leaves a hole in the row. Decorative: the club name always sits
// next to it.
export default function Crest({ club, className = '' }) {
  const list = sources(club)
  const key = list.join(' ')
  // How many sources have failed for the *current* club (resets if it changes).
  const [failed, setFailed] = useState({ key: null, n: 0 })
  const n = failed.key === key ? failed.n : 0
  const src = list[n]
  if (!src) {
    return (
      <span
        className={`crest crest-initials ${className}`}
        style={club?.color ? { background: club.color } : undefined}
        aria-hidden="true"
      >
        {initials(club)}
      </span>
    )
  }
  return (
    <img
      className={`crest ${className}`}
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed({ key, n: n + 1 })}
    />
  )
}
