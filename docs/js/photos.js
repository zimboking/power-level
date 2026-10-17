// Progress photos live in this browser's IndexedDB (too big for localStorage), shrunk on the
// device first. They're never uploaded anywhere and aren't part of the JSON backup.
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

export async function addPhoto(file, date) {
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  const blob = await shrink(file)
  const photo = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date, blob }
  await tx('readwrite', s => s.put(photo))
  return photo
}
