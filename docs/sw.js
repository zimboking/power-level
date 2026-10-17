// Offline cache for Power Level. VERSION changes on every build, which replaces the old cache.
const VERSION = 'd2f03ab7a10b'
const SHELL = ["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-180.png","js/app.js","js/examples.js","js/exercises.js","js/journey.js","js/nutrition.js","js/plan.js","js/power.js","js/store.js","js/strength.js","js/ui/charts.js","js/ui/core.js","js/ui/exercise-card.js","js/ui/food.js","js/ui/goals.js","js/ui/hero.js","js/ui/home.js","js/ui/progress.js","js/ui/rest.js","js/ui/workout.js"]
const CDN = ["https://unpkg.com/htm@3.1.1/preact/standalone.module.js"]
self.addEventListener('install', e => {
  e.waitUntil(caches.open('pl-' + VERSION).then(c => c.addAll([...SHELL, ...CDN])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pl-') && k !== 'pl-' + VERSION && k !== 'pl-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim()))
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
  if (url.origin !== location.origin && !CDN.includes(req.url)) return
  // App files: cache first (instant, offline), page navigations fall back to the cached shell.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))))
})
