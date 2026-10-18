import { test } from 'node:test'
import assert from 'node:assert/strict'
import { e1rm, weightFor, warmupSets, platesFor, nextSetAdvice, nextSessionTarget, applyFeeling, rollingAverage, currentE1rm, workoutVolume } from '../js/strength.js'
import { planJourney, percentThere, guessLevel } from '../js/journey.js'
import { tierFor, liftedComparison, powerLevel } from '../js/power.js'
import { targets, macrosFor, sumEntries, FOODS } from '../js/nutrition.js'

const set = (w, r, rir = 0, extra = {}) => ({ w, r, rir, done: true, ...extra })

test('e1rm: a single is the 1RM, RIR adds reps', () => {
  assert.equal(e1rm(100, 1, 0), 100)
  assert.ok(e1rm(100, 5, 2) > e1rm(100, 5, 0))
  assert.equal(e1rm(0, 5), null)
  assert.equal(e1rm(100, 25), null)
})

test('weightFor inverts e1rm on the plate grid', () => {
  const one = e1rm(100, 5, 2)
  assert.equal(weightFor(one, 5, 2), 100)
})

test('warm-ups ramp below the working weight and skip duplicates', () => {
  const w = warmupSets(100)
  assert.deepEqual(w.map(s => s.w), [20, 40, 60, 80])
  assert.ok(w.every(s => s.warmup))
  assert.deepEqual(warmupSets(20), [])
  assert.deepEqual(warmupSets(30).map(s => s.w), [20, 25])
})

test('plates per side', () => {
  const p = platesFor(140)
  assert.deepEqual(p.perSide, [25, 25, 10])
  assert.ok(p.ok)
  assert.equal(platesFor(101).ok, false)
})

test('next set: on target keeps weight, too easy goes up, grind goes down', () => {
  const target = { repsMin: 6, repsMax: 8, rir: 2 }
  assert.equal(nextSetAdvice(set(100, 7, 2), target).change, 0)
  assert.ok(nextSetAdvice(set(100, 12, 3), target).change > 0)
  assert.ok(nextSetAdvice(set(100, 4, 0), target).change < 0)
})

test('next session: double progression with RIR', () => {
  const cfg = { repsMin: 6, repsMax: 8, sets: 3, rir: 2 }
  const top = { sets: [set(100, 8, 2), set(100, 8, 2), set(100, 8, 1)] }
  assert.deepEqual([nextSessionTarget(top, cfg).kind, nextSessionTarget(top, cfg).w], ['up', 102.5])
  const mid = { sets: [set(100, 7, 2), set(100, 6, 2), set(100, 6, 1)] }
  assert.deepEqual([nextSessionTarget(mid, cfg).kind, nextSessionTarget(mid, cfg).r], ['reps', 7])
  const miss = { sets: [set(100, 5, 0), set(100, 4, 0), set(100, 3, 0)] }
  const down = nextSessionTarget(miss, cfg)
  assert.equal(down.kind, 'down')
  assert.ok(down.w < 100)
  assert.ok(nextSessionTarget(null, cfg).kind === 'first')
  // warm-ups never count toward progression
  const withWarm = { sets: [set(60, 12, 5, { warmup: true }), ...top.sets] }
  assert.equal(nextSessionTarget(withWarm, cfg).kind, 'up')
})

test('feeling rough eases the load', () => {
  const t = applyFeeling({ w: 100, r: 5, why: 'x' }, 'rough')
  assert.equal(t.w, 90)
  assert.equal(applyFeeling({ w: 100, why: 'x' }, 'great').w, 100)
})

test('rolling average', () => {
  assert.deepEqual(rollingAverage([10, 20, 30, 40, 50], 2), [10, 15, 25, 35, 45])
})

test('journey reaches the goal, deloads every 4th week, ends on a test', () => {
  const j = planJourney({ start: 110, goal: 140, level: 'intermediate', startDate: '2026-10-17' })
  assert.ok(j.reachable)
  assert.equal(j.weeks[3].deload, true)
  assert.equal(j.weeks.at(-1).phase, 'Test day')
  assert.equal(j.weeks.at(-1).w, 140)
  assert.ok(j.etaDate > '2026-10-17')
  for (let i = 1; i < j.weeks.length; i++) assert.ok(j.weeks[i].e1rm >= j.weeks[i - 1].e1rm)
  const fast = planJourney({ start: 110, goal: 140, level: 'beginner' })
  assert.ok(fast.totalWeeks < j.totalWeeks)
  assert.equal(planJourney({ start: 100, goal: 400, level: 'advanced' }).reachable, false)
})

test('percent there and level guess', () => {
  assert.equal(percentThere(100, 120, 140), 50)
  assert.equal(guessLevel(70, 80, 'bench'), 'beginner')
  assert.equal(guessLevel(140, 80, 'bench'), 'advanced')
})

test('power tiers and volume comparisons', () => {
  assert.equal(tierFor(0).name, 'Rookie')
  assert.equal(tierFor(4600).name, 'Ascended')
  const c = liftedComparison(13000)
  assert.equal(c.best.name, 'a school bus')
  assert.equal(c.next.name, 'a Leopard 2 tank')
  const workouts = [{ date: '2026-10-01', entries: [{ exId: 'bench', sets: [set(100, 5, 1)] }] }]
  assert.ok(powerLevel(workouts) > 1000)
  assert.equal(workoutVolume(workouts[0]), 500)
  assert.ok(currentE1rm(workouts, 'bench') > 100)
})

test('nutrition targets and food maths', () => {
  const t = targets({ sex: 'male', weight: 85, height: 180, age: 28, activity: 'moderate', goal: 'maintain' })
  assert.ok(t.kcal > 2500 && t.kcal < 3000)
  assert.equal(t.protein, 170)
  assert.equal(targets({ weight: 0 }), null)
  const chicken = FOODS.find(f => f.name.startsWith('Chicken breast'))
  assert.equal(macrosFor(chicken, 200).p, 62)
  assert.equal(sumEntries([{ kcal: 100, p: 10, c: 0, f: 1 }, { kcal: 50, p: 1, c: 10, f: 0 }]).kcal, 150)
})

test('energy units: stored as kcal, shown and entered as kJ', async () => {
  const { toUnit, fromUnit, fmtEnergy, energyUnitOf } = await import('../js/nutrition.js')
  assert.equal(toUnit(100, 'kj'), 418)
  assert.equal(toUnit(100, 'kcal'), 100)
  assert.equal(fromUnit(2000, 'kj'), 478)
  assert.equal(fromUnit(toUnit(2500, 'kj'), 'kj'), 2500)
  assert.equal(fmtEnergy(2000, 'kj'), '8,368 kJ')
  assert.equal(energyUnitOf({ energy: 'kj' }), 'kj')
  assert.equal(energyUnitOf({}), 'kcal')
})

test('backups round-trip and reject the wrong file', async () => {
  const { makeBackup, parseBackup } = await import('../js/store.js')
  const state = { profile: { goals: [] }, workouts: [{ id: 'a', date: '2026-10-01', entries: [] }], food: { '2026-10-01': [] }, water: {} }
  const back = parseBackup(makeBackup(state))
  assert.deepEqual(back, state)
  assert.throws(() => parseBackup('{"hello":1}'))
  assert.throws(() => parseBackup('{"profile":{},"workouts":[{"nope":1}]}'))
  assert.throws(() => parseBackup('not json'))
})
