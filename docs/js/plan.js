// What should I lift right now, and why. A goal journey (if any) sets the week's sets × reps;
// otherwise the exercise's progression rule reads its history. Feeling rough eases the loads.
import { applyFeeling, currentE1rm, exerciseHistory, warmupSets, bestE1rm, feelingFactor, snap } from './strength.js'
import { nextTarget, POLICIES } from './progression.js'
import { planJourney, guessLevel } from './journey.js'
import { exInfo, stepFor, isTimed, isBodyweight, barWeight } from './exercises.js'

export const DEFAULT_CFG = { sets: 3, repsMin: 6, repsMax: 10, rir: 2 }

export function weeksSince(isoStart, isoNow) {
  const ms = new Date(isoNow + 'T00:00:00') - new Date(isoStart + 'T00:00:00')
  return Math.max(0, Math.floor(ms / (7 * 864e5)))
}

// Every logged entry of an exercise, oldest first, including ones with no estimable 1RM.
export function entriesFor(workouts, exId) {
  return [...workouts].sort((a, b) => a.date.localeCompare(b.date)).flatMap(w => (w.entries || []).filter(e => e.exId === exId).map(e => ({ ...e, date: w.date })))
}
export const lastEntryFor = (workouts, exId) => entriesFor(workouts, exId).filter(e => e.sets?.some(s => s.done && !s.warmup)).pop() || null

export const activeGoal = (profile, exId) => (profile.goals || []).find(g => g.exId === exId && !g.achieved) || null
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

export const policyOf = (cfg, ex) => (cfg.pyramid ? 'off' : POLICIES[cfg.prog] ? cfg.prog : isTimed(ex) ? 'time' : 'double')

export function targetFor({ exId, cfg = DEFAULT_CFG, workouts, profile, feeling, todayIso }) {
  const ex = exInfo(exId)
  const step = stepFor(ex)
  const goal = isTimed(ex) ? null : activeGoal(profile, exId)
  let target, nextCfg = { ...cfg }
  if (goal) {
    const wk = journeyFor(goal, workouts, profile, todayIso).weeks[0]
    if (wk) {
      // Heavy low-rep weeks get longer rest unless you've set your own.
      nextCfg = { ...cfg, sets: wk.sets, repsMin: wk.reps, repsMax: wk.reps + (wk.reps >= 5 ? 2 : 1), rir: wk.rir, rest: cfg.rest || (wk.reps <= 3 ? 240 : wk.reps <= 5 ? 180 : undefined), goal: true }
      target = { w: wk.w, r: wk.reps, sets: wk.sets, kind: 'goal', why: `${goal.target} kg goal · week ${wk.week} · ${wk.phase}. ${wk.note}` }
    }
  }
  if (!target) {
    const history = entriesFor(workouts, exId).filter(e => e.sets?.some(s => s.done && !s.warmup))
    target = nextTarget(history, { ...cfg, policy: policyOf(cfg, ex), mode: ex.mode, sec: cfg.sec || cfg.repsMin }, step)
  }
  // Bodyweight work carries no load: progress reps (or strap on a dip belt).
  if (isBodyweight(ex) && !(target.w > 0) && target.kind === 'up' && !isTimed(ex)) {
    target = { ...target, w: 0, r: (cfg.repsMax || target.r) + 1, why: `Every set hit ${cfg.repsMax}. Go for ${(cfg.repsMax || 0) + 1}, or add weight with a belt.` }
  }
  return { target: applyFeeling(target, feeling, step), cfg: nextCfg, step }
}

// Pyramid sets keep their own weight, reps and rest per set, read from last time (or the routine).
function pyramidSets(cfg, workouts, exId, feeling, step) {
  const last = lastEntryFor(workouts, exId)
  const lastWork = (last?.sets || []).filter(s => !s.warmup)
  const plan = cfg.pyramidSets || []
  const n = Math.max(plan.length, lastWork.length, cfg.sets || 0)
  const f = feelingFactor(feeling)
  return Array.from({ length: n }, (_, i) => {
    const p = plan[i] || {}, l = lastWork[i] || {}
    const w = l.w ?? p.w ?? 0
    return { w: f < 1 && w > 0 ? snap(w * f, step) : w, r: p.r ?? l.r ?? cfg.repsMin, rest: p.rest ?? l.rest, rir: null, done: false, auto: true }
  })
}

export function buildEntry({ exId, cfg, group = null, workouts, profile, feeling, todayIso, withWarmups = false }) {
  const { target, cfg: c, step } = targetFor({ exId, cfg, workouts, profile, feeling, todayIso })
  const ex = exInfo(exId)
  const n = target.sets || c.sets
  const work = c.pyramid ? pyramidSets(c, workouts, exId, feeling, step)
    : Array.from({ length: n }, () => (isTimed(ex) ? { w: target.w || 0, sec: target.sec || c.sec || 30, rir: null, done: false, auto: true } : { w: target.w || 0, r: target.r || c.repsMin, rir: null, done: false, auto: true }))
  if (target.amrap && work.length) work[work.length - 1] = { ...work[work.length - 1], failure: true }
  const bar = barWeight(ex, profile.settings)
  const firstW = work[0]?.w || target.w
  const warm = withWarmups && bar > 0 ? warmupSets(firstW, bar, step).map(s => ({ ...s, rir: null, done: false })) : []
  return { key: Math.random().toString(36).slice(2, 9), exId, cfg: c, group, target, sets: [...warm, ...work], advice: null }
}

export const bestEverE1rm = (workouts, exId) => exerciseHistory(workouts, exId).reduce((m, p) => Math.max(m, p.e1rm), 0)

/** "Last time (7 Sept): 75×8 (RIR 3), …" */
export function lastTimeLine(workouts, exId, scaleLabel) {
  const last = lastEntryFor(workouts, exId)
  if (!last) return null
  const sets = last.sets.filter(s => s.done && !s.warmup).map(s => (s.sec ? `${s.w ? s.w + ' kg × ' : ''}${s.sec}s` : `${s.w ? s.w + '×' : ''}${s.r}${s.rir != null ? ` (${scaleLabel(s.rir)})` : ''}`))
  return { date: last.date, text: sets.join(', ') }
}
export { bestE1rm }
