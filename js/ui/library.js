// The exercise library: ~780 exercises with photos and muscles, searchable and filterable by
// muscle (tap the body map) and equipment. Doubles as the picker inside a workout.
import { html, useState, useEffect, useMemo, Sheet, Icon, Field, Segmented, Toggle, fmt, fmtDate } from './core.js'
import { Thumb, ExerciseDemo } from './media.js'
import { BodyMap, ExerciseMuscles } from './bodymap.js'
import { LineChart } from './charts.js'
import { EXERCISES, loadCatalog, instructionsFor, EQUIPMENT_NAMES } from '../exercises.js'
import { MUSCLE_NAME, MAIN_MUSCLES } from '../muscles.js'
import { exerciseHistory } from '../strength.js'
import { uid } from '../store.js'

const EQ_FILTERS = [
  { value: 'all', label: 'All' }, { value: 'barbell', label: 'Barbell' }, { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine & cable' }, { value: 'bodyweight', label: 'Bodyweight' },
]
const eqMatch = (eq, f) => f === 'all' || (f === 'machine' ? eq === 'machine' || eq === 'cable' : f === 'barbell' ? ['barbell', 'ez', 'trap', 'smith'].includes(eq) : eq === f)

export function useLibrary(app) {
  const [catalog, setCatalog] = useState([])
  const [state, setState] = useState('loading')
  useEffect(() => { loadCatalog().then(c => { setCatalog(c); setState('ready') }, () => setState('offline')) }, [])
  return useMemo(() => {
    const coreFdb = new Set(EXERCISES.map(e => e.fdb))
    const mine = Object.values(app.state.profile.exercises || {})
    const mineIds = new Set(mine.map(e => e.id))
    const list = [...EXERCISES, ...mine.filter(e => !EX_IDS.has(e.id)), ...catalog.filter(c => !coreFdb.has(c.fdb) && !mineIds.has(c.id))]
    return { list, state }
  }, [catalog, state, app.state.profile.exercises])
}
const EX_IDS = new Set(EXERCISES.map(e => e.id))

function NewExercise({ open, onClose, onSave }) {
  const [f, setF] = useState({ name: '', eq: 'machine', p: 'chest', mode: 'reps', uni: false })
  const save = e => { e.preventDefault(); if (!f.name.trim()) return; onSave({ id: 'c:' + uid(), name: f.name.trim(), eq: f.eq, p: [f.p], s: [], mode: f.mode, uni: f.uni, cues: [], custom: true }); setF({ ...f, name: '' }) }
  return html`<${Sheet} open=${open} title="New exercise" onClose=${onClose}>
    <form class="stack" onSubmit=${save}>
      <${Field} label="Name"><input id="nx-name" class="input" value=${f.name} onInput=${e => setF({ ...f, name: e.target.value })} placeholder="e.g. Hammer Strength chest press" /></${Field}>
      <${Field} label="Equipment"><select id="nx-eq" class="input" value=${f.eq} onChange=${e => setF({ ...f, eq: e.target.value })}>${Object.entries(EQUIPMENT_NAMES).map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></${Field}>
      <${Field} label="Main muscle"><select id="nx-p" class="input" value=${f.p} onChange=${e => setF({ ...f, p: e.target.value })}>${MAIN_MUSCLES.map(m => html`<option value=${m}>${MUSCLE_NAME[m]}</option>`)}</select></${Field}>
      <${Field} label="Logged by"><${Segmented} small label="Logged by" value=${f.mode} onChange=${v => setF({ ...f, mode: v })} options=${[{ value: 'reps', label: 'Weight × reps' }, { value: 'time', label: 'Time' }]} /></${Field}>
      <div class="group"><${Toggle} id="nx-uni" checked=${f.uni} onChange=${v => setF({ ...f, uni: v })} label="One side at a time" hint="Reps are logged per side, volume counts both." /></div>
      <button class="btn primary">Add exercise</button>
    </form>
  </${Sheet}>`
}

export function ExerciseDetail({ ex, app, open, onClose, onAdd }) {
  const [ins, setIns] = useState(null)
  useEffect(() => { if (open && ex) { setIns(null); instructionsFor(ex).then(setIns) } }, [open, ex?.id])
  if (!ex) return null
  const hist = exerciseHistory(app.state.workouts, ex.id)
  const best = hist.reduce((m, p) => (p.e1rm > (m?.e1rm || 0) ? p : m), null)
  const sex = app.state.profile.settings.sex
  return html`<${Sheet} open=${open} title=${ex.name} onClose=${onClose} tall>
    <${ExerciseDemo} ex=${ex} sex=${sex} />
    <div class="tag-row">${(ex.p || []).map(m => html`<span class="tag strong">${MUSCLE_NAME[m] || m}</span>`)}${(ex.s || []).map(m => html`<span class="tag">${MUSCLE_NAME[m] || m}</span>`)}<span class="tag">${EQUIPMENT_NAMES[ex.eq] || ex.eq}</span>${ex.level && html`<span class="tag">${ex.level}</span>`}</div>
    ${onAdd && html`<button class="btn primary" onClick=${() => onAdd(ex)}>Add to workout</button>`}
    ${hist.length > 0 && html`<div class="card-flat"><p class="section-label">Your estimated 1RM</p>
      <${LineChart} label=${'Estimated 1RM for ' + ex.name} height=${160} series=${[{ className: 's-raw', dots: true, area: true, points: hist.map(p => ({ x: p.date, y: p.e1rm, flag: p.feeling !== 'great' })) }]} />
      <p class="muted small">Best ≈ ${fmt(best.e1rm)} kg on ${fmtDate(best.date)} · ${hist.length} sessions</p></div>`}
    <div class="card-flat"><p class="section-label">Muscles worked</p><${ExerciseMuscles} ex=${ex} sex=${sex} size="md" /></div>
    ${ex.cues?.length > 0 && html`<div class="card-flat"><p class="section-label">Think about</p><ol class="cues">${ex.cues.map(c => html`<li>${c}</li>`)}</ol></div>`}
    ${ins?.length > 0 && html`<div class="card-flat"><p class="section-label">How to</p><ol class="cues">${ins.map(c => html`<li>${c}</li>`)}</ol></div>`}
  </${Sheet}>`
}

export function Library({ app, onPick, pickLabel }) {
  const { list, state } = useLibrary(app)
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState(null)
  const [eq, setEq] = useState('all')
  const [limit, setLimit] = useState(60)
  const [detail, setDetail] = useState(null)
  const [adding, setAdding] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const used = useMemo(() => new Set(app.state.workouts.flatMap(w => w.entries.map(e => e.exId))), [app.state.workouts])
  const s = q.trim().toLowerCase()
  const filtered = list.filter(e => (!s || e.name.toLowerCase().includes(s)) && (!muscle || (e.p || []).includes(muscle) || (e.s || []).includes(muscle)) && eqMatch(e.eq, eq))
    .sort((a, b) => (used.has(b.id) - used.has(a.id)) || (EX_IDS.has(b.id) - EX_IDS.has(a.id)) || a.name.localeCompare(b.name))
  const choose = ex => {
    if (!EX_IDS.has(ex.id)) app.registerExercise(ex)
    if (onPick) onPick(ex.id); else setDetail(ex)
  }
  return html`<div class="stack">
    <div class="search"><${Icon} name="list" size=${18} /><input id="lib-q" type="search" placeholder=${`Search ${list.length} exercises`} value=${q} onInput=${e => { setQ(e.target.value); setLimit(60) }} /></div>
    <${Segmented} small label="Equipment" value=${eq} onChange=${setEq} options=${EQ_FILTERS} />
    <div class="filter-row">
      <button class=${'chip' + (showMap ? ' on' : '')} onClick=${() => setShowMap(!showMap)}>${muscle ? MUSCLE_NAME[muscle] : 'By muscle'}</button>
      ${muscle && html`<button class="chip" onClick=${() => setMuscle(null)}>Clear</button>`}
      <button class="chip" onClick=${() => setAdding(true)}>+ Your own</button>
    </div>
    ${showMap && html`<div class="card"><p class="muted small center">Tap a muscle</p><${BodyMap} sex=${app.state.profile.settings.sex} tone="focus" levels=${muscle ? { [muscle]: 4 } : {}} onPick=${m => { setMuscle(m); setShowMap(false) }} label="Pick a muscle" /></div>`}
    ${state === 'offline' && html`<p class="muted small">Showing your exercises only. The full library loads when you're online.</p>`}
    <div class="group list">
      ${filtered.slice(0, limit).map(e => html`<div class="row-btn ex-row">
        <button class="ex-row-main" onClick=${() => choose(e)}><${Thumb} ex=${e} /><span class="row-main"><span>${e.name}</span><small>${(e.p || []).map(m => MUSCLE_NAME[m] || m).join(', ') || 'General'} · ${EQUIPMENT_NAMES[e.eq] || e.eq}${used.has(e.id) ? ' · yours' : ''}</small></span></button>
        ${onPick && html`<button class="circle-btn" aria-label=${'About ' + e.name} onClick=${() => setDetail(e)}><${Icon} name="info" size=${18} /></button>`}
      </div>`)}
      ${filtered.length === 0 && html`<p class="muted small pad">No exercises match. Try fewer filters, or add your own.</p>`}
    </div>
    ${filtered.length > limit && html`<button class="btn" onClick=${() => setLimit(limit + 60)}>Show more (${filtered.length - limit})</button>`}
    <${ExerciseDetail} ex=${detail} app=${app} open=${!!detail} onClose=${() => setDetail(null)} onAdd=${onPick ? ex => { setDetail(null); choose(ex) } : null} />
    <${NewExercise} open=${adding} onClose=${() => setAdding(false)} onSave=${ex => { app.registerExercise(ex); setAdding(false); if (onPick) onPick(ex.id) }} />
  </div>`
}

export function LibrarySheet({ open, onClose, app, onPick, title = 'Add exercise' }) {
  return html`<${Sheet} open=${open} title=${title} onClose=${onClose} tall>${open && html`<${Library} app=${app} onPick=${id => { onPick(id); onClose() }} />`}</${Sheet}>`
}
