// Steps: one number a day, typed in or brought across from the phone's health app. A web page
// can't read Apple Health, Health Connect or Garmin directly, so nothing here counts steps itself.
// Stored on the profile: profile.steps = { 'YYYY-MM-DD': n }, goal in settings.stepGoal.
import { addDays } from './schedule.js'

export const STEP_GOAL = 8000
export const STEP_GOAL_MIN = 1000
export const STEP_GOAL_MAX = 40000
export const STEPS_MAX = 150000 // more than anyone walks in a day; anything above is a typo

export const stepsOn = settings => settings?.steps !== false
export const stepGoalOf = settings => {
  const g = Math.round(Number(settings?.stepGoal))
  return Number.isFinite(g) && g > 0 ? Math.max(STEP_GOAL_MIN, Math.min(STEP_GOAL_MAX, g)) : STEP_GOAL
}

/** A whole number of steps from typed or pasted text ("12,345", "12 345 steps"), or null. */
export function parseSteps(text) {
  const m = /\d[\d,.\s  ]*/.exec(String(text ?? ''))
  if (!m) return null
  const n = Number(m[0].replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n >= 0 && n <= STEPS_MAX ? n : null
}

export const stepsOf = (steps, date) => steps?.[date] || 0

/** A copy of the log with `date` set to `n` (0 or nothing clears the day). */
export function setSteps(steps, date, n) {
  const next = { ...(steps || {}) }
  const v = parseSteps(n)
  if (v) next[date] = v
  else delete next[date]
  return next
}

/** Seven days ending on `todayIso`: [{ date, steps, today }]. */
export function stepsWeek(steps, todayIso) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(todayIso, i - 6)
    return { date, steps: stepsOf(steps, date), today: date === todayIso }
  })
}

/** Average over the days in the week that have steps logged (0 when none do). */
export function stepsAverage(week) {
  const logged = week.filter(d => d.steps > 0)
  return logged.length ? Math.round(logged.reduce((s, d) => s + d.steps, 0) / logged.length) : 0
}

/** Days in a row at or over the goal, ending today if today is there already, else yesterday. */
export function stepStreak(steps, goal, todayIso) {
  let n = stepsOf(steps, todayIso) >= goal ? 1 : 0
  for (let d = addDays(todayIso, -1); stepsOf(steps, d) >= goal; d = addDays(d, -1)) n++
  return n
}

/**
 * Steps handed over in a link: #steps=12345 or #steps=12345&date=2026-11-13 (a Shortcut or
 * automation on the phone can open it). Returns { date, steps } or null. Untrusted input: the
 * number is range-checked and the date must be a real day that isn't in the future.
 */
export function stepsFromHash(hash, todayIso) {
  const m = /^#?steps=(\d{1,6})(?:&date=(\d{4}-\d{2}-\d{2}))?$/.exec(hash || '')
  if (!m) return null
  const steps = Number(m[1])
  if (steps > STEPS_MAX) return null
  const date = m[2] || todayIso
  const d = new Date(date + 'T12:00:00')
  if (Number.isNaN(d.getTime()) || addDays(date, 0) !== date || date > todayIso) return null
  return { date, steps }
}
