import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timeUnitOf, toUnit, fromUnit, fmtDuration, MAX_SECONDS } from '../js/duration.js'
import { nextTarget } from '../js/progression.js'

test('converting between seconds and the chosen unit', () => {
  assert.equal(toUnit(90, 's'), 90)
  assert.equal(toUnit(90, 'min'), 1.5)
  assert.equal(toUnit(5400, 'h'), 1.5)
  assert.equal(fromUnit(1.5, 'min'), 90)
  assert.equal(fromUnit(0.25, 'h'), 900)
  assert.equal(fromUnit(0, 'min'), 1)
  assert.equal(fromUnit(99, 'h'), MAX_SECONDS)
})

test('the unit comes from your override, then the exercise, then seconds', () => {
  const run = { id: 'c:run', timeUnit: 'min' }
  assert.equal(timeUnitOf(run, {}), 'min')
  assert.equal(timeUnitOf(run, { timeUnits: { 'c:run': 'h' } }), 'h')
  assert.equal(timeUnitOf({ id: 'plank' }, {}), 's')
  assert.equal(timeUnitOf({ id: 'x', timeUnit: 'days' }, {}), 's')
})

test('durations read naturally', () => {
  assert.deepEqual([45, 60, 150, 720, 3600, 5400, 3660].map(fmtDuration), ['45 s', '1 min', '2:30 min', '12 min', '1 h', '1 h 30 min', '1 h 1 min'])
})

test('time progression grows by the step that suits the unit', () => {
  const hit = sec => ({ exId: 'c:run', sets: [{ sec, done: true }], target: { sec } })
  assert.equal(nextTarget([hit(30)], { policy: 'time', sets: 1, mode: 'time', sec: 30 }).sec, 35)
  assert.equal(nextTarget([hit(1800)], { policy: 'time', sets: 1, mode: 'time', sec: 1800, timeGrow: 60 }).sec, 1860)
  const why = nextTarget([hit(1800)], { policy: 'time', sets: 1, mode: 'time', sec: 1800, timeGrow: 60 }).why
  assert.match(why, /30 min/)
  assert.match(why, /31 min/)
})

test('a newly added exercise starts at a sensible time for its unit', async () => {
  const { startCfg } = await import('../js/plan.js')
  assert.equal(startCfg({ id: 'c:run', mode: 'time', timeUnit: 'min' }, {}).repsMin, 1200)
  assert.equal(startCfg({ id: 'plank', mode: 'time' }, {}).repsMin, 30)
  assert.equal(startCfg({ id: 'c:hike', mode: 'time', timeUnit: 'h' }, {}).repsMin, 3600)
  assert.deepEqual(startCfg({ id: 'bench', mode: 'reps' }, {}), { sets: 3, repsMin: 8, repsMax: 12, rir: 2 })
})

test('distance converts, formats and gives a pace', async () => {
  const { toDist, fromDist, fmtDistance, fmtPace, tracksDistance, distUnitOf } = await import('../js/duration.js')
  assert.equal(fromDist(5.2, 'km'), 5200)
  assert.equal(toDist(5200, 'km'), 5.2)
  assert.equal(fromDist(2000, 'm'), 2000)
  assert.equal(fmtDistance(850), '850 m')
  assert.equal(fmtDistance(5230), '5.23 km')
  assert.equal(fmtDistance(0), '')
  assert.equal(fmtPace(1650, 5000), '5:30 /km')
  assert.equal(tracksDistance({ mode: 'time', distance: true }), true)
  assert.equal(tracksDistance({ mode: 'reps', distance: true }), false)
  assert.equal(distUnitOf({ id: 'x', distUnit: 'm' }, {}), 'm')
})

test('farther is a record, and last time shows distance with time', async () => {
  const { recordsBroken } = await import('../js/records.js')
  const run = (dist, sec) => ({ exId: 'c:run', sets: [{ sec, dist, done: true }] })
  assert.deepEqual(recordsBroken(run(6000, 1800), [run(5000, 1800)]), [{ kind: 'distance', value: 6000, prev: 5000 }])
  const { lastTimeLine } = await import('../js/plan.js')
  const line = lastTimeLine([{ date: '2026-10-18', entries: [run(5000, 1500)] }], 'c:run', () => '')
  assert.equal(line.text, '5 km in 25 min')
})
