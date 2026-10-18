import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, isoLocal } from '../js/schedule.js'
import { addWeeks } from '../js/journey.js'

// Day maths must give the same calendar dates wherever the phone is. Node reads TZ when a
// Date is used, so each case switches zone before it runs.
const ZONES = ['Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'Pacific/Kiritimati', 'UTC', 'America/Los_Angeles', 'Pacific/Honolulu']
const inZones = fn => {
  const was = process.env.TZ
  try { for (const tz of ZONES) { process.env.TZ = tz; fn(tz) } } finally { process.env.TZ = was }
}

test('addDays moves exactly n calendar days in every time zone, across DST changes', () => inZones(tz => {
  assert.equal(addDays('2026-10-19', 1), '2026-10-20', tz)
  assert.equal(addDays('2026-10-19', -1), '2026-10-18', tz)
  assert.equal(addDays('2026-10-03', 1), '2026-10-04', tz) // night before Sydney's DST starts
  assert.equal(addDays('2026-04-04', 1), '2026-04-05', tz) // Sydney's DST ends
  assert.equal(addDays('2026-09-26', 1), '2026-09-27', tz) // Auckland's DST starts
  assert.equal(addDays('2026-12-31', 1), '2027-01-01', tz)
  assert.equal(addDays('2026-03-01', -1), '2026-02-28', tz)
  assert.equal(addDays('2026-10-19', 0), '2026-10-19', tz)
}))

test('addWeeks moves whole weeks without slipping a day', () => inZones(tz => {
  assert.equal(addWeeks('2026-10-19', 1), '2026-10-26', tz)
  assert.equal(addWeeks('2026-10-19', 12), '2027-01-11', tz)
}))

test('isoLocal gives the local calendar date, not the UTC one', () => inZones(tz => {
  assert.equal(isoLocal(new Date(2026, 9, 19, 0, 5)), '2026-10-19', tz) // just after midnight
  assert.equal(isoLocal(new Date(2026, 9, 19, 23, 55)), '2026-10-19', tz)
}))
