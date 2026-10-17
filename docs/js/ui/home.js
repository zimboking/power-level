// Home: this week at a glance, today's session (or when the next one is), the fighter, a weight
// check, your streak, food today and goals.
import { html, useState, useEffect, Sheet, Icon, PageHead, fmt, fmtDate, fmtWeekday } from './core.js'
import { PowerCard, Fighter } from './hero.js'
import { LineChart } from './charts.js'
import { TIERS } from '../power.js'
import { sumEntries, energyUnitOf, toUnit, fmtEnergy } from '../nutrition.js'
import { journeyFor, latestBodyweight } from '../plan.js'
import { percentThere } from '../journey.js'
import { exInfo } from '../exercises.js'
import { weekOf, plannedFor, nextSession, addDays, DAY_SHORT, hasPlan } from '../schedule.js'
import { streakWeeks } from '../stats.js'
import { rollingAverage } from '../strength.js'
import { dailyTargets } from './food.js'
import { today, isStandalone, makeBackup, downloadFile } from '../store.js'
import { makeExampleData } from '../examples.js'

const daysSince = iso => (iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 864e5) : Infinity)

function WeekCard({ app }) {
  const { profile, workouts, active } = app.state
  const ws = profile.plan?.weekStart ?? 1
  const [offset, setOffset] = useState(0)
  const [sel, setSel] = useState(today())
  const days = weekOf(addDays(today(), offset * 7), ws)
  const trained = new Set(workouts.map(w => w.date))
  const planned = d => (d >= today() ? plannedFor(profile, workouts, d, today()) : null)
  const selWorkouts = workouts.filter(w => w.date === sel)
  const selPlan = planned(sel)
  const next = nextSession(profile, workouts, today())
  const isToday = sel === today()
  let body
  if (isToday && active) body = html`<div class="today-row"><span class="today-ic live"><${Icon} name="dumbbell" /></span><span class="row-main"><small>IN PROGRESS</small><span>${active.name}</span></span><button class="pill-go" onClick=${() => app.go('train')}>Resume</button></div>`
  else if (selWorkouts.length) body = html`<div class="today-row"><span class="today-ic done"><${Icon} name="check" /></span><span class="row-main"><small>${isToday ? 'TODAY' : fmtWeekday(sel).toUpperCase()} · DONE</small><span>${selWorkouts.map(w => w.name).join(' + ')}</span></span></div>`
  else if (selPlan) body = html`<div class="today-row"><span class="today-ic"><${Icon} name="dumbbell" /></span><span class="row-main"><small>${isToday ? 'TODAY' : fmtWeekday(sel).toUpperCase()}${profile.plan?.overrides?.[sel] ? ' · RESCHEDULED' : ''}</small><span>${selPlan.name}</span></span>${isToday ? html`<button class="pill-go" onClick=${() => app.go('train')}>Start</button>` : null}</div>`
  else if (!hasPlan(profile)) body = html`<div class="today-row"><span class="today-ic soft"><${Icon} name="calendar" /></span><span class="row-main"><small>NO PLAN YET</small><span>Set up your week</span></span><button class="pill-go" onClick=${() => app.go('plan')}>Plan</button></div>`
  else body = html`<div class="today-row"><span class="today-ic soft"><${Icon} name="calendar" /></span><span class="row-main"><small>${isToday ? 'TODAY · REST DAY' : sel < today() ? 'NOTHING LOGGED' : 'REST DAY'}</small><span>${next ? `Next: ${next.routine.name}, ${next.inDays === 1 ? 'tomorrow' : fmtWeekday(next.date)}` : 'Enjoy it'}</span></span></div>`
  return html`<section class="card week-card">
    <div class="week-head"><button class="circle-btn plain" aria-label="Previous week" onClick=${() => setOffset(offset - 1)}><${Icon} name="left" /></button>
      <span class="muted">${offset === 0 ? 'This week' : offset === -1 ? 'Last week' : offset === 1 ? 'Next week' : fmtDate(days[0])}</span>
      <button class="circle-btn plain" aria-label="Next week" onClick=${() => setOffset(offset + 1)}><${Icon} name="right" /></button></div>
    <div class="week-strip">${days.map(d => html`<button class=${'wday' + (d === today() ? ' today' : '') + (d === sel ? ' sel' : '')} onClick=${() => setSel(d)} aria-label=${fmtWeekday(d) + ' ' + fmtDate(d)}>
      <small>${DAY_SHORT[new Date(d + 'T12:00:00').getDay()]}</small><b>${+d.slice(8)}</b>
      <span class=${'wdot' + (trained.has(d) ? ' trained' : planned(d) ? ' planned' : '')}></span></button>`)}</div>
    ${body}
  </section>`
}

function WeightCard({ app }) {
  const { profile } = app.state
  const last = latestBodyweight(profile)
  const [kg, setKg] = useState(last || 80)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (last) setKg(last) }, [last])
  const sorted = [...(profile.weighins || [])].sort((a, b) => a.date.localeCompare(b.date))
  const prev = sorted[sorted.length - 2]
  const goal = profile.settings.goalWeight
  const save = e => {
    e.preventDefault()
    const v = parseFloat(String(kg).replace(',', '.'))
    if (!(v > 20 && v < 400)) return
    app.update(s => ({ ...s, profile: { ...s.profile, weighins: [...s.profile.weighins.filter(w => w.date !== today()), { date: today(), kg: v }] } }), ['profile'])
    setOpen(false); app.toast('Weight logged')
  }
  const recent = sorted.slice(-30)
  const avg = rollingAverage(recent.map(w => w.kg), 7)
  return html`<section class="card">
    <div class="card-head"><p class="card-title">Body weight</p><div class="head-actions">${goal && html`<span class="goal-chip"><${Icon} name="target" size=${15} /> ${fmt(goal)}</span>`}<button class="text-btn" onClick=${() => setOpen(true)}><${Icon} name="plus" size=${16} /> Log</button></div></div>
    ${last ? html`<div class="weight-big"><b>${fmt(last)}</b><span class="unit">kg</span>${prev && html`<span class=${'delta ' + (last - prev.kg <= 0 ? 'down' : 'up')}>${last - prev.kg <= 0 ? '↓' : '↑'} ${fmt(Math.abs(Math.round((last - prev.kg) * 10) / 10))}</span>`}<span class="muted small right">${fmtDate(sorted[sorted.length - 1].date)}</span></div>
      ${goal && html`<p class="goal-line-text"><${Icon} name="target" size=${15} /> Goal ${fmt(goal)} kg · ${fmt(Math.abs(Math.round((last - goal) * 10) / 10))} kg to ${last > goal ? 'lose' : 'gain'}</p>`}
      ${recent.length > 1 && html`<${LineChart} label="Body weight trend" height=${150} goal=${goal || null} series=${[{ className: 's-avg', area: true, points: recent.map((w, i) => ({ x: w.date, y: avg[i] })) }]} />`}`
      : html`<p class="muted">Log your weight in the morning, before food. The trend matters more than any one day.</p>`}
    <${Sheet} open=${open} title="Log weight" onClose=${() => setOpen(false)}>
      <form class="inline-form big" onSubmit=${save}><input id="weigh-kg" class="input" inputmode="decimal" aria-label="Body weight in kilograms" value=${kg} onInput=${e => setKg(e.target.value)} /><span>kg</span><button class="btn primary">Save</button></form>
    </${Sheet}>
  </section>`
}

function TierSheet({ open, onClose, level }) {
  return html`<${Sheet} open=${open} title="Power tiers" onClose=${onClose}>
    <p class="muted">Your power level grows with your estimated 1RMs on the big lifts (bench, squat, deadlift, overhead press, row), plus every session and every kilo you move.</p>
    <ul class="tier-list">${TIERS.map((t, i) => html`<li class=${level >= t.min ? 'got' : ''}><${Fighter} tier=${{ ...t, idx: i }} size=${56} /><div><b>${t.name}</b><span>${t.min.toLocaleString()}+</span></div></li>`)}</ul>
  </${Sheet}>`
}

export function HomeView({ app }) {
  const { workouts, profile, food } = app.state
  const [tiers, setTiers] = useState(false)
  const tgt = dailyTargets(profile)
  const tot = sumEntries(food[today()])
  const unit = energyUnitOf(profile.settings)
  const goals = (profile.goals || []).filter(g => !g.achieved)
  const ws = profile.plan?.weekStart ?? 1
  const streak = streakWeeks(workouts, today(), ws)
  const thisWeek = workouts.filter(w => weekOf(today(), ws).includes(w.date)).length
  const backupDue = isStandalone() && !profile.example && workouts.length >= 3 && daysSince(profile.lastBackup) >= 14
  return html`<div class="stack">
    <${PageHead} title="Power Level" sub=${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}>
      <button class="circle-btn" aria-label="Settings" onClick=${app.openSettings}><${Icon} name="settings" /></button>
    </${PageHead}>
    ${profile.example && html`<p class="callout small">You're looking at example data. Clear it in Settings when you're ready to start.</p>`}
    ${!profile.example && workouts.length === 0 && html`<div class="callout"><b>New here?</b><span class="small">Load a starter plan in Plan, or look around with eight weeks of example training first.</span>
      <div class="row-btns"><button class="btn small primary" onClick=${() => app.go('plan')}>Pick a plan</button><button class="btn small" onClick=${() => app.replaceAll(makeExampleData(profile))}>Example data</button></div></div>`}
    ${backupDue && html`<div class="callout"><span class="small">${profile.lastBackup ? `No backup for ${daysSince(profile.lastBackup)} days.` : 'You haven’t backed up yet.'} Your data lives only on this phone.</span>
      <button class="btn small" onClick=${() => { downloadFile(`power-level-backup-${today()}.json`, makeBackup(app.state)); app.update(st => ({ ...st, profile: { ...st.profile, lastBackup: today() } }), ['profile']) }}>Download backup</button></div>`}
    <${WeekCard} app=${app} />
    <${PowerCard} level=${app.power.level} tier=${app.power.tier} onTap=${() => setTiers(true)} />
    <${WeightCard} app=${app} />
    <section class="card streak" onClick=${() => app.go('stats')}>
      <p class="streak-big"><${Icon} name="flame" size=${26} class="flame" /> ${streak} week streak</p>
      <p class="muted">${thisWeek} this week · ${workouts.length} workouts total</p>
    </section>
    ${goals.length > 0 && html`<section class="card"><div class="card-head"><p class="card-title">Goals</p><button class="text-btn" onClick=${() => app.go('stats', 'strength')}>All</button></div>
      ${goals.map(g => { const j = journeyFor(g, workouts, profile, today()); const pct = percentThere(g.start, j.current, g.target); return html`<div class="goal-mini">
        <div><b>${exInfo(g.exId).name} → ${g.target} kg</b><span class="muted small">${fmt(j.current)} kg now · ${j.reachable ? 'ETA ' + fmtDate(j.etaDate) : 'long road'}</span></div>
        <div class="meter" role="progressbar" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100" aria-label=${exInfo(g.exId).name + ' goal progress'}><span style=${{ width: pct + '%' }}></span></div></div>` })}
    </section>`}
    <section class="card" onClick=${() => app.go('food')}>
      <div class="card-head"><p class="card-title">Food today</p><span class="muted small">${tgt ? `${fmtEnergy(Math.max(0, tgt.kcal - tot.kcal), unit)} left` : 'Set targets in Settings'}</span></div>
      <div class="macro-bars">${[[unit === 'kj' ? 'Energy' : 'Calories', toUnit(tot.kcal, unit), tgt && toUnit(tgt.kcal, unit), 'kcal'], ['Protein', tot.p, tgt?.protein, 'p'], ['Carbs', tot.c, tgt?.carbs, 'c'], ['Fat', tot.f, tgt?.fat, 'f']].map(([l, v, t, k]) => html`
        <div class="mb"><span>${l}</span><div class=${'meter m-' + k}><span style=${{ width: (t ? Math.min(100, (v / t) * 100) : 0) + '%' }}></span></div><span class="tnum">${Math.round(v)}${t ? ' / ' + t : ''}</span></div>`)}</div>
    </section>
    <${TierSheet} open=${tiers} onClose=${() => setTiers(false)} level=${app.power.level} />
  </div>`
}
