// App shell: loads your data, keeps it in one immutable state object, saves what changed, and
// runs the tab bar, rest timer, toasts, editing past workouts and the power-up moment.
import { html, render, useState, useEffect, useMemo, useRef, Icon, ActionSheet } from './ui/core.js'
import { loadAll, createSaver, isStandalone, requestPersistence, uid, today } from './store.js'
import { powerLevel, tierFor } from './power.js'
import { setRegistry, registryEntry } from './exercises.js'
import { addDays } from './schedule.js'
import { HomeView } from './ui/home.js'
import { SettingsSheet } from './ui/settings.js'
import { WorkoutTab, SessionScreen, sessionFromWorkout, toWorkout, newSession } from './ui/workout.js'
import { PlanTab } from './ui/plan-tab.js'
import { StatsTab } from './ui/stats-tab.js'
import { FoodView } from './ui/food.js'
import { CapySpaView } from './ui/capyspa.js'
import { SharedRoutineSheet } from './ui/share-sheet.js'
import { capyOn } from './water.js'
import { Fighter } from './ui/hero.js'
import { RestTimer, startTimer } from './ui/rest.js'

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'train', label: 'Start', icon: 'dumbbell', centre: true },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'food', label: 'Food', icon: 'food' },
]
// With CapySpa on there are six sections, which won't sit evenly around the centre button. So the
// bar keeps two each side and Stats and CapySpa go behind More.
const MORE = [
  { id: 'stats', label: 'Stats', icon: 'stats', hint: 'Records, muscles, body weight' },
  { id: 'capyspa', label: 'CapySpa', icon: 'drop', hint: 'Water tracker with Capy’s onsen' },
]
const CAPY_TABS = [TABS[0], TABS[1], TABS[2], TABS[4], { id: 'more', label: 'More', icon: 'more', more: true }]

function PowerUp({ tier, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  return html`<div class="powerup" onClick=${onDone} role="status"><div class="powerup-inner">
    <${Fighter} tier=${tier} size=${220} charging=${true} />
    <p class="eyebrow">Power up!</p><p class="powerup-name">${tier.name}</p></div></div>`
}

function Toast({ toast, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, toast.action ? 5000 : 3000); return () => clearTimeout(t) }, [toast])
  return html`<div class="toast" role="status"><span>${toast.text}</span>${toast.action && html`<button class="toast-btn" onClick=${() => { toast.action.run(); onClose() }}>${toast.action.label}</button>`}</div>`
}

function App() {
  const [state, setState] = useState(null)
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('pl.tab') || 'home' } catch { return 'home' } })
  const [tabParam, setTabParam] = useState(null)
  const [rest, setRest] = useState(null)
  const [toast, setToast] = useState(null)
  const [settings, setSettings] = useState(false)
  const [more, setMore] = useState(false)
  const [powerUp, setPowerUp] = useState(null)
  const [editing, setEditing] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const stateRef = useRef(null)
  const saver = useRef(null)
  const modeRef = useRef('local')

  useEffect(() => {
    let alive = true
    loadAll().then(d => {
      if (!alive) return
      modeRef.current = d.mode
      stateRef.current = { profile: d.profile, workouts: d.workouts, food: d.food, water: d.water || {}, active: d.active }
      saver.current = createSaver(d.conn, () => stateRef.current, msg => setToast({ text: msg }))
      setState(stateRef.current)
    }).catch(() => setLoadErr('Couldn’t load your data. Reload the page to try again.'))
    return () => { alive = false }
  }, [])
  useEffect(() => { try { localStorage.setItem('pl.tab', tab) } catch { /* private mode */ } window.scrollTo(0, 0) }, [tab])

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
  const capyHidden = state && !capyOn(state.profile.settings)
  useEffect(() => { if (capyHidden && tab === 'capyspa') setTab('home') }, [capyHidden, tab])

  if (state) setRegistry(state.profile.exercises)
  const level = useMemo(() => (state ? powerLevel(state.workouts) : 0), [state?.workouts])
  const tier = tierFor(level)
  const prevTier = useRef(null)
  useEffect(() => {
    if (!state) return
    if (prevTier.current != null && tier.idx > prevTier.current && !state.profile.example) setPowerUp(tier)
    prevTier.current = tier.idx
  }, [tier.idx])

  if (!state) return html`<div class="loading"><div class="loading-dot"></div><p>Charging up…</p>${loadErr && html`<p class="warn">${loadErr}</p>`}</div>`

  const update = (fn, keys = []) => {
    const next = fn(stateRef.current)
    stateRef.current = next
    setState(next)
    keys.forEach(k => saver.current.mark(k))
  }
  const app = {
    state, mode: modeRef.current,
    power: { level, tier },
    powerAfter: ws => powerLevel(ws),
    go: (t, param = null) => { setTab(t); setTabParam(param) },
    toast: t => setToast(typeof t === 'string' ? { text: t } : t),
    update,
    setSetting: patch => update(s => ({ ...s, profile: { ...s.profile, settings: { ...s.profile.settings, ...patch } } }), ['profile']),
    // Known to exInfo at once, so a just-made exercise gets the right sets before the next render.
    registerExercise: ex => { update(s => (s.profile.exercises?.[ex.id] ? s : { ...s, profile: { ...s.profile, exercises: { ...(s.profile.exercises || {}), [ex.id]: registryEntry(ex) } } }), ['profile']); setRegistry(stateRef.current.profile.exercises) },
    replaceAll(d) {
      const prev = stateRef.current
      // No water in the data (old backups, example data) keeps the CapySpa log already here.
      const next = { ...prev, profile: { ...prev.profile, ...d.profile }, workouts: d.workouts || [], food: d.food || {}, water: d.water ?? prev.water }
      stateRef.current = next
      setState(next)
      const ids = new Set([...prev.workouts.map(w => w.id), ...next.workouts.map(w => w.id)])
      const days = new Set([...Object.keys(prev.food), ...Object.keys(next.food)])
      saver.current.mark('profile')
      ids.forEach(id => saver.current.mark('w:' + id))
      days.forEach(day => saver.current.mark('f:' + day))
      new Set([...Object.keys(prev.water), ...Object.keys(next.water)]).forEach(day => saver.current.mark('h:' + day))
    },
    startRest: sec => setRest(startTimer(sec)),
    stopRest: () => setRest(null),
    resting: !!rest,
    openSettings: () => setSettings(true),
    editWorkout: w => setEditing(sessionFromWorkout(w)),
    logPast: () => setEditing({ ...newSession({ state }, null, { date: addDays(today(), -1), warm: false }), editing: true, isNew: true, durationMin: 60 }),
    repeatWorkout: w => {
      if (state.active) { setToast({ text: 'Finish or discard the current workout first.' }); return }
      const routine = { id: w.routineId, name: w.name, items: w.entries.map(e => ({ ...(e.cfg || {}), exId: e.exId, sets: e.sets.filter(s => !s.warmup).length, group: e.group ? e.group.replace(/^g-?/, '') : undefined })) }
      update(s => ({ ...s, active: newSession({ state: s }, routine, { feeling: 'great' }) }), ['profile'])
      setTab('train')
    },
  }
  const saveEdit = () => {
    const w = { ...toWorkout(editing), ...(editing.isNew ? { id: uid() } : {}) }
    if (!w.entries.length) { setToast({ text: 'Add at least one set to save.' }); return }
    update(s => ({ ...s, workouts: editing.isNew ? [...s.workouts, w] : s.workouts.map(x => (x.id === w.id ? w : x)) }), ['w:' + w.id])
    setEditing(null)
    setToast({ text: editing.isNew ? 'Workout logged' : 'Workout updated. Records recalculated.' })
  }

  const capy = capyOn(state.profile.settings)
  const tabs = capy ? CAPY_TABS : TABS
  const shown = !capy && tab === 'capyspa' ? 'home' : tab
  const inMore = capy && MORE.some(m => m.id === shown)
  const View = { home: HomeView, plan: PlanTab, train: WorkoutTab, stats: StatsTab, food: FoodView, capyspa: CapySpaView }[shown] || HomeView
  const inSession = tab === 'train' && state.active
  return html`<div class=${'app' + (inSession || editing ? ' in-session' : '') + (shown === 'capyspa' ? ' capy-tab' : '')}>
    <main class="main">${editing
      ? html`<${SessionScreen} app=${app} session=${editing} onChange=${setEditing} onFinish=${saveEdit} onDiscard=${() => setEditing(null)} onClose=${() => setEditing(null)} />`
      : html`<${View} app=${app} initial=${tabParam} key=${shown} />`}</main>
    ${rest && html`<${RestTimer} timer=${rest} setTimer=${setRest} sound=${state.profile.settings.restSound !== false} flash=${!!state.profile.settings.restFlash}
      onToggleSound=${e => app.setSetting({ restSound: e.target.checked })} />`}
    ${toast && html`<${Toast} toast=${toast} onClose=${() => setToast(null)} />`}
    ${!editing && html`<nav class="tabbar" aria-label="Sections">
      ${tabs.map(t => {
        const on = t.more ? inMore : shown === t.id
        const sub = t.more && inMore ? MORE.find(m => m.id === shown) : null
        return html`<button class=${'tab' + (on ? ' on' : '') + (t.centre ? ' centre' : '')} aria-current=${on && !t.more ? 'page' : undefined} aria-haspopup=${t.more ? 'dialog' : undefined}
          onClick=${() => (t.more ? setMore(true) : app.go(t.id))}>
        <span class="tab-ic"><${Icon} name=${sub ? sub.icon : t.icon} size=${t.centre ? 26 : 24} /></span><span>${t.centre && state.active ? 'Workout' : sub ? sub.label : t.label}</span></button>`
      })}
    </nav>`}
    <${ActionSheet} open=${more} title="More" onClose=${() => setMore(false)} actions=${[
      ...MORE.map(m => ({ label: m.label, icon: m.icon, hint: m.hint, onClick: () => app.go(m.id) })),
      { label: 'Settings', icon: 'settings', onClick: () => setSettings(true) },
    ]} />
    <${SettingsSheet} open=${settings} onClose=${() => setSettings(false)} app=${app} />
    <${SharedRoutineSheet} app=${app} />
    ${powerUp && html`<${PowerUp} tier=${powerUp} onDone=${() => setPowerUp(null)} />`}
  </div>`
}

render(html`<${App} />`, document.getElementById('root'))

// Offline support on the hosted website (service workers don't run inside Claude).
if (isStandalone() && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // When an update takes over, reload once so the new version shows straight away. Everything,
  // a workout in progress included, is already saved, so nothing is lost.
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    location.reload()
  })
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => { /* app still works online */ })
}
