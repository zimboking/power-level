// Reopening a finished workout, and the counts behind the "finish early?" check.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canResume, resumeSession, setCounts, lastFinishedFor } from '../js/resume.js'

const TODAY = '2026-11-09'
const NOW = Date.parse('2026-11-09T10:00:00')
const set = (w, r, done, extra = {}) => ({ w, r, done, ...extra })
const live = {
  id: 's1', date: TODAY, startedAt: NOW - 30 * 60000, feeling: 'great', note: '', name: 'Push', routineId: 'r-push', focus: 1,
  entries: [
    { key: 'a', exId: 'bench', cfg: { sets: 3 }, target: { kind: 'up' }, sets: [set(20, 10, true, { warmup: true }), set(100, 5, true), set(100, 5, true), set(100, 5, false)] },
    { key: 'b', exId: 'ohp', cfg: { sets: 3 }, target: { kind: 'hold' }, sets: [set(50, 8, false), set(50, 8, false)] },
  ],
}
const saved = { id: 's1', date: TODAY, name: 'Push', durationMin: 30, feeling: 'great', routineId: 'r-push', entries: [{ exId: 'bench', cfg: { sets: 3 }, target: { kind: 'up' }, sets: [set(20, 10, true, { warmup: true }), set(100, 5, true), set(100, 5, true)] }] }

test('set counts leave out warm-ups', () => {
  assert.deepEqual(setCounts(live), { done: 2, total: 5 })
  assert.deepEqual(setCounts(null), { done: 0, total: 0 })
})

test('only today’s and yesterday’s workouts can be continued', () => {
  assert.ok(canResume({ date: TODAY }, TODAY))
  assert.ok(canResume({ date: '2026-11-08' }, TODAY))
  assert.ok(!canResume({ date: '2026-11-07' }, TODAY))
  assert.ok(!canResume({ date: '2026-11-10' }, TODAY))
  assert.ok(!canResume(null, TODAY))
})

test('the workout you just finished comes back with its unticked sets', () => {
  const s = resumeSession(saved, lastFinishedFor(live, 's1'), NOW + 60 * 60000)
  assert.deepEqual(setCounts(s), { done: 2, total: 5 })
  assert.equal(s.id, 's1')
  assert.equal(s.focus, 1)
  // The hour away isn't counted: the clock restarts 30 minutes "ago".
  assert.equal(s.startedAt, NOW + 60 * 60000 - 30 * 60000)
})

test('any other recent workout comes back with what was logged, all ticked', () => {
  const s = resumeSession(saved, lastFinishedFor(live, 'someone-else'), NOW)
  assert.equal(s.entries.length, 1)
  assert.ok(s.entries[0].sets.every(x => x.done && !x.auto))
  assert.deepEqual(setCounts(s), { done: 2, total: 2 })
  assert.equal(s.startedAt, NOW - 30 * 60000)
  assert.equal(s.entries[0].cfg.repsMin, 6, 'default config fills gaps')
  assert.ok(s.entries[0].key)
})
