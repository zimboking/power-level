// App shell: loads your data, keeps it in one immutable state object, saves what changed,
// and runs the tab bar, rest timer, toasts and the power-up moment.
import { html, render, useState, useEffect, useMemo, useRef } from './ui/core.js'
import { loadAll, createSaver, isStandalone, requestPersistence } from './store.js'
import { powerLevel, tierFor } from './power.js'
import { HomeView, SettingsSheet } from './ui/home.js'
import { WorkoutView } from './ui/workout.js'
import { ProgressView } from './ui/progress.js'
import { GoalsView } from './ui/goals.js'
import { FoodView } from './ui/food.js'
import { Fighter } from './ui/hero.js'
import { RestTimer, startTimer } from './ui/rest.js'

const TABS = [
  { id: 'home', label: 'Home', icon: 'M3 11 12 4l9 7v9h-6v-6H9v6H3z' },
  { id: 'train', label: 'Train', icon: 'M2 10h3v4H2zm17 0h3v4h-3zM5 8h3v8H5zm11 0h3v8h-3zM8 11h8v2H8z' },
  { id: 'goals', label: 'Goals', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z' },
  { id: 'progress', label: 'Progress', icon: 'M3 20h18v1H3zm1-3 5-6 4 3 6-8 1.6 1.2-7.2 9.6-4-3-3.8 4.6z' },
  { id: 'food', label: 'Food', icon: 'M7 2h2v8a2 2 0 0 1-1 1.7V22H6V11.7A2 2 0 0 1 5 10V2h1v6h1zm9 0c2 0 3 3 3 6s-1 4-2 4v10h-2V2z' },
]
const TITLES = { home: 'Power Level', train: 'Train', goals: 'Goals', progress: 'Progress', food: 'Food' }

function PowerUp({ tier, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  return html`<div class="powerup" onClick=${onDone} role="status"><div class="powerup-inner">
    <${Fighter} tier=${tier} size=${220} charging=${true} />
    <p class="eyebrow">Power up!</p><p class="powerup-name">${tier.name}</p></div></div>`
}

function App() {
  const [state, setState] = useState(null)
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('pl.tab') || 'home' } catch { return 'home' } })
  const [rest, setRest] = useState(null)
  const [toast, setToast] = useState('')
  const [settings, setSettings] = useState(false)
  const [powerUp, setPowerUp] = useState(null)
  const [sample, setSample] = useState(null)
  const stateRef = useRef(null)
  const saver = useRef(null)
  const modeRef = useRef('local')

  useEffect(() => {
    let alive = true
    loadAll().then(d => {
      if (!alive) return
      modeRef.current = d.mode
      stateRef.current = { profile: d.profile, workouts: d.workouts, food: d.food, active: d.active }
      saver.current = createSaver(d.conn, () => stateRef.current, msg => setToast(msg))
      setState(stateRef.current)
    }).catch(() => {
      stateRef.current = null
      setToast('Couldn’t load your data. Reload the page to try again.')
    })
    window.claude?.use?.('sample').then(s => alive && setSample(s || null)).catch(() => {})
    return () => { alive = false }
  }, [])
  // Keep the screen on while a workout is running; the browser drops the lock when the tab hides.
  const activeId = state?.active?.id
  useEffect(() => {
    if (!activeId || !navigator.wakeLock) return
    let lock = null, alive = true
    const grab = () => navigator.wakeLock.request('screen').then(l => { if (alive) lock = l; else l.release() }).catch(() => {})
    const onVis = () => document.visibilityState === 'visible' && grab()
    grab()
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}) }
  }, [activeId])
  useEffect(() => { if (state && modeRef.current === 'local') requestPersistence() }, [!!state])
  useEffect(() => { try { localStorage.setItem('pl.tab', tab) } catch { /* private mode */ } window.scrollTo(0, 0) }, [tab])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toast])

  const level = useMemo(() => (state ? powerLevel(state.workouts) : 0), [state?.workouts])
  const tier = tierFor(level)
  const prevTier = useRef(null)
  useEffect(() => {
    if (!state) return
    if (prevTier.current != null && tier.idx > prevTier.current && !state.profile.example) setPowerUp(tier)
    prevTier.current = tier.idx
  }, [tier.idx])

  if (!state) return html`<div class="loading"><div class="loading-dot"></div><p>Charging up…</p>${toast && html`<p class="warn">${toast}</p>`}</div>`

  const app = {
    state, mode: modeRef.current, sample,
    power: { level, tier },
    powerAfter: ws => powerLevel(ws),
    go: setTab,
    toast: setToast,
    update(fn, keys = []) {
      const next = fn(stateRef.current)
      stateRef.current = next
      setState(next)
      keys.forEach(k => saver.current.mark(k))
    },
    replaceAll(d) {
      const prev = stateRef.current
      const next = { ...prev, profile: { ...prev.profile, ...d.profile }, workouts: d.workouts || [], food: d.food || {} }
      stateRef.current = next
      setState(next)
      const ids = new Set([...prev.workouts.map(w => w.id), ...next.workouts.map(w => w.id)])
      const days = new Set([...Object.keys(prev.food), ...Object.keys(next.food)])
      saver.current.mark('profile')
      ids.forEach(id => saver.current.mark('w:' + id))
      days.forEach(d => saver.current.mark('f:' + d))
    },
    startRest: sec => setRest(startTimer(sec)),
    resting: !!rest,
    stopRest: () => setRest(null),
  }

  const View = { home: HomeView, train: WorkoutView, goals: GoalsView, progress: ProgressView, food: FoodView }[tab] || HomeView
  return html`<div class="app">
    <header class="topbar">
      <h1 class="brand">${TITLES[tab]}</h1>
      <div class="topbar-right">
        ${state.active && tab !== 'train' && html`<button class="pill live" onClick=${() => setTab('train')}>● Workout on</button>`}
        <button class="icon-btn" aria-label="Settings" onClick=${() => setSettings(true)}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg></button>
      </div>
    </header>
    <main class="main"><${View} app=${app} /></main>
    ${rest && html`<${RestTimer} timer=${rest} setTimer=${setRest} sound=${state.profile.settings.restSound !== false}
      onToggleSound=${e => app.update(s => ({ ...s, profile: { ...s.profile, settings: { ...s.profile.settings, restSound: e.target.checked } } }), ['profile'])} />`}
    ${toast && html`<div class="toast" role="status">${toast}</div>`}
    <nav class="tabbar" aria-label="Sections">
      ${TABS.map(t => html`<button class=${'tab' + (tab === t.id ? ' on' : '')} aria-current=${tab === t.id ? 'page' : undefined} onClick=${() => setTab(t.id)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d=${t.icon} /></svg><span>${t.label}</span></button>`)}
    </nav>
    <${SettingsSheet} open=${settings} onClose=${() => setSettings(false)} app=${app} />
    ${powerUp && html`<${PowerUp} tier=${powerUp} onDone=${() => setPowerUp(null)} />`}
  </div>`
}

render(html`<${App} />`, document.getElementById('root'))

// Offline support on the hosted website (service workers don't run inside Claude).
if (isStandalone() && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* app still works online */ })
}
