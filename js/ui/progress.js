// Progress: lift trends with a rolling average, weekly volume, body weight and the volcano meter.
import { html, useState, useMemo, fmt, fmtDateLong, Empty, ConfirmButton } from './core.js'
import { LineChart, Bars } from './charts.js'
import { exerciseHistory, rollingAverage, workoutVolume, FEELINGS } from '../strength.js'
import { liftedComparison, formatKg, LIFTED_LADDER } from '../power.js'
import { exInfo } from '../exercises.js'
import { activeGoal } from '../plan.js'

const weekKey = iso => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function VolcanoMeter({ total }) {
  const c = liftedComparison(total)
  return html`<section class="panel volcano">
    <p class="eyebrow">All-time lifted</p>
    <p class="h1">${formatKg(total)}</p>
    ${c.best && html`<p>You've lifted <b>${c.times >= 10 ? Math.round(c.times) : c.times.toFixed(1)} × ${c.best.name.replace(/^an? /, '')}</b>.</p>`}
    ${c.next && html`<div class="meter volcano-meter" role="progressbar" aria-valuenow=${Math.round(c.progress * 100)} aria-valuemin="0" aria-valuemax="100" aria-label=${'Progress to ' + c.next.name}><span style=${{ width: Math.max(2, c.progress * 100) + '%' }}></span></div>
      <p class="muted small">${formatKg(c.toNext)} more to lift ${c.next.name}${c.next.kg >= 1e14 ? ' (give or take a few lifetimes)' : ''}.</p>`}
    <ol class="ladder">${LIFTED_LADDER.map(i => html`<li class=${total >= i.kg ? 'got' : ''}><span>${i.name}</span><span>${formatKg(i.kg)}</span></li>`)}</ol>
  </section>`
}

export function ProgressView({ app }) {
  const { workouts, profile } = app.state
  const used = useMemo(() => [...new Set(workouts.flatMap(w => w.entries.map(e => e.exId)))], [workouts])
  const [exId, setExId] = useState(used.includes('bench') ? 'bench' : used[0])
  const hist = useMemo(() => (exId ? exerciseHistory(workouts, exId) : []), [workouts, exId])
  const avg = rollingAverage(hist.map(p => p.e1rm), 4)
  const weeks = useMemo(() => {
    const m = {}
    for (const w of workouts) m[weekKey(w.date)] = (m[weekKey(w.date)] || 0) + workoutVolume(w)
    return Object.entries(m).sort().slice(-12).map(([k, y]) => ({ label: new Date(k + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), y }))
  }, [workouts])
  const total = workouts.reduce((s, w) => s + workoutVolume(w), 0)
  const goal = exId ? activeGoal(profile, exId) : null
  const weigh = [...profile.weighins].sort((a, b) => a.date.localeCompare(b.date))

  if (!workouts.length) return html`<div class="stack"><${Empty} title="No workouts yet">Finish a workout and your 1RM trends, weekly volume and records show up here.</${Empty}>${weigh.length > 1 && html`<${WeightPanel} weigh=${weigh} profile=${profile} />`}</div>`

  const best = hist.reduce((m, p) => (p.e1rm > (m?.e1rm || 0) ? p : m), null)
  return html`<div class="stack">
    <section class="panel">
      <div class="panel-head"><h2 class="h2">Estimated 1RM</h2>
        <select id="prog-ex" class="input select" aria-label="Exercise" value=${exId} onChange=${e => setExId(e.target.value)}>
          ${used.map(id => html`<option value=${id}>${exInfo(id).name}</option>`)}
        </select></div>
      ${hist.length ? html`
        <${LineChart} label=${'Estimated 1RM for ' + exInfo(exId).name} goal=${goal?.target} series=${[
          { className: 's-raw', dots: true, points: hist.map(p => ({ x: p.date, y: p.e1rm, flag: p.feeling !== 'great' })) },
          { className: 's-avg', points: hist.map((p, i) => ({ x: p.date, y: avg[i] })) },
        ]} />
        <p class="legend"><span class="lg raw"></span>Each session <span class="lg avg"></span>4-session average <span class="lg flag"></span>Not feeling 100 %</p>
        <div class="kv"><span>Best</span><b>${fmt(best?.e1rm)} kg</b><span>Latest average</span><b>${fmt(avg[avg.length - 1])} kg</b><span>Sessions</span><b>${hist.length}</b></div>`
        : html`<p class="muted">No completed working sets for this lift yet.</p>`}
    </section>
    <section class="panel"><h2 class="h2">Weekly volume</h2><${Bars} data=${weeks} label="Weekly volume in kilograms" /></section>
    ${weigh.length > 1 && html`<${WeightPanel} weigh=${weigh} profile=${profile} />`}
    <${VolcanoMeter} total=${total} />
    <${HistoryList} app=${app} />
  </div>`
}

function WeightPanel({ weigh, profile }) {
  const avg = rollingAverage(weigh.map(w => w.kg), 7)
  return html`<section class="panel"><h2 class="h2">Body weight</h2>
    <${LineChart} label="Body weight" goal=${profile.settings.goalWeight || null} series=${[
      { className: 's-raw', dots: true, points: weigh.map(w => ({ x: w.date, y: w.kg })) },
      { className: 's-avg', points: weigh.map((w, i) => ({ x: w.date, y: avg[i] })) },
    ]} />
    <p class="legend"><span class="lg raw"></span>Weigh-ins <span class="lg avg"></span>7-entry trend</p>
  </section>`
}

function HistoryList({ app }) {
  const list = [...app.state.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  return html`<section class="panel"><h2 class="h2">History</h2>
    <ul class="history">${list.map(w => html`<li>
      <details>
        <summary><b>${w.name}</b> <span class="muted">${fmtDateLong(w.date)}</span>${w.feeling && w.feeling !== 'great' && html`<span class="tag-flag">${FEELINGS[w.feeling]?.label}</span>`}</summary>
        ${w.note && html`<p class="muted small">“${w.note}”</p>`}
        ${w.entries.map(e => html`<p class="small"><b>${exInfo(e.exId).name}</b>: ${e.sets.map(s => `${s.warmup ? 'W ' : ''}${fmt(s.w)}×${s.r}${s.rir != null && !s.warmup ? ' @' + s.rir : ''}`).join(', ')}</p>`)}
        <p class="small muted">${formatKg(workoutVolume(w))} · ${w.durationMin || 0} min</p>
        <${ConfirmButton} class="btn small ghost" confirmText="Tap again to delete" onConfirm=${() => app.update(s => ({ ...s, workouts: s.workouts.filter(x => x.id !== w.id) }), ['w:' + w.id])}>Delete workout</${ConfirmButton}>
      </details></li>`)}</ul>
  </section>`
}
