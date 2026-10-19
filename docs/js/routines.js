// Routines and their folders. Routines live in profile.templates, in the order you see them;
// a routine's `folder` is the id of one of profile.folders ([{ id, name }], also in order).
// A routine with no folder, or one whose folder was deleted, is unfiled.
import { exInfo } from './exercises.js'
import { startCfg } from './plan.js'

export const FOLDER_MAX = 40

const foldersOf = profile => profile.folders || []
const routinesOf = profile => profile.templates || []
const folderKey = (profile, r) => (foldersOf(profile).some(f => f.id === r.folder) ? r.folder : null)

/** Folders in order, each with its routines in order; unfiled routines last (folder: null). */
export function groupRoutines(profile) {
  const groups = foldersOf(profile).map(f => ({ folder: f, routines: [] }))
  const byId = Object.fromEntries(groups.map(g => [g.folder.id, g]))
  const loose = []
  for (const r of routinesOf(profile)) (byId[folderKey(profile, r)]?.routines || loose).push(r)
  return [...groups, { folder: null, routines: loose }]
}

const cleanName = name => String(name || '').trim().slice(0, FOLDER_MAX)

export function addFolder(profile, name, id) {
  const n = cleanName(name)
  if (!n) return profile
  return { ...profile, folders: [...foldersOf(profile), { id, name: n }] }
}

export function renameFolder(profile, id, name) {
  const n = cleanName(name)
  if (!n) return profile
  return { ...profile, folders: foldersOf(profile).map(f => (f.id === id ? { ...f, name: n } : f)) }
}

/** Removes the folder; its routines stay, unfiled. */
export function deleteFolder(profile, id) {
  return {
    ...profile,
    folders: foldersOf(profile).filter(f => f.id !== id),
    templates: routinesOf(profile).map(r => (r.folder === id ? withoutFolder(r) : r)),
  }
}

const withoutFolder = r => { const { folder, ...rest } = r; return rest }

const swap = (list, i, j) => {
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function moveFolder(profile, id, dir) {
  const list = foldersOf(profile)
  const i = list.findIndex(f => f.id === id), j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return profile
  return { ...profile, folders: swap(list, i, j) }
}

/** Moves a routine up (-1) or down (1) past the next routine in the same folder. */
export function moveRoutine(profile, id, dir) {
  const list = routinesOf(profile)
  const i = list.findIndex(r => r.id === id)
  if (i < 0) return profile
  const key = folderKey(profile, list[i])
  let j = i + dir
  while (j >= 0 && j < list.length && folderKey(profile, list[j]) !== key) j += dir
  if (j < 0 || j >= list.length) return profile
  return { ...profile, templates: swap(list, i, j) }
}

/** Files a routine in a folder (null = unfiled). It joins the end of that folder. */
export function setRoutineFolder(profile, id, folderId) {
  const list = routinesOf(profile)
  const r = list.find(x => x.id === id)
  const valid = folderId && foldersOf(profile).some(f => f.id === folderId)
  if (!r || (valid ? r.folder === folderId : !folderKey(profile, r))) return profile
  const moved = valid ? { ...r, folder: folderId } : withoutFolder(r)
  return { ...profile, templates: [...list.filter(x => x.id !== id), moved] }
}

/** Saves a routine from the editor: replaces it in place, or adds a new one at the end of its folder. */
export function saveRoutine(profile, routine) {
  const list = routinesOf(profile)
  const r = routine.folder && foldersOf(profile).some(f => f.id === routine.folder) ? routine : withoutFolder(routine)
  return list.some(x => x.id === r.id)
    ? { ...profile, templates: list.map(x => (x.id === r.id ? r : x)) }
    : { ...profile, templates: [...list, r] }
}

/** Deletes a routine and takes it out of the weekly plan, the rotation and any moved sessions. */
export function deleteRoutine(profile, id) {
  const next = { ...profile, templates: routinesOf(profile).filter(r => r.id !== id) }
  const plan = profile.plan
  if (!plan) return next
  const keep = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== id))
  return { ...next, plan: { ...plan, days: keep(plan.days), overrides: keep(plan.overrides), rotation: (plan.rotation || []).filter(r => r !== id) } }
}

/** Puts a different exercise in a routine slot, keeping its place, sets, effort, rest and superset. */
export function replaceItem(item, exId, ex, settings) {
  const sameKind = (ex?.mode === 'time') === (exInfo(item.exId).mode === 'time')
  const { pyramid, pyramidSets, ...keep } = item
  return { ...keep, ...(sameKind ? {} : startCfg(ex, settings)), sets: item.sets, exId, ...(sameKind ? {} : { prog: undefined }) }
}

/**
 * Deletes one of your own exercises: it leaves the library and your routines, but stays known
 * (hidden) so past workouts still show its name and history.
 */
export function deleteCustomExercise(profile, id) {
  const ex = profile.exercises?.[id]
  if (!ex?.custom) return profile
  return {
    ...profile,
    exercises: { ...profile.exercises, [id]: { ...ex, hidden: true } },
    templates: routinesOf(profile).map(r => (r.items.some(i => i.exId === id) ? { ...r, items: r.items.filter(i => i.exId !== id) } : r)),
  }
}

/** How many routines use an exercise. */
export const routinesUsing = (profile, id) => routinesOf(profile).filter(r => r.items.some(i => i.exId === id)).length
