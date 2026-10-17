// Progression rules, per routine or per exercise. Every target is derived from the log, says why
// it is that number, never adds load after missed reps, and deloads after repeated stalls.
import { nextSessionTarget, isWork, setDone, snap, round1, e1rm, weightFor } from './strength.js'

export const POLICIES = {
  double: { name: 'Double progression', desc: 'Work up through the rep range at one weight. Top of the range on every set → more weight, back to the bottom.' },
  linear: { name: 'Linear', desc: 'Hit every rep on every set and the weight goes up next time. Three misses in a row → 10 % deload.' },
  greyskull: { name: 'Greyskull LP', desc: 'Straight sets plus a last set as many reps as possible. Beat the target → up (twice as much at 10+ reps). Miss → 10 % deload.' },
  triple: { name: 'Triple progression', desc: 'Reps climb to the top of the range, then a set is added, up to your most sets. All at the top → more weight, back to your first sets and reps.' },
  time: { name: 'Add time', desc: 'Hold every set for the full time and the target goes up 5 seconds.' },
  off: { name: 'Manual', desc: 'Targets stay where you set them: same as last time.' },
}
export const DELOAD = 0.9
const STALLS_TO_DELOAD = { linear: 3, double: 3, triple: 3, time: 3, greyskull: 1 }

const workSets = entry => (entry?.sets || []).filter(s => isWork(s) && setDone(s))

/** Did this session hit its own target? Missing sets count as misses. */
export function sessionHit(entry, cfg) {
  const work = workSets(entry)
  const want = entry?.target?.sets || cfg.sets
  if (work.length < want) return false
  if (cfg.mode === 'time') return work.every(s => (s.sec || 0) >= (entry?.target?.sec || cfg.sec || 0))
  const goal = entry?.target?.r || cfg.repsMin
  return work.every(s => s.r >= goal)
}

// Consecutive most-recent sessions that missed.
export function stallCount(history, cfg) {
  let n = 0
  for (let i = history.length - 1; i >= 0; i--) { if (sessionHit(history[i], cfg)) break; n++ }
  return n
}

const deload = (w, step) => Math.max(step, snap(w * DELOAD, step))

/**
 * @param history  past entries of this exercise, oldest first (each {sets, target?})
 * @param cfg      {policy, sets, setsMax?, repsMin, repsMax, rir, sec?, w?}
 * @returns {w, r, sets, sec?, kind, why}
 */
export function nextTarget(history, cfg, step = 2.5) {
  const policy = POLICIES[cfg.policy] ? cfg.policy : 'double'
  const last = history[history.length - 1]
  const work = workSets(last)
  const sets = cfg.sets || 3
  if (policy === 'time') return timeTarget(history, cfg)
  if (!work.length) return { w: cfg.w || 0, r: cfg.repsMin, sets, kind: 'first', why: `Nothing logged yet. Pick a weight you could do about ${cfg.repsMin + (cfg.rir ?? 2)} reps with.` }
  const top = Math.max(...work.map(s => s.w || 0))
  const stalls = stallCount(history, cfg)
  if (policy === 'off') return { w: top, r: last.target?.r || cfg.repsMin, sets, kind: 'hold', why: 'Manual: same as last time.' }
  if (policy === 'double') {
    const t = nextSessionTarget(last, cfg, step)
    if (t.kind === 'down' && stalls >= STALLS_TO_DELOAD.double) return { ...t, w: deload(top, step), kind: 'deload', why: `${stalls} sessions short in a row. Deload to ${deload(top, step)} kg and build back up.` }
    return t
  }
  if (policy === 'linear') {
    const r = cfg.repsMin
    if (sessionHit(last, cfg)) return { w: snap(top + step, step), r, sets, kind: 'up', why: `Every rep last time. ${step} kg more.` }
    if (stalls >= STALLS_TO_DELOAD.linear) return { w: deload(top, step), r, sets, kind: 'deload', why: `Missed reps ${stalls} sessions running. 10 % deload to ${deload(top, step)} kg.` }
    return { w: top, r, sets, kind: 'hold', why: `Missed reps last time, so the weight stays at ${top} kg. Missed reps never add load.` }
  }
  if (policy === 'greyskull') {
    const r = cfg.repsMin
    const amrap = work[work.length - 1]
    const straightOk = work.slice(0, -1).every(s => s.r >= r) && work.length >= sets
    if (!straightOk || amrap.r < r) return { w: deload(top, step), r, sets, kind: 'deload', why: `Fell short of ${r} reps. Reset 10 % to ${deload(top, step)} kg.` }
    const jump = amrap.r >= 10 ? step * 2 : step
    return { w: snap(top + jump, step), r, sets, kind: 'up', amrap: true, why: `Last set went to ${amrap.r} reps. ${jump} kg more${jump > step ? ' (doubled for 10+)' : ''}. Take the last set as far as you can.` }
  }
  // triple: reps, then sets, then load
  const setsMin = cfg.sets || 3, setsMax = Math.max(setsMin, cfg.setsMax || setsMin + 2)
  const lastSets = Math.max(setsMin, last.target?.sets || work.length)
  const allTop = work.length >= lastSets && work.every(s => s.r >= cfg.repsMax)
  const allIn = work.length >= lastSets && work.every(s => s.r >= cfg.repsMin)
  if (allTop && lastSets < setsMax) return { w: top, r: cfg.repsMin, sets: lastSets + 1, kind: 'sets', why: `Top of the range on all ${lastSets} sets. Add a set: ${lastSets + 1} × ${cfg.repsMin}.` }
  if (allTop) return { w: snap(top + step, step), r: cfg.repsMin, sets: setsMin, kind: 'up', why: `All ${setsMax} sets at ${cfg.repsMax}. ${step} kg more, back to ${setsMin} × ${cfg.repsMin}.` }
  if (allIn) { const r = Math.min(cfg.repsMax, Math.min(...work.map(s => s.r)) + 1); return { w: top, r, sets: lastSets, kind: 'reps', why: `In range on every set. Aim for ${r} reps.` } }
  if (stalls >= STALLS_TO_DELOAD.triple) return { w: deload(top, step), r: cfg.repsMin, sets: setsMin, kind: 'deload', why: `${stalls} short sessions. Deload to ${deload(top, step)} kg.` }
  return { w: top, r: cfg.repsMin, sets: lastSets, kind: 'hold', why: 'Came up short. Same again.' }
}

function timeTarget(history, cfg) {
  const last = history[history.length - 1]
  const sets = cfg.sets || 3
  const base = last?.target?.sec || cfg.sec || 30
  if (!workSets(last).length) return { w: 0, sec: base, sets, kind: 'first', why: `Hold each set for ${base} s.` }
  if (sessionHit(last, { ...cfg, mode: 'time' })) return { w: 0, sec: base + 5, sets, kind: 'up', why: `Held every set for ${base} s. Up to ${base + 5} s.` }
  if (stallCount(history, { ...cfg, mode: 'time' }) >= 3) return { w: 0, sec: Math.max(10, Math.round(base * DELOAD / 5) * 5), sets, kind: 'deload', why: 'Short three times running. Back off and build again.' }
  return { w: 0, sec: base, sets, kind: 'hold', why: `Short of ${base} s last time. Same target.` }
}

// Effort: stored as RIR, shown as RIR or RPE (RPE = 10 − RIR).
export const EFFORT = [
  { rir: 0, label: 'Nothing left', line: 'Couldn’t have done another rep.', tone: 'e0' },
  { rir: 1, label: 'One more, just', line: 'Maybe one more with a grind.', tone: 'e1' },
  { rir: 2, label: 'Two in the tank', line: 'Hard, solid working set.', tone: 'e2' },
  { rir: 3, label: 'Three in the tank', line: 'Comfortable and controlled.', tone: 'e3' },
  { rir: 4, label: 'Easy', line: 'Four or more left. Warm-up territory.', tone: 'e4' },
]
export const effortLabel = (rir, scale) => (rir == null ? (scale === 'rpe' ? 'RPE' : 'RIR') : scale === 'rpe' ? 'RPE ' + (10 - Math.min(4, rir)) : 'RIR ' + (rir >= 4 ? '4+' : rir))
export const effortTone = rir => (rir == null ? '' : EFFORT[Math.min(4, rir)].tone)

export { round1, e1rm, weightFor }
