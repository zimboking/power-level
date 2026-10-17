// Plan: the week (a routine per weekday, or a rotation), routines and their editor, starter
// plans, and the exercise library.
import { html, useState, Sheet, Icon, Segmented, Stepper, Field, ConfirmButton, PageHead, Empty, fmtClock, fmtWeekday, fmtDate } from './core.js'
import { Library, LibrarySheet } from './library.js'
import { BodyMap } from './bodymap.js'
import { Thumb } from './media.js'
import { exInfo, STARTER_PLANS } from '../exercises.js'
import { POLICIES } from '../progression.js'
import { DAY_NAMES, emptyPlan, plannedFor, applyStarter, addDays, weekOf } from '../schedule.js'
import { MUSCLE_NAME } from '../muscles.js'
import { uid, today } from '../store.js'

const REST_OPTS = [30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 300, 360, 480, 600, 900]

export function routineMuscles(routine) {
  const out = {}
  for (const it of routine.items || []) {
    const ex = exInfo(it.exId)
    for (const m of ex.p || []) out[m] = (out[m] || 0) + (it.sets || 3)
    for (const m of ex.s || []) out[m] = (out[m] || 0) + (it.sets || 3) / 2
  }
  return out
}
const levelsOf = counts => { const max = Math.max(1, ...Object.values(counts)); return Object.fromEntries(Object.entries(counts).map(([m, v]) => [m, Math.max(1, Math.ceil((v / max) * 4))])) }

function ItemRow({ it, i, n, onChange, onMove, onRemove, linked, onLink }) {
  const ex = exInfo(it.exId)
  const timed = ex.mode === 'time'
  const [open, setOpen] = useState(false)
  return html`<div class=${'item-row' + (it.group ? ' in-superset' : '')}>
    <button class="item-head" onClick=${() => setOpen(!open)} aria-expanded=${open}>
      <${Thumb} ex=${ex} /><span class="row-main"><span>${ex.name}</span><small>${it.sets} × ${timed ? `${it.repsMin}s` : `${it.repsMin}${it.repsMax !== it.repsMin ? '–' + it.repsMax : ''}`} · ${it.pyramid ? 'pyramid' : POLICIES[it.prog]?.name || (timed ? 'Add time' : 'Double progression')}${it.rest ? ' · rest ' + fmtClock(it.rest) : ''}</small></span>
      <${Icon} name=${open ? 'up' : 'down'} size=${18} />
    </button>
    ${open && html`<div class="item-edit">
      <div class="row-3">
        <${Field} label="Sets"><${Stepper} label="Sets" value=${it.sets} step=${1} min=${1} onChange=${v => onChange({ ...it, sets: Math.max(1, v) })} /></${Field}>
        <${Field} label=${timed ? 'Seconds' : 'Reps from'}><${Stepper} label="Reps from" value=${it.repsMin} step=${timed ? 5 : 1} min=${1} onChange=${v => onChange({ ...it, repsMin: v, repsMax: Math.max(v, it.repsMax) })} /></${Field}>
        ${!timed && html`<${Field} label="to"><${Stepper} label="Reps to" value=${it.repsMax} step=${1} min=${1} onChange=${v => onChange({ ...it, repsMax: Math.max(v, it.repsMin) })} /></${Field}>`}
      </div>
      <div class="row-2">
        <${Field} label="Effort target (RIR)"><select class="input" value=${it.rir ?? 2} onChange=${e => onChange({ ...it, rir: +e.target.value })}>${[0, 1, 2, 3, 4].map(v => html`<option value=${v}>${v}</option>`)}</select></${Field}>
        <${Field} label="Rest"><select class="input" value=${it.rest || ''} onChange=${e => onChange({ ...it, rest: e.target.value ? +e.target.value : undefined })}><option value="">Default</option>${REST_OPTS.map(v => html`<option value=${v}>${fmtClock(v)}</option>`)}</select></${Field}>
      </div>
      <${Field} label="Progression"><select class="input" value=${it.pyramid ? 'pyramid' : it.prog || (timed ? 'time' : 'double')} onChange=${e => onChange(e.target.value === 'pyramid' ? { ...it, pyramid: true } : { ...it, pyramid: false, prog: e.target.value })}>
        ${Object.entries(POLICIES).filter(([k]) => (timed ? ['time', 'off'].includes(k) : k !== 'time')).map(([k, p]) => html`<option value=${k}>${p.name}</option>`)}
        ${!timed && html`<option value="pyramid">Pyramid (own weight, reps, rest per set)</option>`}
      </select></${Field}>
      <p class="muted small">${it.pyramid ? 'Each set keeps its own weight, reps and rest, read from last time.' : POLICIES[it.prog || (timed ? 'time' : 'double')]?.desc}</p>
      <div class="row-btns">
        <button class="btn small" disabled=${i === 0} onClick=${() => onMove(-1)}>Move up</button>
        <button class="btn small" disabled=${i === n - 1} onClick=${() => onMove(1)}>Move down</button>
        ${i < n - 1 && html`<button class=${'btn small' + (linked ? ' on' : '')} onClick=${onLink}>${linked ? 'Unlink superset' : 'Superset with next'}</button>`}
        <button class="btn small danger-text" onClick=${onRemove}>Remove</button>
      </div>
    </div>`}
  </div>`
}

export function RoutineEditor({ app, routine, open, onClose }) {
  const [r, setR] = useState(routine)
  const [pick, setPick] = useState(false)
  if (open && routine && r?.id !== routine.id) setR(routine)
  if (!open || !r) return null
  const items = r.items
  const setItems = list => setR({ ...r, items: list })
  const isNew = !app.state.profile.templates.some(t => t.id === r.id)
  const save = () => {
    if (!r.name.trim()) return
    app.update(s => ({ ...s, profile: { ...s.profile, templates: isNew ? [r, ...s.profile.templates] : s.profile.templates.map(t => (t.id === r.id ? r : t)) } }), ['profile'])
    app.toast(isNew ? 'Routine added' : 'Routine saved'); onClose()
  }
  const link = i => {
    const cur = items[i], nxt = items[i + 1]
    const linked = cur.group && cur.group === nxt.group
    const g = linked ? undefined : cur.group || uid().slice(0, 4)
    setItems(items.map((x, j) => (j === i + 1 || (j === i && !linked) ? { ...x, group: g } : x)))
  }
  const move = (i, d) => { const next = [...items];[next[i], next[i + d]] = [next[i + d], next[i]]; setItems(next) }
  return html`<${Sheet} open=${open} title=${isNew ? 'New routine' : 'Edit routine'} onClose=${onClose} tall>
    <input id="routine-name" class="input title-input" value=${r.name} placeholder="Routine name, e.g. Push Day" onInput=${e => setR({ ...r, name: e.target.value })} />
    ${items.length > 0 && html`<div class="card-flat"><p class="section-label">Muscles this works</p><${BodyMap} levels=${levelsOf(routineMuscles(r))} sex=${app.state.profile.settings.sex} size="sm" label=${'Muscles worked by ' + r.name} /></div>`}
    <div class="group">${items.map((it, i) => html`<${ItemRow} key=${it.exId + i} it=${it} i=${i} n=${items.length} linked=${!!it.group && items[i + 1]?.group === it.group}
      onChange=${v => setItems(items.map((x, j) => (j === i ? v : x)))} onMove=${d => move(i, d)} onRemove=${() => setItems(items.filter((_, j) => j !== i))} onLink=${() => link(i)} />`)}
      <button class="row-btn" onClick=${() => setPick(true)}><span class="row-ic"><${Icon} name="plus" size=${20} /></span><span class="row-main"><span>Add exercise</span></span></button>
    </div>
    <button class="btn primary big" disabled=${!r.name.trim() || !items.length} onClick=${save}>Save routine</button>
    ${!isNew && html`<${ConfirmButton} class="btn ghost" confirmText="Tap again to delete" onConfirm=${() => {
      app.update(s => ({ ...s, profile: { ...s.profile, templates: s.profile.templates.filter(t => t.id !== r.id) } }), ['profile']); onClose()
    }}>Delete routine</${ConfirmButton}>`}
    <${LibrarySheet} open=${pick} onClose=${() => setPick(false)} app=${app} onPick=${exId => setItems([...items, { exId, sets: 3, repsMin: exInfo(exId).mode === 'time' ? 30 : 8, repsMax: exInfo(exId).mode === 'time' ? 30 : 12, rir: 2 }])} />
  </${Sheet}>`
}

function WeekPlan({ app }) {
  const { profile, workouts } = app.state
  const plan = { ...emptyPlan(), ...(profile.plan || {}) }
  const routines = profile.templates || []
  const setPlan = patch => app.update(s => ({ ...s, profile: { ...s.profile, plan: { ...plan, ...patch } } }), ['profile'])
  const [moving, setMoving] = useState(null)
  const order = Array.from({ length: 7 }, (_, i) => (plan.weekStart + i) % 7)
  const days = Array.from({ length: 10 }, (_, i) => addDays(today(), i))
  const moveTo = (from, to, routine) => {
    const ov = { ...(plan.overrides || {}), [from]: 'rest', [to]: routine.id }
    setPlan({ overrides: ov }); setMoving(null); app.toast(`${routine.name} moved to ${fmtWeekday(to)}`)
  }
  return html`<div class="stack">
    <${Segmented} label="Plan type" value=${plan.mode} onChange=${m => setPlan({ mode: m })} options=${[{ value: 'weekly', label: 'Fixed days' }, { value: 'rotation', label: 'Rotation' }]} />
    <p class="muted small">${plan.mode === 'weekly' ? 'A routine for each day of the week.' : 'A, B, C, A … on the days you train. The next session is the next one you haven’t done, however the week went.'}</p>
    ${plan.mode === 'weekly' ? html`<div class="group">${order.map(d => html`<label class="toggle-row" for=${'day-' + d}><span class="row-main"><span>${DAY_NAMES[d]}</span></span>
        <select id=${'day-' + d} class="input select" value=${plan.days[d] || ''} onChange=${e => setPlan({ days: { ...plan.days, [d]: e.target.value || null } })}><option value="">Rest</option>${routines.map(r => html`<option value=${r.id}>${r.name}</option>`)}</select></label>`)}</div>`
      : html`<div class="card-flat stack">
        <p class="section-label">Training days</p>
        <div class="chips">${order.map(d => html`<button class=${'chip' + (plan.trainDays.includes(d) ? ' on' : '')} onClick=${() => setPlan({ trainDays: plan.trainDays.includes(d) ? plan.trainDays.filter(x => x !== d) : [...plan.trainDays, d] })}>${DAY_NAMES[d].slice(0, 3)}</button>`)}</div>
        <p class="section-label">Order</p>
        <div class="group">${plan.rotation.map((id, i) => html`<div class="toggle-row"><span class="row-main"><span>${String.fromCharCode(65 + i)} · ${routines.find(r => r.id === id)?.name || 'Missing routine'}</span></span>
          <button class="circle-btn" aria-label="Remove from rotation" onClick=${() => setPlan({ rotation: plan.rotation.filter((_, j) => j !== i) })}><${Icon} name="x" size=${16} /></button></div>`)}
          <label class="toggle-row" for="rot-add"><span class="row-main"><span>Add to rotation</span></span><select id="rot-add" class="input select" value="" onChange=${e => e.target.value && setPlan({ rotation: [...plan.rotation, e.target.value] })}><option value="">Choose…</option>${routines.map(r => html`<option value=${r.id}>${r.name}</option>`)}</select></label>
        </div></div>`}
    <p class="section-label">Coming up</p>
    <div class="group">${days.map(d => {
      const r = plannedFor(profile, workouts, d, today())
      const done = workouts.some(w => w.date === d)
      return html`<div class=${'toggle-row' + (d === today() ? ' today' : '')}><span class="row-main"><span>${d === today() ? 'Today' : fmtWeekday(d)} <small class="inline">${fmtDate(d)}</small></span><small>${done ? 'Trained' : r ? r.name : 'Rest day'}${plan.overrides?.[d] ? ' · moved' : ''}</small></span>
        ${r && !done && html`<button class="text-btn" onClick=${() => setMoving({ from: d, routine: r })}>Move</button>`}
        ${plan.overrides?.[d] && html`<button class="text-btn" onClick=${() => { const ov = { ...plan.overrides }; delete ov[d]; setPlan({ overrides: ov }) }}>Undo</button>`}</div>`
    })}</div>
    <${Sheet} open=${!!moving} title=${moving ? 'Move ' + moving.routine.name : ''} onClose=${() => setMoving(null)}>
      <p class="muted small">Moves this one session. Your weekly plan stays as it is.</p>
      <div class="group">${moving && weekOf(moving.from, plan.weekStart).concat(weekOf(addDays(moving.from, 7), plan.weekStart)).filter(d => d >= today() && d !== moving.from).slice(0, 8).map(d => html`<button class="row-btn" onClick=${() => moveTo(moving.from, d, moving.routine)}><span class="row-main"><span>${fmtWeekday(d)}</span><small>${fmtDate(d)}</small></span></button>`)}</div>
    </${Sheet}>
  </div>`
}

function Starters({ app }) {
  return html`<div class="stack">
    <p class="section-label">Starter plans</p>
    <div class="group">${STARTER_PLANS.map(p => html`<button class="row-btn" onClick=${() => { app.update(s => ({ ...s, profile: applyStarter(s.profile, p, uid) }), ['profile']); app.toast(`${p.name} loaded. Edit anything you like.`) }}>
      <span class="row-ic"><${Icon} name="calendar" size=${20} /></span><span class="row-main"><span>${p.name}</span><small>${p.blurb} · ${p.routines.map(r => r.name).join(', ')}</small></span><${Icon} name="plus" size=${18} /></button>`)}</div>
  </div>`
}

export function PlanTab({ app }) {
  const [seg, setSeg] = useState('week')
  const [editing, setEditing] = useState(null)
  const routines = app.state.profile.templates || []
  return html`<div class="stack">
    <${PageHead} title="Plan" sub=${seg === 'exercises' ? 'Every exercise, with photos and muscles' : 'Your week and your routines'} />
    <${Segmented} label="Plan section" value=${seg} onChange=${setSeg} options=${[{ value: 'week', label: 'Week' }, { value: 'routines', label: 'Routines' }, { value: 'exercises', label: 'Exercises' }]} />
    ${seg === 'week' && (routines.length ? html`<${WeekPlan} app=${app} />` : html`<${Empty} title="No routines yet" icon="calendar">Load a starter plan below, or build your own routines first.</${Empty}><${Starters} app=${app} />`)}
    ${seg === 'routines' && html`
      ${routines.map(r => html`<button class="card routine-card" onClick=${() => setEditing(r)}>
        <div class="routine-text"><p class="title-3">${r.name}</p><p class="muted small">${r.items.length} exercises · ${r.items.reduce((n, i) => n + (i.sets || 3), 0)} sets</p>
          <p class="muted small">${[...new Set(r.items.flatMap(i => exInfo(i.exId).p || []))].slice(0, 4).map(m => MUSCLE_NAME[m]).join(' · ')}</p></div>
        <div class="routine-map"><${BodyMap} levels=${levelsOf(routineMuscles(r))} sex=${app.state.profile.settings.sex} size="xs" label=${'Muscles worked by ' + r.name} /></div>
      </button>`)}
      <button class="btn primary wide" onClick=${() => setEditing({ id: 'r' + uid(), name: '', items: [] })}><${Icon} name="plus" size=${18} /> New routine</button>
      <${Starters} app=${app} />`}
    ${seg === 'exercises' && html`<${Library} app=${app} />`}
    <${RoutineEditor} app=${app} routine=${editing} open=${!!editing} onClose=${() => setEditing(null)} />
  </div>`
}
