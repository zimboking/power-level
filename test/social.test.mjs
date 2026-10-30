// Crews: what leaves the phone, the leaderboard, invite codes and links.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { postFor, recentPosts, profileStats, leaderboard, reactionSummary, cleanCode, validCode, crewLink, codeFromHash, cleanName, validName, postLine, SYNC_DAYS } from '../js/social.js'
import { addDays } from '../js/schedule.js'

const TODAY = '2026-10-30'
const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra })
const workout = (id, date, entries, extra = {}) => ({ id, date, name: 'Push', durationMin: 55, feeling: 'great', note: 'knee a bit sore', entries, ...extra })
const bench = sets => ({ exId: 'bench', sets, note: 'felt heavy' })

test('a post carries the summary only: no notes, feelings or body weight', () => {
  const w = workout('w2', TODAY, [bench([set(20, 10, { warmup: true }), set(100, 5), set(100, 5)])])
  const earlier = workout('w1', addDays(TODAY, -7), [bench([set(95, 5)])])
  const p = postFor(w, [earlier, w])
  assert.deepEqual(p, {
    client_id: 'w2', done_on: TODAY, title: 'Push',
    summary: { minutes: 55, sets: 2, volume: 1000, exercises: ['Bench press'], prs: ['Bench press'] },
  })
  const text = JSON.stringify(p)
  assert.ok(!/knee|heavy|great|feeling|note/i.test(text))
})

test('only the last two weeks are kept in step with the feed', () => {
  const ws = [
    workout('old', addDays(TODAY, -(SYNC_DAYS + 1)), [bench([set(80, 5)])]),
    workout('edge', addDays(TODAY, -SYNC_DAYS), [bench([set(80, 5)])]),
    workout('now', TODAY, [bench([set(80, 5)])]),
    workout('empty', TODAY, []),
  ]
  assert.deepEqual(recentPosts(ws, TODAY).map(p => p.client_id), ['edge', 'now'])
})

test('profile numbers, with lift numbers only when shared', () => {
  const ws = [workout('a', addDays(TODAY, -8), [bench([set(100, 5)])]), workout('b', TODAY, [bench([set(102.5, 5)])])]
  const state = { workouts: ws, profile: { plan: { weekStart: 1 } } }
  const on = profileStats(state, TODAY)
  assert.equal(on.total_sessions, 2)
  assert.equal(on.week_sessions, 1)
  assert.ok(on.power_level > 0 && typeof on.tier === 'string')
  assert.ok(on.lifts.bench > 100)
  assert.equal(on.lifts.squat, undefined)
  assert.equal(profileStats(state, TODAY, { shareLifts: false }).lifts, null)
})

test('leaderboard ranks best first and ties share a place', () => {
  const people = [
    { id: 'a', display_name: 'Alex', power_level: 500, week_sessions: 2, streak_weeks: 4 },
    { id: 'b', display_name: 'Bo', power_level: 900, week_sessions: 2, streak_weeks: 1 },
    { id: 'c', display_name: 'Cy', power_level: 100, week_sessions: 3, streak_weeks: 4 },
  ]
  assert.deepEqual(leaderboard(people, 'power').map(p => [p.id, p.place]), [['b', 1], ['a', 2], ['c', 3]])
  assert.deepEqual(leaderboard(people, 'week').map(p => [p.id, p.place]), [['c', 1], ['a', 2], ['b', 2]])
  assert.deepEqual(leaderboard(people, 'streak').map(p => [p.id, p.place]), [['a', 1], ['c', 1], ['b', 3]])
})

test('reaction counts and which ones are mine', () => {
  const rows = [{ post_id: 'p', user_id: 'me', kind: 'fist' }, { post_id: 'p', user_id: 'x', kind: 'fist' }, { post_id: 'q', user_id: 'me', kind: 'fire' }]
  const s = reactionSummary(rows, 'p', 'me')
  assert.deepEqual(s.fist, { count: 2, mine: true })
  assert.deepEqual(s.fire, { count: 0, mine: false })
})

test('invite codes: tidy input, valid alphabet, links round-trip', () => {
  assert.equal(cleanCode(' abc-234 '), 'ABC234')
  assert.ok(validCode('ABC234'))
  assert.ok(!validCode('ABC2I4') && !validCode('ABC2O4') && !validCode('ABC204') && !validCode('ABC23'))
  const link = crewLink('https://zimboking.github.io/power-level/#routine=xyz', 'ABC234')
  assert.equal(link, 'https://zimboking.github.io/power-level/#crew=ABC234')
  assert.equal(codeFromHash('#crew=abc234'), 'ABC234')
  assert.equal(codeFromHash('#crew=ABC2I4'), null)
  assert.equal(codeFromHash('#routine=abc'), null)
})

test('names are trimmed and capped', () => {
  assert.equal(cleanName('  Big   Dave  '), 'Big Dave')
  assert.equal(cleanName('x'.repeat(40)).length, 30)
  assert.ok(!validName('   '))
})

test('post line reads naturally', () => {
  assert.equal(postLine({ sets: 12, volume: 4200, minutes: 50 }), `12 sets · ${(4200).toLocaleString()} kg moved · 50 min`)
  assert.equal(postLine({}), '')
})
