// Lift charts, body weight against food and the monthly recap.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { liftSeries, seriesChange, weightVsFood, monthRecap, shiftMonth } from '../js/progress.js'

const s = (w, r) => ({ w, r, done: true })
const wk = (id, date, sets, extra = {}) => ({ id, date, startedAt: 1, name: 'Push', durationMin: 60, entries: [{ exId: 'bench', sets }], ...extra })
const workouts = [
  wk('a', '2026-09-01', [s(80, 5), s(80, 5)]),
  wk('b', '2026-10-05', [s(85, 5), s(80, 8)], { feeling: 'flat' }),
  wk('c', '2026-10-20', [s(90, 5), { w: 60, r: 5, done: true, warmup: true }]),
]

test('lift series: estimated 1RM, top set and volume per session, with a range', () => {
  const top = liftSeries(workouts, 'bench', 'top')
  assert.deepEqual(top.map(p => p.y), [80, 85, 90])
  assert.equal(top[1].flag, true)
  assert.deepEqual(liftSeries(workouts, 'bench', 'volume').map(p => p.y), [800, 1065, 450])
  const e = liftSeries(workouts, 'bench', 'e1rm', '2026-10-01')
  assert.equal(e.length, 2)
  assert.ok(e[1].y > e[0].y)
  assert.deepEqual(liftSeries(workouts, 'squat'), [])
  const ch = seriesChange(top)
  assert.deepEqual([ch.from, ch.to, ch.change], [80, 90, 10])
  assert.equal(Math.round(ch.pct * 10) / 10, 12.5)
  assert.equal(seriesChange(top.slice(0, 1)), null)
})

test('weight against food: weekly averages, and a maintenance estimate only with enough data', () => {
  const today = '2026-11-13' // a Friday; weeks start Monday
  const food = {}, weighins = []
  // Five full weeks eating 2,500 kcal a day while losing 0.5 kg a week.
  for (let w = 0; w < 5; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(Date.UTC(2026, 9, 5 + w * 7 + d)).toISOString().slice(0, 10)
      food[date] = [{ kcal: 2500, p: 150, c: 0, f: 0 }]
      if (d === 2) weighins.push({ date, kg: 90 - w * 0.5 })
    }
  }
  const { rows, summary } = weightVsFood(weighins, food, today, 8)
  assert.equal(rows.length, 8)
  assert.equal(rows[7].start, '2026-11-09')
  assert.equal(rows[0].kg, null)
  assert.equal(rows[2].kcal, 2500)
  assert.equal(rows[2].kg, 90)
  assert.equal(summary.weeks, 5)
  assert.equal(Math.round(summary.kgPerWeek * 100) / 100, -0.5)
  assert.equal(Math.round(summary.maintenance), 3050) // 2500 + 0.5 × 7700 / 7
  // Too little: two weeks of data, or weeks with only a couple of logged days.
  assert.equal(weightVsFood(weighins.slice(0, 2), food, today, 8).summary, null)
  const thin = Object.fromEntries(Object.entries(food).filter((_, i) => i % 4 === 0))
  assert.equal(weightVsFood(weighins, thin, today, 8).summary, null)
  assert.equal(weightVsFood([], {}, today).summary, null)
})

test('monthly recap: counts, records, best lifts and weight change for one month', () => {
  const r = monthRecap(workouts, [{ date: '2026-10-02', kg: 84 }, { date: '2026-10-28', kg: 83.2 }, { date: '2026-11-01', kg: 99 }], '2026-10')
  assert.equal(r.workouts, 2)
  assert.equal(r.days, 2)
  assert.equal(r.minutes, 120)
  assert.equal(r.sets, 3) // the warm-up doesn't count
  assert.equal(r.volume, 1515)
  assert.deepEqual(r.prs, ['Bench press'])
  assert.equal(r.lifts[0].name, 'Bench press')
  assert.deepEqual(r.most, { name: 'Bench press', sets: 3 })
  assert.equal(Math.round(r.weight.change * 10) / 10, -0.8)
  const empty = monthRecap(workouts, [], '2026-08')
  assert.deepEqual([empty.workouts, empty.volume, empty.most, empty.weight, empty.prs.length], [0, 0, null, null, 0])
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
})
