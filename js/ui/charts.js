// Small SVG charts drawn with one scale per axis so every mark and label agrees.
import { html, fmt, fmtDate } from './core.js'

const niceTicks = (lo, hi, count = 4) => {
  if (hi === lo) { hi += 1; lo -= 1 }
  const raw = (hi - lo) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw
  const start = Math.floor(lo / step) * step
  const ticks = []
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/**
 * series: [{ points: [{x: 'YYYY-MM-DD', y, flag?}], className, dots?, dashed? }]
 * goal: optional y value drawn as a reference line.
 */
export function LineChart({ series, goal, height = 200, unit = 'kg', label }) {
  const W = 340, H = height, L = 40, R = 12, T = 14, B = 26
  const all = series.flatMap(s => s.points).filter(p => p.y != null)
  if (all.length === 0) return null
  const xs = [...new Set(all.map(p => p.x))].sort()
  const t = d => new Date(d + 'T00:00:00').getTime()
  const x0 = t(xs[0]), x1 = t(xs[xs.length - 1]) || x0 + 1
  const ys = all.map(p => p.y).concat(goal != null ? [goal] : [])
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys))
  const y0 = ticks[0], y1 = ticks[ticks.length - 1]
  const sx = d => L + (x1 === x0 ? (W - L - R) / 2 : ((t(d) - x0) / (x1 - x0)) * (W - L - R))
  const sy = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B)
  const xLabels = xs.length <= 2 ? xs : [xs[0], xs[Math.floor(xs.length / 2)], xs[xs.length - 1]]
  return html`<div class="chart-box"><svg viewBox=${`0 0 ${W} ${H}`} class="chart" role="img" aria-label=${label}>
    ${ticks.map(v => html`<g><line x1=${L} x2=${W - R} y1=${sy(v)} y2=${sy(v)} class="grid" /><text x=${L - 6} y=${sy(v) + 4} class="axis" text-anchor="end">${fmt(v)}</text></g>`)}
    ${xLabels.map((d, i) => html`<text x=${sx(d)} y=${H - 6} class="axis" text-anchor=${i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>${fmtDate(d)}</text>`)}
    ${goal != null && html`<g><line x1=${L} x2=${W - R} y1=${sy(goal)} y2=${sy(goal)} class="goal-line" /><text x=${W - R} y=${sy(goal) - 5} class="axis goal-text" text-anchor="end">Goal ${fmt(goal)} ${unit}</text></g>`}
    ${series.map(s => {
      const pts = s.points.filter(p => p.y != null)
      const d = pts.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ')
      const last = pts[pts.length - 1]
      return html`<g class=${s.className}>
        ${s.area && pts.length > 1 && html`<path d=${d + ` L${sx(last.x)} ${H - B} L${sx(pts[0].x)} ${H - B} Z`} class="area" />`}
        ${pts.length > 1 && html`<path d=${d} class=${'line' + (s.dashed ? ' dashed' : '')} fill="none" />`}
        ${s.dots && pts.map(p => html`<circle cx=${sx(p.x)} cy=${sy(p.y)} r=${p.flag ? 4.5 : 3.2} class=${'dot' + (p.flag ? ' flag' : '')}><title>${fmtDate(p.x)}: ${fmt(p.y)} ${unit}${p.flag ? ' (not 100 %)' : ''}</title></circle>`)}
        ${last && !s.dots && html`<circle cx=${sx(last.x)} cy=${sy(last.y)} r="3.5" class="dot end" />`}
      </g>`
    })}
  </svg></div>`
}

export function Bars({ data, height = 140, unit = 'kg', label }) {
  const W = 340, H = height, L = 6, B = 22, T = 16
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.y), 1)
  const bw = (W - L * 2) / data.length
  return html`<div class="chart-box"><svg viewBox=${`0 0 ${W} ${H}`} class="chart" role="img" aria-label=${label}>
    ${data.map((d, i) => {
      const h = (d.y / max) * (H - B - T)
      return html`<g>
        <rect x=${L + i * bw + bw * 0.15} y=${H - B - h} width=${bw * 0.7} height=${Math.max(h, 1)} rx="3" class=${'bar' + (i === data.length - 1 ? ' current' : '')}><title>${d.label}: ${Math.round(d.y).toLocaleString()} ${unit}</title></rect>
        ${(i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) && html`<text x=${L + i * bw + bw / 2} y=${H - 6} class="axis" text-anchor="middle">${d.label}</text>`}
      </g>`
    })}
    <text x=${W - L} y="11" class="axis" text-anchor="end">max ${Math.round(max).toLocaleString()} ${unit}</text>
  </svg></div>`
}

export function Ring({ value, target, label, unit, className }) {
  const pct = target > 0 ? Math.min(1.25, value / target) : 0
  const r = 30, c = 2 * Math.PI * r
  const over = target > 0 && value > target * 1.05
  return html`<div class=${'ring ' + (className || '') + (over ? ' over' : '')}>
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <circle cx="40" cy="40" r=${r} class="ring-track" fill="none" stroke-width="8" />
      <circle cx="40" cy="40" r=${r} class="ring-fill" fill="none" stroke-width="8" stroke-linecap="round"
        stroke-dasharray=${`${Math.min(1, pct) * c} ${c}`} transform="rotate(-90 40 40)" />
    </svg>
    <div class="ring-text"><b>${Math.round(value)}</b><span>/ ${target ? Math.round(target) : '–'}${unit}</span></div>
    <p class="ring-label">${label}</p>
  </div>`
}
