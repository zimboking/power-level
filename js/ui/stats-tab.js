// Stats: tiles, a year of activity, the muscle map (volume, recovery, untrained), strength
// trends and balance, goals, body weight and photos, everything lifted, and editable history.
import { html, useState, useMemo, Icon, Segmented, PageHead, ActionSheet, fmt, fmtDate, fmtDateLong, Empty } from './core.js'
import { LineChart, Bars } from './charts.js'
import { BodyMap } from './bodymap.js'
import { Photos } from './photos.js'
import { GoalsView } from './goals.js'
import { exerciseHistory, rollingAverage, workoutVolume, FEELINGS } from '../strength.js'
import { setsByMuscle, fatigueByMuscle, fatigueLevel, daysSinceByMuscle, volumeLevel, untrainedLevel, MUSCLE_NAME, MAIN_MUSCLES, recoveryHours } from '../muscles.js'
import { streakWeeks, thisMonth, weightChange30, heatmap, balance } from '../stats.js'
import { liftedComparison, formatKg, LIFTED_LADDER } from '../power.js'
import { exInfo } from '../exercises.js'
import { addDays, weekOf } from '../schedule.js'
import { activeGoal } from '../plan.js'
import { today } from '../store.js'

function Tile({ icon, label, value, tone }) {
  return html`<div class="tile"><p class="tile-label"><${Icon} name=${icon} size=${15} /> ${label}</p><p class=${'tile-value ' + (tone || '')}>${value}</p></div>`
}

function Heatmap({ workouts, weekStart }) {
  const cols = heatmap(workouts, today(), weekStart, 26)
  const months = []
  cols.forEach((c, i) => { const m = c[0].date.slice(0, 7); if (!months.length || months[months.length - 1].m !== m) months.push({ m, i }) })
  return html`<div class="card"><p class="card-title">Activity · last 6 months <span class="muted">by time trained</span></p>
    <div class="heat-scroll"><div class="heat" style=${{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
      ${months.filter((x, k) => k > 0 || cols.length - x.i > 2).map(x => html`<span class="heat-month" style=${{ gridColumn: x.i + 1 }}>${new Date(x.m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short' })}</span>`)}
      ${cols.map((c, i) => c.map((d, r) => html`<span class=${'heat-cell h' + d.level + (d.date === today() ? ' today' : '') + (d.future ? ' future' : '')} style=${{ gridColumn: i + 1, gridRow: r + 2 }} title=${d.mins ? `${fmtDate(d.date)}: ${d.mins} min` : fmtDate(d.date)}></span>`))}
    </div></div>
    <p class="heat-legend">Less time ${[0, 1, 2, 3, 4].map(l => html`<span class=${'heat-cell h' + l}></span>`)} More time</p>
  </div>`
}

function MuscleSection({ workouts, sex }) {
  const [mode, setMode] = useState('volume')
  const [range, setRange] = useState('week')
  const [picked, setPicked] = useState(null)
  const since = { week: addDays(today(), -6), '30d': addDays(today(), -29), '90d': addDays(today(), -89), all: '0000' }[range]
  const vol = useMemo(() => setsByMuscle(workouts, since), [workouts, since])
  const fat = useMemo(() => fatigueByMuscle(workouts), [workouts])
  const days = useMemo(() => daysSinceByMuscle(workouts, today()), [workouts])
  const max = Math.max(1, ...Object.values(vol))
  const levels = Object.fromEntries(MAIN_MUSCLES.map(m => [m, mode === 'volume' ? volumeLevel(vol[m], max) : mode === 'recovery' ? fatigueLevel(fat[m]) : untrainedLevel(days[m])]))
  const detail = m => (mode === 'volume' ? `${fmt(vol[m] || 0)} sets` : mode === 'recovery' ? (fat[m] ? `still recovering · ~${Math.round(recoveryHours(m))} h window` : 'fresh') : days[m] === Infinity ? 'never trained' : days[m] === 0 ? 'today' : `${days[m]} days ago`)
  const list = MAIN_MUSCLES.map(m => ({ m, v: mode === 'volume' ? vol[m] || 0 : mode === 'recovery' ? fat[m] || 0 : days[m] })).sort((a, b) => (mode === 'untrained' ? (b.v === Infinity) - (a.v === Infinity) || b.v - a.v : b.v - a.v))
  return html`<div class="card">
    <${Segmented} label="Muscle map mode" value=${mode} onChange=${setMode} options=${[{ value: 'volume', label: 'Volume' }, { value: 'recovery', label: 'Recovery' }, { value: 'untrained', label: 'Untrained' }]} />
    <p class="card-title">${mode === 'volume' ? 'Where your sets went' : mode === 'recovery' ? 'What’s still recovering' : 'What’s gone untrained'}</p>
    ${mode === 'volume' && html`<${Segmented} small label="Range" value=${range} onChange=${setRange} options=${[{ value: 'week', label: 'Week' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: 'all', label: 'All' }]} />`}
    <${BodyMap} levels=${levels} tone=${mode === 'volume' ? 'vol' : mode === 'recovery' ? 'fat' : 'untrained'} sex=${sex} onPick=${setPicked} label=${'Muscle map: ' + mode} />
    ${picked && html`<p class="map-pick"><b>${MUSCLE_NAME[picked] || picked}</b> · ${MAIN_MUSCLES.includes(picked) ? detail(picked) : 'not tracked'}</p>`}
    <div class="muscle-list">${list.slice(0, 6).map(({ m }) => html`<div class="muscle-row"><span class=${'dot lvl' + levels[m] + ' tone-' + mode}></span><span>${MUSCLE_NAME[m]}</span><span class="muted">${detail(m)}</span></div>`)}</div>
    ${mode === 'recovery' && html`<p class="muted small">A muscle stays shaded for about 2–3 days after hard sets, fading as it recovers.</p>`}
  </div>`
}

function StrengthSection({ workouts, profile }) {
  const used = useMemo(() => [...new Set(workouts.flatMap(w => w.entries.map(e => e.exId)))].filter(id => exerciseHistory(workouts, id).length), [workouts])
  const [exId, setExId] = useState(used.includes('bench') ? 'bench' : used[0])
  const hist = useMemo(() => (exId ? exerciseHistory(workouts, exId) : []), [workouts, exId])
  const avg = rollingAverage(hist.map(p => p.e1rm), 4)
  const bal = balance(workouts)
  if (!used.length) return null
  const goal = activeGoal(profile, exId)
  const best = hist.reduce((m, p) => (p.e1rm > (m?.e1rm || 0) ? p : m), null)
  return html`<div class="card">
    <div class="card-head"><p class="card-title">Estimated 1RM</p>
      <select id="stat-ex" class="input select" aria-label="Exercise" value=${exId} onChange=${e => setExId(e.target.value)}>${used.map(id => html`<option value=${id}>${exInfo(id).name}</option>`)}</select></div>
    ${hist.length > 0 && html`<${LineChart} label=${'Estimated 1RM for ' + exInfo(exId).name} goal=${goal?.target} series=${[
      { className: 's-raw', dots: true, points: hist.map(p => ({ x: p.date, y: p.e1rm, flag: p.feeling !== 'great' })) },
      { className: 's-avg', area: true, points: hist.map((p, i) => ({ x: p.date, y: avg[i] })) },
    ]} />
    <p class="legend"><span class="lg raw"></span>Session <span class="lg avg"></span>4-session average <span class="lg flag"></span>Not 100 %</p>
    <div class="kv"><span>Best</span><b>${fmt(best.e1rm)} kg · ${fmtDate(best.date)}</b><span>Now (average)</span><b>${fmt(avg[avg.length - 1])} kg</b></div>`}
    ${bal && html`<div class="divider"></div><p class="card-title">Strength balance <span class="muted">rule-of-thumb ratios</span></p>
      ${bal.map(b => html`<div class="bal-row"><span>${exInfo(b.exId).name}</span><div class="bal-bar"><span class=${'bal-fill ' + b.status} style=${{ width: Math.min(100, b.pct) + '%' }}></span></div><span class="tnum">${b.pct}%</span></div>`)}
      <p class="muted small">Each lift against what your strongest lift suggests it could be (squat 100 : deadlift 120 : bench 75 : row 60 : press 47). The shortest bar is usually the best one to bring up.</p>`}
  </div>`
}

function Lifted({ total }) {
  const c = liftedComparison(total)
  return html`<div class="card volcano"><p class="card-title">Everything you’ve lifted</p>
    <p class="big-num">${formatKg(total)}</p>
    ${c.best && html`<p>That's <b>${c.times >= 10 ? Math.round(c.times) : c.times.toFixed(1)} × ${c.best.name.replace(/^an? /, '')}</b>.</p>`}
    ${c.next && html`<div class="meter volcano-meter" role="progressbar" aria-valuenow=${Math.round(c.progress * 100)} aria-valuemin="0" aria-valuemax="100" aria-label=${'Progress to ' + c.next.name}><span style=${{ width: Math.max(2, c.progress * 100) + '%' }}></span></div>
      <p class="muted small">${formatKg(c.toNext)} more to lift ${c.next.name}${c.next.kg >= 1e14 ? ' (give or take a few lifetimes)' : ''}.</p>`}
    <details><summary class="muted small">The ladder</summary><ol class="ladder">${LIFTED_LADDER.map(i => html`<li class=${total >= i.kg ? 'got' : ''}><span>${i.name}</span><span>${formatKg(i.kg)}</span></li>`)}</ol></details>
  </div>`
}

function History({ app }) {
  const [menu, setMenu] = useState(null)
  const [limit, setLimit] = useState(15)
  const list = [...app.state.workouts].sort((a, b) => b.date.localeCompare(a.date))
  return html`<div class="card">
    <div class="card-head"><p class="card-title">History</p><button class="text-btn" onClick=${() => app.logPast()}><${Icon} name="plus" size=${16} /> Log past workout</button></div>
    <div class="group inset">${list.slice(0, limit).map(w => html`<button class="row-btn" onClick=${() => setMenu(w)}>
      <span class="row-main"><span>${w.name}${w.feeling && w.feeling !== 'great' ? html` <small class="tag-flag inline">${FEELINGS[w.feeling]?.label}</small>` : ''}</span>
      <small>${fmtDateLong(w.date)} · ${w.entries.reduce((n, e) => n + e.sets.filter(s => !s.warmup).length, 0)} sets · ${formatKg(workoutVolume(w))}${w.durationMin ? ` · ${w.durationMin} min` : ''}</small></span><${Icon} name="right" size=${16} /></button>`)}</div>
    ${list.length > limit && html`<button class="btn" onClick=${() => setLimit(limit + 30)}>Show more</button>`}
    <${ActionSheet} open=${!!menu} title=${menu ? `${menu.name} · ${fmtDate(menu.date)}` : ''} onClose=${() => setMenu(null)} actions=${menu ? [
      { label: 'Edit or move date', icon: 'edit', hint: 'Records are re-read from the corrected history', onClick: () => app.editWorkout(menu) },
      { label: 'Repeat this workout', icon: 'copy', onClick: () => app.repeatWorkout(menu) },
      { label: 'Delete workout', icon: 'trash', danger: true, onClick: () => { const w = menu; app.update(s => ({ ...s, workouts: s.workouts.filter(x => x.id !== w.id) }), ['w:' + w.id]); app.toast({ text: 'Workout deleted', action: { label: 'Undo', run: () => app.update(s => ({ ...s, workouts: [...s.workouts, w] }), ['w:' + w.id]) } }) } },
    ] : []} />
  </div>`
}

export function StatsTab({ app, initial }) {
  const { workouts, profile } = app.state
  const [seg, setSeg] = useState(initial || 'overview')
  const ws = profile.plan?.weekStart ?? 1
  const total = workouts.reduce((s, w) => s + workoutVolume(w), 0)
  const delta = weightChange30(profile.weighins || [], today())
  const weigh = [...(profile.weighins || [])].sort((a, b) => a.date.localeCompare(b.date))
  const wavg = rollingAverage(weigh.map(w => w.kg), 7)
  const weeks = useMemo(() => {
    const m = {}
    for (const w of workouts) { const k = weekOf(w.date, ws)[0]; m[k] = (m[k] || 0) + workoutVolume(w) }
    return Object.entries(m).sort().slice(-12).map(([k, y]) => ({ label: fmtDate(k), y }))
  }, [workouts])
  return html`<div class="stack">
    <${PageHead} title="Stats" sub="Progress & history" />
    <${Segmented} label="Stats section" value=${seg} onChange=${setSeg} options=${[{ value: 'overview', label: 'Overview' }, { value: 'strength', label: 'Strength' }, { value: 'body', label: 'Body' }]} />
    ${seg === 'overview' && html`
      <div class="tiles">
        <${Tile} icon="dumbbell" label="Workouts" value=${workouts.length} />
        <${Tile} icon="calendar" label="This month" value=${thisMonth(workouts, today())} />
        <${Tile} icon="flame" label="Week streak" value=${streakWeeks(workouts, today(), ws)} />
        <${Tile} icon="scale" label="Weight 30d" value=${delta == null ? '–' : `${delta > 0 ? '+' : ''}${fmt(delta)} kg`} tone=${delta == null ? '' : delta < 0 ? 'good' : 'warm'} />
      </div>
      ${workouts.length === 0 ? html`<${Empty} title="No workouts yet" icon="stats">Finish a workout and your activity, muscle map and records show up here.</${Empty}>` : html`
        <${Heatmap} workouts=${workouts} weekStart=${ws} />
        <${MuscleSection} workouts=${workouts} sex=${profile.settings.sex} />
        <div class="card"><p class="card-title">Weekly volume</p><${Bars} data=${weeks} label="Weekly volume in kilograms" /></div>
        <${Lifted} total=${total} />
        <${History} app=${app} />`}`}
    ${seg === 'strength' && html`<${StrengthSection} workouts=${workouts} profile=${profile} /><p class="section-label">Goals</p><${GoalsView} app=${app} />`}
    ${seg === 'body' && html`
      <div class="card"><p class="card-title">Body weight</p>
        ${weigh.length > 1 ? html`<${LineChart} label="Body weight" goal=${profile.settings.goalWeight || null} series=${[
          { className: 's-avg', area: true, points: weigh.map((w, i) => ({ x: w.date, y: wavg[i] })) },
          { className: 's-raw', dots: true, points: weigh.map(w => ({ x: w.date, y: w.kg })) },
        ]} /><p class="legend"><span class="lg raw"></span>Weigh-ins <span class="lg avg"></span>7-entry trend</p>` : html`<p class="muted small">Log your weight on the Home screen. Two weigh-ins and the chart appears.</p>`}
      </div>
      <div class="card"><p class="card-title">Progress photos</p><${Photos} /></div>`}
  </div>`
}
