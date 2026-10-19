// Sharing a finished workout: a picture card (1080 × 1350, drawn on a canvas) plus the text
// summary, through the phone's share menu. Falls back to text, then to copying.
import { workoutText, setsLine } from '../workout-share.js'
import { workoutVolume } from '../strength.js'
import { liftedComparison, formatKg } from '../power.js'
import { exInfo } from '../exercises.js'
import { liftedSvg } from './lifted-art.js'

const W = 1080, H = 1350, PAD = 72
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'

const loadSvg = svg => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
})

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

/** The card as a PNG blob. */
export async function workoutCard(w, { prNames = [] } = {}) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#161618'); bg.addColorStop(1, '#0a0a0b')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  let y = PAD + 30
  ctx.fillStyle = '#30d158'; ctx.font = `700 34px ${FONT}`; ctx.fillText('POWER LEVEL', PAD, y)
  y += 76
  ctx.fillStyle = '#ffffff'; ctx.font = `700 72px ${FONT}`; ctx.fillText(fit(ctx, w.name, W - PAD * 2), PAD, y)
  y += 50
  const date = new Date(w.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  ctx.fillStyle = 'rgba(235,235,245,.62)'; ctx.font = `400 36px ${FONT}`
  ctx.fillText([date, w.durationMin ? `${w.durationMin} min` : ''].filter(Boolean).join(' · '), PAD, y)

  // Volume and what it compares to, with the drawing.
  const vol = workoutVolume(w)
  const cmp = liftedComparison(vol)
  y += 40
  ctx.fillStyle = '#1c1c1e'; roundRect(ctx, PAD, y, W - PAD * 2, 420, 36); ctx.fill()
  try { ctx.drawImage(await loadSvg(liftedSvg(cmp.best?.art || 'dumbbell', { width: 560, height: 350 })), W - PAD - 560 - 20, y + 40, 560, 350) } catch { /* no drawing */ }
  ctx.fillStyle = '#ffffff'; ctx.font = `800 96px ${FONT}`; ctx.fillText(vol > 0 ? formatKg(vol) : 'Done', PAD + 44, y + 150)
  ctx.fillStyle = 'rgba(235,235,245,.62)'; ctx.font = `400 34px ${FONT}`
  if (cmp.best) {
    ctx.fillText('That’s about', PAD + 44, y + 220)
    ctx.fillStyle = '#ffd60a'; ctx.font = `700 46px ${FONT}`
    ctx.fillText(`${cmp.times >= 10 ? Math.round(cmp.times) : cmp.times.toFixed(1)} ×`, PAD + 44, y + 282)
    ctx.fillStyle = '#ffffff'; ctx.font = `600 38px ${FONT}`
    ctx.fillText(cmp.best.name.replace(/^an? /, ''), PAD + 44, y + 334)
  } else ctx.fillText(vol > 0 ? 'Every kilo counts.' : 'Session logged.', PAD + 44, y + 220)
  y += 420 + 70

  // Exercises.
  const rows = w.entries.slice(0, 7)
  for (const e of rows) {
    const name = exInfo(e.exId).name
    const pr = prNames.includes(name)
    ctx.fillStyle = '#ffffff'; ctx.font = `600 38px ${FONT}`
    ctx.fillText(fit(ctx, name, W - PAD * 2 - (pr ? 120 : 0)), PAD, y)
    if (pr) { ctx.fillStyle = '#ffd60a'; roundRect(ctx, W - PAD - 96, y - 34, 96, 44, 10); ctx.fill(); ctx.fillStyle = '#000'; ctx.font = `800 26px ${FONT}`; ctx.fillText('PR', W - PAD - 66, y - 3) }
    y += 46
    ctx.fillStyle = 'rgba(235,235,245,.62)'; ctx.font = `400 32px ${FONT}`
    ctx.fillText(fit(ctx, setsLine(e), W - PAD * 2), PAD, y)
    y += 66
    if (y > H - 150) break
  }
  if (w.entries.length > rows.length) { ctx.fillStyle = 'rgba(235,235,245,.62)'; ctx.font = `400 30px ${FONT}`; ctx.fillText(`+ ${w.entries.length - rows.length} more`, PAD, y) }
  ctx.fillStyle = 'rgba(235,235,245,.34)'; ctx.font = `400 28px ${FONT}`; ctx.fillText('zimboking.github.io/power-level', PAD, H - PAD)
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/png'))
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

/**
 * Shares a workout: picture + text where the phone allows it, else text, else copies the text.
 * Returns 'shared' | 'copied' | 'cancelled' | { text } (when nothing worked, to show it).
 */
export async function shareWorkout(w, { prNames = [] } = {}) {
  const url = location.origin + location.pathname
  const text = workoutText(w, { prNames, url })
  const title = `${w.name}: a Power Level workout`
  try {
    if (navigator.share) {
      let file = null
      try { file = new File([await workoutCard(w, { prNames })], `power-level-${w.date}.png`, { type: 'image/png' }) } catch { file = null }
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title, text })
      else await navigator.share({ title, text })
      return 'shared'
    }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  try { await navigator.clipboard.writeText(text); return 'copied' } catch { return { text } }
}
