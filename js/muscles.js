// Muscle maths for the body map: where your sets went, what's still recovering, what's untrained.
// Regions match the body outlines (js/data/body.json). Primary muscles count a full set,
// secondary half a set: the usual convention for "sets per muscle".
import { exInfo } from './exercises.js'
import { isWork, setDone } from './strength.js'

export const MUSCLE_NAME = {
  chest: 'Chest', abs: 'Abs', obliques: 'Obliques', serratus: 'Serratus', deltoids: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', forearm: 'Forearms', trapezius: 'Traps', 'upper-back': 'Upper back & lats', 'lower-back': 'Lower back',
  gluteal: 'Glutes', quadriceps: 'Quads', hamstring: 'Hamstrings', adductors: 'Adductors', calves: 'Calves',
  tibialis: 'Shins', 'hip-flexors': 'Hip flexors', neck: 'Neck',
}
export const INERT = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles']
export const MAIN_MUSCLES = ['chest', 'deltoids', 'biceps', 'triceps', 'forearm', 'trapezius', 'upper-back', 'lower-back', 'abs', 'obliques', 'gluteal', 'quadriceps', 'hamstring', 'adductors', 'calves']
const BIG = new Set(['quadriceps', 'hamstring', 'gluteal', 'upper-back', 'chest', 'lower-back'])
export const recoveryHours = m => (BIG.has(m) ? 72 : 48)

const DAY = 864e5
const at = iso => new Date(iso + 'T12:00:00').getTime()

function eachSet(workouts, fn) {
  for (const w of workouts) for (const e of w.entries || []) {
    const ex = exInfo(e.exId)
    const n = (e.sets || []).filter(s => isWork(s) && setDone(s)).length
    if (n) fn(w, ex, n)
  }
}

/** Sets per muscle since `sinceIso` (inclusive). */
export function setsByMuscle(workouts, sinceIso = '0000') {
  const out = {}
  eachSet(workouts.filter(w => w.date >= sinceIso), (w, ex, n) => {
    for (const m of ex.p || []) out[m] = (out[m] || 0) + n
    for (const m of ex.s || []) out[m] = (out[m] || 0) + n * 0.5
  })
  return out
}

/** Remaining fatigue per muscle, 0 = fresh. Each set's load fades linearly over the recovery window. */
export function fatigueByMuscle(workouts, now = Date.now()) {
  const out = {}
  eachSet(workouts.filter(w => now - at(w.date) < 4 * DAY), (w, ex, n) => {
    const hours = Math.max(0, (now - at(w.date)) / 36e5)
    const add = (m, k) => { const left = 1 - hours / recoveryHours(m); if (left > 0) out[m] = (out[m] || 0) + n * k * left }
    for (const m of ex.p || []) add(m, 1)
    for (const m of ex.s || []) add(m, 0.5)
  })
  return out
}
export function fatigueLevel(v) { return !v ? 0 : v >= 6 ? 3 : v >= 3 ? 2 : 1 }

/** Days since each muscle was last trained as a primary or secondary; Infinity if never. */
export function daysSinceByMuscle(workouts, todayIso) {
  const last = {}
  eachSet(workouts, (w, ex) => { for (const m of [...(ex.p || []), ...(ex.s || [])]) if (!last[m] || w.date > last[m]) last[m] = w.date })
  return Object.fromEntries(MAIN_MUSCLES.map(m => [m, last[m] ? Math.round((at(todayIso) - at(last[m])) / DAY) : Infinity]))
}

// Colour bands (as CSS class suffixes) per mode. 0 = no colour.
export const volumeLevel = (sets, maxSets) => (!sets ? 0 : Math.min(4, Math.ceil((sets / Math.max(maxSets, 1)) * 4)))
export const untrainedLevel = days => (days === Infinity ? 4 : days >= 14 ? 3 : days >= 8 ? 2 : days >= 5 ? 1 : 0)

let bodyPromise = null
export const loadBody = () => (bodyPromise = bodyPromise || fetch(new URL('./data/body.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('body'); return r.json() }).catch(e => { bodyPromise = null; throw e }))
