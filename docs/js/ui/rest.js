// Rest countdown. Starts by itself after a set (or by hand), counts down with a ring, beeps
// for the last 3 seconds and at zero, buzzes the phone, and can be paused, nudged or expanded.
import { html, useState, useEffect, useRef } from './core.js'

export const REST_PRESETS = [60, 90, 120, 150, 180, 240, 300]
export const fmtClock = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

// Timer state is plain data: { total, endsAt } while running, { total, pausedLeft } while paused.
export const startTimer = sec => ({ total: sec, endsAt: Date.now() + sec * 1000 })
export const timeLeft = (t, now = Date.now()) => (t.pausedLeft != null ? t.pausedLeft : Math.max(0, Math.ceil((t.endsAt - now) / 1000)))
export function adjustTimer(t, delta) {
  if (t.pausedLeft != null) { const left = Math.max(0, t.pausedLeft + delta); return { total: Math.max(t.total, left), pausedLeft: left } }
  const endsAt = Math.max(Date.now(), t.endsAt + delta * 1000)
  return { total: Math.max(t.total, Math.ceil((endsAt - Date.now()) / 1000)), endsAt }
}
export const togglePause = t => (t.pausedLeft != null ? { total: t.total, endsAt: Date.now() + t.pausedLeft * 1000 } : { total: t.total, pausedLeft: timeLeft(t) })

// Sound needs a tap first (browser rule); the set's ✓ tap counts, so the context is made then.
let audio = null
export function primeAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume() } catch { audio = null }
}
function beep(freq, ms) {
  if (!audio) return
  try {
    const o = audio.createOscillator(), g = audio.createGain()
    o.frequency.value = freq; o.type = 'sine'
    g.gain.setValueAtTime(0.0001, audio.currentTime)
    g.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000)
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + ms / 1000 + 0.02)
  } catch { /* audio unavailable */ }
}

function Dial({ left, total, size }) {
  const r = 44, c = 2 * Math.PI * r
  const frac = total > 0 ? left / total : 0
  return html`<svg class="rest-dial" viewBox="0 0 100 100" width=${size} height=${size} aria-hidden="true">
    <circle cx="50" cy="50" r=${r} class="dial-track" fill="none" stroke-width="7" />
    <circle cx="50" cy="50" r=${r} class="dial-fill" fill="none" stroke-width="7" stroke-linecap="round"
      stroke-dasharray=${`${frac * c} ${c}`} transform="rotate(-90 50 50)" />
  </svg>`
}

export function RestTimer({ timer, setTimer, sound, flash, onToggleSound }) {
  const [now, setNow] = useState(Date.now())
  const [big, setBig] = useState(false)
  const lastBeep = useRef(null)
  const [flashing, setFlashing] = useState(false)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t) }, [])
  const left = timeLeft(timer, now)
  const paused = timer.pausedLeft != null
  const done = left === 0 && !paused

  useEffect(() => {
    if (paused || lastBeep.current === left) return
    lastBeep.current = left
    if (sound && left > 0 && left <= 3) beep(660, 120)
    if (left === 0) {
      if (sound) { beep(990, 220); setTimeout(() => beep(990, 320), 280) }
      try { navigator.vibrate?.([250, 120, 250]) } catch { /* no vibration */ }
      if (flash) { setFlashing(true); setTimeout(() => setFlashing(false), 2600) }
    }
  }, [left, paused])

  const controls = html`
    <button class="btn small" aria-label="15 seconds less" onClick=${() => setTimer(adjustTimer(timer, -15))}>−15</button>
    <button class="btn small" aria-label="15 seconds more" onClick=${() => setTimer(adjustTimer(timer, 15))}>+15</button>
    ${!done && html`<button class="btn small" onClick=${() => setTimer(togglePause(timer))}>${paused ? 'Resume' : 'Pause'}</button>`}
    <button class="btn small ghost" onClick=${() => setTimer(null)}>${done ? 'Close' : 'Skip'}</button>`

  const flashEl = flashing && html`<div class="rest-flash" aria-hidden="true"></div>`
  if (big) return html`${flashEl}<div class=${'rest-full' + (done ? ' go' : '')} role="timer" aria-live="polite" aria-label="Rest timer">
    <button class="icon-btn rest-shrink" aria-label="Shrink timer" onClick=${() => setBig(false)}>⌄</button>
    <p class="eyebrow">${done ? 'Rest over' : paused ? 'Paused' : 'Resting'}</p>
    <div class="rest-full-dial"><${Dial} left=${left} total=${timer.total} size=${240} /><span class="rest-full-time tnum">${done ? 'GO' : fmtClock(left)}</span></div>
    <div class="chips chips-sm rest-presets">${REST_PRESETS.map(s => html`<button class=${'chip' + (timer.total === s ? ' on' : '')} onClick=${() => setTimer(startTimer(s))}>${fmtClock(s)}</button>`)}</div>
    <div class="row-btns rest-ctrls">${controls}</div>
    <label class="toggle"><input id="rest-sound" type="checkbox" checked=${sound} onChange=${onToggleSound} /> Beep at the end</label>
  </div>`

  return html`${flashEl}<div class=${'rest-bar' + (done ? ' go' : '')} role="timer" aria-live="polite" aria-label="Rest timer">
    <button class="rest-open" aria-label="Expand timer" onClick=${() => setBig(true)}>
      <span class="rest-mini"><${Dial} left=${left} total=${timer.total} size=${40} /></span>
      <span class="rest-time tnum">${done ? 'Go!' : fmtClock(left)}</span>
      ${paused && html`<span class="rest-label">paused</span>`}
    </button>
    <div class="rest-actions">${controls}</div>
  </div>`
}
