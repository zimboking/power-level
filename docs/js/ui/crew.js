// Crew: sign in with an emailed code, make or join a crew with an invite code, then see your
// mates on a leaderboard and a feed of their workouts, and cheer them on.
import { html, useState, useEffect, Icon, Segmented, Toggle, ConfirmButton, PageHead, fmtDate } from './core.js'
import * as api from '../social-api.js'
import { AVATARS, LEADERBOARDS, REACTIONS, SHARE_LIFTS, cleanCode, validCode, cleanName, validName, crewLink, leaderboard, reactionSummary, postLine, profileStats, recentPosts } from '../social.js'
import { today } from '../store.js'

const LIFT_SHORT = { bench: 'Bench', squat: 'Squat', deadlift: 'Dead', ohp: 'OHP' }
const sharesLifts = s => s.crewLifts !== false
const sharesPosts = s => s.crewPosts !== false

async function shareCrew(app, crew, url) {
  const text = `Join my crew "${crew.name}" on Power Level. Code: ${crew.invite_code}`
  if (navigator.share) {
    try { await navigator.share({ title: 'Power Level crew', text, url }); return } catch (e) { if (e?.name === 'AbortError') return }
  }
  try { await navigator.clipboard.writeText(`${text}
${url}`); app.toast('Invite copied. Paste it in the group chat.') } catch { app.toast(`Code: ${crew.invite_code}`) }
}

// After you train, your profile and feed catch up by themselves, but only once you've signed in
// on this phone (so people who never use Crews never load the Supabase library).
let pushTimer = null
export function autoPush(state) {
  clearTimeout(pushTimer)
  let signedIn = false
  try { signedIn = !!localStorage.getItem('pl.crew.auth') } catch { /* private mode */ }
  if (!api.configured() || !signedIn) return
  pushTimer = setTimeout(async () => {
    try {
      const user = await api.currentUser()
      const p = user && await api.myProfile(user.id)
      if (p) await pushMine(user.id, state, p.display_name, p.avatar)
    } catch { /* offline or signed out: the next open of Crew catches up */ }
  }, 4000)
}

/** Sends this phone's numbers and recent workouts up. Used on open and after training. */
export async function pushMine(me, state, name, avatar) {
  const s = state.profile.settings
  // Example data is never shared: you show up with no workouts until you log your own.
  const real = state.profile.example ? { ...state, workouts: [] } : state
  await api.saveProfile(me, { display_name: name, avatar, ...profileStats(real, today(), { shareLifts: sharesLifts(s) }) })
  await api.syncPosts(me, sharesPosts(s) ? recentPosts(real.workouts, today()) : [], today())
}

function SignIn({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async fn => { setBusy(true); setMsg(''); try { await fn() } catch (e) { setMsg(e.message) } finally { setBusy(false) } }
  const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  return html`<div class="card stack">
    <p class="title-3">Train with your mates</p>
    <p class="muted small">Join a crew to see each other’s workouts, PRs, streaks and power level, and give a fist bump when someone turns up. Your food, water, body weight and notes stay on your phone.</p>
    ${!sent ? html`<form class="stack" onSubmit=${e => { e.preventDefault(); okEmail && run(async () => { await api.sendCode(email); setSent(true) }) }}>
        <input id="crew-email" class="input" type="email" inputmode="email" autocomplete="email" placeholder="Your email" value=${email} onInput=${e => setEmail(e.target.value)} />
        <button class="btn primary" disabled=${!okEmail || busy}>${busy ? 'Sending…' : 'Email me a code'}</button>
      </form>`
      : html`<form class="stack" onSubmit=${e => { e.preventDefault(); run(async () => { await api.verifyCode(email, code); onSignedIn() }) }}>
        <p class="small">We sent a code to <b>${email.trim()}</b>. It can take a minute; check spam too.</p>
        <input id="crew-code" class="input code-input" inputmode="numeric" autocomplete="one-time-code" placeholder="Code" maxlength="10" value=${code} onInput=${e => setCode(e.target.value.replace(/\D/g, ''))} />
        <button class="btn primary" disabled=${code.length < 6 || busy}>${busy ? 'Checking…' : 'Sign in'}</button>
        <button type="button" class="btn ghost" onClick=${() => { setSent(false); setCode('') }}>Use a different email</button>
      </form>`}
    ${msg && html`<p class="warn small" role="status">${msg}</p>`}
  </div>`
}

function ProfileForm({ initial, onSave, busy }) {
  const [name, setName] = useState(initial?.display_name || '')
  const [avatar, setAvatar] = useState(initial?.avatar || AVATARS[0])
  return html`<form class="card stack" onSubmit=${e => { e.preventDefault(); validName(name) && onSave(cleanName(name), avatar) }}>
    <p class="title-3">${initial ? 'Your crew profile' : 'What should your mates call you?'}</p>
    <input id="crew-name" class="input" maxlength="30" placeholder="Name or nickname" value=${name} onInput=${e => setName(e.target.value)} />
    <div class="avatar-pick" role="radiogroup" aria-label="Avatar">${AVATARS.map(a => html`<button type="button" role="radio" aria-checked=${a === avatar} class=${'avatar-opt' + (a === avatar ? ' on' : '')} onClick=${() => setAvatar(a)}>${a}</button>`)}</div>
    <button class="btn primary" disabled=${!validName(name) || busy}>${busy ? 'Saving…' : 'Save'}</button>
  </form>`
}

function CrewSetup({ onCreate, onJoin, busy, joinCode }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(joinCode || '')
  return html`<div class="stack">
    <form class="card stack" onSubmit=${e => { e.preventDefault(); validCode(code) && onJoin(code) }}>
      <p class="title-3">Join a crew</p>
      <p class="muted small">Got an invite code or link from a mate? Pop the code in.</p>
      <div class="field-row"><input id="crew-join" class="input code-input" autocapitalize="characters" maxlength="6" placeholder="ABC234" value=${code} onInput=${e => setCode(cleanCode(e.target.value))} />
        <button class="btn primary" disabled=${!validCode(code) || busy}>Join</button></div>
    </form>
    <form class="card stack" onSubmit=${e => { e.preventDefault(); name.trim() && onCreate(name.trim()) }}>
      <p class="title-3">Start a crew</p>
      <p class="muted small">You’ll get a code and a link to send to the group chat.</p>
      <div class="field-row"><input id="crew-new" class="input" maxlength="40" placeholder="e.g. Tuesday Lifters" value=${name} onInput=${e => setName(e.target.value)} />
        <button class="btn" disabled=${!name.trim() || busy}>Create</button></div>
    </form>
  </div>`
}

function Leaderboard({ people, me }) {
  const [by, setBy] = useState('power')
  const board = leaderboard(people, by)
  return html`<section class="card">
    <div class="card-head"><p class="card-title">Leaderboard</p>
      <${Segmented} small label="Rank by" value=${by} onChange=${setBy} options=${Object.entries(LEADERBOARDS).map(([value, b]) => ({ value, label: b.label }))} /></div>
    <ol class="board">${board.map(p => html`<li class=${p.id === me ? 'me' : ''}>
      <span class="board-place">${p.place}</span><span class="board-avatar" aria-hidden="true">${p.avatar}</span>
      <span class="board-main"><b>${p.display_name}${p.id === me ? ' (you)' : ''}</b>
        <small>${p.tier}${p.lifts && Object.keys(p.lifts).length ? ' · ' + SHARE_LIFTS.filter(id => p.lifts[id]).map(id => `${LIFT_SHORT[id]} ${Math.round(p.lifts[id])}`).join(' · ') : ''}</small></span>
      <span class="board-val tnum">${LEADERBOARDS[by].show(p)}</span></li>`)}</ol>
    ${people.some(p => p.lifts && Object.keys(p.lifts).length) && html`<p class="muted small">Lift numbers are estimated 1RMs (kg) from recent sets.</p>`}
  </section>`
}

function Post({ post, person, me, reactions, onReact }) {
  const sum = reactionSummary(reactions, post.id, me)
  const s = post.summary || {}
  return html`<article class="card post">
    <div class="post-head"><span class="board-avatar" aria-hidden="true">${person?.avatar || '💪'}</span>
      <span class="row-main"><b>${person?.display_name || 'A mate'}</b><small>${post.done_on === today() ? 'Today' : fmtDate(post.done_on)} · ${post.title}</small></span></div>
    <p class="small">${postLine(s)}</p>
    ${s.prs?.length > 0 && html`<p class="post-prs"><span class="pr">PR</span> ${s.prs.join(', ')}</p>`}
    ${s.exercises?.length > 0 && html`<p class="muted small">${s.exercises.join(' · ')}</p>`}
    <div class="reacts">${Object.entries(REACTIONS).map(([kind, r]) => html`<button class=${'react' + (sum[kind].mine ? ' on' : '')} aria-pressed=${sum[kind].mine} aria-label=${r.label}
      disabled=${post.user_id === me} onClick=${() => onReact(post.id, kind, !sum[kind].mine)}>${r.emoji}${sum[kind].count > 0 && html` <span class="tnum">${sum[kind].count}</span>`}</button>`)}</div>
  </article>`
}

export function CrewView({ app, initial }) {
  const { profile } = app.state
  const s = profile.settings
  const [me, setMe] = useState(undefined) // undefined: checking; null: signed out
  const [mine, setMine] = useState(null)
  const [loaded, setLoaded] = useState(false) // your profile was fetched (it may not exist yet)
  const [crews, setCrews] = useState([])
  const [crewId, setCrewId] = useState(() => { try { return localStorage.getItem('pl.crew.sel') } catch { return null } })
  const [people, setPeople] = useState([])
  const [posts, setPosts] = useState([])
  const [reactions, setReactions] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [editProfile, setEditProfile] = useState(false)
  const [adding, setAdding] = useState(false)
  const joinCode = initial?.join || null

  const run = async (fn, okText) => { setBusy(true); setMsg(''); try { await fn(); if (okText) app.toast(okText) } catch (e) { setMsg(e.message) } finally { setBusy(false) } }
  const crew = crews.find(c => c.id === crewId) || crews[0] || null

  async function loadAll(user = me) {
    if (!user) return
    const p = await api.myProfile(user.id)
    setMine(p); setLoaded(true)
    if (!p) return
    await pushMine(user.id, app.state, p.display_name, p.avatar)
    const cs = await api.myCrews()
    setCrews(cs)
    const ids = [...new Set(cs.flatMap(c => c.members))]
    const [ps, fs] = await Promise.all([api.profilesOf(ids), api.feed(ids)])
    setPeople(ps); setPosts(fs)
    setReactions(await api.reactionsOn(fs.map(f => f.id)))
  }
  useEffect(() => {
    let alive = true
    api.currentUser().then(u => { if (!alive) return; setMe(u); if (u) run(() => loadAll(u)) }, e => { if (alive) { setMe(null); setMsg(e.message) } })
    return () => { alive = false }
  }, [])
  useEffect(() => { try { if (crew) localStorage.setItem('pl.crew.sel', crew.id) } catch { /* ignore */ } }, [crew?.id])

  const head = html`<${PageHead} title="Crew" sub="Train together, even apart">
    ${me && html`<button class="circle-btn" aria-label="Refresh" disabled=${busy} onClick=${() => run(() => loadAll())}><${Icon} name="refresh" /></button>`}</${PageHead}>`
  if (!api.configured()) return html`<div class="stack">${head}<p class="muted">Crews aren’t switched on for this site yet.</p></div>`
  if (me === undefined) return html`<div class="stack">${head}<p class="muted" role="status">Checking…</p>${msg && html`<p class="warn small">${msg}</p>`}</div>`
  if (!me) return html`<div class="stack">${head}<${SignIn} onSignedIn=${() => api.currentUser().then(u => { setMe(u); run(() => loadAll(u)) })} />${msg && html`<p class="warn small">${msg}</p>`}</div>`
  if (!loaded) return html`<div class="stack">${head}
    ${busy ? html`<p class="muted" role="status">Loading your crew…</p>` : html`<div class="card stack"><p>${msg || 'Couldn’t reach Crew.'}</p><button class="btn primary" onClick=${() => run(() => loadAll())}>Try again</button></div>`}</div>`
  if (!mine || editProfile) return html`<div class="stack">${head}
    <${ProfileForm} initial=${mine} busy=${busy} onSave=${(name, avatar) => run(async () => { await pushMine(me.id, app.state, name, avatar); setEditProfile(false); await loadAll() }, mine ? 'Saved' : 'You’re in')} />
    ${msg && html`<p class="warn small" role="status">${msg}</p>`}
    ${mine && html`<button class="btn ghost" onClick=${() => setEditProfile(false)}>Cancel</button>`}</div>`

  const ids = new Set(crew?.members || [])
  const crewPeople = people.filter(p => ids.has(p.id))
  const crewPosts = posts.filter(p => ids.has(p.user_id))
  const byId = Object.fromEntries(people.map(p => [p.id, p]))
  const onReact = (postId, kind, on) => {
    const row = { post_id: postId, user_id: me.id, kind }
    setReactions(rs => (on ? [...rs, row] : rs.filter(r => !(r.post_id === postId && r.user_id === me.id && r.kind === kind))))
    api.react(me.id, postId, kind, on).catch(e => { setMsg(e.message); run(() => loadAll()) })
  }
  return html`<div class="stack">${head}
    ${msg && html`<p class="warn small" role="status">${msg}</p>`}
    ${crews.length > 1 && html`<div class="chips chips-sm" role="radiogroup" aria-label="Crew">${crews.map(c => html`<button role="radio" aria-checked=${c.id === crew?.id} class=${'chip' + (c.id === crew?.id ? ' on' : '')} onClick=${() => setCrewId(c.id)}>${c.name}</button>`)}</div>`}
    ${!crew || adding || (joinCode && !crews.some(c => c.invite_code === joinCode))
      ? html`<${CrewSetup} busy=${busy} joinCode=${joinCode}
          onJoin=${code => run(async () => { const c = await api.joinCrew(code); setCrewId(c.id); setAdding(false); app.go('crew'); await loadAll() }, 'Joined the crew')}
          onCreate=${name => run(async () => { const c = await api.createCrew(name); setCrewId(c.id); setAdding(false); await loadAll() }, 'Crew made. Send the invite to your mates.')} />
        ${crew && html`<button class="btn ghost" onClick=${() => { setAdding(false); app.go('crew') }}>Back to ${crew.name}</button>`}`
      : html`
        <section class="card crew-invite">
          <div class="card-head"><p class="title-3">${crew.name}</p><span class="muted small">${crew.members.length} ${crew.members.length === 1 ? 'member' : 'members'}</span></div>
          <p class="small">Invite code <b class="crew-code tnum">${crew.invite_code}</b></p>
          <div class="row-btns"><button class="btn small primary" onClick=${() => shareCrew(app, crew, crewLink(location.href, crew.invite_code))}>Invite mates</button>
            <button class="btn small" onClick=${() => setAdding(true)}>Join or start another</button></div>
        </section>
        ${crew.members.length < 2 && html`<p class="muted small center">It’s just you so far. Send the invite to your group chat.</p>`}
        <${Leaderboard} people=${crewPeople} me=${me.id} />
        <p class="section-label">Recent workouts</p>
        ${crewPosts.length ? crewPosts.map(p => html`<${Post} key=${p.id} post=${p} person=${byId[p.user_id]} me=${me.id} reactions=${reactions} onReact=${onReact} />`)
          : html`<p class="muted small">No workouts shared in the last while. Finish a session and it shows up here.</p>`}`}
    <p class="section-label">Sharing</p>
    <div class="group">
      <button class="row-btn" onClick=${() => setEditProfile(true)}><span class="board-avatar" aria-hidden="true">${mine.avatar}</span><span class="row-main"><span>${mine.display_name}</span><small>Change name or avatar</small></span></button>
      <${Toggle} id="crew-posts" checked=${sharesPosts(s)} onChange=${v => { app.setSetting({ crewPosts: v }); run(() => loadAll()) }} label="Share my workouts" hint="Name, sets, kg moved, time and PRs. Never notes, food or body weight." />
      <${Toggle} id="crew-lifts" checked=${sharesLifts(s)} onChange=${v => { app.setSetting({ crewLifts: v }); run(() => loadAll()) }} label="Share my lift numbers" hint="Estimated 1RM for bench, squat, deadlift and overhead press." />
      ${crew && html`<${ConfirmButton} class="row-btn danger" confirmText=${'Tap again to leave ' + crew.name} onConfirm=${() => run(async () => { await api.leaveCrew(crew.id); setCrewId(null); await loadAll() }, 'Left the crew')}>Leave ${crew.name}</${ConfirmButton}>`}
      <button class="row-btn" onClick=${() => run(async () => { await api.signOut(); setMe(null); setMine(null); setLoaded(false); setCrews([]) })}><span class="row-main"><span>Sign out</span><small>${me.email}</small></span></button>
      <${ConfirmButton} class="row-btn danger" confirmText="Tap again: removes your posts, profile and memberships" onConfirm=${() => run(async () => { await api.removeMyData(me.id); await api.signOut(); setMe(null); setMine(null); setLoaded(false); setCrews([]) }, 'Your Crew data is gone')}>Remove my Crew data</${ConfirmButton}>
    </div>
  </div>`
}
