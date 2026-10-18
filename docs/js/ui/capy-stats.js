// CapySpa stats: today's hours, the week against your goal, drink mix and the mood check-in.
// All from your own logs; the mood insight unlocks only once there's enough of them.
import { html, useState, useEffect, Segmented } from './core.js'
import {
  BEVERAGES, TYPE_ORDER, MOODS, MOOD_ORDER, PERIODS, INSIGHT_MIN_DAYS, INSIGHT_MIN_PER_GROUP,
  hourly, periodTotals, periodOf, weekSeries, breakdown, moodInsight, pctOf, clamp,
} from '../water.js'
import { addDays } from '../schedule.js'

const fmtMl = n => Math.round(n).toLocaleString('en-AU')
const hourLabel = h => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)
const dayShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' })
const dayLong = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
const topRoundedBar = (x, y, w, h, r) => {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`
}

function HourlyChart({ capy }) {
  const buckets = hourly(capy.logs, capy.ratios)
  const totals = periodTotals(buckets)
  const max = Math.max(...buckets)
  const yMax = Math.max(500, Math.ceil(max / 500) * 500)
  const peak = max > 0 ? buckets.indexOf(max) : null
  const [sel, setSel] = useState(null)
  const active = sel ?? peak
  const nowH = new Date().getHours()
  const W = 320, H = 150, L = 30, R = 6, T = 10, B = 22
  const pw = W - L - R, ph = H - T - B, slot = pw / 24, bw = slot - 3
  const y = v => T + ph - (v / yMax) * ph
  return html`<section class="card">
    <div class="card-head"><p class="card-title">Hourly intake</p><span class="muted small">net ml</span></div>
    <p class="small cs-readout">${active != null ? html`<b>${hourLabel(active)}</b> · ${fmtMl(buckets[active])} ml net · ${PERIODS[periodOf(active)].label}${sel == null ? html`<span class="muted"> (peak)</span>` : ''}` : 'No sips logged yet'}</p>
    <svg viewBox=${`0 0 ${W} ${H}`} class="cs-chart" role="img" aria-label="Net ml by hour today" onMouseLeave=${() => setSel(null)}>
      ${[0, yMax / 2, yMax].map(v => html`<g key=${v}><line x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} class=${v === 0 ? 'cs-axis' : 'cs-grid'} />
        <text x=${L - 5} y=${y(v) + 3.5} text-anchor="end" class="cs-tick">${v >= 1000 ? `${v / 1000}k` : v}</text></g>`)}
      ${buckets.map((v, h) => html`<g key=${h}>
        ${v > 0 && html`<path d=${topRoundedBar(L + h * slot + 1.5, y(v), bw, T + ph - y(v), 4)} class=${'cs-p-' + periodOf(h)} opacity=${sel != null && sel !== h ? 0.45 : 1} />`}
        <rect x=${L + h * slot} y=${T} width=${slot} height=${ph + B} fill="transparent" onMouseEnter=${() => setSel(h)} onClick=${() => setSel(h)} style="cursor: pointer" /></g>`)}
      ${[0, 6, 12, 18].map(h => html`<text key=${h} x=${L + h * slot + slot / 2} y=${H - 6} text-anchor="middle" class="cs-tick">${hourLabel(h)}</text>`)}
      <path d=${`M${L + nowH * slot + slot / 2 - 4} ${T + ph + 9} l4 -5 l4 5 z`} class="cs-now" />
    </svg>
    <div class="cs-periods">${Object.entries(PERIODS).map(([k, p]) => html`<div class="cs-period"><small><i class=${'cs-key cs-p-' + k}></i>${p.label}</small>
      <b class="tnum">${fmtMl(totals[k])} <span>ml</span></b><small class="muted">${p.range}</small></div>`)}</div>
    <p class="field-hint">▲ marks the current hour. Tap a bar for details.</p>
  </section>`
}

function WeeklyChart({ app, capy }) {
  const [week, setWeek] = useState(0)
  const data = weekSeries(app.state.water || {}, capy.ratios, capy.date, week)
  const [sel, setSel] = useState(null)
  useEffect(() => setSel(null), [week])
  const active = sel ?? data.length - 1
  const goal = capy.goal
  const W = 320, H = 170, L = 30, R = 14, T = 14, B = 24
  const pw = W - L - R, ph = H - T - B
  const yMax = Math.max(Math.ceil((goal * 1.4) / 500) * 500, Math.ceil((Math.max(...data.map(d => d.total)) * 1.1) / 500) * 500)
  const x = i => L + (i * pw) / (data.length - 1)
  const y = v => T + ph - (v / yMax) * ph
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.total)}`).join(' ')
  const met = data.filter(d => d.total >= goal).length
  const avg = Math.round(data.reduce((s, d) => s + d.total, 0) / data.length)
  const a = data[active]
  const ticks = Array.from({ length: Math.floor(yMax / 1000) + 1 }, (_, i) => i * 1000)
  return html`<section class="card">
    <div class="card-head"><p class="card-title">Weekly trend</p>
      <${Segmented} small label="Week" value=${week} onChange=${setWeek} options=${[{ value: 0, label: 'Last 7' }, { value: 1, label: 'Prior 7' }]} /></div>
    <p class="small">Avg <b>${fmtMl(avg)} ml</b> · Goal hit <b>${met}/${data.length} days</b></p>
    <p class="small cs-readout"><b>${a.today ? 'Today' : dayLong(a.date)}</b> · ${fmtMl(a.total)} ml · ${pctOf(a.total, goal)}% of goal ${a.total >= goal ? '✓' : ''}</p>
    <svg viewBox=${`0 0 ${W} ${H}`} class="cs-chart" role="img" aria-label="Net ml per day this week" onMouseLeave=${() => setSel(null)}>
      ${ticks.map(v => html`<g key=${v}><line x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} class=${v === 0 ? 'cs-axis' : 'cs-grid'} />
        <text x=${L - 5} y=${y(v) + 3.5} text-anchor="end" class="cs-tick">${v / 1000}k</text></g>`)}
      <line x1=${L} x2=${W - R} y1=${y(goal)} y2=${y(goal)} class="cs-goal-line" />
      <path d=${`${line} L${x(data.length - 1)} ${T + ph} L${x(0)} ${T + ph} Z`} class="cs-area" />
      <path d=${line} class="cs-line" />
      <line x1=${x(active)} x2=${x(active)} y1=${T} y2=${T + ph} class="cs-cursor" />
      ${data.map((d, i) => html`<g key=${d.date}>
        <circle cx=${x(i)} cy=${y(d.total)} r=${i === active ? 6 : 4.5} class=${'cs-dot' + (d.total >= goal ? ' hit' : '')} />
        <text x=${x(i)} y=${H - 6} text-anchor="middle" class=${'cs-tick' + (d.today ? ' today' : '')}>${d.today ? 'Today' : dayShort(d.date)}</text>
        <rect x=${x(i) - pw / (data.length - 1) / 2} y=${T} width=${pw / (data.length - 1)} height=${ph + B} fill="transparent" onMouseEnter=${() => setSel(i)} onClick=${() => setSel(i)} style="cursor: pointer" /></g>`)}
    </svg>
    <div class="cs-legend"><span><i class="cs-key dot hit"></i> Goal met</span><span><i class="cs-key dot"></i> Below goal</span><span><i class="cs-key dash"></i> ${fmtMl(goal)} ml goal</span></div>
  </section>`
}

function Breakdown({ capy }) {
  const totals = breakdown(capy.logs)
  const sum = Object.values(totals).reduce((s, v) => s + v, 0)
  return html`<section class="card">
    <div class="card-head"><p class="card-title">Drink mix</p><span class="muted small">share of today's volume</span></div>
    ${sum === 0 ? html`<p class="muted small">Log a drink to see your mix.</p> ` : html`
      <div class="cs-mix">${TYPE_ORDER.filter(t => totals[t] > 0).map(t => html`<span class=${'bev-' + t} style=${{ width: (totals[t] / sum) * 100 + '%' }} title=${`${BEVERAGES[t].category}: ${totals[t]} ml`}></span>`)}</div>
      ${TYPE_ORDER.map(t => html`<div class="cs-mix-row"><span><i class=${'cs-key bev-' + t}></i>${BEVERAGES[t].emoji} ${BEVERAGES[t].category}</span>
        <span class="muted"><b>${Math.round((totals[t] / sum) * 100)}%</b> · ${fmtMl(totals[t])} ml</span></div>`)}`}
  </section>`
}

function MoodCard({ app, capy }) {
  const water = app.state.water || {}
  const insight = moodInsight(water, capy.ratios, capy.goal, capy.date)
  const last6 = Array.from({ length: 6 }, (_, i) => addDays(capy.date, i - 6))
  const low = capy.mood === 'tired' || capy.mood === 'headachy'
  return html`<section class="card">
    <div class="card-head"><p class="card-title">Mood and energy check-in</p></div>
    <div class="cs-types" role="radiogroup" aria-label="How are you feeling?">${MOOD_ORDER.map(k => html`<button type="button" role="radio" aria-checked=${capy.mood === k}
      class=${'cs-type mood' + (capy.mood === k ? ' on' : '')} onClick=${() => capy.pickMood(capy.mood === k ? null : k)}><span class="cs-emoji">${MOODS[k].emoji}</span><b>${MOODS[k].label}</b></button>`)}</div>
    ${capy.mood && (low && capy.pct < 60
      ? html`<div class="cs-note warm"><p>Feeling ${MOODS[capy.mood].label.toLowerCase()} and you're at <b>${capy.pct}%</b>. Low intake often tracks with low energy. Quick glass?</p>
          <button class="pill-go cs-pill" onClick=${() => capy.add('water', 250)}>+250 ml 💧</button></div>`
      : html`<p class="cs-note">${MOODS[capy.mood].emoji} Saved for today. It joins your insights once today closes, so a half-finished day can't skew the numbers.</p>`)}
    <div class="cs-moods">${last6.map(d => html`<div><span>${MOODS[water[d]?.mood]?.emoji || '·'}</span><small>${new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'narrow' })}</small></div>`)}
      <div><span>${capy.mood ? MOODS[capy.mood].emoji : '·'}</span><small><b>Today</b></small></div></div>
    ${insight.ready ? html`<div class="cs-insight">
        <p><b>✨ Correlation insight</b></p>
        <p class="small">On days with <b>over 90% hydration</b>, your mood rating averaged <b>${insight.lift}% ${insight.lift >= 0 ? 'higher' : 'lower'}</b>.</p>
        ${[['>90%', insight.hiAvg, insight.hiN, 'hi'], ['≤90%', insight.loAvg, insight.loN, 'lo']].map(([label, v, n, k]) => html`<div class="cs-insight-row"><span>${label}</span>
          <div class="meter"><span class=${'cs-' + k} style=${{ width: (v / 4) * 100 + '%' }}></span></div><span class="tnum"><b>${v.toFixed(1)}</b>/4 · ${n} days</span></div>`)}
        <p class="field-hint">Rating: ⚡4 😊3 😴2 🤕1. Based on ${insight.days} finished days. Correlation, not causation.</p></div>`
      : html`<div class="cs-insight locked">
        <p><b>✨ Insight unlocking</b></p>
        <p class="small muted">Your first mood insight appears after ${INSIGHT_MIN_DAYS} days of check-ins, with at least ${INSIGHT_MIN_PER_GROUP} days above and below 90% hydration. Fewer days than that would mostly be noise.</p>
        <div class="meter"><span class="cs-lo" style=${{ width: clamp((insight.days / INSIGHT_MIN_DAYS) * 100, 0, 100) + '%' }}></span></div>
        <p class="field-hint">${Math.min(insight.days, INSIGHT_MIN_DAYS)} of ${INSIGHT_MIN_DAYS} days checked in</p></div>`}
  </section>`
}

export function CapyStats({ app, capy }) {
  return html`<div class="stack">
    <${HourlyChart} capy=${capy} />
    <${WeeklyChart} app=${app} capy=${capy} />
    <${Breakdown} capy=${capy} />
    <${MoodCard} app=${app} capy=${capy} />
  </div>`
}
