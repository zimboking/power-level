// Sharing routines by link: the Share button's action, and the sheet a link opens.
import { html, useState, useEffect, Sheet, Icon } from './core.js'
import { shareUrl, sharedFromHash, decodeRoutine } from '../share.js'
import { saveRoutine } from '../routines.js'
import { EXERCISES, exInfo } from '../exercises.js'
import { uid } from '../store.js'

const CORE = new Set(EXERCISES.map(e => e.id))

/** Shares a link through the phone's share menu, or copies it. Returns a message, or the link to show. */
export async function shareRoutine(app, routine) {
  const url = shareUrl(location.href, routine, id => app.state.profile.exercises?.[id] || null)
  if (navigator.share) {
    try { await navigator.share({ title: routine.name, text: `${routine.name}: a Power Level routine`, url }); return { done: true } } catch (e) { if (e?.name === 'AbortError') return { done: true } }
  }
  try { await navigator.clipboard.writeText(url); app.toast('Link copied. Send it to your mates.'); return { done: true } } catch { return { url } }
}

const clearHash = () => { try { history.replaceState(null, '', location.pathname + location.search) } catch { /* ignore */ } }

/** Watches for a shared-routine link and offers to add it. */
export function SharedRoutineSheet({ app }) {
  const [incoming, setIncoming] = useState(null)
  useEffect(() => {
    const read = () => {
      const packed = sharedFromHash(location.hash)
      if (!packed) return
      const known = id => CORE.has(id) || !!app.state.profile.exercises?.[id]
      try { setIncoming(decodeRoutine(packed, known)) } catch { app.toast('That routine link is broken or incomplete.'); clearHash() }
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const close = () => { setIncoming(null); clearHash() }
  const add = () => {
    const r = { id: 'r' + uid(), name: incoming.name, items: incoming.items }
    app.update(s => {
      const exercises = { ...(s.profile.exercises || {}) }
      for (const e of incoming.exercises) if (!exercises[e.id]) exercises[e.id] = e
      return { ...s, profile: saveRoutine({ ...s.profile, exercises }, r) }
    }, ['profile'])
    app.toast(`${r.name} added to your routines`)
    close()
    app.go('plan', 'routines')
  }
  const name = id => incoming.exercises.find(e => e.id === id)?.name || exInfo(id).name
  return html`<${Sheet} open=${!!incoming} title="Add a shared routine" onClose=${close}>
    ${incoming && html`<p class="title-3">${incoming.name}</p>
      <div class="group">${incoming.items.map(it => html`<div class="toggle-row"><span class="row-main"><span>${name(it.exId)}</span>
        <small>${it.sets} × ${it.repsMin}${it.repsMax !== it.repsMin ? '–' + it.repsMax : ''}${it.group ? ' · superset' : ''}</small></span></div>`)}</div>
      <p class="muted small">It's added as your own copy, so changes you make won't affect whoever sent it.</p>
      <button class="btn primary big" onClick=${add}><${Icon} name="plus" size=${18} /> Add routine</button>
      <button class="btn ghost" onClick=${close}>No thanks</button>`}
  </${Sheet}>`
}
