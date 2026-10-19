import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeRoutine, decodeRoutine, shareUrl, sharedFromHash } from '../js/share.js'

const CORE = new Set(['bench', 'squat', 'pullup'])
const isKnown = id => CORE.has(id)
const fdbEx = { id: 'fdb:Cable_Fly', name: 'Cable fly', eq: 'cable', p: ['chest'], s: ['deltoids'], fdb: 'Cable_Fly', img: 2, mode: 'reps', uni: false, cues: [], custom: false }
const routine = { id: 'r1', name: 'Push Day 💪', folder: 'f1', items: [
  { exId: 'bench', sets: 4, repsMin: 5, repsMax: 8, rir: 2, rest: 180, prog: 'linear', group: 'a' },
  { exId: 'fdb:Cable_Fly', sets: 3, repsMin: 10, repsMax: 15, rir: 1, group: 'a' },
] }
const lookup = id => (id === fdbEx.id ? fdbEx : null)

test('a routine survives the round trip, emoji and catalogue exercise included', () => {
  const back = decodeRoutine(encodeRoutine(routine, lookup), isKnown)
  assert.equal(back.name, 'Push Day 💪')
  assert.deepEqual(back.items, routine.items)
  assert.deepEqual(back.exercises.map(e => e.id), ['fdb:Cable_Fly'])
  assert.equal(back.exercises[0].name, 'Cable fly')
})

test('links put the routine after # and can be read back from the hash', () => {
  const url = shareUrl('https://zimboking.github.io/power-level/#old', routine, lookup)
  assert.ok(url.startsWith('https://zimboking.github.io/power-level/#routine='))
  const packed = sharedFromHash(new URL(url).hash)
  assert.equal(decodeRoutine(packed, isKnown).items.length, 2)
  assert.equal(sharedFromHash('#something-else'), null)
  assert.equal(sharedFromHash(''), null)
})

test('values from a link are clamped, and unknown or malformed parts are dropped', () => {
  const pack = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const back = decodeRoutine(pack({ v: 1, name: '  Sneaky\u0007 <b>name</b>  '.padEnd(200, 'x'), items: [
    { exId: 'bench', sets: 999, repsMin: -5, repsMax: 3, rir: 9, rest: 99999, prog: 'eval', group: '<script>' },
    { exId: 'mystery', sets: 3 }, // not built in and no details sent
    { exId: '../../etc', sets: 3 },
    null,
  ], ex: [{ id: 'mystery-not-used', name: 'x' }] }), isKnown)
  assert.equal(back.items.length, 1)
  assert.deepEqual(back.items[0], { exId: 'bench', sets: 20, repsMin: 1, repsMax: 3, rir: 5, rest: 1800 })
  assert.equal(back.name.length, 60)
  assert.ok(!back.name.includes('\u0007'))
  assert.deepEqual(back.exercises, [])
})

test('a sent exercise is cleaned before it is stored', () => {
  const pack = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const back = decodeRoutine(pack({ v: 1, name: 'R', items: [{ exId: 'my:thing', sets: 3, repsMin: 8, repsMax: 12 }],
    ex: [{ id: 'my:thing', name: 'Thing', eq: 'rocket', p: ['chest', 'not a muscle!'], fdb: 'javascript:alert(1)', mode: 'time', uni: 'yes', custom: true }] }), isKnown)
  assert.deepEqual(back.exercises[0], { id: 'my:thing', name: 'Thing', eq: 'other', p: ['chest'], s: [], mode: 'time', uni: false, cues: [], custom: true })
})

test('junk links are refused', () => {
  assert.throws(() => decodeRoutine('%%%', isKnown))
  assert.throws(() => decodeRoutine(Buffer.from('{"v":2,"items":[]}').toString('base64url'), isKnown))
  assert.throws(() => decodeRoutine(Buffer.from('{"v":1,"items":[{"exId":"nope"}]}').toString('base64url'), isKnown))
})
