import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makePhotoBackup, parsePhotoBackup, newPhotos, PHOTO_BACKUP_KIND } from '../js/photos.js'

const bytes = n => Uint8Array.from({ length: n }, (_, i) => (i * 37) % 256)
const photo = (id, date, n = 64, type = 'image/jpeg') => ({ id, date, blob: new Blob([bytes(n)], { type }) })
const bytesOf = async blob => [...new Uint8Array(await blob.arrayBuffer())]

test('photo backups round-trip every byte, date and type', async () => {
  const photos = [photo('a1', '2026-09-01'), photo('b2', '2026-10-01', 200000, 'image/png')] // > one 32 KB slice
  const back = parsePhotoBackup(await makePhotoBackup(photos))
  assert.deepEqual(back.map(p => [p.id, p.date, p.blob.type]), [['a1', '2026-09-01', 'image/jpeg'], ['b2', '2026-10-01', 'image/png']])
  assert.deepEqual(await bytesOf(back[1].blob), [...bytes(200000)])
})

test('the wrong file is refused, and bad entries are skipped rather than trusted', () => {
  assert.throws(() => parsePhotoBackup('{"kind":"power-level-backup","profile":{},"workouts":[]}'))
  assert.throws(() => parsePhotoBackup('not json'))
  const ok = { id: 'ok', date: '2026-10-01', type: 'image/jpeg', data: btoa('abc') }
  const file = JSON.stringify({ kind: PHOTO_BACKUP_KIND, version: 1, photos: [
    ok,
    { ...ok, id: '../evil' },
    { ...ok, id: 'svg', type: 'image/svg+xml' },
    { ...ok, id: 'date', date: 'yesterday' },
    { ...ok, id: 'b64', data: '***' },
    null,
  ] })
  assert.deepEqual(parsePhotoBackup(file).map(p => p.id), ['ok'])
})

test('restoring only adds photos this device lacks', () => {
  const have = [photo('a', '2026-09-01')]
  const incoming = [photo('a', '2026-09-01'), photo('b', '2026-09-15')]
  assert.deepEqual(newPhotos(have, incoming).map(p => p.id), ['b'])
  assert.deepEqual(newPhotos([], incoming).length, 2)
})
