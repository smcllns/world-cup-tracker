// Download the Champions League tracker's SVG club crests from FootyLogos into
// public/ucl/crests/<slug>.svg, for every club in src/ucl/data/crests.js.
//
//   npm run ucl:crests            # fetch clubs whose file is missing
//   npm run ucl:crests -- --all   # re-fetch every club
//
// The files are served from our own origin, so each one is checked before it's
// written: anything that could run script or pull in external content is
// rejected. An SVG without a viewBox gets one from its width/height, so it
// scales to the small crest slots instead of being cropped.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CRESTS } from '../src/ucl/data/crests.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/ucl/crests')
const sourceUrl = (slug) => `https://assets.footylogos.com/logos/${slug}/${slug}-logo-footylogos.svg`

const UNSAFE = /<script|\son[a-z]+\s*=|javascript:|<foreignObject|<iframe|<embed|<object/i
const EXTERNAL = /(?:href|src)\s*=\s*["'](?!#|data:image\/svg)/i

// Validate one downloaded SVG and normalise its root; throws if unusable.
export function prepareSvg(text) {
  const root = /<svg\b[^>]*>/.exec(text)
  if (!root) throw new Error('not an SVG')
  if (UNSAFE.test(text)) throw new Error('contains script or embedded content')
  if (EXTERNAL.test(text)) throw new Error('references external content')
  if (/\bviewBox=/.test(root[0])) return text
  const w = /\bwidth="([\d.]+)(?:px)?"/.exec(root[0])
  const h = /\bheight="([\d.]+)(?:px)?"/.exec(root[0])
  if (!w || !h) throw new Error('no viewBox and no width/height to derive one')
  return text.replace(root[0], root[0].replace(/^<svg\b/, `<svg viewBox="0 0 ${w[1]} ${h[1]}"`))
}

async function main() {
  const all = process.argv.includes('--all')
  mkdirSync(OUT, { recursive: true })
  let failed = 0
  for (const slug of new Set(Object.values(CRESTS))) {
    const file = join(OUT, `${slug}.svg`)
    if (!all && existsSync(file)) continue
    try {
      const res = await fetch(sourceUrl(slug))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      writeFileSync(file, prepareSvg(await res.text()))
      console.log(`✓ ${slug}`)
    } catch (e) {
      failed++
      console.error(`✗ ${slug}: ${e.message}`)
    }
  }
  if (failed) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
