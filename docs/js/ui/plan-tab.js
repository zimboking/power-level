// Plan: the week (a routine per weekday, or a rotation), routines and their editor, starter
// plans, and the exercise library.
import { html, useState, useRef, Sheet, Icon, Segmented, Stepper, Field, ConfirmButton, Toggle, PageHead, Empty, fmtClock, fmtWeekday, fmtDate } from './core.js'
import { Library, LibrarySheet } from './library.js'
import { BodyMap } from './bodymap.js'
import { Thumb } from './media.js'
import { exInfo, STARTER_PLANS, EXERCISES } from '../exercises.js'
import { POLICIES } from '../progression.js'
import { DAY_NAMES, emptyPlan, plannedFor, applyStarter, addDays, weekOf } from '../schedule.js'
import { MUSCLE_NAME } from '../muscles.js'
import { uid, today } from '../store.js'
import { groupRoutines, addFolder, renameFolder, deleteFolder, moveFolder, moveRoutine, setRoutineFolder, saveRoutine, deleteRoutine } from '../routines.js'

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

// Quick fill: muscle groups → a couple of solid exercises each, compounds first (core list order).
export const MUSCLE_GROUPS = {
  Chest: ['chest'], Back: ['upper-back', 'lower-back', 'trapezius'], Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves'],
  Shoulders: ['deltoids'], Arms: ['biceps', 'triceps'], Core: ['abs', 'obliques'],
}
const PER_GROUP = { Legs: 3, Back: 2, Chest: 2, Shoulders: 2, Arms: 2, Core: 1 }
export function suggestItems(groups, existing = []) {
  const have = new Set(existing.map(i => i.exId))
  const out = []
  for (const g of groups) {
    const picks = EXERCISES.filter(e => !have.has(e.id) && (e.p || []).some(m => MUSCLE_GROUPS[g].includes(m)))
    // Arms: one biceps and one triceps rather than two curls.
    const chosen = g === 'Arms' ? [picks.find(e => e.p[0] === 'biceps'), picks.find(e => e.p[0] === 'triceps')].filter(Boolean) : picks.slice(0, PER_GROUP[g])
    for (const e of chosen) {
      have.add(e.id)
      const timed = e.mode === 'time', big = ['barbell', 'trap'].includes(e.eq) && !['biceps', 'triceps', 'forearm', 'deltoids'].includes(e.p[0])
      out.push({ exId: e.id, sets: 3, repsMin: timed ? 30 : big ? 5 : 8, repsMax: timed ? 30 : big ? 8 : 12, rir: big ? 2 : 1, ...(big ? { rest: 180 } : {}) })
    }
  }
  return out
}

function QuickFill({ items, onAdd }) {
  const [groups, setGroups] = useState([])
  const toggle = g => setGroups(groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g])
  return html`<div class="card-flat stack">
    <p class="section-label">Quick fill by muscle group</p>
    <div class="chips">${Object.keys(MUSCLE_GROUPS).map(g => html`<button class=${'chip' + (groups.includes(g) ? ' on' : '')} onClick=${() => toggle(g)} aria-pressed=${groups.includes(g)}>${g}</button>`)}</div>
    <button class="btn small" disabled=${!groups.length} onClick=${() => { const add = suggestItems(groups, items); if (add.length) onAdd(add); setGroups([]) }}>Add exercises for ${groups.length ? groups.join(', ') : 'these'}</button>
  </div>`
}

const NEW_FOLDER = '__new'

// Folder picker for a routine: its folder, unfiled, or a new one typed in place.
function FolderField({ folders, value, newName, onChange, onNewName }) {
  return html`<${Field} label="Folder">
    <select id="routine-folder" class="input" value=${value} onChange=${e => onChange(e.target.value)}>
      <option value="">No folder</option>
      ${folders.map(f => html`<option value=${f.id}>${f.name}</option>`)}
      <option value=${NEW_FOLDER}>New folder…</option>
    </select>
    ${value === NEW_FOLDER && html`<input id="routine-new-folder" class="input" placeholder="Folder name, e.g. Strength" value=${newName} onInput=${e => onNewName(e.target.value)} />`}
  </${Field}>`
}

export function RoutineEditor({ app, routine, open, onClose, mode = 'routine', onStart }) {
  const custom = mode === 'custom'
  const [keep, setKeep] = useState(false)
  const [r, setR] = useState(routine)
  const [pick, setPick] = useState(false)
  const [newFolder, setNewFolder] = useState('')
  // Start from the saved routine every time the editor opens, so unsaved changes don't linger.
  const openedFor = useRef(null)
  if (!open) openedFor.current = null
  else if (routine && openedFor.current !== routine) { openedFor.current = routine; if (r !== routine) setR(routine); if (newFolder) setNewFolder('') }
  if (!open || !r) return null
  const items = r.items
  const setItems = list => setR({ ...r, items: list })
  const folders = app.state.profile.folders || []
  const isNew = !app.state.profile.templates.some(t => t.id === r.id)
  // A typed new folder is created when the routine is saved.
  const withFolder = (profile, routine) => {
    if (routine.folder !== NEW_FOLDER) return { profile, routine }
    const id = 'f' + uid()
    const next = addFolder(profile, newFolder, id)
    return { profile: next, routine: next === profile ? { ...routine, folder: '' } : { ...routine, folder: id } }
  }
  const store = routine => app.update(s => { const f = withFolder(s.profile, routine); return { ...s, profile: saveRoutine(f.profile, f.routine) } }, ['profile'])
  const save = () => {
    if (!r.name.trim()) return
    store(r)
    app.toast(isNew ? 'Routine added' : 'Routine saved'); onClose()
  }
  const link = i => {
    const cur = items[i], nxt = items[i + 1]
    const linked = cur.group && cur.group === nxt.group
    const g = linked ? undefined : cur.group || uid().slice(0, 4)
    setItems(items.map((x, j) => (j === i + 1 || (j === i && !linked) ? { ...x, group: g } : x)))
  }
  const move = (i, d) => { const next = [...items];[next[i], next[i + d]] = [next[i + d], next[i]]; setItems(next) }
  const start = () => {
    const name = r.name.trim() || 'Custom workout'
    const routine = { ...r, name }
    if (keep) store(routine)
    onStart(keep ? routine : { ...routine, id: null })
  }
  return html`<${Sheet} open=${open} title=${custom ? 'Custom workout' : isNew ? 'New routine' : 'Edit routine'} onClose=${onClose} tall>
    <input id="routine-name" class="input title-input" value=${r.name} placeholder=${custom ? 'Name it (optional), e.g. Arm day' : 'Routine name, e.g. Push Day'} onInput=${e => setR({ ...r, name: e.target.value })} />
    ${(!custom || keep) && html`<${FolderField} folders=${folders} value=${r.folder || ''} newName=${newFolder} onChange=${v => setR({ ...r, folder: v })} onNewName=${setNewFolder} />`}
    ${(custom || items.length < 3) && html`<${QuickFill} items=${items} onAdd=${add => setItems([...items, ...add])} />`}
    ${items.length > 0 && html`<div class="card-flat"><p class="section-label">Muscles this works</p><${BodyMap} levels=${levelsOf(routineMuscles(r))} sex=${app.state.profile.settings.sex} size="sm" label=${'Muscles worked by ' + r.name} /></div>`}
    <div class="group">${items.map((it, i) => html`<${ItemRow} key=${it.exId + i} it=${it} i=${i} n=${items.length} linked=${!!it.group && items[i + 1]?.group === it.group}
      onChange=${v => setItems(items.map((x, j) => (j === i ? v : x)))} onMove=${d => move(i, d)} onRemove=${() => setItems(items.filter((_, j) => j !== i))} onLink=${() => link(i)} />`)}
      <button class="row-btn" onClick=${() => setPick(true)}><span class="row-ic"><${Icon} name="plus" size=${20} /></span><span class="row-main"><span>Add exercise</span></span></button>
    </div>
    ${custom ? html`
      <div class="group"><${Toggle} id="custom-keep" checked=${keep} onChange=${setKeep} label="Also save as a routine" hint="So you can pick it again or put it in your weekly plan." /></div>
      <button class="btn primary big" disabled=${!items.length} onClick=${start}>Start workout</button>`
      : html`<button class="btn primary big" disabled=${!r.name.trim() || !items.length} onClick=${save}>Save routine</button>`}
    ${!isNew && !custom && html`<${ConfirmButton} class="btn ghost" confirmText="Tap again to delete" onConfirm=${() => {
      app.update(s => ({ ...s, profile: deleteRoutine(s.profile, r.id) }), ['profile']); onClose()
    }}>Delete routine</${ConfirmButton}>`}
    <${LibrarySheet} open=${pick} onClose=${() => setPick(false)} app=${app} onPick=${exId => setItems([...items, { exId, sets: 3, repsMin: exInfo(exId).mode === 'time' ? 30 : 8, repsMax: exInfo(exId).mode === 'time' ? 30 : 12, rir: 2 }])} />
  </${Sheet}>`
}

/** <option>s for every routine, grouped by folder when there are folders. */
export function RoutineOptions({ profile }) {
  const groups = groupRoutines(profile).filter(g => g.routines.length)
  const opts = list => list.map(r => html`<option value=${r.id}>${r.name}</option>`)
  if (groups.length === 1 && !groups[0].folder) return opts(groups[0].routines)
  return groups.map(g => html`<optgroup label=${g.folder ? g.folder.name : 'No folder'}>${opts(g.routines)}</optgroup>`)
}

function RoutineCard({ app, r, organise, first, last, onEdit }) {
  const folders = app.state.profile.folders || []
  const change = fn => app.update(s => ({ ...s, profile: fn(s.profile) }), ['profile'])
  const summary = html`<div class="routine-text"><p class="title-3">${r.name}</p><p class="muted small">${r.items.length} ${r.items.length === 1 ? 'exercise' : 'exercises'} · ${r.items.reduce((n, i) => n + (i.sets || 3), 0)} sets</p>
    <p class="muted small">${[...new Set(r.items.flatMap(i => exInfo(i.exId).p || []))].slice(0, 4).map(m => MUSCLE_NAME[m]).join(' · ')}</p></div>`
  if (organise) return html`<div class="card routine-card organise">
    <div class="organise-top">${summary}
      <div class="organise-ctrls">
        <button class="circle-btn" aria-label=${'Move ' + r.name + ' up'} disabled=${first} onClick=${() => change(p => moveRoutine(p, r.id, -1))}><${Icon} name="up" size=${18} /></button>
        <button class="circle-btn" aria-label=${'Move ' + r.name + ' down'} disabled=${last} onClick=${() => change(p => moveRoutine(p, r.id, 1))}><${Icon} name="down" size=${18} /></button>
      </div></div>
    ${folders.length > 0 && html`<label class="organise-folder"><span class="muted small">Folder</span><select class="input select" aria-label=${'Folder for ' + r.name} value=${r.folder && folders.some(f => f.id === r.folder) ? r.folder : ''}
      onChange=${e => change(p => setRoutineFolder(p, r.id, e.target.value || null))}><option value="">No folder</option>${folders.map(f => html`<option value=${f.id}>${f.name}</option>`)}</select></label>`}
  </div>`
  return html`<button class="card routine-card" onClick=${onEdit} aria-label=${'Edit ' + r.name}>
    ${summary}
    <div class="routine-map"><${BodyMap} levels=${levelsOf(routineMuscles(r))} sex=${app.state.profile.settings.sex} size="xs" label=${'Muscles worked by ' + r.name} /></div>
    <span class="routine-edit" aria-hidden="true"><${Icon} name="edit" size=${16} /></span>
  </button>`
}

// Add or rename a folder. Deleting one leaves its routines, unfiled.
function FolderSheet({ app, folder, onClose }) {
  const [name, setName] = useState('')
  const seen = useRef(null)
  if (!folder) seen.current = null
  else if (seen.current !== folder) { seen.current = folder; setName(folder.name || '') }
  const isNew = folder && !folder.id
  const change = fn => app.update(s => ({ ...s, profile: fn(s.profile) }), ['profile'])
  const save = e => {
    e.preventDefault()
    if (!name.trim()) return
    change(p => (isNew ? addFolder(p, name, 'f' + uid()) : renameFolder(p, folder.id, name)))
    onClose()
  }
  return html`<${Sheet} open=${!!folder} title=${isNew ? 'New folder' : 'Edit folder'} onClose=${onClose}>
    <form class="stack" onSubmit=${save}>
      <input id="folder-name" class="input" placeholder="e.g. Strength, Hypertrophy, Cardio" maxlength="40" value=${name} onInput=${e => setName(e.target.value)} />
      <button class="btn primary big" disabled=${!name.trim()}>${isNew ? 'Add folder' : 'Save'}</button>
    </form>
    ${!isNew && folder && html`<${ConfirmButton} class="btn ghost" confirmText="Tap again. Its routines stay, without a folder" onConfirm=${() => { change(p => deleteFolder(p, folder.id)); onClose() }}>Delete folder</${ConfirmButton}>`}
  </${Sheet}>`
}

function FolderHead({ f, g, gi, count, shut, organise, onToggle, onMove, onEditFolder, onNew }) {
  if (!f) return html`<div class="folder-head"><span class="folder-name plain"><span>No folder</span><small class="muted">${g.routines.length}</small></span></div>`
  return html`<div class="folder-head">
    <button class="folder-name" aria-expanded=${!shut} onClick=${onToggle}><${Icon} name=${shut ? 'right' : 'down'} size=${16} /><span>${f.name}</span><small class="muted">${g.routines.length}</small></button>
    ${organise ? html`<span class="organise-ctrls">
        <button class="circle-btn" aria-label=${'Move folder ' + f.name + ' up'} disabled=${gi === 0} onClick=${() => onMove(-1)}><${Icon} name="up" size=${16} /></button>
        <button class="circle-btn" aria-label=${'Move folder ' + f.name + ' down'} disabled=${gi === count - 1} onClick=${() => onMove(1)}><${Icon} name="down" size=${16} /></button>
        <button class="circle-btn" aria-label=${'Rename or delete folder ' + f.name} onClick=${onEditFolder}><${Icon} name="edit" size=${16} /></button></span>`
      : html`<button class="text-btn" aria-label=${'New routine in ' + f.name} onClick=${onNew}><${Icon} name="plus" size=${16} /> Add</button>`}
  </div>`
}

function RoutinesList({ app, onEdit, onNew }) {
  const [organise, setOrganise] = useState(false)
  const [folderEdit, setFolderEdit] = useState(null)
  const [closed, setClosed] = useState({})
  const profile = app.state.profile
  const folders = profile.folders || []
  const groups = groupRoutines(profile)
  const change = fn => app.update(s => ({ ...s, profile: fn(s.profile) }), ['profile'])
  const total = (profile.templates || []).length
  return html`<div class="stack">
    <div class="routines-bar">
      <button class="text-btn" onClick=${() => setFolderEdit({ name: '' })}><${Icon} name="plus" size=${16} /> New folder</button>
      ${(total > 1 || folders.length > 0) && html`<button class="text-btn" aria-pressed=${organise} onClick=${() => setOrganise(!organise)}>${organise ? 'Done' : 'Reorder'}</button>`}
    </div>
    ${organise && html`<p class="muted small">Use the arrows to change the order${folders.length ? ', and pick a folder to move a routine there' : ''}. Tap Done when you're finished.</p>`}
    ${groups.map((g, gi) => {
      const f = g.folder
      if (!f && !g.routines.length) return null
      const shut = f && closed[f.id] && !organise
      return html`<section class="routine-folder" key=${f ? f.id : 'none'}>
        ${(f || folders.length > 0) && html`<${FolderHead} f=${f} g=${g} gi=${gi} count=${folders.length} shut=${shut} organise=${organise}
          onToggle=${() => setClosed({ ...closed, [f.id]: !closed[f.id] })} onMove=${d => change(p => moveFolder(p, f.id, d))} onEditFolder=${() => setFolderEdit(f)} onNew=${() => onNew(f.id)} />`}
        ${!shut && (g.routines.length ? g.routines.map((r, i) => html`<${RoutineCard} key=${r.id} app=${app} r=${r} organise=${organise} first=${i === 0} last=${i === g.routines.length - 1} onEdit=${() => onEdit(r)} />`)
          : html`<p class="muted small folder-empty">No routines here yet.</p>`)}
      </section>`
    })}
    <button class="btn primary wide" onClick=${() => onNew(null)}><${Icon} name="plus" size=${18} /> New routine</button>
    <${FolderSheet} app=${app} folder=${folderEdit} onClose=${() => setFolderEdit(null)} />
  </div>`
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
        <select id=${'day-' + d} class="input select" value=${plan.days[d] || ''} onChange=${e => setPlan({ days: { ...plan.days, [d]: e.target.value || null } })}><option value="">Rest</option><${RoutineOptions} profile=${profile} /></select></label>`)}</div>`
      : html`<div class="card-flat stack">
        <p class="section-label">Training days</p>
        <div class="chips">${order.map(d => html`<button class=${'chip' + (plan.trainDays.includes(d) ? ' on' : '')} onClick=${() => setPlan({ trainDays: plan.trainDays.includes(d) ? plan.trainDays.filter(x => x !== d) : [...plan.trainDays, d] })}>${DAY_NAMES[d].slice(0, 3)}</button>`)}</div>
        <p class="section-label">Order</p>
        <div class="group">${plan.rotation.map((id, i) => html`<div class="toggle-row"><span class="row-main"><span>${String.fromCharCode(65 + i)} · ${routines.find(r => r.id === id)?.name || 'Missing routine'}</span></span>
          <button class="circle-btn" aria-label="Remove from rotation" onClick=${() => setPlan({ rotation: plan.rotation.filter((_, j) => j !== i) })}><${Icon} name="x" size=${16} /></button></div>`)}
          <label class="toggle-row" for="rot-add"><span class="row-main"><span>Add to rotation</span></span><select id="rot-add" class="input select" value="" onChange=${e => e.target.value && setPlan({ rotation: [...plan.rotation, e.target.value] })}><option value="">Choose…</option><${RoutineOptions} profile=${profile} /></select></label>
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

export function PlanTab({ app, initial }) {
  const [seg, setSeg] = useState(['week', 'routines', 'exercises'].includes(initial) ? initial : 'week')
  const [editing, setEditing] = useState(null)
  const routines = app.state.profile.templates || []
  return html`<div class="stack">
    <${PageHead} title="Plan" sub=${seg === 'exercises' ? 'Every exercise, with photos and muscles' : 'Your week and your routines'} />
    <${Segmented} label="Plan section" value=${seg} onChange=${setSeg} options=${[{ value: 'week', label: 'Week' }, { value: 'routines', label: 'Routines' }, { value: 'exercises', label: 'Exercises' }]} />
    ${seg === 'week' && (routines.length ? html`<${WeekPlan} app=${app} />` : html`<${Empty} title="No routines yet" icon="calendar">Load a starter plan below, or build your own routines first.</${Empty}><${Starters} app=${app} />`)}
    ${seg === 'routines' && html`
      <${RoutinesList} app=${app} onEdit=${setEditing} onNew=${folder => setEditing({ id: 'r' + uid(), name: '', items: [], ...(folder ? { folder } : {}) })} />
      <${Starters} app=${app} />`}
    ${seg === 'exercises' && html`<${Library} app=${app} />`}
    <${RoutineEditor} app=${app} routine=${editing} open=${!!editing} onClose=${() => setEditing(null)} />
  </div>`
}
