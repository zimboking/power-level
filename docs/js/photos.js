// Progress photos live in this browser's IndexedDB (too big for localStorage), shrunk on the
// device first. They're never uploaded anywhere. They have their own backup file (photos are
// far bigger than everything else), made and restored from Settings.
const DB = 'powerlevel-photos', STORE = 'photos', MAX_SIDE = 1280

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function tx(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

export const listPhotos = async () => ((await tx('readonly', s => s.getAll())) || []).sort((a, b) => a.date.localeCompare(b.date))
export const deletePhoto = id => tx('readwrite', s => s.delete(id))

// Downscale and re-encode. Re-drawing through a canvas also drops the camera's location data.
export async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.82))
}

export const putPhotos = photos => tx('readwrite', s => { photos.forEach(p => s.put(p)) })

export const PHOTO_BACKUP_KIND = 'power-level-photos'
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 15e6
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[a-z0-9]{1,40}$/i

// btoa/atob work on binary strings; go in slices so big photos don't overflow the call stack.
function toBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromBase64(text) {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** photos: [{ id, date, blob }] → JSON text. */
export async function makePhotoBackup(photos) {
  const list = []
  for (const p of photos) list.push({ id: p.id, date: p.date, type: p.blob.type || 'image/jpeg', data: toBase64(new Uint8Array(await p.blob.arrayBuffer())) })
  return JSON.stringify({ kind: PHOTO_BACKUP_KIND, version: 1, savedAt: new Date().toISOString(), photos: list })
}

/** JSON text → [{ id, date, blob }]. Throws on anything that isn't a photo backup; skips bad entries. */
export function parsePhotoBackup(text) {
  const d = JSON.parse(text)
  if (!d || d.kind !== PHOTO_BACKUP_KIND || !Array.isArray(d.photos)) throw new Error('not a photo backup')
  const out = []
  for (const p of d.photos) {
    if (!p || !ID_RE.test(p.id) || !DATE_RE.test(p.date) || !PHOTO_TYPES.includes(p.type) || typeof p.data !== 'string') continue
    if (p.data.length * 0.75 > MAX_PHOTO_BYTES) continue
    let bytes
    try { bytes = fromBase64(p.data) } catch { continue }
    out.push({ id: p.id, date: p.date, blob: new Blob([bytes], { type: p.type }) })
  }
  return out
}

/** The backup photos this device doesn't have yet (matched by id). Restoring never deletes. */
export const newPhotos = (have, incoming) => {
  const ids = new Set(have.map(p => p.id))
  return incoming.filter(p => !ids.has(p.id))
}

export async function addPhoto(file, date) {
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  const blob = await shrink(file)
  const photo = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date, blob }
  await tx('readwrite', s => s.put(photo))
  return photo
}
