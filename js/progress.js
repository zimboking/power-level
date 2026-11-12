// Progress numbers behind the Stats charts: a lift over time, body weight against food, and the
// month's recap. No UI here, so it can be tested.
import { exerciseHistory, workoutVolume } from './strength.js'
import { sumEntries } from './nutrition.js'
import { prNamesFor } from './records.js'
import { exInfo } from './exercises.js'
import { addDays, weekOf } from './schedule.js'

export const LIFT_METRICS = [
  { value: 'e1rm', label: 'Est. 1RM', unit: 'kg' },
  { value: 'top', label: 'Top set', unit: 'kg' },
  { value: 'volume', label: 'Volume', unit: 'kg' },
]
const topWeight = entry => Math.max(0, ...(entry.sets || []).filter(s => s.done && !s.warmup).map(s => Number(s.w) || 0))

/** One point per session for an exercise: [{ date, y, flag }]. `since` is an ISO date or null. */
export function liftSeries(workouts, exId, metric = 'e1rm', since = null) {
  return exerciseHistory(workouts, exId)
    .filter(p => !since || p.date >= since)
    .map(p => ({ date: p.date, y: metric === 'top' ? topWeight(p.entry) : metric === 'volume' ? p.volume : p.e1rm, flag: p.feeling !== 'great' }))
    .filter(p => p.y > 0)
}

/** First to last, for the line under the chart: { from, to, change, pct } or null. */
export function seriesChange(points) {
  if (points.length < 2) return null
  const from = points[0].y, to = points[points.length - 1].y
  return { from, to, change: to - from, pct: from ? ((to - from) / from) * 100 : 0 }
}

export const KCAL_PER_KG = 7700 // rule of thumb for body fat; real weight change also moves water
const MIN_FOOD_DAYS = 4 // a week needs this many logged days before its average counts
const MIN_WEEKS = 3

const mean = list => list.reduce((s, v) => s + v, 0) / list.length
/** Least-squares slope of y over x. */
function slope(points) {
  const mx = mean(points.map(p => p.x)), my = mean(points.map(p => p.y))
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  return den ? points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / den : 0
}

/**
 * Body weight against food, week by week (oldest first, `weeks` of them ending this week).
 * rows: [{ start, kg, kcal, p, days }] where kg is the week's average weigh-in (null if none) and
 * kcal / p the average of logged days (null under MIN_FOOD_DAYS).
 * summary (null until MIN_WEEKS weeks have both): { weeks, kgPerWeek, kcal, maintenance }, where
 * maintenance is what the trend suggests you burn a day: intake minus the energy in the weight change.
 */
export function weightVsFood(weighins, food, todayIso, weeks = 8, weekStart = 1) {
  const first = weekOf(todayIso, weekStart)[0]
  const rows = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(first, -7 * (weeks - 1 - i))
    const dates = Array.from({ length: 7 }, (_, d) => addDays(start, d))
    const kgs = (weighins || []).filter(w => dates.includes(w.date) && w.kg > 0).map(w => w.kg)
    const days = dates.map(d => sumEntries(food?.[d])).filter(t => t.kcal > 0)
    const enough = days.length >= MIN_FOOD_DAYS
    return { start, kg: kgs.length ? mean(kgs) : null, kcal: enough ? mean(days.map(t => t.kcal)) : null, p: enough ? mean(days.map(t => t.p)) : null, days: days.length }
  })
  const both = rows.map((r, x) => ({ ...r, x })).filter(r => r.kg != null && r.kcal != null)
  if (both.length < MIN_WEEKS) return { rows, summary: null }
  const kgPerWeek = slope(both.map(r => ({ x: r.x, y: r.kg })))
  const kcal = mean(both.map(r => r.kcal))
  return { rows, summary: { weeks: both.length, kgPerWeek, kcal, maintenance: kcal - (kgPerWeek * KCAL_PER_KG) / 7 } }
}

const monthOf = iso => iso.slice(0, 7)
export const shiftMonth = (month, n) => {
  const d = new Date(month + '-15T12:00:00')
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * A month in numbers. `month` is 'YYYY-MM'.
 * { month, workouts, days, minutes, sets, volume, prs: [exercise names], lifts: [{ name, e1rm }] (best
 *   three by estimated 1RM), most: { name, sets } | null, weight: { from, to, change } | null }
 */
export function monthRecap(workouts, weighins, month) {
  const mine = (workouts || []).filter(w => monthOf(w.date) === month)
  const sets = e => (e.sets || []).filter(s => s.done !== false && !s.warmup).length
  const perEx = new Map()
  for (const w of mine) for (const e of w.entries || []) perEx.set(e.exId, (perEx.get(e.exId) || 0) + sets(e))
  const most = [...perEx.entries()].sort((a, b) => b[1] - a[1])[0]
  const lifts = [...perEx.keys()]
    .map(id => ({ name: exInfo(id).name, e1rm: Math.max(0, ...exerciseHistory(mine, id).map(p => p.e1rm)) }))
    .filter(l => l.e1rm > 0).sort((a, b) => b.e1rm - a.e1rm).slice(0, 3)
  const weighs = (weighins || []).filter(w => monthOf(w.date) === month && w.kg > 0).sort((a, b) => a.date.localeCompare(b.date))
  return {
    month,
    workouts: mine.length,
    days: new Set(mine.map(w => w.date)).size,
    minutes: mine.reduce((s, w) => s + (w.durationMin || 0), 0),
    sets: [...perEx.values()].reduce((s, n) => s + n, 0),
    volume: mine.reduce((s, w) => s + workoutVolume(w), 0),
    prs: [...new Set(mine.flatMap(w => prNamesFor(workouts, w)))],
    lifts,
    most: most && most[1] > 0 ? { name: exInfo(most[0]).name, sets: most[1] } : null,
    weight: weighs.length > 1 ? { from: weighs[0].kg, to: weighs[weighs.length - 1].kg, change: weighs[weighs.length - 1].kg - weighs[0].kg } : null,
  }
}
