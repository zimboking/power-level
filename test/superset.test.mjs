// Rest and "who's next" after ticking a set, alone and in supersets.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterSet } from '../js/superset.js'

const sets = (done, total = 3) => Array.from({ length: total }, (_, k) => ({ w: 50, r: 10, done: k < done }))
const ex = (group, done, cfg = {}, total) => ({ group, cfg, sets: sets(done, total) })
const tick = { w: 50, r: 10, done: false }

test('a lone exercise rests its own time, or the default', () => {
  assert.deepEqual(afterSet([ex(null, 0)], 0, tick, 150), { rest: 150, next: null })
  assert.deepEqual(afterSet([ex(null, 0, { rest: 90 })], 0, tick, 150), { rest: 90, next: null })
  assert.equal(afterSet([ex(null, 0, { rest: 90 })], 0, { ...tick, rest: 45 }, 150).rest, 45)
  assert.equal(afterSet([ex(null, 0)], 0, { ...tick, warmup: true }, 150).rest, 60)
})

test('superset with no rest set: straight to the partner, full rest after the round', () => {
  const s = [ex('g1', 0), ex('g1', 0)]
  assert.deepEqual(afterSet(s, 0, tick, 150), { rest: null, next: 1 })
  const s2 = [ex('g1', 1), ex('g1', 0)]
  assert.deepEqual(afterSet(s2, 1, tick, 150), { rest: 150, next: 0 })
})

test('each exercise in a superset uses its own rest time when it has one', () => {
  // Hack squat 0:30 then calf raise 1:30.
  const s = [ex('g1', 0, { rest: 30 }), ex('g1', 0, { rest: 90 })]
  assert.deepEqual(afterSet(s, 0, tick, 150), { rest: 30, next: 1 })
  const s2 = [ex('g1', 1, { rest: 30 }), ex('g1', 0, { rest: 90 })]
  assert.deepEqual(afterSet(s2, 1, tick, 150), { rest: 90, next: 0 })
})

test('a third exercise linked in but not started yet still gets the turn, and rest isn’t lost', () => {
  const s = [ex('g1', 1, { rest: 30 }), ex('g1', 0, { rest: 90 }), ex('g1', 0)]
  assert.deepEqual(afterSet(s, 1, tick, 150), { rest: 90, next: 2 })
})

test('the round ends when partners are already finished, whatever the order', () => {
  // Partner already did all its sets: this exercise rests normally.
  const s = [ex('g1', 3), ex('g1', 1)]
  assert.deepEqual(afterSet(s, 1, tick, 150), { rest: 150, next: 0 })
  // Doing the second exercise first: the first one still owes this round.
  const s2 = [ex('g1', 0), ex('g1', 0)]
  assert.deepEqual(afterSet(s2, 1, tick, 150), { rest: null, next: 0 })
})
