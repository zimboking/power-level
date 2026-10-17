// The workout tab: start (template + how you feel), log, rest timer, finish summary.
import { html, useState, useMemo, Sheet, Chips, Field, fmt, ConfirmButton } from './core.js'
import { ExerciseCard } from './exercise-card.js'
import { EXERCISES, MUSCLES, STARTER_TEMPLATES, exInfo } from '../exercises.js'
import { buildEntry, bestEverE1rm, DEFAULT_CFG } from '../plan.js'
import { FEELINGS, workoutVolume, bestE1rm } from '../strength.js'
import { liftedComparison, formatKg } from '../power.js'
import { uid, today } from '../store.js'
import { primeAudio } from './rest.js'

const FEELING_OPTS = Object.entries(FEELINGS).map(([value, f]) => ({ value, label: f.label }))

export function supersetLabels(entries) {
  const labels = {}
  let letter = 0
  for (let i = 0; i < entries.length; i++) {
    const g = entries[i].group
    if (!g) continue
    if (i > 0 && entries[i - 1].group === g) continue
    const run = []
    for (let j = i; j < entries.length && entries[j].group === g; j++) run.push(j)
    if (run.length < 2) continue
    const L = String.fromCharCode(65 + letter++)
    run.forEach((j, k) => { labels[entries[j].key] = L + (k + 1) })
  }
  return labels
}

function ExercisePicker({ open, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('All')
  const list = EXERCISES.filter(e => (muscle === 'All' || e.muscle === muscle) && e.name.toLowerCase().includes(q.trim().toLowerCase()))
  return html`<${Sheet} open=${open} title="Add exercise" onClose=${onClose}>
    <input id="ex-search" class="input" placeholder="Search exercises" value=${q} onInput=${e => setQ(e.target.value)} />
    <${Chips} small label="Muscle" value=${muscle} onChange=${setMuscle} options=${['All', ...MUSCLES].map(m => ({ value: m, label: m }))} />
    <ul class="pick-list">${list.map(e => html`<li><button onClick=${() => { onPick(e.id); setQ('') }}><b>${e.name}</b><span>${e.muscle} · ${e.eq}</span></button></li>`)}</ul>
  </${Sheet}>`
}

function StartScreen({ app }) {
  const { profile } = app.state
  const [feeling, setFeeling] = useState('great')
  const [note, setNote] = useState('')
  const [warm, setWarm] = useState(true)
  const templates = [...(profile.templates || []), ...STARTER_TEMPLATES]
  const start = tpl => {
    const ctx = { workouts: app.state.workouts, profile, feeling, todayIso: today(), withWarmups: warm }
    const entries = (tpl?.items || []).map(it => buildEntry({ ...ctx, exId: it.exId, cfg: { ...DEFAULT_CFG, ...it }, group: it.group ? 'g' + it.group : null }))
    app.update(s => ({ ...s, active: { id: uid(), date: today(), startedAt: Date.now(), feeling, note, name: tpl?.name || 'Workout', entries } }), ['profile'])
  }
  return html`<div class="stack">
    <section class="panel">
      <h2 class="h2">How are you feeling today?</h2>
      <p class="muted">Not 100 %? The app eases today's weights so you still get a good session. It's also marked on your graphs.</p>
      <${Chips} label="Feeling" value=${feeling} onChange=${setFeeling} options=${FEELING_OPTS} />
      <${Field} label="Notes (optional)"><input id="start-note" class="input" placeholder="e.g. head cold, slept 5 hours" value=${note} onInput=${e => setNote(e.target.value)} /></${Field}>
      <label class="toggle"><input id="start-warm" type="checkbox" checked=${warm} onChange=${e => setWarm(e.target.checked)} /> Add warm-up sets to barbell lifts</label>
    </section>
    <section class="panel">
      <h2 class="h2">Start a workout</h2>
      <div class="tpl-grid">
        ${templates.map(t => html`<button class="tpl" onClick=${() => start(t)}><b>${t.name}</b><span>${t.items.map(i => exInfo(i.exId).name).join(' · ')}</span></button>`)}
        <button class="tpl ghost" onClick=${() => start(null)}><b>Empty workout</b><span>Add exercises as you go</span></button>
      </div>
    </section>
  </div>`
}

function Summary({ result, onDone }) {
  const cmp = liftedComparison(result.volume)
  return html`<section class="panel summary">
    <p class="eyebrow">Workout saved</p>
    <h2 class="h1">${formatKg(result.volume)} lifted</h2>
    ${cmp.best ? html`<p class="big-compare">That's <b>${cmp.times >= 10 ? Math.round(cmp.times) : cmp.times.toFixed(1)} × ${cmp.best.name.replace(/^an? /, '')}</b>.</p>` : html`<p class="big-compare">Every kilo counts.</p>`}
    ${result.prs.length > 0 && html`<div class="pr-list"><p class="eyebrow">New records</p>${result.prs.map(p => html`<p><span class="pr">PR</span> ${p.name}: ≈ ${fmt(p.e1rm)} kg 1RM</p>`)}</div>`}
    <p class="muted">Power level ${result.before.toLocaleString()} → <b>${result.after.toLocaleString()}</b></p>
    <button class="btn primary" onClick=${onDone}>Done</button>
  </section>`
}

export function WorkoutView({ app }) {
  const { active, workouts, profile } = app.state
  const [picker, setPicker] = useState(false)
  const [result, setResult] = useState(null)
  const [saveTpl, setSaveTpl] = useState(false)
  const bests = useMemo(() => Object.fromEntries((active?.entries || []).map(e => [e.exId, bestEverE1rm(workouts, e.exId)])), [workouts, active?.entries.length])

  if (result) return html`<${Summary} result=${result} onDone=${() => { setResult(null); app.go('home') }} />`
  if (!active) return html`<${StartScreen} app=${app} />`

  const labels = supersetLabels(active.entries)
  const setEntries = entries => app.update(s => ({ ...s, active: { ...s.active, entries } }), ['profile'])
  const replace = (i, e) => setEntries(active.entries.map((x, j) => (j === i ? e : x)))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= active.entries.length) return
    const next = [...active.entries];[next[i], next[j]] = [next[j], next[i]]
    setEntries(next)
  }
  const toggleSuperset = i => {
    const cur = active.entries[i], nxt = active.entries[i + 1]
    if (!nxt) return
    const linked = cur.group && cur.group === nxt.group
    const g = linked ? null : cur.group || 'g' + uid()
    setEntries(active.entries.map((e, j) => (j === i + 1 ? { ...e, group: g } : j === i && !linked ? { ...e, group: g } : e)))
  }
  const onSetDone = (entry, set) => {
    const i = active.entries.findIndex(e => e.key === entry.key)
    const nxt = active.entries[i + 1]
    if (entry.group && nxt && nxt.group === entry.group) return // superset: rest after the last exercise of the pair
    app.startRest(set.warmup ? 60 : entry.cfg.rest || profile.settings.rest || 150)
  }
  const add = exId => {
    setPicker(false)
    setEntries([...active.entries, buildEntry({ exId, cfg: DEFAULT_CFG, workouts, profile, feeling: active.feeling, todayIso: active.date, withWarmups: false })])
  }
  const finish = () => {
    const entries = active.entries
      .map(e => ({ exId: e.exId, group: e.group, cfg: e.cfg, sets: e.sets.filter(s => s.done).map(({ auto, ...s }) => s) }))
      .filter(e => e.sets.length)
    const before = app.power.level
    const w = { id: active.id, date: active.date, name: active.name, feeling: active.feeling, note: active.note || '', durationMin: Math.round((Date.now() - active.startedAt) / 60000), entries }
    const prs = entries.map(e => ({ name: exInfo(e.exId).name, e1rm: bestE1rm(e), prev: bests[e.exId] || 0 })).filter(p => p.e1rm && p.prev > 0 && p.e1rm > p.prev)
    app.update(s => ({ ...s, active: null, workouts: entries.length ? [...s.workouts, w] : s.workouts }), ['profile', 'w:' + w.id])
    app.stopRest()
    if (entries.length) setResult({ volume: workoutVolume(w), prs, before, after: app.powerAfter([...workouts, w]) })
  }
  const saveTemplate = name => {
    const items = active.entries.map(e => ({ exId: e.exId, sets: e.sets.filter(s => !s.warmup).length || e.cfg.sets, repsMin: e.cfg.repsMin, repsMax: e.cfg.repsMax, rir: e.cfg.rir, rest: e.cfg.rest, group: e.group ? e.group : undefined }))
    app.update(s => ({ ...s, profile: { ...s.profile, templates: [{ id: uid(), name, items }, ...(s.profile.templates || [])] } }), ['profile'])
    setSaveTpl(false)
    app.toast('Template saved')
  }

  const doneSets = active.entries.reduce((n, e) => n + e.sets.filter(s => s.done && !s.warmup).length, 0)
  return html`<div class="stack">
    <section class="session-head">
      <div><p class="eyebrow">${FEELINGS[active.feeling]?.label}${active.note ? ' · ' + active.note : ''}</p><h2 class="h1">${active.name}</h2></div>
      <div class="session-meta"><p class="muted small">${doneSets} sets done · ${formatKg(workoutVolume({ entries: active.entries }))}</p>
        ${!app.resting && html`<button class="btn small" onClick=${() => { primeAudio(); app.startRest(profile.settings.rest || 150) }}>⏱ Start rest</button>`}</div>
    </section>
    ${active.entries.length === 0 && html`<p class="muted">Add your first exercise. Targets, warm-ups and plates are worked out for you.</p>`}
    ${active.entries.map((e, i) => html`<${ExerciseCard} key=${e.key} entry=${e} index=${i} label=${labels[e.key]} settings=${profile.settings}
      prevBest=${bests[e.exId]} onChange=${ne => replace(i, ne)} onSetDone=${onSetDone}
      onRemove=${() => setEntries(active.entries.filter((_, j) => j !== i))} onMove=${d => move(i, d)}
      isLinked=${!!e.group && active.entries[i + 1]?.group === e.group} onToggleSuperset=${() => toggleSuperset(i)} />`)}
    <button class="btn wide" onClick=${() => setPicker(true)}>+ Add exercise</button>
    <div class="row-btns">
      <button class="btn primary grow" onClick=${finish}>Finish & save</button>
      <button class="btn" onClick=${() => setSaveTpl(true)} disabled=${!active.entries.length}>Save as template</button>
    </div>
    <${ConfirmButton} class="btn ghost" confirmText="Tap again to discard" onConfirm=${() => { app.update(s => ({ ...s, active: null }), ['profile']); app.stopRest() }}>Discard workout</${ConfirmButton}>
    <${ExercisePicker} open=${picker} onClose=${() => setPicker(false)} onPick=${add} />
    <${TemplateSheet} open=${saveTpl} defaultName=${active.name} onClose=${() => setSaveTpl(false)} onSave=${saveTemplate} />
  </div>`
}

function TemplateSheet({ open, defaultName, onClose, onSave }) {
  const [name, setName] = useState(defaultName)
  return html`<${Sheet} open=${open} title="Save as template" onClose=${onClose}>
    <form class="stack" onSubmit=${e => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }}>
      <${Field} label="Template name"><input id="tpl-name" class="input" value=${name} onInput=${e => setName(e.target.value)} /></${Field}>
      <button class="btn primary">Save template</button>
    </form>
  </${Sheet}>`
}
