// Personal records per exercise, beyond estimated 1RM: heaviest weight, most reps at a weight,
// best single-session volume, longest time and farthest distance. Only done working sets count.
// An exercise's first session sets the bar rather than breaking records.
import { e1rm, isWork, setDone, entryVolume } from './strength.js'
import { exInfo } from './exercises.js'

const workSets = entry => (entry.sets || []).filter(s => isWork(s) && setDone(s))

/** Best marks across entries: { e1rm, weight, volume, sec, reps: [[weight, maxReps]] } or null. */
export function bestsOf(entries) {
  let any = false
  const b = { e1rm: 0, weight: 0, volume: 0, sec: 0, dist: 0, reps: new Map() }
  for (const entry of entries) {
    const sets = workSets(entry)
    if (!sets.length) continue
    any = true
    b.volume = Math.max(b.volume, entryVolume(entry))
    for (const s of sets) {
      const w = s.w || 0
      if (s.sec > 0) { b.sec = Math.max(b.sec, s.sec); b.dist = Math.max(b.dist, s.dist || 0); continue }
      if (!(s.r > 0)) continue
      b.weight = Math.max(b.weight, w)
      b.e1rm = Math.max(b.e1rm, (w > 0 && e1rm(w, s.r, s.rir ?? 0)) || 0)
      b.reps.set(w, Math.max(b.reps.get(w) || 0, s.r))
    }
  }
  return any ? b : null
}

/** Most reps done at this weight or heavier. */
export const repsAtLeast = (bests, w) => Math.max(0, ...[...bests.reps].filter(([x]) => x >= w).map(([, r]) => r))

/**
 * Records this entry breaks against earlier entries of the same exercise:
 * [{ kind: 'e1rm'|'weight'|'reps'|'volume'|'time', value, prev, w? }], strongest kind first.
 */
export function recordsBroken(entry, earlier) {
  const prev = bestsOf(earlier)
  const now = bestsOf([entry])
  if (!prev || !now) return []
  const out = []
  if (now.e1rm > prev.e1rm && prev.e1rm > 0) out.push({ kind: 'e1rm', value: now.e1rm, prev: prev.e1rm })
  if (now.weight > prev.weight && now.weight > 0) out.push({ kind: 'weight', value: now.weight, prev: prev.weight })
  // A rep record at a weight no heavier than before (heavier is already a weight record).
  let rep = null
  for (const [w, r] of now.reps) {
    if (w > prev.weight) continue
    const was = repsAtLeast(prev, w)
    if (r > was && (!rep || w > rep.w || (w === rep.w && r > rep.value))) rep = { kind: 'reps', w, value: r, prev: was }
  }
  if (rep) out.push(rep)
  if (now.volume > prev.volume && prev.volume > 0) out.push({ kind: 'volume', value: now.volume, prev: prev.volume })
  if (now.dist > prev.dist && prev.dist > 0) out.push({ kind: 'distance', value: now.dist, prev: prev.dist })
  if (now.sec > prev.sec && prev.sec > 0) out.push({ kind: 'time', value: now.sec, prev: prev.sec })
  return out
}

/** The note left on this exercise most recently, if any: { date, text }. */
export function lastNoteFor(workouts, exId) {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date))
  for (const w of sorted) {
    const e = (w.entries || []).find(x => x.exId === exId && x.note?.trim())
    if (e) return { date: w.date, text: e.note.trim() }
  }
  return null
}

/** Names of the exercises in workout `w` that set a record against the workouts before it. */
export function prNamesFor(workouts, w) {
  const before = workouts.filter(x => x.id !== w.id && (x.date < w.date || (x.date === w.date && (x.startedAt || 0) < (w.startedAt || 0))))
  return w.entries.filter(e => recordsBroken(e, before.flatMap(x => (x.entries || []).filter(y => y.exId === e.exId))).length).map(e => exInfo(e.exId).name)
}
