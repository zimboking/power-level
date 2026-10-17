// Strength maths. Every function is pure: the workout log is the only source of truth and
// targets are derived from it each time they are needed (the same idea openGym uses), so a
// fixed typo or a changed setting immediately produces the right next number.

// RTS / Tuchscherer %1RM table: index 0 = 1 rep to failure ... index 11 = 12 reps to failure.
const RIR_PCT = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.5]
export const REP_CAP = 12
export const DEFAULT_STEP = 2.5

const round1 = v => Math.round(v * 10) / 10
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function snap(weight, step = DEFAULT_STEP) {
  if (!(step > 0)) return round1(weight)
  return round1(Math.round(weight / step) * step)
}

// Fraction of 1RM you can lift for `reps` with `rir` reps left in the tank.
export function pctOf1RM(reps, rir = 0) {
  const effective = Math.round(reps + rir)
  if (effective < 1) return 1
  if (effective <= REP_CAP) return RIR_PCT[effective - 1] / 100
  return 1 / (1 + effective / 30) // Epley beyond the table, it only drifts at high reps
}

// Estimated 1RM from a set. RIR counts as reps you could have done. Null when unusable.
export function e1rm(weight, reps, rir = 0) {
  // RIR guesses past 3 are unreliable, so they count as 3.
  const w = Number(weight), r = Number(reps), x = Math.min(3, Number(rir) || 0)
  if (!(w > 0) || !(r >= 1)) return null
  if (r + x > 20) return null // a set of 20+ says more about endurance than strength
  return round1(w / pctOf1RM(r, x))
}

// The load that should give exactly `reps` at `rir` for a lifter with this 1RM.
export function weightFor(oneRm, reps, rir = 2, step = DEFAULT_STEP) {
  if (!(oneRm > 0)) return 0
  return snap(oneRm * pctOf1RM(reps, rir), step)
}

export const isWork = set => !set.warmup
export const setDone = set => !!set.done && set.r > 0

// Best e1RM in a logged session for one exercise entry.
export function bestE1rm(entry) {
  let best = null
  for (const s of entry.sets || []) {
    if (!isWork(s) || !setDone(s)) continue
    const v = e1rm(s.w, s.r, s.rir ?? 0)
    if (v && (best == null || v > best)) best = v
  }
  return best
}

export function entryVolume(entry) {
  return (entry.sets || []).reduce((sum, s) => (isWork(s) && setDone(s) ? sum + (s.w || 0) * s.r : sum), 0)
}
export const workoutVolume = w => (w.entries || []).reduce((sum, e) => sum + entryVolume(e), 0)

// Ramp-up sets for a working weight. Bar × 10, then roughly 40 / 60 / 80 %.
export function warmupSets(workWeight, bar = 20, step = DEFAULT_STEP) {
  if (!(workWeight > bar)) return []
  const ramp = [[0, 10], [0.4, 8], [0.6, 5], [0.8, 3]]
  const out = []
  for (const [pct, reps] of ramp) {
    const w = pct === 0 ? bar : Math.max(bar, snap(workWeight * pct, step))
    if (w >= workWeight) continue
    if (out.length && out[out.length - 1].w === w) continue
    out.push({ w, r: reps, warmup: true })
  }
  return out
}

// Plates per side. Greedy works for standard plate sets; the remainder says what is left over.
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]
export function platesFor(weight, bar = 20, plates = DEFAULT_PLATES) {
  let side = round1((weight - bar) / 2)
  if (side < 0) return { perSide: [], remainder: round1(weight - bar), ok: false }
  const perSide = []
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) { perSide.push(p); side = round1(side - p) }
  }
  return { perSide, remainder: round1(side * 2), ok: side < 0.01 }
}

// Readiness scales today's loads when you are not feeling 100 %.
export const FEELINGS = {
  great: { label: 'Feeling 100 %', factor: 1 },
  flat: { label: 'A bit flat', factor: 0.95 },
  rough: { label: 'Sick or sooky', factor: 0.9 },
  wrecked: { label: 'Wrecked', factor: 0.85 },
}
export const feelingFactor = key => FEELINGS[key]?.factor ?? 1

// In-session autoregulation: after a set, set the next set's weight so it lands inside the rep
// range at the target RIR. Small misses keep the weight; only a real gap changes it.
export function nextSetAdvice(done, target, step = DEFAULT_STEP) {
  const { repsMin, repsMax, rir: rirTarget = 2 } = target
  const rir = done.rir ?? rirTarget
  const est = e1rm(done.w, done.r, rir)
  if (!est) return null
  const inRange = done.r >= repsMin && done.r <= repsMax
  if (inRange && Math.abs(rir - rirTarget) <= 1) {
    return { w: done.w, r: done.r, change: 0, why: 'Right on target. Same again.' }
  }
  // Fatigue builds across sets, so aim one rep under where the estimate says you'd land.
  const aimReps = clamp(done.r, repsMin, repsMax)
  const w = Math.max(step, weightFor(est, aimReps, rirTarget, step))
  const change = round1(w - done.w)
  let why
  if (change > 0) why = `That was easier than planned (${done.r} reps, ${rir} in the tank). Up to ${w} kg.`
  else if (change < 0) why = `That was a grind (${done.r} reps, ${rir} in the tank). Down to ${w} kg.`
  else why = 'Close enough. Same weight.'
  return { w, r: aimReps, change, why }
}

// Next session's prescription from the last session of this exercise (double progression with
// RIR, the way MacroFactor-style apps adjust): beat the top of the range → more weight; land
// in the range → add a rep; miss the bottom → recalculate from what you actually lifted.
export function nextSessionTarget(lastEntry, cfg, step = DEFAULT_STEP) {
  const { repsMin = 6, repsMax = 10, sets = 3, rir: rirTarget = 2 } = cfg
  const work = (lastEntry?.sets || []).filter(s => isWork(s) && setDone(s))
  if (!work.length) {
    return { w: cfg.w || 0, r: repsMin, sets, kind: 'first', why: 'Nothing logged yet. Pick a weight you could lift for about ' + (repsMin + rirTarget) + ' reps.' }
  }
  const top = Math.max(...work.map(s => s.w))
  const topSets = work.filter(s => s.w === top)
  const allTop = topSets.length >= sets && topSets.every(s => s.r >= repsMax && (s.rir ?? rirTarget) >= rirTarget - 1)
  const allMin = topSets.length >= sets && topSets.every(s => s.r >= repsMin)
  if (allTop) return { w: snap(top + step, step), r: repsMin, sets, kind: 'up', why: `Hit ${repsMax} reps on every set. +${step} kg, back to ${repsMin} reps.` }
  if (allMin) {
    const lowest = Math.min(...topSets.map(s => s.r))
    const r = clamp(lowest + 1, repsMin, repsMax)
    return { w: top, r, sets, kind: 'reps', why: `Every set in range. Same ${top} kg, aim for ${r} reps.` }
  }
  const est = Math.max(...work.map(s => e1rm(s.w, s.r, s.rir ?? 0) || 0))
  const w = Math.min(top, weightFor(est, repsMin, rirTarget, step))
  return { w, r: repsMin, sets, kind: 'down', why: `Came up short last time. ${w} kg should land ${repsMin} reps with ${rirTarget} in reserve.` }
}

export function applyFeeling(target, feeling, step = DEFAULT_STEP) {
  const f = feelingFactor(feeling)
  if (f === 1 || !(target.w > 0)) return target
  const w = snap(target.w * f, step)
  if (w >= target.w) return target
  return { ...target, w, why: `${target.why} Eased to ${w} kg because you're not 100 % today.` }
}

// Rolling mean over the last `n` points. Smooths session-to-session noise on the graphs.
export function rollingAverage(values, n = 4) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - n + 1), i + 1).filter(v => v != null)
    return slice.length ? round1(slice.reduce((a, b) => a + b, 0) / slice.length) : null
  })
}

// Sessions of one exercise in date order: [{date, e1rm, volume, feeling, entry}]
export function exerciseHistory(workouts, exId) {
  const out = []
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of w.entries || []) {
      if (e.exId !== exId) continue
      const est = bestE1rm(e)
      if (est) out.push({ date: w.date, e1rm: est, volume: entryVolume(e), feeling: w.feeling || 'great', entry: e })
    }
  }
  return out
}

// Best e1RM across recent sessions. Recent matters: an old PR from before a layoff overstates you.
export function currentE1rm(workouts, exId, lookback = 3) {
  const h = exerciseHistory(workouts, exId).filter(p => p.feeling === 'great' || p.feeling == null)
  const all = h.length ? h : exerciseHistory(workouts, exId)
  const recent = all.slice(-lookback)
  return recent.length ? Math.max(...recent.map(p => p.e1rm)) : null
}

export { round1, clamp }
