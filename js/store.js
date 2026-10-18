// Persistence. Each signed-in person's data is private to them in the artifact database:
//   data/users/<uid>/profile                  settings, weigh-ins, goals, templates, custom foods
//   data/users/<uid>/profile/workouts/<id>    one document per finished workout
//   data/users/<uid>/profile/food/<date>      one document per day of food
//   data/users/<uid>/profile/water/<date>     one document per day of CapySpa drinks and mood
// When the database isn't available (preview, signed out) it falls back to this browser only.

const LOCAL_KEY = 'powerlevel.v1'

export const emptyProfile = () => ({
  settings: { sex: 'male', age: 28, height: 178, activity: 'moderate', goal: 'maintain', rest: 150, plates: [25, 20, 15, 10, 5, 2.5, 1.25], bars: { barbell: 20, ez: 10, trap: 25, smith: 15 }, effort: 'rir', showEffort: true, view: 'focus', restFlash: false },
  weighins: [],
  goals: [],
  templates: [],
  customFoods: [],
  exercises: {},
  plan: null,
})

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') } catch { return null }
}
function writeLocal(state) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); return true } catch { return false }
}

async function connect() {
  const claude = window.claude
  if (!claude?.use) return null
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')])
  if (!db || !user) return null
  const uid = await user.id()
  if (!uid) return null
  return { db, root: db.doc('data/users/' + uid + '/profile') }
}

const retryOnce = async fn => {
  try { return await fn() } catch (err) {
    if (err?.code !== 'unavailable') throw err
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600))
    return fn()
  }
}

/** Load everything. Returns { mode: 'cloud'|'local', profile, workouts, food, water } */
export async function loadAll() {
  let conn = null
  try { conn = await connect() } catch { conn = null }
  if (!conn) {
    const local = readLocal() || {}
    const lp = local.profile || {}
    return { mode: 'local', conn: null, profile: { ...emptyProfile(), ...lp, settings: { ...emptyProfile().settings, ...(lp.settings || {}) } }, workouts: local.workouts || [], food: local.food || {}, water: local.water || {}, active: local.active || null }
  }
  const [p, ws, fs, hs] = await Promise.all([
    retryOnce(() => conn.root.get()),
    retryOnce(() => conn.root.collection('workouts').limit(1000).get()),
    retryOnce(() => conn.root.collection('food').limit(1000).get()),
    retryOnce(() => conn.root.collection('water').limit(1000).get()),
  ])
  const pdata = p.exists ? p.data() : {}
  const profile = { ...emptyProfile(), ...pdata, settings: { ...emptyProfile().settings, ...(pdata.settings || {}) } }
  const workouts = ws.docs.map(d => ({ ...d.data(), id: d.id }))
  const food = Object.fromEntries(fs.docs.map(d => [d.id, d.data().entries || []]))
  const water = Object.fromEntries(hs.docs.map(d => [d.id, { logs: d.data().logs || [], ...(d.data().mood ? { mood: d.data().mood } : {}) }]))
  return { mode: 'cloud', conn, profile, workouts, food, water, active: pdata.active || null }
}

// A store that writes only what changed. In local mode it writes the whole state at once.
export function createSaver(conn, getState, onError) {
  const pending = new Set()
  let timer = null
  const flush = async () => {
    timer = null
    const s = getState()
    if (!conn) {
      if (!writeLocal({ profile: s.profile, workouts: s.workouts, food: s.food, water: s.water, active: s.active })) onError?.('This browser blocked saving. Data will be lost when you close the page.')
      pending.clear()
      return
    }
    const jobs = [...pending]
    pending.clear()
    for (const job of jobs) {
      try {
        if (job === 'profile') await retryOnce(() => conn.root.set({ ...s.profile, active: s.active || null }))
        else if (job.startsWith('w:')) {
          const id = job.slice(2)
          const w = s.workouts.find(x => x.id === id)
          const ref = conn.root.collection('workouts').doc(id)
          await retryOnce(() => (w ? ref.set(w) : ref.delete()))
        } else if (job.startsWith('f:')) {
          const date = job.slice(2)
          await retryOnce(() => conn.root.collection('food').doc(date).set({ entries: s.food[date] || [] }))
        } else if (job.startsWith('h:')) {
          const date = job.slice(2)
          const day = s.water[date]
          const ref = conn.root.collection('water').doc(date)
          await retryOnce(() => (day ? ref.set({ logs: day.logs || [], mood: day.mood || null }) : ref.delete()))
        }
      } catch (err) {
        onError?.(err?.code === 'quota_exceeded' ? 'Storage is full. Delete some old workouts to keep saving.'
          : err?.code === 'invalid_argument' ? 'You need Contributor access to save. Ask whoever shared this with you.'
            : 'Couldn’t save just now. Your changes are kept on screen; try again shortly.')
        pending.add(job)
      }
    }
  }
  return {
    mark(key) { pending.add(key); if (!timer) timer = setTimeout(flush, 600) },
    flushNow: flush,
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// True when running as a plain website (GitHub Pages etc.) rather than inside Claude.
export const isStandalone = () => typeof window !== 'undefined' && !window.claude?.use

// Ask the browser not to clear this site's storage under pressure. Best effort: Chrome grants it
// to installed apps, Safari mostly ignores it, which is why backups exist.
export async function requestPersistence() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false } catch { return false }
}

export const BACKUP_KIND = 'power-level-backup'
export function makeBackup(state) {
  return JSON.stringify({ kind: BACKUP_KIND, version: 1, savedAt: new Date().toISOString(), profile: state.profile, workouts: state.workouts, food: state.food, water: state.water || {} })
}
// Validates shape before anything is replaced, so a wrong file can't wipe your data.
export function parseBackup(text) {
  const d = JSON.parse(text)
  if (!d || typeof d !== 'object' || typeof d.profile !== 'object' || !Array.isArray(d.workouts)) throw new Error('not a backup')
  if (d.workouts.some(w => !w || typeof w.date !== 'string' || !Array.isArray(w.entries))) throw new Error('bad workouts')
  // Backups from before CapySpa have no water; the caller then keeps what's on the device.
  const water = d.water && typeof d.water === 'object' && !Array.isArray(d.water)
    ? Object.fromEntries(Object.entries(d.water).filter(([, day]) => day && Array.isArray(day.logs)))
    : undefined
  return { profile: d.profile, workouts: d.workouts, food: d.food && typeof d.food === 'object' ? d.food : {}, water }
}

// Download a file on a normal website. Inside Claude downloads are blocked, so callers check isStandalone().
export function downloadFile(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
