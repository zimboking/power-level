// Progress photos: a timeline and a before/after slider.
import { html, useState, useEffect, useMemo, Sheet, Icon, ConfirmButton, fmtDate } from './core.js'
import { listPhotos, addPhoto, deletePhoto } from '../photos.js'
import { today } from '../store.js'

function useUrls(photos) {
  const urls = useMemo(() => Object.fromEntries(photos.map(p => [p.id, URL.createObjectURL(p.blob)])), [photos])
  useEffect(() => () => Object.values(urls).forEach(u => URL.revokeObjectURL(u)), [urls])
  return urls
}

function Compare({ before, after, urls }) {
  const [pos, setPos] = useState(50)
  return html`<div class="compare">
    <div class="compare-frame">
      <img src=${urls[after.id]} alt=${'After, ' + fmtDate(after.date)} />
      <img src=${urls[before.id]} alt=${'Before, ' + fmtDate(before.date)} class="compare-top" style=${{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <span class="compare-line" style=${{ left: pos + '%' }} aria-hidden="true"></span>
      <span class="compare-tag left">${fmtDate(before.date)}</span><span class="compare-tag right">${fmtDate(after.date)}</span>
    </div>
    <input id="compare-pos" type="range" min="0" max="100" value=${pos} onInput=${e => setPos(+e.target.value)} aria-label="Before and after slider" class="range" />
  </div>`
}

export function Photos() {
  const [photos, setPhotos] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(null)
  const [pair, setPair] = useState(null)
  const urls = useUrls(photos)
  const refresh = () => listPhotos().then(setPhotos, () => setErr('Photos aren’t available in this browser.'))
  useEffect(() => { refresh() }, [])
  const onFile = async e => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true); setErr('')
    try { for (const f of files) await addPhoto(f, today()); await refresh() } catch { setErr('Couldn’t add that photo. Try a JPEG or PNG.') }
    setBusy(false)
  }
  const first = photos[0], last = photos[photos.length - 1]
  return html`<div class="stack">
    <div class="row-btns">
      <label class="btn file-btn"><${Icon} name="camera" size=${18} /> ${busy ? 'Adding…' : 'Add photo'}<input id="photo-add" type="file" accept="image/*" multiple onChange=${onFile} /></label>
      ${photos.length >= 2 && html`<button class="btn" onClick=${() => setPair({ before: first, after: last })}>Before / after</button>`}
    </div>
    ${err && html`<p class="warn small">${err}</p>`}
    ${photos.length === 0 ? html`<p class="muted small">Same spot, same light, every couple of weeks. Photos stay on this phone and aren't in your backup file.</p>`
      : html`<div class="photo-strip">${[...photos].reverse().map(p => html`<button class="photo-thumb" onClick=${() => setView(p)}><img src=${urls[p.id]} alt=${'Progress photo, ' + fmtDate(p.date)} loading="lazy" /><span>${fmtDate(p.date)}</span></button>`)}</div>`}
    <${Sheet} open=${!!view} title=${view ? fmtDate(view.date) : ''} onClose=${() => setView(null)}>
      ${view && html`<img class="photo-full" src=${urls[view.id]} alt=${'Progress photo, ' + fmtDate(view.date)} />
        <div class="row-btns">
          ${photos.length >= 2 && html`<button class="btn" onClick=${() => { setPair({ before: first.id === view.id ? view : first, after: first.id === view.id ? last : view }); setView(null) }}>Compare</button>`}
          <${ConfirmButton} class="btn ghost" confirmText="Tap again to delete" onConfirm=${async () => { await deletePhoto(view.id); setView(null); refresh() }}>Delete</${ConfirmButton}>
        </div>`}
    </${Sheet}>
    <${Sheet} open=${!!pair} title="Before / after" onClose=${() => setPair(null)} tall>
      ${pair && html`<${Compare} before=${pair.before} after=${pair.after} urls=${urls} />
        <p class="section-label">Before</p><div class="photo-strip small">${photos.map(p => html`<button class=${'photo-thumb' + (p.id === pair.before.id ? ' on' : '')} onClick=${() => setPair({ ...pair, before: p })}><img src=${urls[p.id]} alt=${fmtDate(p.date)} /></button>`)}</div>
        <p class="section-label">After</p><div class="photo-strip small">${photos.map(p => html`<button class=${'photo-thumb' + (p.id === pair.after.id ? ' on' : '')} onClick=${() => setPair({ ...pair, after: p })}><img src=${urls[p.id]} alt=${fmtDate(p.date)} /></button>`)}</div>`}
    </${Sheet}>
  </div>`
}
