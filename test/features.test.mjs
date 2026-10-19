import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextTarget, sessionHit, stallCount, effortLabel } from '../js/progression.js'
import { setsByMuscle, fatigueByMuscle, daysSinceByMuscle, fatigueLevel } from '../js/muscles.js'
import { plannedFor, nextSession, weekOf, applyStarter, addDays } from '../js/schedule.js'
import { streakWeeks, heatmap, balance, weightChange30 } from '../js/stats.js'
import { entryVolume } from '../js/strength.js'
import { STARTER_PLANS, barWeight, usesPlates, exInfo } from '../js/exercises.js'

const s = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const entry = (sets, target) => ({ exId: 'bench', sets, target })

test('linear: every rep → up, miss → hold, three misses → deload', () => {
  const cfg = { policy: 'linear', sets: 3, repsMin: 5, repsMax: 5 }
  assert.equal(nextTarget([entry([s(100, 5), s(100, 5), s(100, 5)])], cfg).w, 102.5)
  const miss = entry([s(100, 5), s(100, 4), s(100, 3)])
  const hold = nextTarget([miss], cfg)
  assert.deepEqual([hold.kind, hold.w], ['hold', 100])
  const dl = nextTarget([miss, miss, miss], cfg)
  assert.deepEqual([dl.kind, dl.w], ['deload', 90])
  assert.equal(stallCount([miss, miss], cfg), 2)
  assert.equal(sessionHit(entry([s(100, 5), s(100, 5)]), cfg), false) // a missing set is a miss
})

test('greyskull: AMRAP beats target → up, doubled at 10+; miss → reset', () => {
  const cfg = { policy: 'greyskull', sets: 3, repsMin: 5, repsMax: 5 }
  assert.equal(nextTarget([entry([s(60, 5), s(60, 5), s(60, 7)])], cfg).w, 62.5)
  assert.equal(nextTarget([entry([s(60, 5), s(60, 5), s(60, 11)])], cfg).w, 65)
  assert.equal(nextTarget([entry([s(60, 5), s(60, 5), s(60, 4)])], cfg).kind, 'deload')
})

test('triple: reps, then sets, then load', () => {
  const cfg = { policy: 'triple', sets: 3, setsMax: 4, repsMin: 8, repsMax: 10 }
  const mid = nextTarget([entry([s(50, 9), s(50, 8), s(50, 8)], { sets: 3 })], cfg)
  assert.deepEqual([mid.kind, mid.r, mid.sets], ['reps', 9, 3])
  const addSet = nextTarget([entry([s(50, 10), s(50, 10), s(50, 10)], { sets: 3 })], cfg)
  assert.deepEqual([addSet.kind, addSet.sets, addSet.r], ['sets', 4, 8])
  const up = nextTarget([entry([s(50, 10), s(50, 10), s(50, 10), s(50, 10)], { sets: 4 })], cfg)
  assert.deepEqual([up.kind, up.w, up.sets], ['up', 52.5, 3])
})

test('time: hold every set → +5 s', () => {
  const cfg = { policy: 'time', sets: 3, sec: 30, mode: 'time' }
  const t = nextTarget([{ exId: 'plank', sets: [{ sec: 30, done: true }, { sec: 30, done: true }, { sec: 31, done: true }], target: { sec: 30 } }], cfg)
  assert.deepEqual([t.kind, t.sec], ['up', 35])
})

test('effort shows as RIR or RPE', () => {
  assert.equal(effortLabel(2, 'rir'), 'RIR 2')
  assert.equal(effortLabel(2, 'rpe'), 'RPE 8')
  assert.equal(effortLabel(5, 'rir'), 'RIR 4+')
})

test('per-side work counts both sides; warm-ups never count', () => {
  assert.equal(entryVolume({ exId: 'lunge', sets: [s(20, 10)] }), 400)
  assert.equal(entryVolume({ exId: 'bench', sets: [s(20, 10, { warmup: true }), s(100, 5)] }), 500)
})

test('bars: barbell, EZ, trap and Smith use plates with their own bar weight', () => {
  assert.equal(barWeight(exInfo('skull'), {}), 10)
  assert.equal(barWeight(exInfo('bench'), { bars: { barbell: 15 } }), 15)
  assert.equal(usesPlates(exInfo('dbcurl')), false)
})

test('muscle volume, fatigue and untrained days', () => {
  const today = '2026-10-17'
  const ws = [{ date: today, entries: [{ exId: 'bench', sets: [s(100, 5), s(100, 5)] }] }, { date: '2026-09-01', entries: [{ exId: 'squat', sets: [s(100, 5)] }] }]
  const v = setsByMuscle(ws, '2026-10-10')
  assert.deepEqual([v.chest, v.triceps, v.quadriceps], [2, 1, undefined])
  const f = fatigueByMuscle(ws, new Date(today + 'T13:00:00').getTime())
  assert.ok(f.chest > 1.9 && fatigueLevel(f.chest) === 1)
  const d = daysSinceByMuscle(ws, today)
  assert.deepEqual([d.chest, d.quadriceps, d.calves], [0, 46, Infinity])
})

test('weekly plan, overrides and next session', () => {
  const profile = { templates: [{ id: 'a', name: 'Push' }, { id: 'b', name: 'Pull' }], plan: { mode: 'weekly', days: { 1: 'a', 4: 'b' }, overrides: { '2026-10-19': 'rest' } } }
  assert.equal(plannedFor(profile, [], '2026-10-15').name, 'Pull') // Thursday
  assert.equal(plannedFor(profile, [], '2026-10-17'), null) // Saturday
  assert.equal(plannedFor(profile, [], '2026-10-19'), null) // Monday moved to rest
  const n = nextSession(profile, [], '2026-10-17')
  assert.deepEqual([n.routine.name, n.date], ['Pull', '2026-10-22'])
  assert.deepEqual(weekOf('2026-10-17', 1).slice(0, 1), ['2026-10-12'])
})

test('rotation: next session is the next one not done', () => {
  const profile = { templates: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], plan: { mode: 'rotation', rotation: ['a', 'b'], trainDays: [1, 3, 5] } }
  const ws = [{ date: '2026-10-12', routineId: 'a', entries: [] }]
  assert.equal(plannedFor(profile, ws, '2026-10-14', '2026-10-14').name, 'B')
  assert.equal(plannedFor(profile, ws, '2026-10-16', '2026-10-14').name, 'A')
})

test('starter plans load as routines plus a schedule', () => {
  let n = 0
  const p = applyStarter({ templates: [] }, STARTER_PLANS[0], () => String(++n))
  assert.equal(p.templates.length, 3)
  assert.equal(p.plan.mode, 'weekly')
  assert.equal(Object.keys(p.plan.days).length, 3)
  const r = applyStarter({ templates: [] }, STARTER_PLANS[3], () => String(++n))
  assert.equal(r.plan.mode, 'rotation')
})

test('streaks, heatmap and balance', () => {
  const today = '2026-10-17'
  const ws = [0, 7, 14].map(d => ({ date: addDays(today, -d), durationMin: 60, entries: [] }))
  assert.equal(streakWeeks(ws, today), 3)
  const h = heatmap(ws, today)
  assert.equal(h.length, 53)
  assert.equal(h.flat().find(c => c.date === today).level, 3)
  const lifts = [{ date: today, entries: [{ exId: 'squat', sets: [s(100, 1)] }, { exId: 'bench', sets: [s(60, 1)] }] }]
  const b = balance(lifts)
  assert.equal(b.find(l => l.exId === 'bench').pct, 80)
  assert.equal(weightChange30([{ date: '2026-09-15', kg: 80 }, { date: '2026-10-16', kg: 79 }], today), -1)
})

test('custom workout quick fill picks sensible exercises per muscle group', async () => {
  const { suggestItems } = await import('../js/ui/plan-tab.js').catch(() => ({}))
  if (!suggestItems) return // UI module needs a browser for its CDN import; covered in the browser check
  const ids = suggestItems(['Chest', 'Arms']).map(i => i.exId)
  assert.deepEqual(ids, ['bench', 'incline', 'curl', 'pushdown'])
})

test('moving a session onto a booked day swaps the two; onto a free day leaves a rest day', async () => {
  const { moveSession, plannedFor } = await import('../js/schedule.js')
  const profile = { templates: [{ id: 'push', name: 'Push', items: [] }, { id: 'pull', name: 'Pull', items: [] }], plan: { mode: 'weekly', days: { 1: 'push', 3: 'pull' }, weekStart: 1, overrides: {} } }
  const mon = '2026-10-19', tue = '2026-10-20', wed = '2026-10-21'
  const swapped = { ...profile, plan: { ...profile.plan, overrides: moveSession(profile, [], mon, wed, mon) } }
  assert.equal(plannedFor(swapped, [], mon, mon).id, 'pull')
  assert.equal(plannedFor(swapped, [], wed, mon).id, 'push')
  const moved = { ...profile, plan: { ...profile.plan, overrides: moveSession(profile, [], mon, tue, mon) } }
  assert.equal(plannedFor(moved, [], mon, mon), null)
  assert.equal(plannedFor(moved, [], tue, mon).id, 'push')
  // A day you've already trained on isn't swapped back.
  const trained = moveSession(profile, [{ date: wed, entries: [] }], mon, wed, mon)
  assert.equal(trained[mon], 'rest')
})

test('the default progression comes from settings; an exercise rule or a timed exercise wins', async () => {
  const { policyOf, defaultProgOf } = await import('../js/plan.js')
  const bench = exInfo('bench'), plank = exInfo('plank')
  assert.equal(policyOf({}, bench, {}), 'double')
  assert.equal(policyOf({}, bench, { defaultProg: 'linear' }), 'linear')
  assert.equal(policyOf({ prog: 'triple' }, bench, { defaultProg: 'linear' }), 'triple')
  assert.equal(policyOf({}, plank, { defaultProg: 'linear' }), 'time')
  assert.equal(policyOf({ pyramid: true }, bench, { defaultProg: 'linear' }), 'off')
  assert.equal(defaultProgOf({ defaultProg: 'time' }), 'double') // not a weight rule
})

test('with linear as the default, a full session moves the weight up', async () => {
  const { targetFor } = await import('../js/plan.js')
  const profile = { settings: { defaultProg: 'linear' }, goals: [], exercises: {} }
  const done = { date: '2026-10-12', entries: [{ exId: 'bench', target: { w: 100, r: 5 }, sets: [5, 5, 5].map(r => ({ w: 100, r, rir: 1, done: true })) }] }
  const t = targetFor({ exId: 'bench', cfg: { sets: 3, repsMin: 5, repsMax: 5, rir: 2 }, workouts: [done], profile, feeling: 'great', todayIso: '2026-10-19' })
  assert.equal(t.target.w, 102.5)
})

test('reformer pilates exercises log reps or time with no load, and have a starter plan', async () => {
  const { EXERCISES, STARTER_PLANS, isBodyweight, EQUIPMENT_NAMES } = await import('../js/exercises.js')
  const ref = EXERCISES.filter(e => e.eq === 'reformer')
  assert.ok(ref.length >= 15)
  assert.ok(ref.every(e => isBodyweight(e) && e.p.length && !e.fdb && e.cues.length === 3))
  assert.equal(EQUIPMENT_NAMES.reformer, 'Reformer')
  assert.equal(new Set(EXERCISES.map(e => e.id)).size, EXERCISES.length)
  const plan = STARTER_PLANS.find(p => p.id === 'reformer')
  assert.ok(plan.routines[0].items.every(i => ref.some(e => e.id === i.exId)))
  assert.equal(entryVolume({ exId: 'ref-footwork', sets: [{ w: 0, r: 10, done: true }] }), 0)
})
