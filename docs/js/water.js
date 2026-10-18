// CapySpa: water and drinks, ported from zimboking/Water-habit-app-2 (Apache 2.0).
// Days are stored like food: state.water['YYYY-MM-DD'] = { logs: [{ id, type, volume, ts, name? }], mood? }.
// Every total here is "net" ml = volume × the drink's hydration ratio.
import { addDays } from './schedule.js'

export const WATER_GOAL = 2500
export const GOAL_MIN = 1000
export const GOAL_MAX = 6000

export const BEVERAGES = {
  water: { label: 'Water', category: 'Water', emoji: '💧', note: 'The reference drink.' },
  tea: { label: 'Green Tea', category: 'Tea', emoji: '🍵', note: 'Hydrates like water at everyday intake.' },
  coffee: { label: 'Coffee', category: 'Coffee', emoji: '☕', note: 'Hydrates like water up to about 4 mugs a day.' },
  juice: { label: 'Juice', category: 'Juice', emoji: '🧃', note: 'Hydrates at least as well as water in lab tests.' },
}
export const TYPE_ORDER = ['water', 'tea', 'coffee', 'juice']

// Defaults follow the Beverage Hydration Index (Maughan et al., 2016) and Killer et al. (2014):
// at everyday intake, tea, coffee and juice hydrate like water.
export const DEFAULT_RATIOS = { water: 1, tea: 1, coffee: 1, juice: 1 }
export const RATIO_MIN = 0.5
export const RATIO_MAX = 1.5

export const QUICK_ADDS = [
  { type: 'water', volume: 250, label: 'Water', emoji: '💧' },
  { type: 'tea', volume: 300, label: 'Green Tea', emoji: '🍵' },
  { type: 'coffee', volume: 200, label: 'Americano', name: 'Americano', emoji: '☕' },
]

export const STAGES = [
  { at: 0, name: 'Shallow Soak', emoji: '♨️', unlock: 'calm capy and soft steam' },
  { at: 26, name: 'Towel Time', emoji: '🧺', unlock: 'a folded towel for Capy' },
  { at: 51, name: 'Yuzu Float', emoji: '🍋', unlock: 'yuzu floats and a rubber duck' },
  { at: 76, name: 'Golden Zen', emoji: '🐢', unlock: 'turtle buddy and bamboo spout' },
]

export const MOODS = {
  energy: { label: 'High Energy', emoji: '⚡', score: 4 },
  focused: { label: 'Focused', emoji: '😊', score: 3 },
  tired: { label: 'Tired', emoji: '😴', score: 2 },
  headachy: { label: 'Headachy', emoji: '🤕', score: 1 },
}
export const MOOD_ORDER = ['energy', 'focused', 'tired', 'headachy']

// The mood insight stays hidden until there is enough data to mean something.
export const INSIGHT_MIN_DAYS = 30
export const INSIGHT_MIN_PER_GROUP = 5

export const PERIODS = {
  morning: { label: 'Morning', range: '5am to 12pm' },
  afternoon: { label: 'Afternoon', range: '12pm to 5pm' },
  evening: { label: 'Evening', range: '5pm to 5am' },
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const pctOf = (total, goal) => Math.floor((total * 100) / goal)
export const stageFor = pct => (pct >= 76 ? 3 : pct >= 51 ? 2 : pct >= 26 ? 1 : 0)
export const periodOf = h => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening')
export const drinkName = log => log.name || BEVERAGES[log.type]?.label || 'Drink'

/** Is CapySpa switched on? On unless the person turned it off. */
export const capyOn = settings => settings?.capyspa !== false
export const ratiosOf = settings => ({ ...DEFAULT_RATIOS, ...(settings?.capyRatios || {}) })
export const goalOf = settings => clamp(Math.round(settings?.waterGoal || WATER_GOAL), GOAL_MIN, GOAL_MAX)

export const netOf = (log, ratios) => Math.round(log.volume * (ratios[log.type] ?? 1))
export const logsOf = (water, date) => water?.[date]?.logs || []
export const dayNet = (water, date, ratios) => logsOf(water, date).reduce((s, l) => s + netOf(l, ratios), 0)
export const dayVolume = (water, date) => logsOf(water, date).reduce((s, l) => s + l.volume, 0)

/** Local calendar date of a timestamp, as 'YYYY-MM-DD'. */
export function dateOf(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function toHHMM(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
/** A clock time on `date`. Drinks can't be in the future: a time later than now means the day before. */
export function tsFromHHMM(hhmm, date, now = Date.now()) {
  const [h, m] = String(hhmm).split(':').map(Number)
  const d = new Date(date + 'T00:00:00')
  d.setHours(h || 0, m || 0, 0, 0)
  const ts = d.getTime()
  return ts > now + 60000 ? ts - 864e5 : ts
}

const withLogs = (water, date, logs) => {
  const day = { ...(water[date] || {}), logs }
  const next = { ...water, [date]: day }
  if (!logs.length && !day.mood) delete next[date]
  return next
}

/** Add a drink to the day its time falls on. Returns { water, date }. */
export function addLog(water, log) {
  const date = dateOf(log.ts)
  return { water: withLogs(water, date, [...logsOf(water, date), log]), date }
}

const findLog = (water, id) => {
  for (const [date, day] of Object.entries(water)) {
    const log = (day.logs || []).find(l => l.id === id)
    if (log) return { date, log }
  }
  return null
}

/** Remove a drink. Returns { water, log, date } (log null when it wasn't found). */
export function removeLog(water, id) {
  const hit = findLog(water, id)
  if (!hit) return { water, log: null, date: null }
  return { water: withLogs(water, hit.date, logsOf(water, hit.date).filter(l => l.id !== id)), log: hit.log, date: hit.date }
}

/** Change a drink; it moves day if its new time falls on another date. Returns { water, dates }. */
export function updateLog(water, id, patch) {
  const hit = findLog(water, id)
  if (!hit) return { water, dates: [] }
  const log = { ...hit.log, ...patch }
  if (log.name === undefined) delete log.name
  const removed = removeLog(water, id).water
  const added = addLog(removed, log)
  return { water: added.water, dates: [...new Set([hit.date, added.date])] }
}

export function setMood(water, date, mood) {
  const day = { logs: [], ...(water[date] || {}), mood }
  if (!mood) delete day.mood
  return withLogs({ ...water, [date]: day }, date, day.logs)
}

/** Days in a row at or over the goal, ending today if today's goal is met, else yesterday. */
export function streak(water, ratios, goal, todayIso) {
  let n = dayNet(water, todayIso, ratios) >= goal ? 1 : 0
  for (let d = addDays(todayIso, -1); dayNet(water, d, ratios) >= goal; d = addDays(d, -1)) n++
  return n
}

/** What the next onsen stage needs. */
export function nextUnlock(total, goal) {
  const stage = stageFor(pctOf(total, goal))
  if (stage >= 3) return { stage, next: null, need: Math.max(0, goal - total) }
  const next = STAGES[stage + 1]
  return { stage, next, need: Math.max(0, Math.ceil((next.at * goal) / 100) - total) }
}

/** Net ml per clock hour, 0 to 23. */
export function hourly(logs, ratios) {
  const b = Array(24).fill(0)
  logs.forEach(l => { b[new Date(l.ts).getHours()] += netOf(l, ratios) })
  return b
}
export function periodTotals(buckets) {
  const t = { morning: 0, afternoon: 0, evening: 0 }
  buckets.forEach((v, h) => { t[periodOf(h)] += v })
  return t
}

/** Seven days of net totals ending today (weeksBack 0) or a week earlier (1). */
export function weekSeries(water, ratios, todayIso, weeksBack = 0) {
  const end = addDays(todayIso, -7 * weeksBack)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(end, i - 6)
    return { date, total: dayNet(water, date, ratios), today: date === todayIso }
  })
}

/** Volume per drink type. */
export function breakdown(logs) {
  const t = Object.fromEntries(TYPE_ORDER.map(k => [k, 0]))
  logs.forEach(l => { t[l.type] = (t[l.type] || 0) + l.volume })
  return t
}

/**
 * Mood vs hydration, from finished days only (today could still change). Ready once there are
 * INSIGHT_MIN_DAYS check-ins with at least INSIGHT_MIN_PER_GROUP days on each side of 90%.
 */
export function moodInsight(water, ratios, goal, todayIso) {
  const days = Object.entries(water)
    .filter(([date, d]) => date < todayIso && MOODS[d.mood])
    .map(([date, d]) => ({ date, mood: d.mood, total: dayNet(water, date, ratios) }))
  const hi = days.filter(d => d.total > goal * 0.9)
  const lo = days.filter(d => d.total <= goal * 0.9)
  const avg = arr => (arr.length ? arr.reduce((s, d) => s + MOODS[d.mood].score, 0) / arr.length : 0)
  const hiAvg = avg(hi), loAvg = avg(lo)
  const ready = days.length >= INSIGHT_MIN_DAYS && hi.length >= INSIGHT_MIN_PER_GROUP && lo.length >= INSIGHT_MIN_PER_GROUP
  return { ready, days: days.length, hiAvg, loAvg, hiN: hi.length, loN: lo.length, lift: ready && loAvg ? Math.round(((hiAvg - loAvg) / loAvg) * 100) : 0 }
}
