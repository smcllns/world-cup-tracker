// Persist timezone and spoiler mode to the URL query string so a view can be
// bookmarked or shared. Only non-default values are written, keeping the URL
// clean.

export function readState(detectedTz) {
  const p = new URLSearchParams(window.location.search)
  const get = (k, d) => (p.has(k) ? p.get(k) : d)

  return {
    tz: get('tz', detectedTz),
    hideScores: get('hide', '0') === '1',
  }
}

export function writeState({ tz, hideScores }, detectedTz) {
  const p = new URLSearchParams()
  if (tz && tz !== detectedTz) p.set('tz', tz)
  if (hideScores) p.set('hide', '1')

  const qs = p.toString()
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', url)
}
