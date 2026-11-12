// Steps: typed or pasted counts, the week, streaks and the #steps= link.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSteps, setSteps, stepsWeek, stepsAverage, stepStreak, stepsFromHash, stepGoalOf, stepsOn, STEP_GOAL, STEPS_MAX } from '../js/steps.js'

const TODAY = '2026-11-13'

test('parseSteps reads typed and pasted numbers, and refuses nonsense', () => {
  assert.equal(parseSteps('12345'), 12345)
  assert.equal(parseSteps('12,345 steps'), 12345)
  assert.equal(parseSteps('Steps today: 8 902'), 8902)
  assert.equal(parseSteps(0), 0)
  assert.equal(parseSteps(''), null)
  assert.equal(parseSteps('lots'), null)
  assert.equal(parseSteps(String(STEPS_MAX + 1)), null)
})

test('setSteps stores a day, replaces it, and clears it with 0 or nothing', () => {
  const a = setSteps(undefined, TODAY, '9,000')
  assert.deepEqual(a, { [TODAY]: 9000 })
  assert.deepEqual(setSteps(a, TODAY, 10500), { [TODAY]: 10500 })
  assert.deepEqual(setSteps(a, TODAY, 0), {})
  assert.deepEqual(setSteps(a, TODAY, 'abc'), {})
  assert.deepEqual(a, { [TODAY]: 9000 }, 'the original is not changed')
})

test('week, average over logged days, and the streak', () => {
  const steps = { '2026-11-13': 4000, '2026-11-12': 9000, '2026-11-11': 8000, '2026-11-09': 12000 }
  const week = stepsWeek(steps, TODAY)
  assert.equal(week.length, 7)
  assert.deepEqual([week[0].date, week[6].date, week[6].today], ['2026-11-07', TODAY, true])
  assert.equal(stepsAverage(week), 8250)
  assert.equal(stepsAverage(stepsWeek({}, TODAY)), 0)
  // Today isn't there yet, so the streak is the run ending yesterday; the gap on the 10th stops it.
  assert.equal(stepStreak(steps, 8000, TODAY), 2)
  assert.equal(stepStreak({ ...steps, [TODAY]: 8000 }, 8000, TODAY), 3)
  assert.equal(stepStreak({}, 8000, TODAY), 0)
})

test('goal and switch defaults', () => {
  assert.equal(stepGoalOf({}), STEP_GOAL)
  assert.equal(stepGoalOf({ stepGoal: 12000 }), 12000)
  assert.equal(stepGoalOf({ stepGoal: 5 }), 1000)
  assert.equal(stepGoalOf({ stepGoal: 'x' }), STEP_GOAL)
  assert.equal(stepsOn({}), true)
  assert.equal(stepsOn({ steps: false }), false)
})

test('#steps= links are checked: sane number, real date, not in the future', () => {
  assert.deepEqual(stepsFromHash('#steps=12345', TODAY), { date: TODAY, steps: 12345 })
  assert.deepEqual(stepsFromHash('#steps=7000&date=2026-11-12', TODAY), { date: '2026-11-12', steps: 7000 })
  assert.equal(stepsFromHash('#steps=7000&date=2026-11-14', TODAY), null)
  assert.equal(stepsFromHash('#steps=7000&date=2026-02-31', TODAY), null)
  assert.equal(stepsFromHash('#steps=999999', TODAY), null)
  assert.equal(stepsFromHash('#steps=-5', TODAY), null)
  assert.equal(stepsFromHash('#steps=12<script>', TODAY), null)
  assert.equal(stepsFromHash('#routine=abc', TODAY), null)
  assert.equal(stepsFromHash('', TODAY), null)
})
