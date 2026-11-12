// Food, week view: how the week is tracking against your targets. Days with nothing logged
// are left out of the averages (see weekSummary).
import { html, fmt, fmtDate } from './core.js'
import { weekSummary, toUnit, fmtEnergy } from '../nutrition.js'
import { weekOf, addDays } from '../schedule.js'
import { today } from '../store.js'

const dayShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' })
const ROWS = [['kcal', 'Energy', 'kcal'], ['p', 'Protein', 'p'], ['c', 'Carbs', 'c'], ['f', 'Fat', 'f']]

function Bars({ week, target, unit, onPickDay }) {
  const top = Math.max(target || 0, ...week.days.map(d => d.kcal), 1) * 1.08
  return html`<div class="fw-chart">
    ${target ? html`<span class="fw-target" style=${{ bottom: `calc(22px + ${(target / top) * 100}% * 0.78)` }}><em>${fmtEnergy(target, unit)}</em></span>` : null}
    ${week.days.map(d => html`<button class=${'fw-col' + (d.today ? ' today' : '') + (target && d.kcal > target * 1.05 ? ' over' : '')} disabled=${d.future}
      aria-label=${`${dayShort(d.date)} ${fmtDate(d.date)}: ${d.logged ? fmtEnergy(d.kcal, unit) : 'nothing logged'}`} onClick=${() => onPickDay(d.date)}>
      <span class="fw-bar-wrap"><span class="fw-bar" style=${{ height: (d.kcal / top) * 100 + '%' }}></span></span>
      <small>${d.today ? 'Today' : dayShort(d.date)}</small></button>`)}
  </div>`
}

export function FoodWeek({ food, date, setDate, tgt, unit, weekStart, onPickDay }) {
  const now = today()
  const dates = weekOf(date, weekStart)
  const week = weekSummary(food, dates, tgt, now)
  const current = dates.includes(now)
  const val = (k, v) => (k === 'kcal' ? toUnit(v, unit).toLocaleString() : fmt(Math.round(v)))
  const u = k => (k === 'kcal' ? (unit === 'kj' ? 'kJ' : 'kcal') : 'g')
  const left = week.stats.kcal.perDayLeft
  return html`<div class="stack">
    <div class="date-nav">
      <button class="icon-btn" aria-label="Previous week" onClick=${() => setDate(addDays(dates[0], -1))}>‹</button>
      <b>${current ? 'This week' : `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`}</b>
      <button class="icon-btn" aria-label="Next week" disabled=${current || dates[6] >= now} onClick=${() => setDate(addDays(dates[6], 1) > now ? now : addDays(dates[6], 1))}>›</button>
    </div>
    <section class="panel">
      <div class="panel-head"><h2 class="h2">Energy by day</h2><span class="muted small">${week.logged} of 7 days logged</span></div>
      <${Bars} week=${week} target=${tgt?.kcal} unit=${unit} onPickDay=${onPickDay} />
    </section>
    <section class="panel">
      <div class="panel-head"><h2 class="h2">Daily average</h2><span class="muted small">${week.avgDays} ${week.avgDays === 1 ? 'day' : 'days'}${tgt ? ' · against target' : ''}</span></div>
      ${week.logged === 0 ? html`<p class="muted small">Nothing logged this week yet.</p>` : html`<div class="macro-bars">
        ${ROWS.map(([k, label, cls]) => { const s = week.stats[k]; return html`<div class="fw-row">
          <div class="mb"><span>${label}</span><div class=${'meter m-' + cls}><span class=${s.target && s.avg > s.target * 1.05 ? 'over' : ''} style=${{ width: (s.target ? Math.min(100, (s.avg / s.target) * 100) : 100) + '%' }}></span></div>
            <span class="tnum">${val(k, s.avg)}${s.target ? ` / ${val(k, s.target)}` : ''} ${u(k)}</span></div>
          <small class="muted">Week so far, with today: ${val(k, s.total)}${s.budget ? ` of ${val(k, s.budget)}` : ''} ${u(k)}</small></div>` })}</div>`}
      ${!tgt && html`<p class="warn small">Add your height and age in Settings to get targets to compare against.</p>`}
    </section>
    ${tgt && left != null && week.logged > 0 && html`<p class="muted small center">To finish the week on target: about <b>${fmtEnergy(left, unit)}</b> and <b>${Math.round(week.stats.p.perDayLeft)} g protein</b> ${week.toCome === 1 ? 'today in total' : `a day for today and the ${week.toCome - 1} ${week.toCome === 2 ? 'day' : 'days'} after`}.</p>`}
    <section class="panel">
      <div class="panel-head"><h2 class="h2">Each day</h2><span class="muted small">tap to open</span></div>
      <div class="fw-table" role="table">
        <div class="fw-tr head" role="row"><span></span><span>${u('kcal')}</span><span>P</span><span>C</span><span>F</span></div>
        ${week.days.map(d => html`<button class=${'fw-tr' + (d.today ? ' today' : '')} role="row" disabled=${d.future} onClick=${() => onPickDay(d.date)}>
          <span>${dayShort(d.date)} <small class="muted">${fmtDate(d.date)}</small></span>
          ${d.logged ? html`<span class="tnum">${val('kcal', d.kcal)}</span><span class="tnum">${val('p', d.p)}</span><span class="tnum">${val('c', d.c)}</span><span class="tnum">${val('f', d.f)}</span>`
            : html`<span class="muted fw-none">${d.future ? '' : 'not logged'}</span>`}</button>`)}
      </div>
    </section>
  </div>`
}
