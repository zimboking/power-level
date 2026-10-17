// Goal journey: map a path from today's estimated 1RM to a goal lift through 4-week blocks of
// progressive overload (volume → strength → intensity, deload every 4th week), finishing with
// a test day. Re-planned from your actual numbers every time you open it, so it adapts.
import { weightFor, round1, DEFAULT_STEP } from './strength.js'

// Typical weekly e1RM gain for natural lifters on a decent program, as a fraction.
export const LEVELS = {
  beginner: { label: 'Beginner (under 1 year)', rate: 0.0125 },
  intermediate: { label: 'Intermediate (1–3 years)', rate: 0.006 },
  advanced: { label: 'Advanced (3+ years)', rate: 0.003 },
}

// Rough guess from the lift relative to bodyweight when the lifter hasn't said.
export function guessLevel(e1rm, bodyweight, exId) {
  if (!(e1rm > 0) || !(bodyweight > 0)) return 'intermediate'
  const ratio = e1rm / bodyweight
  const bands = { bench: [1, 1.5], squat: [1.25, 2], deadlift: [1.5, 2.25], ohp: [0.6, 0.9] }
  const [b, a] = bands[exId] || [1, 1.6]
  return ratio < b ? 'beginner' : ratio < a ? 'intermediate' : 'advanced'
}

const PHASES = [
  { name: 'Volume', sets: 4, reps: 8, rir: 2, note: 'Build the engine. Smooth, controlled reps.' },
  { name: 'Strength', sets: 4, reps: 5, rir: 2, note: 'Heavier sets of five. Keep the bar speed crisp.' },
  { name: 'Intensity', sets: 3, reps: 3, rir: 1, note: 'Heavy and sharp. Full rest between sets.' },
]
export const MAX_WEEKS = 156

// Gains slow as you approach your goal and as you get stronger overall.
function weeklyGain(current, start, goal, rate) {
  const progress = goal > start ? (current - start) / (goal - start) : 1
  return current * rate * (1 - 0.35 * Math.min(1, Math.max(0, progress)))
}

/**
 * @param {{start:number, goal:number, level:string, step?:number, startDate?:string, weekOffset?:number}} opts
 * weekOffset: weeks already done since the goal began, so today's week keeps its place in the block.
 * @returns {{weeks:Array, reachable:boolean, totalWeeks:number, etaDate:string|null}}
 */
export function planJourney({ start, goal, level = 'intermediate', step = DEFAULT_STEP, startDate, weekOffset = 0 }) {
  const rate = (LEVELS[level] || LEVELS.intermediate).rate
  const weeks = []
  if (!(start > 0) || !(goal > 0)) return { weeks, reachable: false, totalWeeks: 0, etaDate: null }
  let e = start
  let week = weekOffset
  while (e < goal && week - weekOffset < MAX_WEEKS) {
    week += 1
    const blockIdx = Math.floor((week - 1) / 4)
    const inBlock = ((week - 1) % 4) + 1
    const phase = PHASES[blockIdx % PHASES.length]
    if (inBlock === 4) {
      weeks.push({ week, block: blockIdx + 1, phase: 'Deload', sets: 3, reps: phase.reps, rir: 4, e1rm: round1(e), w: weightFor(e * 0.9, phase.reps, 4, step), deload: true, note: 'Lighter week. Let the gains land.' })
      continue
    }
    e = Math.min(goal, e + weeklyGain(e, start, goal, rate))
    weeks.push({ week, block: blockIdx + 1, phase: phase.name, sets: phase.sets, reps: phase.reps, rir: phase.rir, e1rm: round1(e), w: weightFor(e, phase.reps, phase.rir, step), deload: false, note: phase.note })
  }
  const reachable = e >= goal
  if (reachable) {
    week += 1
    weeks.push({ week, block: null, phase: 'Test day', sets: 1, reps: 1, rir: 0, e1rm: goal, w: goal, deload: false, note: `Work up in singles and hit ${goal} kg.` })
  }
  const remaining = week - weekOffset
  return { weeks, reachable, totalWeeks: remaining, etaDate: reachable && startDate ? addWeeks(startDate, remaining) : null }
}

export function addWeeks(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

export function percentThere(start, current, goal) {
  if (!(goal > start)) return current >= goal ? 100 : 0
  return Math.round(Math.min(1, Math.max(0, (current - start) / (goal - start))) * 100)
}
