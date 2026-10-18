import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addLog, removeLog, updateLog, setMood, streak, nextUnlock, hourly, periodTotals, weekSeries, breakdown, moodInsight,
  dayNet, dateOf, tsFromHHMM, stageFor, pctOf, ratiosOf, goalOf, capyOn, netOf, DEFAULT_RATIOS, INSIGHT_MIN_DAYS,
} from '../js/water.js'
import { addDays } from '../js/schedule.js'

const at = (date, hhmm) => new Date(`${date}T${hhmm}:00`).getTime()
const log = (id, date, hhmm, volume = 250, type = 'water') => ({ id, type, volume, ts: at(date, hhmm) })
const R = DEFAULT_RATIOS
const TODAY = '2026-10-18'

test('addLog files a drink under the local day of its time, without touching the original', () => {
  const empty = {}
  const { water, date } = addLog(empty, log('a', TODAY, '08:15'))
  assert.equal(date, TODAY)
  assert.equal(water[TODAY].logs.length, 1)
  assert.deepEqual(empty, {})
  const late = addLog(water, log('b', '2026-10-17', '23:30')).water
  assert.equal(late['2026-10-17'].logs[0].id, 'b')
  assert.equal(late[TODAY].logs.length, 1)
})

test('removeLog returns the removed drink and drops days left empty', () => {
  const w = addLog({}, log('a', TODAY, '08:15')).water
  const r = removeLog(w, 'a')
  assert.equal(r.log.id, 'a')
  assert.equal(r.date, TODAY)
  assert.equal(r.water[TODAY], undefined)
  assert.equal(removeLog(w, 'missing').log, null)
})

test('a day with only a mood check-in is kept when its drinks go', () => {
  let w = addLog({}, log('a', TODAY, '08:15')).water
  w = setMood(w, TODAY, 'tired')
  w = removeLog(w, 'a').water
  assert.deepEqual(w[TODAY], { logs: [], mood: 'tired' })
  assert.equal(setMood(w, TODAY, null)[TODAY], undefined)
})

test('updateLog changes volume and type, and moves the drink if its time crosses midnight', () => {
  let w = addLog({}, { ...log('a', TODAY, '07:00'), name: 'Americano', type: 'coffee' }).water
  const same = updateLog(w, 'a', { volume: 400 })
  assert.equal(same.water[TODAY].logs[0].volume, 400)
  assert.equal(same.water[TODAY].logs[0].name, 'Americano')
  assert.deepEqual(same.dates, [TODAY])
  const renamed = updateLog(w, 'a', { type: 'tea', name: undefined })
  assert.equal('name' in renamed.water[TODAY].logs[0], false)
  const moved = updateLog(w, 'a', { ts: at('2026-10-17', '21:00') })
  assert.equal(moved.water[TODAY], undefined)
  assert.equal(moved.water['2026-10-17'].logs[0].id, 'a')
  assert.deepEqual(moved.dates, [TODAY, '2026-10-17'])
})

test('net hydration uses the ratio for each drink', () => {
  const r = { ...R, coffee: 0.8 }
  let w = addLog({}, log('a', TODAY, '08:00', 500)).water
  w = addLog(w, log('b', TODAY, '09:00', 250, 'coffee')).water
  assert.equal(dayNet(w, TODAY, R), 750)
  assert.equal(dayNet(w, TODAY, r), 700)
  assert.equal(netOf({ type: 'mystery', volume: 100 }, R), 100)
})

test('settings: ratios merge over defaults, goal is clamped, CapySpa is on unless switched off', () => {
  assert.equal(ratiosOf({ capyRatios: { tea: 0.9 } }).tea, 0.9)
  assert.equal(ratiosOf({}).water, 1)
  assert.equal(goalOf({}), 2500)
  assert.equal(goalOf({ waterGoal: 99999 }), 6000)
  assert.equal(capyOn({}), true)
  assert.equal(capyOn({ capyspa: false }), false)
})

test('stages unlock at 26, 51 and 76 percent', () => {
  assert.deepEqual([0, 25, 26, 50, 51, 75, 76, 140].map(stageFor), [0, 0, 1, 1, 2, 2, 3, 3])
  assert.equal(pctOf(1249, 2500), 49)
  const u = nextUnlock(600, 2500)
  assert.equal(u.next.name, 'Towel Time')
  assert.equal(u.need, 50)
  assert.equal(nextUnlock(2000, 2500).next, null)
  assert.equal(nextUnlock(2000, 2500).need, 500)
})

test('streak counts goal days in a row; an unfinished today does not break it', () => {
  let w = {}
  for (let i = 1; i <= 3; i++) w = addLog(w, log('d' + i, addDays(TODAY, -i), '10:00', 2500)).water
  w = addLog(w, log('old', addDays(TODAY, -5), '10:00', 2500)).water
  assert.equal(streak(w, R, 2500, TODAY), 3)
  w = addLog(w, log('t', TODAY, '10:00', 2600)).water
  assert.equal(streak(w, R, 2500, TODAY), 4)
  assert.equal(streak({}, R, 2500, TODAY), 0)
})

test('hourly buckets and periods', () => {
  const logs = [log('a', TODAY, '06:10', 200), log('b', TODAY, '06:50', 100), log('c', TODAY, '13:00'), log('d', TODAY, '22:00'), log('e', TODAY, '02:00')]
  const b = hourly(logs, R)
  assert.equal(b[6], 300)
  assert.deepEqual(periodTotals(b), { morning: 300, afternoon: 250, evening: 500 })
})

test('weekSeries ends on today, or a week earlier', () => {
  const w = addLog({}, log('a', addDays(TODAY, -8), '10:00', 900)).water
  const thisWeek = weekSeries(w, R, TODAY)
  assert.equal(thisWeek.length, 7)
  assert.equal(thisWeek[6].date, TODAY)
  assert.equal(thisWeek[6].today, true)
  const last = weekSeries(w, R, TODAY, 1)
  assert.equal(last[6].date, addDays(TODAY, -7))
  assert.equal(last.find(d => d.date === addDays(TODAY, -8)).total, 900)
})

test('breakdown sums volume per drink type', () => {
  const t = breakdown([log('a', TODAY, '08:00', 300), log('b', TODAY, '09:00', 200, 'tea')])
  assert.deepEqual(t, { water: 300, tea: 200, coffee: 0, juice: 0 })
})

test('mood insight stays locked until 30 finished days with 5 on each side of 90%', () => {
  let w = {}
  const fill = (n, offset, total, mood) => {
    for (let i = 0; i < n; i++) {
      const d = addDays(TODAY, -(offset + i))
      w = setMood(addLog(w, log(d, d, '10:00', total)).water, d, mood)
    }
  }
  fill(20, 1, 2400, 'energy') // 96%: high
  fill(4, 21, 1000, 'tired') // low, only 4 days
  w = setMood(addLog(w, log('today', TODAY, '10:00', 100)).water, TODAY, 'headachy') // today never counts
  const locked = moodInsight(w, R, 2500, TODAY)
  assert.equal(locked.ready, false)
  assert.equal(locked.days, 24)
  fill(6, 25, 1000, 'tired')
  const ready = moodInsight(w, R, 2500, TODAY)
  assert.equal(ready.days, INSIGHT_MIN_DAYS)
  assert.equal(ready.ready, true)
  assert.equal(ready.hiN, 20)
  assert.equal(ready.loN, 10)
  assert.equal(ready.lift, 100) // 4 vs 2
})

test('tsFromHHMM: a time later than now means the day before', () => {
  const now = at(TODAY, '09:00')
  assert.equal(dateOf(tsFromHHMM('08:30', TODAY, now)), TODAY)
  assert.equal(dateOf(tsFromHHMM('21:00', TODAY, now)), '2026-10-17')
  assert.equal(dateOf(tsFromHHMM('21:00', '2026-10-15', now)), '2026-10-15')
})

test('backups carry the CapySpa log, and older backups without one leave it alone', async () => {
  const { makeBackup, parseBackup } = await import('../js/store.js')
  const water = setMood(addLog({}, log('a', TODAY, '08:00')).water, TODAY, 'focused')
  const back = parseBackup(makeBackup({ profile: { settings: {} }, workouts: [], food: {}, water }))
  assert.deepEqual(back.water, water)
  assert.equal(parseBackup(JSON.stringify({ profile: {}, workouts: [] })).water, undefined)
  const junk = parseBackup(JSON.stringify({ profile: {}, workouts: [], water: { [TODAY]: { logs: 'nope' }, x: null } }))
  assert.deepEqual(junk.water, {})
})
