// The weekly plan. Two shapes: a routine per weekday, or a rotation (A, B, C, A …) on the days
// you train, where the next session is simply the next one you haven't done. Single days can be
// moved or turned into rest days without touching the plan (plan.overrides).
const DAY = 864e5
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export const emptyPlan = () => ({ mode: 'weekly', days: {}, rotation: [], trainDays: [1, 3, 5], weekStart: 1, overrides: {} })
const dow = iso => new Date(iso + 'T12:00:00').getDay()
// Dates are local calendar days as 'YYYY-MM-DD'. Never format them with toISOString: that is UTC,
// so in Australia or New Zealand it lands on the wrong day.
export const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoLocal(d) }

export function weekOf(iso, weekStart = 1) {
  const back = (dow(iso) - weekStart + 7) % 7
  const first = addDays(iso, -back)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

const routineById = (profile, id) => (profile.templates || []).find(t => t.id === id) || null

// Which rotation routine comes next after what's been done (by routine id) up to `beforeIso`.
function rotationIndex(plan, workouts, beforeIso) {
  const rot = plan.rotation || []
  if (!rot.length) return -1
  const done = [...workouts].filter(w => w.date < beforeIso && rot.includes(w.routineId)).sort((a, b) => a.date.localeCompare(b.date))
  const last = done[done.length - 1]
  return last ? (rot.indexOf(last.routineId) + 1) % rot.length : 0
}

/** The routine planned for a date: null on rest days. Rotation days ahead are projected in order. */
export function plannedFor(profile, workouts, iso, todayIso = iso) {
  const plan = { ...emptyPlan(), ...(profile.plan || {}) }
  const o = plan.overrides?.[iso]
  if (o === 'rest') return null
  if (o) return routineById(profile, o)
  if (plan.mode === 'rotation') {
    if (!plan.trainDays.includes(dow(iso)) || !plan.rotation.length) return null
    let idx = rotationIndex(plan, workouts, todayIso)
    // Count the planned training days between today and this date to project forward.
    for (let d = todayIso; d < iso; d = addDays(d, 1)) {
      const doneThatDay = workouts.some(w => w.date === d && plan.rotation.includes(w.routineId))
      if ((plan.trainDays.includes(dow(d)) && plan.overrides?.[d] !== 'rest') && !(d === todayIso && doneThatDay)) idx = (idx + 1) % plan.rotation.length
    }
    return routineById(profile, plan.rotation[idx])
  }
  return routineById(profile, plan.days?.[dow(iso)])
}

/**
 * Moves one session from `from` to `to` as overrides. If `to` already has a session planned,
 * the two swap days instead of one being lost.
 */
export function moveSession(profile, workouts, from, to, todayIso = from) {
  const plan = { ...emptyPlan(), ...(profile.plan || {}) }
  const moving = plannedFor(profile, workouts, from, todayIso)
  if (!moving || from === to) return plan.overrides || {}
  const there = workouts.some(w => w.date === to) ? null : plannedFor(profile, workouts, to, todayIso)
  return { ...(plan.overrides || {}), [from]: there ? there.id : 'rest', [to]: moving.id }
}

/** Next planned session after `fromIso` (exclusive), within four weeks. */
export function nextSession(profile, workouts, fromIso) {
  for (let i = 1; i <= 28; i++) {
    const d = addDays(fromIso, i)
    const r = plannedFor(profile, workouts, d, fromIso)
    if (r) return { date: d, routine: r, inDays: i }
  }
  return null
}

export const hasPlan = profile => {
  const p = profile.plan
  return !!p && (p.mode === 'rotation' ? p.rotation?.length > 0 : Object.values(p.days || {}).some(Boolean))
}

/** Load a starter plan: its routines become yours, and the schedule points at them. */
export function applyStarter(profile, starter, uidFn) {
  const ids = {}
  const routines = starter.routines.map(r => { const id = 'r' + uidFn(); ids[r.id] = id; return { ...r, id, items: r.items.map(i => ({ ...i })) } })
  const newIds = starter.routines.map(r => ids[r.id])
  const plan = starter.rotation || newIds.length < starter.days.length
    ? { ...emptyPlan(), mode: 'rotation', rotation: newIds, trainDays: starter.days }
    : { ...emptyPlan(), mode: 'weekly', days: Object.fromEntries(starter.days.map((d, i) => [d, newIds[i % newIds.length]])) }
  return { ...profile, templates: [...routines, ...(profile.templates || [])], plan: { ...plan, weekStart: profile.plan?.weekStart ?? 1 } }
}

export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / DAY)
