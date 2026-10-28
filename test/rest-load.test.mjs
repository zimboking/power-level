// Rest sounds queued on the audio clock, and the per-exercise bodyweight choice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setAudio, scheduleRestSounds, cancelRestSounds } from '../js/chime.js'
import { EX_BY_ID, isBodyweight, setLoadPrefs, withLoadPref, defaultBodyweight } from '../js/exercises.js'

// Just enough of an AudioContext to see what gets queued and when.
function fakeAudio() {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} })
  const node = () => ({ connect() {}, disconnect() {} })
  const ctx = {
    currentTime: 100, state: 'running', started: [], stopped: 0, destination: node(),
    resume: () => Promise.resolve(),
    createGain: () => ({ ...node(), gain: param() }),
    createDynamicsCompressor: () => ({ ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createOscillator: () => {
      const o = { ...node(), type: '', frequency: param(), start: t => ctx.started.push({ t, o }), stop: t => { if (t === 0) ctx.stopped++ } }
      return o
    },
  }
  return ctx
}

test('rest sounds are queued ahead on the audio clock: three countdown beeps, then the chime', () => {
  const ctx = fakeAudio(); setAudio(ctx)
  assert.equal(scheduleRestSounds(10_000 + 90_000, false, 10_000), true)
  const times = ctx.started.map(s => Math.round((s.t - 100) * 100) / 100)
  // Soft: one oscillator per beep. Beeps at 87, 88, 89 s, chime at 90 s (two notes).
  assert.deepEqual(times, [87, 88, 89, 90, 90.28])
  cancelRestSounds()
})

test('changing the timer calls off what was queued before', () => {
  const ctx = fakeAudio(); setAudio(ctx)
  scheduleRestSounds(60_000, true, 0)
  const first = ctx.started.length
  assert.ok(first > 0)
  scheduleRestSounds(75_000, true, 0)
  assert.equal(ctx.stopped, first)
  cancelRestSounds()
  assert.equal(ctx.stopped, ctx.started.length)
})

test('nothing is queued once the time has passed, or without audio', () => {
  const ctx = fakeAudio(); setAudio(ctx)
  assert.equal(scheduleRestSounds(1000, true, 2000), false)
  assert.equal(ctx.started.length, 0)
  setAudio(null)
  assert.equal(scheduleRestSounds(5000, true, 0), false)
})

test('a short rest skips countdown beeps that would fall before now', () => {
  const ctx = fakeAudio(); setAudio(ctx)
  scheduleRestSounds(1500, false, 0)
  assert.deepEqual(ctx.started.map(s => Math.round((s.t - 100) * 100) / 100), [0.5, 1.5, 1.78])
  cancelRestSounds(); setAudio(null)
})

test('any exercise can be switched to bodyweight (no weight) and back', () => {
  const bench = EX_BY_ID.bench, pullup = EX_BY_ID.pullup
  assert.equal(defaultBodyweight(bench), false)
  assert.equal(defaultBodyweight(pullup), true)
  let prefs = withLoadPref({}, bench, true)
  assert.deepEqual(prefs, { bench: 'bw' })
  prefs = withLoadPref(prefs, pullup, false)
  assert.deepEqual(prefs, { bench: 'bw', pullup: 'kg' })
  setLoadPrefs(prefs)
  assert.equal(isBodyweight(bench), true)
  assert.equal(isBodyweight(pullup), false)
  // Back to each exercise's own default: nothing stored.
  prefs = withLoadPref(withLoadPref(prefs, bench, false), pullup, true)
  assert.deepEqual(prefs, {})
  setLoadPrefs(prefs)
  assert.equal(isBodyweight(bench), false)
  assert.equal(isBodyweight(pullup), true)
  setLoadPrefs(undefined)
  assert.equal(isBodyweight(pullup), true)
})
