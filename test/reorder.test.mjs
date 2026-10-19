import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveItem, dropIndex, shiftFor } from '../js/reorder.js'

test('moveItem moves one item and leaves the original alone', () => {
  const list = ['a', 'b', 'c', 'd']
  assert.deepEqual(moveItem(list, 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveItem(list, 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(moveItem(list, 1, 9), ['a', 'c', 'd', 'b'])
  assert.equal(moveItem(list, 2, 2), list)
  assert.deepEqual(list, ['a', 'b', 'c', 'd'])
})

test('dropIndex: the dragged item lands once its centre passes a neighbour\'s centre', () => {
  const mids = [50, 150, 250, 350] // 100 px rows
  assert.equal(dropIndex(mids, 0, 50), 0)
  assert.equal(dropIndex(mids, 0, 149), 0)
  assert.equal(dropIndex(mids, 0, 151), 1)
  assert.equal(dropIndex(mids, 0, 400), 3)
  assert.equal(dropIndex(mids, 3, 249), 2)
  assert.equal(dropIndex(mids, 3, -50), 0)
})

test('shiftFor makes room in the right direction', () => {
  assert.deepEqual([0, 1, 2, 3].map(i => shiftFor(i, 0, 2, 100)), [0, -100, -100, 0])
  assert.deepEqual([0, 1, 2, 3].map(i => shiftFor(i, 3, 1, 100)), [0, 100, 100, 0])
})
