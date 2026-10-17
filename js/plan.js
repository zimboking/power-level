// Glue between history, goals and today's session: what should I lift right now, and why.
import { nextSessionTarget, applyFeeling, currentE1rm, exerciseHistory, warmupSets, bestE1rm } from './strength.js'
import { planJourney, guessLevel } from './journey.js'
import { exInfo, stepFor } from './exercises.js'

export const DEFAULT_CFG = { sets: 3, repsMin: 6, repsMax: 10, rir: 2 }

export function weeksSince(isoStart, isoNow) {
  const ms = new Date(isoNow + 'T00:00:00') - new Date(isoStart + 'T00:00:00')
  return Math.max(0, Math.floor(ms / (7 * 864e5)))
}

export function lastEntryFor(workouts, exId) {
  const h = exerciseHistory(workouts, exId)
  return h.length ? h[h.length - 1].entry : null
}

export function activeGoal(profile, exId) {
  return (profile.goals || []).find(g => g.exId === exId && !g.achieved) || null
}

export function latestBodyweight(profile) {
  const w = [...(profile.weighins || [])].sort((a, b) => a.date.localeCompare(b.date))
  return w.length ? w[w.length - 1].kg : null
}

export function journeyFor(goal, workouts, profile, todayIso) {
  const ex = exInfo(goal.exId)
  const current = currentE1rm(workouts, goal.exId) || goal.start
  const level = goal.level || guessLevel(current, latestBodyweight(profile), goal.exId)
  const offset = weeksSince(goal.startDate, todayIso)
  return { current, level, offset, ...planJourney({ start: current, goal: goal.target, level, step: stepFor(ex), startDate: todayIso, weekOffset: offset }) }
}

// Today's target for one exercise. A goal journey, if there is one, sets the week's
// sets × reps; otherwise the double-progression engine reads the last session.
export function targetFor({ exId, cfg = DEFAULT_CFG, workouts, profile, feeling, todayIso }) {
  const ex = exInfo(exId)
  const step = stepFor(ex)
  const goal = activeGoal(profile, exId)
  let target, nextCfg = cfg
  if (goal) {
    const j = journeyFor(goal, workouts, profile, todayIso)
    const wk = j.weeks[0]
    if (wk) {
      // Heavy low-rep weeks get longer rest unless you've set your own.
      nextCfg = { sets: wk.sets, repsMin: wk.reps, repsMax: wk.reps + (wk.reps >= 5 ? 2 : 1), rir: wk.rir, rest: cfg.rest || (wk.reps <= 3 ? 240 : wk.reps <= 5 ? 180 : undefined) }
      target = { w: wk.w, r: wk.reps, sets: wk.sets, kind: 'goal', why: `${goal.target} kg goal · week ${wk.week} · ${wk.phase}. ${wk.note}` }
    }
  }
  if (!target) target = nextSessionTarget(lastEntryFor(workouts, exId), cfg, step)
  // Bodyweight work has no load to add: progress reps instead (or strap on a dip belt).
  if (ex.eq === 'bodyweight' && !(target.w > 0)) {
    const r = target.kind === 'up' ? cfg.repsMax + 1 : target.r
    target = { ...target, w: 0, r, why: target.kind === 'up' ? `Every set hit ${cfg.repsMax}. Go for ${r}, or add a little weight with a belt.` : target.why.replace(/ Pick a weight.*$/, ' Do as many clean reps as you can.') }
  }
  return { target: applyFeeling(target, feeling, step), cfg: nextCfg, step }
}

export function buildEntry({ exId, cfg, group = null, workouts, profile, feeling, todayIso, withWarmups = false }) {
  const { target, cfg: c, step } = targetFor({ exId, cfg, workouts, profile, feeling, todayIso })
  const ex = exInfo(exId)
  const work = Array.from({ length: target.sets || c.sets }, () => ({ w: target.w || 0, r: target.r || c.repsMin, rir: null, done: false, auto: true }))
  const bar = ex.eq === 'barbell' ? profile.settings.bar || 20 : 0
  const warm = withWarmups && ex.eq === 'barbell' ? warmupSets(target.w, bar, step).map(s => ({ ...s, rir: null, done: false })) : []
  return { key: Math.random().toString(36).slice(2, 9), exId, cfg: c, group, target, sets: [...warm, ...work], advice: null }
}

export function bestEverE1rm(workouts, exId) {
  return exerciseHistory(workouts, exId).reduce((m, p) => Math.max(m, p.e1rm), 0)
}
export { bestE1rm }
