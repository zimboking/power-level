// Offline cache for Power Level. VERSION changes on every build, which replaces the old cache.
const VERSION = '6d262ee43820'
const SHELL = ["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-180.png","js/app.js","js/data/body.json","js/data/catalog.json","js/data/foods.json","js/examples.js","js/exercises.js","js/foods.js","js/journey.js","js/muscles.js","js/nutrition.js","js/off.js","js/photos.js","js/plan.js","js/power.js","js/progression.js","js/records.js","js/routines.js","js/schedule.js","js/share.js","js/stats.js","js/store.js","js/strength.js","js/ui/bodymap.js","js/ui/capy-stats.js","js/ui/capyspa.js","js/ui/charts.js","js/ui/core.js","js/ui/exercise-card.js","js/ui/food.js","js/ui/goals.js","js/ui/hero.js","js/ui/home.js","js/ui/library.js","js/ui/media.js","js/ui/onsen.js","js/ui/photos.js","js/ui/plan-tab.js","js/ui/rest.js","js/ui/scanner.js","js/ui/set-row.js","js/ui/settings.js","js/ui/share-sheet.js","js/ui/stats-tab.js","js/ui/workout.js","js/water.js"]
const CDN = ["https://unpkg.com/htm@3.1.1/preact/standalone.module.js"]
self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages sends max-age=600), so a new
  // version never gets cached with a stale file from the old one.
  e.waitUntil(caches.open('pl-' + VERSION).then(c => c.addAll([...SHELL, ...CDN].map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()))
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
