// Rest-timer sounds and the rest-over notification. No UI here, so it can be tested in Node:
// pass a fake AudioContext to setAudio().
// Sound needs a tap first (browser rule); the set's ✓ tap counts, so the context is made then.
let audio = null
export const setAudio = a => { audio = a; out = null }
export function primeAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume() } catch { audio = null }
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
const ON_TIME = 0.5 // seconds of slack between the page clock and the audio clock
export function ensureChime(loud) {
  if (!audio) return false
  if (audio.state !== 'running') { try { audio.resume().catch(() => {}) } catch { /* old browsers */ } }
  if (chimeAt != null && audio.state === 'running' && audio.currentTime >= chimeAt - ON_TIME) return false
  cancelRestSounds()
  restChime(loud)
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

