// The 48 qualified teams, grouped A–L per the Final Draw (Dec 5, 2025),
// with European and intercontinental playoff winners resolved.
export const TEAMS = {
  A: [
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'South Korea', flag: '🇰🇷' },
    { name: 'Czechia', flag: '🇨🇿' },
  ],
  B: [
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Bosnia & Herzegovina', flag: '🇧🇦' },
    { name: 'Qatar', flag: '🇶🇦' },
    { name: 'Switzerland', flag: '🇨🇭' },
  ],
  C: [
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Morocco', flag: '🇲🇦' },
    { name: 'Haiti', flag: '🇭🇹' },
    { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  ],
  D: [
    { name: 'USA', flag: '🇺🇸' },
    { name: 'Paraguay', flag: '🇵🇾' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'Türkiye', flag: '🇹🇷' },
  ],
  E: [
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Curaçao', flag: '🇨🇼' },
    { name: 'Ivory Coast', flag: '🇨🇮' },
    { name: 'Ecuador', flag: '🇪🇨' },
  ],
  F: [
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Tunisia', flag: '🇹🇳' },
  ],
  G: [
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Egypt', flag: '🇪🇬' },
    { name: 'Iran', flag: '🇮🇷' },
    { name: 'New Zealand', flag: '🇳🇿' },
  ],
  H: [
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Cape Verde', flag: '🇨🇻' },
    { name: 'Saudi Arabia', flag: '🇸🇦' },
    { name: 'Uruguay', flag: '🇺🇾' },
  ],
  I: [
    { name: 'France', flag: '🇫🇷' },
    { name: 'Senegal', flag: '🇸🇳' },
    { name: 'Iraq', flag: '🇮🇶' },
    { name: 'Norway', flag: '🇳🇴' },
  ],
  J: [
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Algeria', flag: '🇩🇿' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Jordan', flag: '🇯🇴' },
  ],
  K: [
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'DR Congo', flag: '🇨🇩' },
    { name: 'Uzbekistan', flag: '🇺🇿' },
    { name: 'Colombia', flag: '🇨🇴' },
  ],
  L: [
    { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Croatia', flag: '🇭🇷' },
    { name: 'Ghana', flag: '🇬🇭' },
    { name: 'Panama', flag: '🇵🇦' },
  ],
}

// Flat lookup: team name -> flag emoji.
export const FLAG_BY_TEAM = Object.values(TEAMS)
  .flat()
  .reduce((acc, t) => {
    acc[t.name] = t.flag
    return acc
  }, {})

// Sorted list of all qualified team names (for the team filter).
export const ALL_TEAMS = Object.values(TEAMS)
  .flat()
  .map((t) => t.name)
  .sort((a, b) => a.localeCompare(b))
