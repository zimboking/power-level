// Share a routine as a link: the routine is packed into the part after '#', which browsers never
// send to a server. Opening the link offers to add it. Anything in a link is someone else's data,
// so decoding checks every field and drops what doesn't fit.

export const SHARE_KEY = 'routine'
const MAX_ITEMS = 40
const ID_RE = /^[a-z0-9:_.-]{1,80}$/i
const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'reformer', 'ez', 'trap', 'smith', 'kettlebell', 'band', 'other']
const PROGS = ['double', 'linear', 'greyskull', 'triple', 'time', 'off']

function toBase64Url(text) {
  let bin = ''
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}

const ITEM_KEYS = ['exId', 'sets', 'repsMin', 'repsMax', 'rir', 'rest', 'prog', 'group', 'pyramid']
const EX_KEYS = ['id', 'name', 'eq', 'p', 's', 'fdb', 'img', 'mode', 'uni', 'custom', 'timeUnit', 'distance', 'distUnit']

/**
 * routine: { name, items }. lookup(exId) gives the stored details of a catalogue or custom
 * exercise (null for built-in ones), so the link carries what the other phone needs.
 */
export function encodeRoutine(routine, lookup = () => null) {
  const items = routine.items.slice(0, MAX_ITEMS).map(it => Object.fromEntries(ITEM_KEYS.filter(k => it[k] != null && it[k] !== false).map(k => [k, it[k]])))
  const ex = [...new Set(items.map(i => i.exId))].map(lookup).filter(Boolean).map(e => Object.fromEntries(EX_KEYS.filter(k => e[k] != null).map(k => [k, e[k]])))
  return toBase64Url(JSON.stringify({ v: 1, name: routine.name, items, ...(ex.length ? { ex } : {}) }))
}

export const shareUrl = (base, routine, lookup) => `${base.split('#')[0]}#${SHARE_KEY}=${encodeRoutine(routine, lookup)}`

/** The packed routine in a location hash, or null if there isn't one. */
export function sharedFromHash(hash) {
  const m = /^#?routine=([A-Za-z0-9_-]+)$/.exec(hash || '')
  return m ? m[1] : null
}

const num = (v, lo, hi, fallback) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : fallback)
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '')
const muscles = v => (Array.isArray(v) ? v.filter(m => typeof m === 'string' && /^[a-z-]{2,20}$/.test(m)).slice(0, 8) : [])

function cleanItem(it) {
  if (!it || !ID_RE.test(it.exId)) return null
  // Reps, or seconds for timed exercises (up to a day).
  const repsMin = num(it.repsMin, 1, 86400, 8)
  const out = { exId: it.exId, sets: num(it.sets, 1, 20, 3), repsMin, repsMax: Math.max(repsMin, num(it.repsMax, 1, 86400, repsMin)), rir: num(it.rir, 0, 5, 2) }
  if (it.rest != null) out.rest = num(it.rest, 15, 1800, 150)
  if (PROGS.includes(it.prog)) out.prog = it.prog
  if (typeof it.group === 'string' && /^[a-z0-9]{1,8}$/i.test(it.group)) out.group = it.group
  if (it.pyramid === true) out.pyramid = true
  return out
}

function cleanExercise(e, wanted) {
  if (!e || !ID_RE.test(e.id) || !wanted.has(e.id)) return null
  const name = text(e.name, 80)
  if (!name) return null
  return {
    id: e.id, name, eq: EQUIPMENT.includes(e.eq) ? e.eq : 'other', p: muscles(e.p), s: muscles(e.s),
    ...(typeof e.fdb === 'string' && /^[A-Za-z0-9_()'.,+-]{1,100}$/.test(e.fdb) ? { fdb: e.fdb, img: num(e.img, 1, 4, 2) } : {}),
    mode: e.mode === 'time' ? 'time' : 'reps', uni: e.uni === true, cues: [], custom: e.custom === true,
    ...(e.mode === 'time' && ['s', 'min', 'h'].includes(e.timeUnit) ? { timeUnit: e.timeUnit } : {}),
    ...(e.mode === 'time' && e.distance === true ? { distance: true, distUnit: e.distUnit === 'm' ? 'm' : 'km' } : {}),
  }
}

/**
 * Packed text → { name, items, exercises } with every field checked. Built-in exercise ids are
 * kept only if `isKnown(id)` says so; others need their details in the link. Throws if unusable.
 */
export function decodeRoutine(packed, isKnown = () => false) {
  let d
  try { d = JSON.parse(fromBase64Url(packed)) } catch { throw new Error('unreadable') }
  if (!d || d.v !== 1 || !Array.isArray(d.items)) throw new Error('not a routine')
  const raw = d.items.slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean)
  const wanted = new Set(raw.map(i => i.exId))
  const exercises = (Array.isArray(d.ex) ? d.ex : []).map(e => cleanExercise(e, wanted)).filter(Boolean)
  const have = new Set(exercises.map(e => e.id))
  const items = raw.filter(i => isKnown(i.exId) || have.has(i.exId))
  if (!items.length) throw new Error('no exercises')
  return { name: text(d.name, 60) || 'Shared routine', items, exercises: exercises.filter(e => !isKnown(e.id)) }
}
