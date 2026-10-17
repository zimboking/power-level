// Builds the hostable website from gym/: node tools/build-site.mjs <outDir>
// Same app code as the Claude version; adds a full HTML head, a web app manifest, home-screen
// icons and a service worker so it installs to the home screen and works offline in the gym.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(process.argv[2] || join(SRC, '..', 'site'))
const PREACT = 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js'
const BG = [14, 19, 29], GOLD = [255, 183, 3], GLOW = [255, 140, 0], WHITE = [255, 247, 224]

const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p] })

// ---- PNG icon: navy tile, gold aura, lightning bolt. Drawn with 4×4 supersampling. ----
const BOLT = [[0.56, 0.16], [0.30, 0.55], [0.47, 0.55], [0.41, 0.84], [0.70, 0.43], [0.53, 0.43], [0.62, 0.16]]
function inPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
function pixel(u, v) {
  // Content sits inside the central 80 % so Android's maskable crop never clips it.
  const cx = (u - 0.5) / 0.8 + 0.5, cy = (v - 0.5) / 0.8 + 0.5
  const d = Math.hypot(cx - 0.5, cy - 0.5)
  let c = BG
  if (d < 0.5) c = mix(BG, GLOW, Math.max(0, 0.55 - d) * 0.9)
  if (d < 0.36) c = mix(c, GOLD, 0.22)
  if (inPoly(cx, cy, BOLT)) c = d < 0.2 ? WHITE : mix(WHITE, GOLD, 0.35)
  return c
}
function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function iconPng(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  const SS = 4
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const p = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
        acc = acc.map((v, i) => v + p[i])
      }
      const o = y * (size * 3 + 1) + 1 + x * 3
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS))
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ---- Build ----
if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (f !== '.git') rmSync(join(OUT, f), { recursive: true, force: true })
mkdirSync(join(OUT, 'icons'), { recursive: true })

const jsFiles = walk(join(SRC, 'js')).filter(f => f.endsWith('.js') || f.endsWith('.json'))
for (const f of jsFiles) {
  const dest = join(OUT, relative(SRC, f))
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(f, dest)
}
for (const n of [180, 192, 512]) writeFileSync(join(OUT, 'icons', `icon-${n}.png`), iconPng(n))

const body = readFileSync(join(SRC, 'index.html'), 'utf8').replace(/^<title>.*?<\/title>\s*/s, '').replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '')
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Power Level</title>
<meta name="description" content="Gym tracker with goal journeys, smart set adjustments, 1RM trends and food logging.">
<meta name="theme-color" content="#0e131d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Power Level">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="modulepreload" href="${PREACT}">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}html,body{height:auto}</style>
</head>
<body>
${body}
</body>
</html>
`
writeFileSync(join(OUT, 'index.html'), html)

writeFileSync(join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'Power Level', short_name: 'Power Level', description: 'Gym tracker with goal journeys, smart set adjustments and food logging.',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait', background_color: '#0e131d', theme_color: '#0e131d',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}, null, 2))

const shell = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', ...jsFiles.map(f => relative(SRC, f).replace(/\\/g, '/'))]
const hash = createHash('sha256')
for (const f of walk(OUT).sort()) hash.update(relative(OUT, f)).update(readFileSync(f))
const VERSION = hash.digest('hex').slice(0, 12)

writeFileSync(join(OUT, 'sw.js'), `// Offline cache for Power Level. VERSION changes on every build, which replaces the old cache.
const VERSION = '${VERSION}'
const SHELL = ${JSON.stringify(shell)}
const CDN = ${JSON.stringify([PREACT])}
self.addEventListener('install', e => {
  e.waitUntil(caches.open('pl-' + VERSION).then(c => c.addAll([...SHELL, ...CDN])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pl-') && k !== 'pl-' + VERSION && k !== 'pl-fonts' && k !== 'pl-img').map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Fonts: cache as they're used, so the second visit works offline too.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('pl-fonts').then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res }))))
    return
  }
  // Exercise photos: kept once seen, so the demos you use work offline.
  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/free-exercise-db/')) {
    e.respondWith(caches.open('pl-img').then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res }))))
    return
  }
  if (url.origin !== location.origin && !CDN.includes(req.url)) return
  // App files: cache first (instant, offline), page navigations fall back to the cached shell.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))))
})
`)
writeFileSync(join(OUT, '.nojekyll'), '')
writeFileSync(join(OUT, 'README.md'), `# Power Level

A gym tracker: goal journeys (e.g. "bench 140 kg"), estimated 1RM, smart set and session
adjustments from reps and RIR, warm-ups, supersets, plate maths, a rest countdown, an anime
fighter who powers up as you get stronger, and calorie/macro logging in kcal or kJ.

Open the site on your phone and add it to your home screen. Your data stays on your phone, so
use **Settings → Download backup** now and then.

Built files only: this folder is generated by \`gym/tools/build-site.mjs\`.
`)
console.log(`Built ${OUT} (version ${VERSION}, ${shell.length} cached files)`)
