// Stats tiles, the year heatmap and strength-balance ratios.
import { addDays, weekOf, daysBetween } from './schedule.js'
import { currentE1rm } from './strength.js'

export function streakWeeks(workouts, todayIso, weekStart = 1) {
  const weeks = new Set(workouts.map(w => weekOf(w.date, weekStart)[0]))
  let start = weekOf(todayIso, weekStart)[0]
  if (!weeks.has(start)) start = addDays(start, -7) // this week isn't over yet
  let n = 0
  while (weeks.has(start)) { n++; start = addDays(start, -7) }
  return n
}

export const thisMonth = (workouts, todayIso) => workouts.filter(w => w.date.slice(0, 7) === todayIso.slice(0, 7)).length

/** Weight change over the last 30 days, from the weigh-ins either side. */
export function weightChange30(weighins, todayIso) {
  const sorted = [...weighins].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return null
  const last = sorted[sorted.length - 1]
  const base = sorted.filter(w => daysBetween(w.date, last.date) >= 25).pop() || sorted[0]
  if (base === last || daysBetween(last.date, todayIso) > 30) return null
  return Math.round((last.kg - base.kg) * 10) / 10
}

/** 53 columns of 7 days, ending this week. level 0–4 by minutes trained that day. */
export function heatmap(workouts, todayIso, weekStart = 1, weeks = 53) {
  const mins = {}
  for (const w of workouts) mins[w.date] = (mins[w.date] || 0) + Math.max(w.durationMin || 45, 1)
  const end = weekOf(todayIso, weekStart)[6]
  const first = addDays(end, -(weeks * 7 - 1))
  const cols = []
  for (let c = 0; c < weeks; c++) {
    cols.push(Array.from({ length: 7 }, (_, r) => {
      const date = addDays(first, c * 7 + r)
      const m = mins[date] || 0
      return { date, mins: m, future: date > todayIso, level: !m ? 0 : m < 30 ? 1 : m < 50 ? 2 : m < 75 ? 3 : 4 }
    }))
  }
  return cols
}

// Rule-of-thumb strength ratios, relative to the back squat = 100. These are rough guides used
// by many coaches, not a standard; a lift well below its line is the one most worth a push.
export const BALANCE = [
  { exId: 'squat', ratio: 1 },
  { exId: 'deadlift', ratio: 1.2 },
  { exId: 'bench', ratio: 0.75 },
  { exId: 'ohp', ratio: 0.47 },
  { exId: 'row', ratio: 0.6 },
  { exId: 'frontsquat', ratio: 0.85 },
]
export function balance(workouts) {
  const lifts = BALANCE.map(b => ({ ...b, e1rm: currentE1rm(workouts, b.exId) })).filter(b => b.e1rm)
  if (lifts.length < 2) return null
  // Anchor on the lift that implies the highest squat, so every other lift reads as at or below.
  const squatEq = Math.max(...lifts.map(l => l.e1rm / l.ratio))
  return lifts.map(l => {
    const expected = Math.round(squatEq * l.ratio)
    const pct = Math.round((l.e1rm / expected) * 100)
    return { ...l, expected, pct, status: pct >= 95 ? 'good' : pct >= 85 ? 'ok' : 'low' }
  })
}
