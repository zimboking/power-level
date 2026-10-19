import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestsOf, repsAtLeast, recordsBroken, lastNoteFor } from '../js/records.js'

const s = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const entry = (sets, exId = 'bench') => ({ exId, sets })
const kinds = list => list.map(x => x.kind)

test('the first session sets the bar and breaks nothing', () => {
  assert.deepEqual(recordsBroken(entry([s(100, 5)]), []), [])
})

test('heavier weight is a weight record (and usually a 1RM one)', () => {
  const r = recordsBroken(entry([s(110, 3)]), [entry([s(100, 5), s(100, 5)])])
  assert.deepEqual(kinds(r), ['e1rm', 'weight'])
  assert.deepEqual([r[1].value, r[1].prev], [110, 100])
  assert.deepEqual(kinds(recordsBroken(entry([s(105, 3)]), [entry([s(100, 5)])])), ['weight']) // heavier, but a lower estimated max
})

test('more reps at a weight you have lifted before is a rep record, judged against heavier sets too', () => {
  const before = [entry([s(100, 5), s(90, 8)])]
  const r = recordsBroken(entry([s(90, 9)]), before)
  assert.ok(kinds(r).includes('reps'))
  assert.deepEqual(r.find(x => x.kind === 'reps'), { kind: 'reps', w: 90, value: 9, prev: 8 })
  // 6 reps at 95 beats the 5 you did at 100 (the most at 95 kg or more).
  assert.deepEqual(recordsBroken(entry([s(95, 6)]), before).find(x => x.kind === 'reps'), { kind: 'reps', w: 95, value: 6, prev: 5 })
  // 8 at 90 again is no record.
  assert.equal(recordsBroken(entry([s(90, 8)]), before).some(x => x.kind === 'reps'), false)
})

test('session volume and bodyweight reps count; warm-ups and undone sets do not', () => {
  const before = [entry([s(60, 10), s(60, 10)])]
  assert.ok(kinds(recordsBroken(entry([s(60, 10), s(60, 10), s(60, 10)]), before)).includes('volume'))
  assert.deepEqual(recordsBroken(entry([s(200, 1, { warmup: true }), s(200, 1, { done: false })]), before), [])
  const pull = [entry([s(0, 8)], 'pullup')]
  assert.deepEqual(recordsBroken(entry([s(0, 10)], 'pullup'), pull), [{ kind: 'reps', w: 0, value: 10, prev: 8 }])
})

test('longer holds are time records', () => {
  const hold = sec => ({ exId: 'plank', sets: [{ sec, done: true }] })
  assert.deepEqual(recordsBroken(hold(75), [hold(60)]), [{ kind: 'time', value: 75, prev: 60 }])
})

test('bests and the most reps at or above a weight', () => {
  const b = bestsOf([entry([s(100, 5), s(80, 10)])])
  assert.equal(b.weight, 100)
  assert.equal(repsAtLeast(b, 90), 5)
  assert.equal(repsAtLeast(b, 80), 10)
  assert.equal(repsAtLeast(b, 120), 0)
  assert.equal(bestsOf([entry([])]), null)
})

test('lastNoteFor finds the newest note for that exercise', () => {
  const workouts = [
    { date: '2026-10-01', entries: [{ exId: 'bench', note: 'Seat 4', sets: [] }] },
    { date: '2026-10-08', entries: [{ exId: 'bench', note: '  ', sets: [] }, { exId: 'squat', note: 'Knees', sets: [] }] },
  ]
  assert.deepEqual(lastNoteFor(workouts, 'bench'), { date: '2026-10-01', text: 'Seat 4' })
  assert.equal(lastNoteFor(workouts, 'row'), null)
})
