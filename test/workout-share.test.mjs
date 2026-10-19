import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setsLine, workoutText } from '../js/workout-share.js'
import { liftedSvg, ART_KEYS } from '../js/ui/lifted-art.js'
import { LIFTED_LADDER } from '../js/power.js'

const s = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const w = {
  name: 'Push', date: '2026-10-19', durationMin: 48,
  entries: [
    { exId: 'bench', sets: [s(60, 10, { warmup: true }), s(100, 8), s(100, 8), s(95, 7), s(95, 6, { done: false })] },
    { exId: 'dips', sets: [s(0, 12), s(0, 10)] },
    { exId: 'plank', sets: [{ sec: 90, done: true }] },
  ],
}

test('set lines group the same weight and skip warm-ups and undone sets', () => {
  assert.equal(setsLine(w.entries[0]), '100 kg × 8, 8 · 95 kg × 7')
  assert.equal(setsLine(w.entries[1]), '12, 10 reps')
  assert.equal(setsLine(w.entries[2]), '1:30 min')
  assert.equal(setsLine({ exId: 'c:run', sets: [{ sec: 1500, dist: 5000, done: true }] }), '5 km in 25 min')
})

test('the message has the title, totals, a comparison, every exercise, PRs and the link', () => {
  const text = workoutText(w, { prNames: ['Bench press'], url: 'https://zimboking.github.io/power-level/' })
  const lines = text.split('\n')
  assert.equal(lines[0], '💪 Push · Mon 19 Oct')
  assert.match(lines[1], /^3 exercises · 6 sets · 48 min · 2,265 kg lifted$/)
  assert.equal(lines[2], '≈ 1.5 × family car')
  assert.ok(text.includes('• Bench press: 100 kg × 8, 8 · 95 kg × 7 🏆 PR'))
  assert.ok(text.includes('• Dips: 12, 10 reps'))
  assert.ok(text.endsWith('Tracked with Power Level: https://zimboking.github.io/power-level/'))
})

test('every lifted comparison has a drawing, and unknown ones fall back to a dumbbell', () => {
  assert.ok(LIFTED_LADDER.every(i => ART_KEYS.includes(i.art)))
  assert.match(liftedSvg('piano'), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 160 100"/)
  assert.equal(liftedSvg('nope'), liftedSvg('dumbbell'))
  assert.ok(!/var\(--/.test(ART_KEYS.map(k => liftedSvg(k)).join('')), 'no CSS variables, so canvas drawing works')
})
