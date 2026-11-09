// Reopening a finished workout: back to a live session with its ticked sets, plus the unticked
// ones when it's the workout you just finished. No UI here, so it can be tested.
import { DEFAULT_CFG } from './plan.js'
import { addDays } from './schedule.js'

/** Workouts from today or yesterday can be picked up again; older ones are edited instead. */
export const canResume = (w, todayIso) => !!w && w.date >= addDays(todayIso, -1) && w.date <= todayIso

/** What to keep when a workout is finished, so "Keep going" can bring back the unticked sets. */
export const lastFinishedFor = (session, workoutId) => ({ workoutId, session })

const key = () => Math.random().toString(36).slice(2, 9)

/**
 * The live session for workout `w`. `last` is profile.lastFinished. The session clock is wound
 * back by the minutes already logged, so time spent away isn't counted.
 */
export function resumeSession(w, last, now = Date.now()) {
  const startedAt = now - (w.durationMin || 0) * 60000
  if (last?.workoutId === w.id && last.session?.entries?.length) return { ...last.session, id: w.id, date: w.date, startedAt }
  return {
    id: w.id, date: w.date, startedAt, feeling: w.feeling || 'great', note: w.note || '', name: w.name || 'Workout', routineId: w.routineId || null, focus: 0,
    entries: (w.entries || []).map(e => ({
      key: key(), exId: e.exId, group: e.group || null, ...(e.note ? { note: e.note } : {}),
      cfg: { ...DEFAULT_CFG, ...(e.cfg || {}) }, target: e.target || { kind: 'hold', why: 'As logged.' },
      sets: (e.sets || []).map(s => ({ ...s, done: true, auto: false })), advice: null,
    })),
  }
}

/** Sets ticked and planned (warm-ups not counted), for the finish check. */
export function setCounts(session) {
  let done = 0, total = 0
  for (const e of session?.entries || []) for (const s of e.sets || []) if (!s.warmup) { total++; if (s.done) done++ }
  return { done, total }
}
