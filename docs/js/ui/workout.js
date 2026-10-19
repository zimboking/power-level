// The session screen. Guided (one exercise at a time with its demo) or list view. Used live,
// and to edit a saved workout or log one you did on paper.
import { html, useState, useEffect, Icon, Sheet, Field, Chips, Toggle, ActionSheet, fmt, fmtClock, fmtWeekday } from './core.js'
import { ExerciseCard } from './exercise-card.js'
import { LibrarySheet } from './library.js'
import { RoutineEditor } from './plan-tab.js'
import { groupRoutines, saveRoutine as storeRoutine } from '../routines.js'
import { buildEntry, DEFAULT_CFG, entriesFor, startCfg } from '../plan.js'
import { recordsBroken } from '../records.js'
import { fmtDuration, fmtDistance } from '../duration.js'
import { liftedSvg } from './lifted-art.js'
import { shareWorkout } from './share-card.js'
import { FEELINGS, workoutVolume } from '../strength.js'
import { liftedComparison, formatKg } from '../power.js'
import { exInfo } from '../exercises.js'
import { plannedFor, nextSession } from '../schedule.js'
import { uid, today } from '../store.js'
import { primeAudio } from './rest.js'

const FEELING_OPTS = Object.entries(FEELINGS).map(([value, f]) => ({ value, label: f.label }))

export function supersetLabels(entries) {
  const labels = {}
  let letter = 0
  for (let i = 0; i < entries.length; i++) {
    const g = entries[i].group
    if (!g || (i > 0 && entries[i - 1].group === g)) continue
    const run = []
    for (let j = i; j < entries.length && entries[j].group === g; j++) run.push(j)
    if (run.length < 2) continue
    const L = String.fromCharCode(65 + letter++)
    run.forEach((j, k) => { labels[entries[j].key] = L + (k + 1) })
  }
  return labels
}

export function newSession(app, routine, { feeling = 'great', note = '', warm = true, date = today() } = {}) {
  const { workouts, profile } = app.state
  const ctx = { workouts, profile, feeling, todayIso: date, withWarmups: warm }
  const entries = (routine?.items || []).map(it => buildEntry({ ...ctx, exId: it.exId, cfg: { ...DEFAULT_CFG, ...it }, group: it.group ? 'g-' + it.group : null }))
  return { id: uid(), date, startedAt: Date.now(), feeling, note, name: routine?.name || 'Workout', routineId: routine?.id || null, entries, focus: 0 }
}

// A saved workout opened for editing: every set is shown as done, targets read "as logged".
export function sessionFromWorkout(w) {
  return {
    ...w, editing: true, focus: 0,
    entries: w.entries.map(e => ({ key: Math.random().toString(36).slice(2, 9), exId: e.exId, group: e.group || null, ...(e.note ? { note: e.note } : {}), cfg: { ...DEFAULT_CFG, ...(e.cfg || {}) }, target: e.target || { kind: 'hold', why: 'As logged.' }, sets: e.sets.map(s => ({ ...s, done: true, auto: false })), advice: null })),
  }
}

export function toWorkout(session) {
  const entries = session.entries
    .map(e => ({ exId: e.exId, group: e.group, ...(e.note?.trim() ? { note: e.note.trim() } : {}), cfg: e.cfg, target: { w: e.target.w, r: e.target.r, sec: e.target.sec, sets: e.target.sets, kind: e.target.kind }, sets: e.sets.filter(s => s.done).map(({ auto, ...s }) => s) }))
    .filter(e => e.sets.length)
  const durationMin = session.editing ? session.durationMin || 0 : Math.round((Date.now() - session.startedAt) / 60000)
  return { id: session.id, date: session.date, name: session.name, routineId: session.routineId || null, feeling: session.feeling, note: session.note || '', durationMin, entries }
}

export function StartSheet({ open, onClose, app, routine, onStart, onCustom }) {
  const [feeling, setFeeling] = useState('great')
  const [note, setNote] = useState('')
  const [warm, setWarm] = useState(true)
  const [pick, setPick] = useState(routine?.id || '')
  useEffect(() => { if (open) setPick(routine?.id || '') }, [open, routine?.id])
  const routines = app.state.profile.templates || []
  return html`<${Sheet} open=${open} title="Start workout" onClose=${onClose}>
    <div class="group"><div class="pad stack">
      <p class="section-label">How are you feeling?</p>
      <${Chips} label="Feeling" value=${feeling} onChange=${setFeeling} options=${FEELING_OPTS} />
      ${feeling !== 'great' && html`<p class="muted small">Today's loads ease off by ${Math.round((1 - FEELINGS[feeling].factor) * 100)} % and the session is marked on your graphs.</p>`}
      <input id="start-note" class="input" placeholder="Note (optional): head cold, 5 hours sleep…" value=${note} onInput=${e => setNote(e.target.value)} />
    </div></div>
    <p class="section-label">Routine</p>
    <div class="group">
      ${groupRoutines(app.state.profile).flatMap(g => g.routines).map(r => html`<button class=${'row-btn' + (pick === r.id ? ' on' : '')} onClick=${() => setPick(r.id)}><span class="row-main"><span>${r.name}${routine?.id === r.id ? ' · today' : ''}</span><small>${r.items.map(i => exInfo(i.exId).name).join(' · ')}</small></span>${pick === r.id && html`<${Icon} name="check" />`}</button>`)}
      <button class=${'row-btn' + (pick === '' ? ' on' : '')} onClick=${() => setPick('')}><span class="row-main"><span>Empty workout</span><small>Add exercises as you go</small></span>${pick === '' && html`<${Icon} name="check" />`}</button>
    </div>
    ${onCustom && html`<div class="group"><button class="row-btn" onClick=${() => onCustom({ feeling, note, warm })}><span class="row-ic"><${Icon} name="edit" size=${20} /></span>
      <span class="row-main"><span>Build a custom workout</span><small>Pick exercises, sets, reps and rest first, or quick-fill by muscle group</small></span><${Icon} name="right" size=${18} /></button></div>`}
    <div class="group"><${Toggle} id="start-warm" checked=${warm} onChange=${setWarm} label="Add warm-up sets" hint="Ramp-up sets for barbell lifts, worked out from your first working weight." /></div>
    <button class="btn primary big" onClick=${() => { primeAudio(); onStart(routines.find(r => r.id === pick) || null, { feeling, note, warm }) }}>Start</button>
  </${Sheet}>`
}

const RECORD_TEXT = {
  e1rm: r => `≈ ${fmt(r.value)} kg 1RM (was ${fmt(r.prev)})`,
  weight: r => `Heaviest: ${fmt(r.value)} kg (was ${fmt(r.prev)})`,
  reps: r => `${r.value} reps${r.w > 0 ? ` at ${fmt(r.w)} kg` : ''} (was ${r.prev})`,
  volume: r => `Volume: ${formatKg(r.value)} (was ${formatKg(r.prev)})`,
  time: r => `Longest: ${fmtDuration(r.value)} (was ${fmtDuration(r.prev)})`,
  distance: r => `Farthest: ${fmtDistance(r.value)} (was ${fmtDistance(r.prev)})`,
}

/** The share button and what happens after it. */
export function ShareWorkoutButton({ app, workout, prNames, label = 'Share workout', cls = 'btn big' }) {
  const [busy, setBusy] = useState(false)
  const [fallback, setFallback] = useState('')
  const go = async () => {
    setBusy(true)
    const res = await shareWorkout(workout, { prNames })
    setBusy(false)
    if (res === 'copied') app.toast('Workout copied. Paste it in the group chat.')
    else if (res?.text) setFallback(res.text)
  }
  return html`<button class=${cls} disabled=${busy} onClick=${go}><${Icon} name="link" size=${18} /> ${busy ? 'Getting it ready…' : label}</button>
    ${fallback && html`<textarea class="input share-text" readonly rows="8" aria-label="Workout summary to copy" onFocus=${e => e.target.select()}>${fallback}</textarea>`}`
}

function Summary({ app, result, onDone }) {
  const cmp = liftedComparison(result.volume)
  const times = cmp.times >= 10 ? Math.round(cmp.times) : cmp.times.toFixed(1)
  return html`<div class="stack summary">
    <div class="card hero-card"><p class="eyebrow">Workout saved</p>
      <p class="big-num">${formatKg(result.volume)}</p>
      <figure class="lift-art" aria-label=${cmp.best ? `About ${times} times ${cmp.best.name}` : 'A dumbbell'}>
        <div class="lift-art-pic" dangerouslySetInnerHTML=${{ __html: liftedSvg(cmp.best?.art || 'dumbbell', { width: 240, height: 150 }) }}></div>
        ${cmp.best && html`<span class="lift-times">× ${times}</span>`}
      </figure>
      <p>${cmp.best ? html`That's <b>${times} × ${cmp.best.name.replace(/^an? /, '')}</b>.` : 'Every kilo counts.'}</p>
      <p class="muted small">${result.sets} sets · ${result.minutes} min · power level ${result.before.toLocaleString()} → <b>${result.after.toLocaleString()}</b></p></div>
    ${result.prs.length > 0 && html`<div class="card"><p class="section-label">New records</p>${result.prs.map(p => html`<div class="pr-group"><p class="pr-line"><span class="pr">PR</span> <b>${p.name}</b></p>
      <ul class="pr-list">${p.records.map(r => html`<li>${RECORD_TEXT[r.kind](r)}</li>`)}</ul></div>`)}</div>`}
    ${result.next && html`<p class="muted center">Next up: <b>${result.next.routine.name}</b> on ${fmtWeekday(result.next.date)}.</p>`}
    <${ShareWorkoutButton} app=${app} workout=${result.workout} prNames=${result.prs.map(p => p.name)} />
    <button class="btn primary big" onClick=${onDone}>Done</button>
  </div>`
}

function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return html`<span class="tnum">${fmtClock(Math.max(0, Math.floor((now - since) / 1000)))}</span>`
}

export function SessionScreen({ app, session, onChange, onFinish, onDiscard, onClose }) {
  const { workouts, profile } = app.state
  const view = profile.settings.view === 'list' ? 'list' : 'focus'
  const [picker, setPicker] = useState(null) // { swap?: index }
  const [menu, setMenu] = useState(false)
  const [demoMin, setDemoMin] = useState(false)
  const [rename, setRename] = useState(false)
  const entries = session.entries
  const focus = Math.min(session.focus || 0, Math.max(0, entries.length - 1))
  const labels = supersetLabels(entries)
  const set = patch => onChange({ ...session, ...patch })
  const setEntries = (list, extra = {}) => set({ entries: list, ...extra })
  const replace = (i, e) => setEntries(entries.map((x, j) => (j === i ? e : x)))
  const goTo = i => { set({ focus: Math.max(0, Math.min(entries.length - 1, i)) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= entries.length) return
    const next = [...entries];[next[i], next[j]] = [next[j], next[i]]
    setEntries(next, { focus: j })
  }
  const toggleSuperset = i => {
    const cur = entries[i], nxt = entries[i + 1]
    if (!nxt) return
    const linked = cur.group && cur.group === nxt.group
    const g = linked ? null : cur.group || 'g' + uid()
    setEntries(entries.map((e, j) => (j === i + 1 ? { ...e, group: g } : j === i && !linked ? { ...e, group: g } : e)))
  }
  const onSetDone = (entry, doneSet) => {
    if (session.editing) return
    const i = entries.findIndex(e => e.key === entry.key)
    const group = entry.group ? entries.map((e, j) => ({ e, j })).filter(x => x.e.group === entry.group) : []
    const pos = group.findIndex(x => x.j === i)
    if (group.length > 1 && pos < group.length - 1) { if (view === 'focus') goTo(group[pos + 1].j); return } // superset: straight to the partner
    if (group.length > 1 && view === 'focus') setTimeout(() => goTo(group[0].j), 300)
    app.startRest(doneSet.warmup ? 60 : doneSet.rest || entry.cfg.rest || profile.settings.rest || 150)
    // `entry` is the state before this tick, so "all done" means at most this one set was left.
    const allDone = !doneSet.warmup && entry.sets.filter(s => !s.warmup && !s.done).length <= 1
    if (view === 'focus' && group.length < 2 && allDone && i < entries.length - 1) setTimeout(() => app.toast({ text: `${exInfo(entry.exId).name} done`, action: { label: 'Next exercise', run: () => goTo(i + 1) } }), 50)
  }
  const add = (exId, picked) => {
    const ex = picked || exInfo(exId)
    const e = buildEntry({ exId, cfg: ex.mode === 'time' ? { ...DEFAULT_CFG, ...startCfg(ex, profile.settings) } : DEFAULT_CFG, workouts, profile, feeling: session.feeling, todayIso: session.date, withWarmups: false })
    if (picker?.swap != null) { const i = picker.swap; setEntries(entries.map((x, j) => (j === i ? { ...e, group: x.group } : x)), { focus: i }) }
    else setEntries([...entries, e], { focus: entries.length })
    setPicker(null)
  }
  const saveRoutine = () => {
    const items = entries.map(e => ({ exId: e.exId, sets: e.sets.filter(s => !s.warmup).length || e.cfg.sets, repsMin: e.cfg.repsMin, repsMax: e.cfg.repsMax, rir: e.cfg.rir, rest: e.cfg.rest, prog: e.cfg.prog, group: e.group ? e.group.replace(/^g-?/, '') : undefined,
      ...(e.cfg.pyramid ? { pyramid: true, pyramidSets: e.sets.filter(s => !s.warmup).map(s => ({ w: s.w, r: s.r, rest: s.rest })) } : {}) }))
    const existing = profile.templates.find(t => t.id === session.routineId)
    app.update(s => ({ ...s, profile: storeRoutine(s.profile, existing ? { ...existing, items } : { id: 'r' + uid(), name: session.name, items }) }), ['profile'])
    app.toast(existing ? `Updated routine “${existing.name}”` : 'Saved as a routine')
  }
  const total = entries.reduce((n, e) => n + e.sets.filter(s => !s.warmup).length, 0)
  const done = entries.reduce((n, e) => n + e.sets.filter(s => s.done && !s.warmup).length, 0)
  const card = (e, i) => html`<${ExerciseCard} key=${e.key} entry=${e} index=${i} count=${entries.length} label=${labels[e.key]} app=${app} view=${view}
    onChange=${ne => replace(i, ne)} onSetDone=${onSetDone} onRemove=${() => setEntries(entries.filter((_, j) => j !== i), { focus: Math.max(0, i - 1) })} onMove=${d => move(i, d)}
    isLinked=${!!e.group && entries[i + 1]?.group === e.group} onToggleSuperset=${() => toggleSuperset(i)} onSwap=${() => setPicker({ swap: i })}
    demoMin=${demoMin} onToggleDemo=${() => setDemoMin(!demoMin)} />`

  return html`<div class="session">
    <header class="session-bar">
      <button class="circle-btn" aria-label=${session.editing ? 'Cancel editing' : 'Back to home'} onClick=${onClose}><${Icon} name=${session.editing ? 'x' : 'down'} /></button>
      <button class="session-title" onClick=${() => setRename(true)}><b>${session.name}</b><span>${session.editing ? fmtWeekday(session.date) + ' · editing' : html`<${Elapsed} since=${session.startedAt} /> · ${done}/${total} sets`}</span></button>
      <button class="circle-btn" aria-label="Workout options" onClick=${() => setMenu(true)}><${Icon} name="more" /></button>
      <button class="circle-btn go" aria-label=${session.editing ? 'Save changes' : 'Finish workout'} onClick=${onFinish}><${Icon} name="check" /></button>
    </header>
    <div class="progress" role="progressbar" aria-valuenow=${done} aria-valuemin="0" aria-valuemax=${total} aria-label="Sets done"><span style=${{ width: (total ? (done / total) * 100 : 0) + '%' }}></span></div>
    ${session.feeling && session.feeling !== 'great' && html`<p class="feeling-note">${FEELINGS[session.feeling].label}: loads eased today.${session.note ? ' “' + session.note + '”' : ''}</p>`}
    ${session.editing && html`<div class="group"><label class="toggle-row" for="edit-date"><span class="row-main"><span>Date</span><small>Move it to the day you trained</small></span><input id="edit-date" type="date" class="input date-input" value=${session.date} max=${today()} onChange=${e => e.target.value && set({ date: e.target.value })} /></label></div>`}

    ${entries.length === 0 && html`<div class="card empty"><p class="empty-title">Add your first exercise</p><p class="empty-body">Targets, warm-ups, plates and rest are worked out for you.</p></div>`}
    ${view === 'focus' && entries.length > 0 && html`
      <nav class="ex-strip" aria-label="Exercises">${entries.map((e, i) => {
        const w = e.sets.filter(s => !s.warmup), d = w.filter(s => s.done).length
        return html`<button class=${'strip-chip' + (i === focus ? ' on' : '') + (w.length && d === w.length ? ' complete' : '')} onClick=${() => goTo(i)}>${labels[e.key] ? html`<b>${labels[e.key]}</b> ` : ''}${exInfo(e.exId).name}<small>${d}/${w.length}</small></button>`
      })}</nav>
      ${card(entries[focus], focus)}
      <div class="focus-nav">
        <button class="btn" disabled=${focus === 0} onClick=${() => goTo(focus - 1)}><${Icon} name="left" size=${18} /> Previous</button>
        ${focus < entries.length - 1 ? html`<button class="btn primary" onClick=${() => goTo(focus + 1)}>Next <${Icon} name="right" size=${18} /></button>` : html`<button class="btn primary" onClick=${onFinish}>${session.editing ? 'Save' : 'Finish'} <${Icon} name="check" size=${18} /></button>`}
      </div>`}
    ${view === 'list' && entries.map(card)}
    <button class="btn wide" onClick=${() => setPicker({})}><${Icon} name="plus" size=${18} /> Add exercise</button>

    <${ActionSheet} open=${menu} title=${session.name} onClose=${() => setMenu(false)} actions=${[
      { label: 'Add exercise', icon: 'plus', onClick: () => setPicker({}) },
      { label: view === 'focus' ? 'Show as list' : 'Guided view', icon: 'list', hint: 'Change the default in Settings', onClick: () => app.setSetting({ view: view === 'focus' ? 'list' : 'focus' }) },
      !session.editing && { label: 'Rest timer', icon: 'timer', onClick: () => app.startRest(profile.settings.rest || 150) },
      { label: 'Rename', icon: 'edit', onClick: () => setRename(true) },
      entries.length > 0 && { label: session.routineId && profile.templates.some(t => t.id === session.routineId) ? 'Update the routine' : 'Save as routine', icon: 'copy', onClick: saveRoutine },
      { label: session.editing ? 'Discard changes' : 'Discard workout', icon: 'trash', danger: true, onClick: onDiscard },
    ]} />
    <${Sheet} open=${rename} title="Workout name" onClose=${() => setRename(false)}>
      <form class="stack" onSubmit=${e => { e.preventDefault(); setRename(false) }}>
        <input id="session-name" class="input" value=${session.name} onInput=${e => set({ name: e.target.value })} />
        <${Field} label="Note"><input id="session-note" class="input" value=${session.note || ''} onInput=${e => set({ note: e.target.value })} /></${Field}>
        <${Field} label="Feeling"><${Chips} small label="Feeling" value=${session.feeling} onChange=${v => set({ feeling: v })} options=${FEELING_OPTS} /></${Field}>
        <button class="btn primary">Done</button>
      </form>
    </${Sheet}>
    <${LibrarySheet} open=${!!picker} title=${picker?.swap != null ? 'Swap exercise' : 'Add exercise'} onClose=${() => setPicker(null)} app=${app} onPick=${add} />
  </div>`
}

// The centre tab: today's planned session, or a picker, or the live session itself.
export function WorkoutTab({ app }) {
  const { active, profile, workouts } = app.state
  const [result, setResult] = useState(null)
  const [starting, setStarting] = useState(false)
  const [custom, setCustom] = useState(null) // start options while the builder is open
  const [draft, setDraft] = useState(null)
  const [chosen, setChosen] = useState(null)
  const [editing, setEditing] = useState(null)
  const openCustom = (opts = { feeling: 'great', note: '', warm: true }) => { setStarting(false); setDraft({ id: 'r' + uid(), name: '', items: [] }); setCustom(opts) }
  if (result) return html`<${Summary} app=${app} result=${result} onDone=${() => { setResult(null); app.go('home') }} />`
  if (active) {
    const finish = () => {
      const w = toWorkout(active)
      app.stopRest()
      if (!w.entries.length) { app.update(s => ({ ...s, active: null }), ['profile']); app.toast('Nothing logged, so nothing saved'); return }
      const before = app.power.level
      const prs = w.entries.map(e => ({ name: exInfo(e.exId).name, records: recordsBroken(e, entriesFor(workouts, e.exId)) })).filter(p => p.records.length)
      const all = [...workouts, w]
      app.update(s => ({ ...s, active: null, workouts: [...s.workouts, w] }), ['profile', 'w:' + w.id])
      setResult({ workout: w, volume: workoutVolume(w), sets: w.entries.reduce((n, e) => n + e.sets.filter(x => !x.warmup).length, 0), minutes: w.durationMin, prs, before, after: app.powerAfter(all), next: nextSession(profile, all, w.date) })
    }
    return html`<${SessionScreen} app=${app} session=${active} onChange=${s => app.update(st => ({ ...st, active: s }), ['profile'])}
      onFinish=${finish} onDiscard=${() => { app.update(s => ({ ...s, active: null }), ['profile']); app.stopRest(); app.toast('Workout discarded') }} onClose=${() => app.go('home')} />`
  }
  const planned = plannedFor(profile, workouts, today())
  const doneToday = workouts.some(w => w.date === today())
  return html`<div class="stack">
    <div class="card">
      <p class="eyebrow">${planned ? 'Today' : 'No session planned today'}</p>
      <p class="title-2">${planned ? planned.name : 'Train anyway?'}</p>
      ${planned && html`<p class="muted small">${planned.items.map(i => exInfo(i.exId).name).join(' · ')}</p>`}
      ${doneToday && html`<p class="muted small">You've already trained today.</p>`}
      <button class="btn primary big" onClick=${() => { setChosen(null); setStarting(true) }}>${planned ? 'Start ' + planned.name : 'Start a workout'}</button>
    </div>
    <button class="card custom-card" onClick=${() => openCustom()}>
      <span class="today-ic"><${Icon} name="edit" /></span>
      <span class="row-main"><span class="title-3">Custom workout</span><small>Build today's session your way: exercises, sets, reps and rest. Save it as a routine if you like it.</small></span>
      <${Icon} name="right" size=${18} />
    </button>
    ${profile.templates.length > 0 && html`<div class="card-head"><p class="section-label">Your routines</p><button class="text-btn" onClick=${() => app.go('plan', 'routines')}>Organise</button></div>
      ${groupRoutines(profile).filter(g => g.routines.length).map(g => html`${g.folder && html`<p class="folder-label">${g.folder.name}</p>`}
      <div class="group">${g.routines.map(r => html`<div class="row-split"><button class="row-btn" onClick=${() => { setChosen(r); setStarting(true) }}><span class="row-main"><span>${r.name}</span><small>${r.items.map(i => exInfo(i.exId).name).join(' · ')}</small></span></button>
        <button class="circle-btn plain" aria-label=${'Edit ' + r.name} onClick=${() => setEditing(r)}><${Icon} name="edit" size=${18} /></button></div>`)}</div>`)}`}
    <${StartSheet} open=${starting} onClose=${() => setStarting(false)} app=${app} routine=${chosen || planned} onCustom=${openCustom}
      onStart=${(r, opts) => { setStarting(false); app.update(s => ({ ...s, active: newSession(app, r, opts) }), ['profile']) }} />
    <${RoutineEditor} app=${app} routine=${editing} open=${!!editing} onClose=${() => setEditing(null)} />
    <${RoutineEditor} app=${app} routine=${draft} open=${!!custom} mode="custom" onClose=${() => setCustom(null)}
      onStart=${r => { const opts = custom; setCustom(null); app.update(s => ({ ...s, active: newSession({ state: s }, r, opts) }), ['profile']) }} />
  </div>`
}
