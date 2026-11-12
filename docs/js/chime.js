// Rest-timer sounds and the rest-over notification. No UI here, so it can be tested in Node:
// pass a fake AudioContext to setAudio().
// Sound needs a tap first (browser rule); the set's ✓ tap counts, so the context is made then.
let audio = null
export const setAudio = a => { audio = a; out = null }
export function primeAudio() {
  try {
    mixWithOthers()
    const fresh = !audio
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state !== 'running') audio.resume()
    if (fresh) watchAudio(audio)
    primeBackup()
  } catch { audio = null }
}

// Another app's sound (a video, music) can take the phone's audio away from the page: on iPhone
// the context then sits in "interrupted" and the chime never plays. Three things help:
// 1. ask for a "transient" audio session where the browser has one (Safari 16.4+), which is the
//    kind meant for short alerts that play on top of other sound;
// 2. wake the context again whenever it stops while the app is on screen, and on the next tap;
// 3. if it still isn't running at zero, play the chime through a plain <audio> element instead.
function mixWithOthers() {
  try { const s = navigator.audioSession; if (s && s.type !== 'transient') s.type = 'transient' } catch { /* not supported */ }
}
const wake = () => { if (audio && audio.state !== 'running') { try { audio.resume().catch(() => {}) } catch { /* old browsers */ } } }
let watching = false
function watchAudio(ctx) {
  try { ctx.addEventListener?.('statechange', () => { if (ctx === audio && typeof document !== 'undefined' && document.visibilityState === 'visible') wake() }) } catch { /* fine */ }
  if (watching || typeof document === 'undefined') return
  watching = true
  document.addEventListener('pointerdown', wake, { capture: true, passive: true })
}

const WAV_RATE = 22050
/** The chime as a WAV file (mono, 16-bit), for the <audio> back-up. Same notes as restChime. */
export function chimeWav(loud) {
  const notes = loud ? [880, 1175, 1568, 880, 1175, 1568] : [990, 990]
  const step = loud ? 0.22 : 0.28, len = loud ? 0.18 : 0.26
  const total = Math.ceil((notes.length * step + (loud ? 0.25 : 0) + 0.1) * WAV_RATE)
  const pcm = new Int16Array(total)
  notes.forEach((f, i) => {
    const start = Math.round((i * step + (loud && i >= 3 ? 0.25 : 0)) * WAV_RATE), n = Math.round(len * WAV_RATE)
    for (let k = 0; k < n && start + k < total; k++) {
      const t = k / WAV_RATE, edge = Math.min(1, k / 180, (n - k) / 900)
      const wave = loud ? (Math.sin(2 * Math.PI * f * t) >= 0 ? 0.6 : -0.6) + 0.35 * Math.sin(4 * Math.PI * f * t) : 0.5 * Math.sin(2 * Math.PI * f * t)
      pcm[start + k] = Math.max(-1, Math.min(1, wave * edge)) * 32767
    }
  })
  const bytes = new Uint8Array(44 + pcm.length * 2), v = new DataView(bytes.buffer)
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, WAV_RATE, true); v.setUint32(28, WAV_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.length * 2, true)
  pcm.forEach((x, i) => v.setInt16(44 + i * 2, x, true))
  return bytes
}

// The back-up player. Phones only let an <audio> element play later if it was first started by a
// tap, so it is started silently (muted) on the first tick and stopped again straight away.
let backup = null // { el, loud, url }
function primeBackup() {
  if (backup || typeof Audio === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return
  try {
    const el = new Audio()
    el.preload = 'auto'; el.muted = true
    backup = { el, loud: null, url: null }
    loadBackup(true)
    const p = el.play()
    if (p && p.then) p.then(() => { el.pause(); el.currentTime = 0; el.muted = false }, () => { el.muted = false })
  } catch { backup = null }
}
function loadBackup(loud) {
  if (!backup || backup.loud === loud) return
  if (backup.url) URL.revokeObjectURL(backup.url)
  backup.url = URL.createObjectURL(new Blob([chimeWav(loud)], { type: 'audio/wav' }))
  backup.loud = loud
  backup.el.src = backup.url
}
/** Play the chime through the <audio> element. Returns false when there isn't one. */
export function backupChime(loud) {
  if (!backup) return false
  try { loadBackup(loud); backup.el.muted = false; backup.el.currentTime = 0; const p = backup.el.play(); if (p && p.catch) p.catch(() => {}); return true } catch { return false }
}
// A limiter on the way out lets the chime run hot without crackling.
let out = null
const output = () => {
  if (out) return out
  const c = audio.createDynamicsCompressor()
  c.threshold.value = -6; c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.1
  c.connect(audio.destination)
  out = c
  return out
}
// Loud: a square wave plus a sine an octave up, at full level. Square waves carry over gym noise
// far better than a plain sine; phones still cap it at their own volume.
// `at` is seconds from now. Returns the oscillators, so a scheduled beep can be called off.
function beep(freq, ms, loud = false, at = 0) {
  if (!audio) return []
  try {
    const t0 = audio.currentTime + at, t1 = t0 + ms / 1000
    const g = audio.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(loud ? 1 : 0.35, t0 + 0.008)
    g.gain.setValueAtTime(loud ? 1 : 0.35, t1 - 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t1)
    g.connect(loud ? output() : audio.destination)
    const tones = loud ? [['square', freq], ['sine', freq * 2]] : [['sine', freq]]
    return tones.map(([type, f]) => { const o = audio.createOscillator(); o.type = type; o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t1 + 0.02); return o })
  } catch { return [] }
}
/** The rest-over alert: three rising chimes, twice when loud. `at` is seconds from now. */
export function restChime(loud, at = 0) {
  const notes = loud ? [880, 1175, 1568, 880, 1175, 1568] : [990, 990]
  return notes.flatMap((f, i) => beep(f, loud ? 180 : i ? 320 : 220, loud, at + i * (loud ? 0.22 : 0.28) + (loud && i >= 3 ? 0.25 : 0)))
}

// The countdown beeps and the chime are queued on the audio clock as soon as rest starts, so
// they play on time even when the phone slows the page's timers down (screen off, another app
// in front). Changing, pausing or skipping the timer calls them off and queues them again.
let queued = []
let chimeAt = null // audio-clock time the queued chime starts
export function cancelRestSounds() {
  for (const o of queued) { try { o.stop(0); o.disconnect() } catch { /* already finished */ } }
  queued = []
  chimeAt = null
}
export function scheduleRestSounds(endsAt, loud, now = Date.now()) {
  cancelRestSounds()
  if (!audio) return false
  if (audio.state === 'suspended') audio.resume().catch(() => {})
  const at = (endsAt - now) / 1000
  if (at <= 0) return false
  for (const s of [3, 2, 1]) if (at - s > 0.05) queued.push(...beep(660, 120, loud, at - s))
  queued.push(...restChime(loud, at))
  chimeAt = audio.currentTime + at
  return true
}

// Back-up for the queued chime, called when the page's own clock reaches zero. Phones can pause
// the audio clock (power saving, screen off), and then the queued chime is late or never plays.
// If the audio clock hasn't reached the chime yet, play it now instead. Returns true if it did.
// If the audio context is stopped (another app has the phone's sound), it gets a moment to wake;
// if it doesn't, the chime goes out through the <audio> back-up, so it is never played late.
const ON_TIME = 0.5 // seconds of slack between the page clock and the audio clock
const WAKE_MS = 400 // how long a stopped context gets to start again
export function ensureChime(loud, wait = ms => new Promise(r => setTimeout(r, ms))) {
  if (!audio) return backupChime(loud)
  if (audio.state === 'running') {
    if (chimeAt != null && audio.currentTime >= chimeAt - ON_TIME) return false
    cancelRestSounds()
    restChime(loud)
    return true
  }
  cancelRestSounds()
  const ctx = audio
  let woke
  try { woke = Promise.resolve(ctx.resume()).catch(() => {}) } catch { woke = Promise.resolve() }
  Promise.race([woke, wait(WAKE_MS)]).then(() => {
    if (ctx !== audio) return
    if (ctx.state === 'running') restChime(loud)
    else backupChime(loud)
  })
  return true
}

// A phone notification at zero, for when the app isn't in front. Needs permission (Settings).
export const canNotify = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator
export async function notifyRestOver() {
  if (!canNotify() || Notification.permission !== 'granted') return
  const opts = { body: 'Time for your next set.', tag: 'rest-over', renotify: true, vibrate: [500, 150, 500, 150, 700], icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }
  try { await (await navigator.serviceWorker.ready).showNotification('Rest over', opts) } catch {
    try { new Notification('Rest over', opts) } catch { /* not allowed here */ }
  }
}

