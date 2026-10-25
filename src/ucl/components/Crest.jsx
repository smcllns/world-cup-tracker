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

// A club's crest. Falls back from the resized crest to the original logo, then
// to an initials badge in the club's colour, so a missing image never leaves a
// hole in the row. Decorative: the club name always sits next to it.
export default function Crest({ club, className = '' }) {
  // How many sources have failed for the *current* logo (resets if it changes).
  const [failed, setFailed] = useState({ logo: null, n: 0 })
  const logo = club?.logo || null
  const n = failed.logo === logo ? failed.n : 0
  const src = n === 0 ? crestSrc(logo) : n === 1 ? logo : null
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
      onError={() => setFailed({ logo, n: n + 1 })}
    />
  )
}
