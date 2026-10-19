import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupRoutines, addFolder, renameFolder, deleteFolder, moveFolder, moveRoutine, setRoutineFolder, saveRoutine, deleteRoutine } from '../js/routines.js'

const r = (id, folder) => ({ id, name: id, items: [], ...(folder ? { folder } : {}) })
const base = () => ({
  folders: [{ id: 'f1', name: 'Strength' }, { id: 'f2', name: 'Cardio' }],
  templates: [r('a', 'f1'), r('b'), r('c', 'f1'), r('d', 'f2'), r('e', 'gone')],
})
const names = p => groupRoutines(p).map(g => `${g.folder ? g.folder.name : '-'}:${g.routines.map(x => x.id).join('')}`)

test('groups routines by folder in order; unfiled and orphaned routines go last', () => {
  assert.deepEqual(names(base()), ['Strength:ac', 'Cardio:d', '-:be'])
  assert.deepEqual(names({ templates: [r('x')] }), ['-:x'])
  assert.deepEqual(names({}), ['-:'])
})

test('folders: add, rename, reorder; blank names are ignored and long ones trimmed', () => {
  const p = base()
  const added = addFolder(p, '  Mobility ', 'f3')
  assert.deepEqual(added.folders.map(f => f.name), ['Strength', 'Cardio', 'Mobility'])
  assert.equal(addFolder(p, '   ', 'f4'), p)
  assert.equal(addFolder(p, 'x'.repeat(60), 'f5').folders[2].name.length, 40)
  assert.equal(renameFolder(p, 'f2', 'Conditioning').folders[1].name, 'Conditioning')
  assert.equal(renameFolder(p, 'f2', ''), p)
  assert.deepEqual(moveFolder(p, 'f2', -1).folders.map(f => f.id), ['f2', 'f1'])
  assert.equal(moveFolder(p, 'f1', -1), p)
  assert.equal(p.folders.length, 2) // original untouched
})

test('deleting a folder keeps its routines, unfiled', () => {
  const p = deleteFolder(base(), 'f1')
  assert.deepEqual(names(p), ['Cardio:d', '-:abce'])
  assert.equal('folder' in p.templates[0], false)
})

test('moving a routine skips past routines in other folders', () => {
  const p = base()
  assert.deepEqual(names(moveRoutine(p, 'c', -1)), ['Strength:ca', 'Cardio:d', '-:be'])
  assert.deepEqual(names(moveRoutine(p, 'b', 1)), ['Strength:ac', 'Cardio:d', '-:eb'])
  assert.equal(moveRoutine(p, 'a', -1), p)
  assert.equal(moveRoutine(p, 'd', 1), p)
  assert.equal(moveRoutine(p, 'nope', 1), p)
})

test('filing a routine moves it to the end of that folder', () => {
  const p = base()
  assert.deepEqual(names(setRoutineFolder(p, 'b', 'f1')), ['Strength:acb', 'Cardio:d', '-:e'])
  assert.deepEqual(names(setRoutineFolder(p, 'a', null)), ['Strength:c', 'Cardio:d', '-:bea'])
  assert.deepEqual(names(setRoutineFolder(p, 'a', 'missing')), ['Strength:c', 'Cardio:d', '-:bea'])
  assert.equal(setRoutineFolder(p, 'a', 'f1'), p)
})

test('saving: edits replace in place, new routines join the end of their folder', () => {
  const p = base()
  const edited = saveRoutine(p, { ...r('a', 'f1'), name: 'Heavy', items: [{ exId: 'squat', sets: 5 }] })
  assert.equal(edited.templates[0].name, 'Heavy')
  assert.equal(edited.templates[0].items[0].sets, 5)
  assert.deepEqual(names(saveRoutine(p, r('n', 'f2'))), ['Strength:ac', 'Cardio:dn', '-:be'])
  assert.equal('folder' in saveRoutine(p, r('m', 'missing')).templates[5], false)
  assert.deepEqual(names(deleteRoutine(p, 'c')), ['Strength:a', 'Cardio:d', '-:be'])
})

test('deleting a routine takes it out of the weekly plan, rotation and moved sessions', () => {
  const p = { ...base(), plan: { mode: 'weekly', days: { 1: 'a', 3: 'b', 5: 'a' }, rotation: ['a', 'b', 'a'], overrides: { '2026-10-20': 'a', '2026-10-21': 'rest' } } }
  const next = deleteRoutine(p, 'a')
  assert.deepEqual(next.plan.days, { 3: 'b' })
  assert.deepEqual(next.plan.rotation, ['b'])
  assert.deepEqual(next.plan.overrides, { '2026-10-21': 'rest' })
  assert.equal(next.templates.some(r => r.id === 'a'), false)
  assert.deepEqual(deleteRoutine({ templates: [r('x')] }, 'x'), { templates: [] })
})

test('replacing keeps the slot, sets and superset; a different kind of exercise gets fresh reps or time', async () => {
  const { replaceItem } = await import('../js/routines.js')
  const item = { exId: 'bench', sets: 4, repsMin: 5, repsMax: 8, rir: 1, rest: 180, group: 'a', prog: 'linear' }
  assert.deepEqual(replaceItem(item, 'incline', { id: 'incline', mode: 'reps' }, {}), { ...item, exId: 'incline' })
  const timed = replaceItem(item, 'plank', { id: 'plank', mode: 'time' }, {})
  assert.deepEqual([timed.exId, timed.sets, timed.repsMin, timed.group, timed.rest, timed.prog], ['plank', 4, 30, 'a', 180, undefined])
  const list = [{ exId: 'squat' }, item, { exId: 'row' }]
  const next = list.map((x, i) => (i === 1 ? replaceItem(x, 'ohp', { id: 'ohp', mode: 'reps' }, {}) : x))
  assert.deepEqual(next.map(x => x.exId), ['squat', 'ohp', 'row'])
})

test('deleting your own exercise hides it and takes it out of routines; built-in ones are left alone', async () => {
  const { deleteCustomExercise, routinesUsing } = await import('../js/routines.js')
  const p = { exercises: { 'c:run': { id: 'c:run', name: 'Run', custom: true }, 'fdb:X': { id: 'fdb:X', name: 'X' } },
    templates: [{ id: 'a', items: [{ exId: 'c:run' }, { exId: 'bench' }] }, { id: 'b', items: [{ exId: 'squat' }] }] }
  assert.equal(routinesUsing(p, 'c:run'), 1)
  const next = deleteCustomExercise(p, 'c:run')
  assert.equal(next.exercises['c:run'].hidden, true)
  assert.equal(next.exercises['c:run'].name, 'Run') // past workouts still show it
  assert.deepEqual(next.templates[0].items, [{ exId: 'bench' }])
  assert.equal(next.templates[1], p.templates[1])
  assert.equal(deleteCustomExercise(p, 'fdb:X'), p)
  assert.equal(deleteCustomExercise(p, 'bench'), p)
})
