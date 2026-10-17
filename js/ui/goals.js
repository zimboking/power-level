// Goals: "I want to bench 140" → a week-by-week journey from where you are now, re-planned
// from your real lifts every time, plotted against what you've actually done.
import { html, useState, Sheet, Field, Chips, fmt, fmtDate, fmtDateLong, ConfirmButton, Empty } from './core.js'
import { LineChart } from './charts.js'
import { LEVELS, percentThere, addWeeks } from '../journey.js'
import { journeyFor } from '../plan.js'
import { exerciseHistory, currentE1rm, e1rm } from '../strength.js'
import { exInfo } from '../exercises.js'
import { uid, today } from '../store.js'

const GOAL_LIFTS = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'incline', 'frontsquat', 'hipthrust']

function GoalCard({ goal, app }) {
  const { workouts, profile } = app.state
  const [open, setOpen] = useState(false)
  const now = today()
  const j = journeyFor(goal, workouts, profile, now)
  const ex = exInfo(goal.exId)
  const pct = percentThere(goal.start, j.current, goal.target)
  const hist = exerciseHistory(workouts, goal.exId).filter(p => p.date >= goal.startDate)
  const projected = [{ x: now, y: j.current }, ...j.weeks.map(w => ({ x: addWeeks(now, w.week - j.offset), y: w.e1rm }))]
  const thisWeek = j.weeks[0]
  const reached = j.current >= goal.target
  return html`<section class="panel goal">
    <div class="panel-head"><div><p class="eyebrow">${ex.name}</p><h2 class="h1">${goal.target} kg</h2></div>
      <div class="goal-pct" style=${{ '--pct': pct }}><b>${pct}%</b><span>there</span></div></div>
    <div class="kv"><span>Started at</span><b>${fmt(goal.start)} kg</b><span>Now (est. 1RM)</span><b>${fmt(j.current)} kg</b>
      <span>ETA</span><b>${reached ? 'Reached!' : j.reachable ? `${fmtDate(j.etaDate)} · ${j.totalWeeks} wks` : '3+ years'}</b><span>Level</span><b>${LEVELS[j.level].label.split(' (')[0]}</b></div>
    <${LineChart} label=${'Journey to ' + goal.target + ' kg'} goal=${goal.target} height=${190} series=${[
      { className: 's-plan', dashed: true, points: projected },
      { className: 's-raw', dots: true, points: hist.map(p => ({ x: p.date, y: p.e1rm, flag: p.feeling !== 'great' })) },
    ]} />
    <p class="legend"><span class="lg plan"></span>Planned path <span class="lg raw"></span>Your sessions</p>
    ${reached ? html`<div class="callout good"><b>You did it.</b> Your estimated 1RM is at the goal. Test it on a fresh day, then set a new one.
        <button class="btn small primary" onClick=${() => app.update(s => ({ ...s, profile: { ...s.profile, goals: s.profile.goals.map(g => (g.id === goal.id ? { ...g, achieved: now } : g)) } }), ['profile'])}>Mark achieved</button></div>`
      : thisWeek && html`<div class="callout">
        <p class="eyebrow">This week · ${thisWeek.phase}${thisWeek.block ? ' · block ' + thisWeek.block : ''}</p>
        <p class="this-week"><b>${thisWeek.sets} × ${thisWeek.reps} @ ${fmt(thisWeek.w)} kg</b>, ${thisWeek.rir} rep${thisWeek.rir === 1 ? '' : 's'} in reserve</p>
        <p class="muted small">${thisWeek.note} This is already loaded into your ${ex.name} when you train.</p></div>`}
    ${!reached && !j.reachable && html`<p class="warn small">At a typical rate that's more than 3 years away. Consider a nearer milestone first.</p>`}
    <button class="btn small ghost" aria-expanded=${open} onClick=${() => setOpen(!open)}>${open ? 'Hide' : 'Show'} week-by-week plan</button>
    ${open && html`<div class="table-wrap"><table class="plan-table"><thead><tr><th>Wk</th><th>Phase</th><th>Work</th><th>Est. 1RM</th></tr></thead><tbody>
      ${j.weeks.map(w => html`<tr class=${w.deload ? 'deload' : w.phase === 'Test day' ? 'test' : ''}><td>${w.week}</td><td>${w.phase}</td><td>${w.sets}×${w.reps} @ ${fmt(w.w)}</td><td>${fmt(w.e1rm)}</td></tr>`)}
    </tbody></table></div>`}
    <${ConfirmButton} class="btn small ghost" confirmText="Tap again to remove" onConfirm=${() => app.update(s => ({ ...s, profile: { ...s.profile, goals: s.profile.goals.filter(g => g.id !== goal.id) } }), ['profile'])}>Remove goal</${ConfirmButton}>
  </section>`
}

function NewGoal({ open, onClose, app }) {
  const [exId, setExId] = useState('bench')
  const [target, setTarget] = useState(140)
  const [level, setLevel] = useState('')
  const [w, setW] = useState('')
  const [r, setR] = useState('')
  const known = currentE1rm(app.state.workouts, exId)
  const manual = e1rm(+w, +r)
  const start = known || manual
  const save = e => {
    e.preventDefault()
    if (!start || !(target > start)) return
    const g = { id: uid(), exId, target: +target, start, startDate: today(), level: level || null }
    app.update(s => ({ ...s, profile: { ...s.profile, goals: [...s.profile.goals.filter(x => x.exId !== exId || x.achieved), g] } }), ['profile'])
    onClose()
  }
  return html`<${Sheet} open=${open} title="New strength goal" onClose=${onClose}>
    <form class="stack" onSubmit=${save}>
      <${Field} label="Lift"><select id="goal-ex" class="input select" value=${exId} onChange=${e => setExId(e.target.value)}>
        ${GOAL_LIFTS.map(id => html`<option value=${id}>${exInfo(id).name}</option>`)}</select></${Field}>
      <${Field} label="Goal 1RM (kg)"><input id="goal-target" class="input" inputmode="decimal" value=${target} onInput=${e => setTarget(e.target.value)} /></${Field}>
      ${known ? html`<p class="muted">Your current estimated 1RM is <b>${fmt(known)} kg</b>, from your recent sessions.</p>` : html`
        <p class="muted">No history for this lift yet. Enter a recent hard set and I'll estimate your 1RM.</p>
        <div class="row-2"><${Field} label="Weight (kg)"><input id="goal-w" class="input" inputmode="decimal" value=${w} onInput=${e => setW(e.target.value)} /></${Field}>
        <${Field} label="Reps"><input id="goal-r" class="input" inputmode="numeric" value=${r} onInput=${e => setR(e.target.value)} /></${Field}></div>
        ${manual && html`<p>Estimated 1RM: <b>${fmt(manual)} kg</b></p>`}`}
      <${Field} label="Training age" hint="Leave on Auto and it's guessed from your strength and body weight.">
        <${Chips} small label="Training age" value=${level} onChange=${setLevel} options=${[{ value: '', label: 'Auto' }, ...Object.entries(LEVELS).map(([v, l]) => ({ value: v, label: l.label.split(' (')[0] }))]} /></${Field}>
      ${start && target > start ? html`<button class="btn primary">Map my journey</button>` : html`<p class="warn small">${start ? 'Set a goal above your current 1RM.' : 'Enter a set to estimate where you are now.'}</p>`}
    </form>
  </${Sheet}>`
}

export function GoalsView({ app }) {
  const [adding, setAdding] = useState(false)
  const goals = app.state.profile.goals || []
  const active = goals.filter(g => !g.achieved)
  const done = goals.filter(g => g.achieved)
  return html`<div class="stack">
    ${active.length === 0 && html`<${Empty} title="Where do you want to get to?">Pick a lift and a number, say a 140 kg bench. You'll get a week-by-week plan of progressive overload from where you are now, and it re-plans itself as you train.</${Empty}>`}
    ${active.map(g => html`<${GoalCard} key=${g.id} goal=${g} app=${app} />`)}
    <button class="btn primary wide" onClick=${() => setAdding(true)}>+ New goal</button>
    ${done.length > 0 && html`<section class="panel"><h2 class="h2">Achieved</h2>${done.map(g => html`<p><b>${exInfo(g.exId).name} ${g.target} kg</b> <span class="muted">· ${fmtDateLong(g.achieved)}</span></p>`)}</section>`}
    <${NewGoal} open=${adding} onClose=${() => setAdding(false)} app=${app} />
  </div>`
}
