// The month in numbers, on Stats, with a picture card (1080 × 1350) to share.
import { html, useState, useMemo, Icon, fmt } from './core.js'
import { monthRecap, shiftMonth } from '../progress.js'
import { liftedComparison, formatKg } from '../power.js'
import { liftedSvg } from './lifted-art.js'
import { FONT, fit, roundRect, loadSvg, shareImage } from './share-card.js'
import { today } from '../store.js'

const W = 1080, H = 1350, PAD = 72
const monthName = m => new Date(m + '-15T12:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
const hours = min => (min >= 90 ? `${(min / 60).toFixed(1)} h` : `${min} min`)
const signed = kg => `${kg > 0 ? '+' : ''}${fmt(Math.round(kg * 10) / 10)} kg`

export function recapText(r, url = '') {
  return [
    `My ${monthName(r.month)} on Power Level`,
    `${r.workouts} ${r.workouts === 1 ? 'workout' : 'workouts'} · ${r.sets} sets · ${formatKg(r.volume)} lifted${r.minutes ? ` · ${hours(r.minutes)}` : ''}`,
    r.prs.length ? `Records: ${r.prs.join(', ')}` : '',
    r.lifts.length ? `Best lifts (est. 1RM): ${r.lifts.map(l => `${l.name} ${fmt(Math.round(l.e1rm))} kg`).join(', ')}` : '',
    url,
  ].filter(Boolean).join('\n')
}

/** The recap as a PNG blob. */
export async function recapCard(r) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#161618'); bg.addColorStop(1, '#0a0a0b')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  const soft = 'rgba(235,235,245,.62)'
  let y = PAD + 30
  ctx.fillStyle = '#30d158'; ctx.font = `700 34px ${FONT}`; ctx.fillText('POWER LEVEL · MONTH RECAP', PAD, y)
  y += 84
  ctx.fillStyle = '#ffffff'; ctx.font = `700 80px ${FONT}`; ctx.fillText(monthName(r.month), PAD, y)
  y += 50

  // Volume and what it compares to.
  const cmp = liftedComparison(r.volume)
  ctx.fillStyle = '#1c1c1e'; roundRect(ctx, PAD, y, W - PAD * 2, 380, 36); ctx.fill()
  try { ctx.drawImage(await loadSvg(liftedSvg(cmp.best?.art || 'dumbbell', { width: 500, height: 312 })), W - PAD - 500 - 20, y + 36, 500, 312) } catch { /* no drawing */ }
  ctx.fillStyle = '#ffffff'; ctx.font = `800 92px ${FONT}`; ctx.fillText(r.volume > 0 ? formatKg(r.volume) : 'Showed up', PAD + 44, y + 140)
  ctx.fillStyle = soft; ctx.font = `400 34px ${FONT}`
  if (cmp.best) {
    ctx.fillText('lifted. That’s about', PAD + 44, y + 204)
    ctx.fillStyle = '#ffd60a'; ctx.font = `700 46px ${FONT}`
    ctx.fillText(`${cmp.times >= 10 ? Math.round(cmp.times) : cmp.times.toFixed(1)} ×`, PAD + 44, y + 268)
    ctx.fillStyle = '#ffffff'; ctx.font = `600 38px ${FONT}`
    ctx.fillText(fit(ctx, cmp.best.name.replace(/^an? /, ''), 420), PAD + 44, y + 322)
  } else ctx.fillText('this month.', PAD + 44, y + 204)
  y += 380 + 36

  // Four tiles.
  const tiles = [['Workouts', String(r.workouts)], ['Sets', String(r.sets)], ['Time', r.minutes ? hours(r.minutes) : '–'], ['Records', String(r.prs.length)]]
  const tw = (W - PAD * 2 - 3 * 20) / 4
  tiles.forEach(([k, v], i) => {
    const x = PAD + i * (tw + 20)
    ctx.fillStyle = '#1c1c1e'; roundRect(ctx, x, y, tw, 170, 28); ctx.fill()
    ctx.fillStyle = soft; ctx.font = `400 28px ${FONT}`; ctx.fillText(k, x + 24, y + 52)
    ctx.fillStyle = k === 'Records' && r.prs.length ? '#ffd60a' : '#ffffff'; ctx.font = `800 60px ${FONT}`; ctx.fillText(fit(ctx, v, tw - 40), x + 24, y + 128)
  })
  y += 170 + 76

  // Best lifts, then the rest.
  if (r.lifts.length) {
    ctx.fillStyle = soft; ctx.font = `600 30px ${FONT}`; ctx.fillText('BEST LIFTS · ESTIMATED 1RM', PAD, y)
    y += 60
    for (const l of r.lifts) {
      ctx.fillStyle = '#ffffff'; ctx.font = `600 42px ${FONT}`; ctx.fillText(fit(ctx, l.name, W - PAD * 2 - 260), PAD, y)
      ctx.font = `800 42px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`${fmt(Math.round(l.e1rm))} kg`, W - PAD, y); ctx.textAlign = 'left'
      y += 68
    }
    y += 16
  }
  const lines = [
    r.prs.length ? `Records in: ${r.prs.join(', ')}` : '',
    r.most ? `Most trained: ${r.most.name}, ${r.most.sets} sets` : '',
    r.weight ? `Body weight: ${signed(r.weight.change)}` : '',
  ].filter(Boolean)
  ctx.fillStyle = soft; ctx.font = `400 34px ${FONT}`
  for (const line of lines) { if (y > H - 150) break; ctx.fillText(fit(ctx, line, W - PAD * 2), PAD, y); y += 54 }
  ctx.fillStyle = 'rgba(235,235,245,.34)'; ctx.font = `400 28px ${FONT}`; ctx.fillText('zimboking.github.io/power-level', PAD, H - PAD)
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/png'))
}

export function RecapCard({ app }) {
  const { workouts, profile } = app.state
  const now = today().slice(0, 7)
  const [month, setMonth] = useState(now)
  const [busy, setBusy] = useState(false)
  const r = useMemo(() => monthRecap(workouts, profile.weighins || [], month), [workouts, profile.weighins, month])
  const share = async () => {
    setBusy(true)
    const res = await shareImage(() => recapCard(r), `power-level-${month}.png`, `My ${monthName(month)} on Power Level`, recapText(r, location.origin + location.pathname))
    setBusy(false)
    if (res === 'copied') app.toast('Recap copied. Paste it in the group chat.')
    else if (res === 'failed') app.toast('Couldn’t share from this browser.')
  }
  const cmp = liftedComparison(r.volume)
  return html`<div class="card recap">
    <div class="card-head"><p class="card-title">Month recap</p>
      <div class="recap-nav"><button class="icon-btn" aria-label="Previous month" onClick=${() => setMonth(shiftMonth(month, -1))}>‹</button><b>${monthName(month)}</b>
        <button class="icon-btn" aria-label="Next month" disabled=${month >= now} onClick=${() => setMonth(shiftMonth(month, 1))}>›</button></div></div>
    ${r.workouts === 0 ? html`<p class="muted small">No workouts logged in ${monthName(month)}.</p>` : html`
      <div class="recap-tiles">
        <div><small>Workouts</small><b class="tnum">${r.workouts}</b></div><div><small>Sets</small><b class="tnum">${r.sets}</b></div>
        <div><small>Time</small><b class="tnum">${r.minutes ? hours(r.minutes) : '–'}</b></div><div><small>Records</small><b class=${'tnum' + (r.prs.length ? ' gold' : '')}>${r.prs.length}</b></div>
      </div>
      <p><b>${formatKg(r.volume)}</b> lifted${cmp.best ? html`, about <b>${cmp.times >= 10 ? Math.round(cmp.times) : cmp.times.toFixed(1)} × ${cmp.best.name.replace(/^an? /, '')}</b>` : ''}.</p>
      ${r.lifts.length > 0 && html`<div class="kv">${r.lifts.map(l => html`<span>${l.name}</span><b>${fmt(Math.round(l.e1rm))} kg est. 1RM</b>`)}</div>`}
      <p class="muted small">${[r.prs.length ? `Records in ${r.prs.join(', ')}` : 'No new records this month', r.most && `most trained: ${r.most.name} (${r.most.sets} sets)`, r.weight && `body weight ${signed(r.weight.change)}`].filter(Boolean).join(' · ')}.</p>
      <button class="btn" disabled=${busy} onClick=${share}><${Icon} name="link" size=${18} /> ${busy ? 'Making the card…' : 'Share this month'}</button>`}
  </div>`
}
