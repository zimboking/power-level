// Crews over the network: sign-in with an emailed code, crews, profiles, the feed, reactions.
// The Supabase library is loaded only when Crews is opened, so the rest of the app stays
// offline-first and never waits on it. Every call throws an Error with a message fit to show.
import { SUPABASE_URL, SUPABASE_KEY } from './social-config.js'
import { SYNC_DAYS } from './social.js'
import { addDays } from './schedule.js'

const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm'
export const configured = () => !!(SUPABASE_URL && SUPABASE_KEY)

let clientPromise = null
export function client() {
  if (!configured()) return Promise.reject(new Error('Crews aren’t set up on this site yet.'))
  clientPromise = clientPromise || import(/* @vite-ignore */ LIB).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'pl.crew.auth' },
  })).catch(() => { clientPromise = null; throw new Error('Couldn’t load Crews. Check your connection and try again.') })
  return clientPromise
}

// Supabase answers { data, error }; turn errors into plain messages.
const FRIENDLY = [
  [/Token has expired or is invalid|otp_expired|invalid.*token/i, 'That code didn’t work. Check it, or send a new one.'],
  [/rate limit|too many|security purposes/i, 'Too many tries. Wait a minute and try again.'],
  [/Failed to fetch|NetworkError|network/i, 'You look offline. Crews need a connection.'],
  [/JWT|not authenticated|Sign in first/i, 'You’ve been signed out. Sign in again.'],
]
function check({ data, error }) {
  if (!error) return data
  const msg = String(error.message || error)
  const nice = FRIENDLY.find(([re]) => re.test(msg))
  throw new Error(nice ? nice[1] : msg.length < 120 ? msg : 'Something went wrong. Try again.')
}
async function call(fn) {
  try { return check(await fn(await client())) } catch (err) {
    if (err instanceof Error && !/^TypeError/.test(err.name)) throw err
    throw new Error('You look offline. Crews need a connection.')
  }
}

// ---- Sign-in ----
export const sendCode = email => call(sb => sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }))
export const verifyCode = (email, token) => call(sb => sb.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' }))
export async function currentUser() {
  if (!configured()) return null
  const sb = await client()
  const { data } = await sb.auth.getSession()
  return data.session?.user || null
}
export const signOut = () => call(sb => sb.auth.signOut())

// ---- Profile ----
export const myProfile = me => call(sb => sb.from('profiles').select('*').eq('id', me).maybeSingle())
export const saveProfile = (me, fields) => call(sb => sb.from('profiles').upsert({ id: me, ...fields, updated_at: new Date().toISOString() }).select().single())

// ---- Crews ----
export async function myCrews() {
  const crews = await call(sb => sb.from('crews').select('id, name, invite_code, created_by, created_at').order('created_at'))
  if (!crews.length) return []
  const members = await call(sb => sb.from('crew_members').select('crew_id, user_id').in('crew_id', crews.map(c => c.id)))
  return crews.map(c => ({ ...c, members: members.filter(m => m.crew_id === c.id).map(m => m.user_id) }))
}
export const createCrew = name => call(sb => sb.rpc('create_crew', { crew_name: name }))
export const joinCrew = code => call(sb => sb.rpc('join_crew', { code }))
export const leaveCrew = id => call(sb => sb.rpc('leave_crew', { crew: id }))
export const profilesOf = ids => (ids.length ? call(sb => sb.from('profiles').select('*').in('id', ids)) : Promise.resolve([]))

// ---- Feed ----
export const feed = (ids, limit = 40) => (ids.length
  ? call(sb => sb.from('posts').select('id, user_id, done_on, title, summary, created_at').in('user_id', ids).order('done_on', { ascending: false }).order('created_at', { ascending: false }).limit(limit))
  : Promise.resolve([]))
export const reactionsOn = postIds => (postIds.length ? call(sb => sb.from('reactions').select('post_id, user_id, kind').in('post_id', postIds)) : Promise.resolve([]))
export const react = (me, postId, kind, on) => call(sb => (on
  ? sb.from('reactions').upsert({ post_id: postId, user_id: me, kind }, { onConflict: 'post_id,user_id,kind', ignoreDuplicates: true })
  : sb.from('reactions').delete().match({ post_id: postId, user_id: me, kind })))

/** Brings your last SYNC_DAYS days of posts in line with the phone: adds, updates and removes. */
export async function syncPosts(me, posts, todayIso) {
  const now = new Date().toISOString()
  if (posts.length) await call(sb => sb.from('posts').upsert(posts.map(p => ({ ...p, user_id: me, updated_at: now })), { onConflict: 'user_id,client_id' }))
  const there = await call(sb => sb.from('posts').select('client_id').eq('user_id', me).gte('done_on', addDays(todayIso, -SYNC_DAYS)))
  const keep = new Set(posts.map(p => p.client_id))
  const gone = there.map(r => r.client_id).filter(id => !keep.has(id))
  if (gone.length) await call(sb => sb.from('posts').delete().eq('user_id', me).in('client_id', gone))
  return { sent: posts.length, removed: gone.length }
}

/** Takes you off Crews: your posts, reactions and profile go, and you leave every crew. */
export async function removeMyData(me) {
  for (const c of await myCrews()) await leaveCrew(c.id)
  await call(sb => sb.from('reactions').delete().eq('user_id', me))
  await call(sb => sb.from('posts').delete().eq('user_id', me))
  await call(sb => sb.from('profiles').delete().eq('id', me))
}
