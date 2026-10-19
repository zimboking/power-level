// Shared UI pieces. Preact + htm from a pinned CDN build: no build step, works as a static page.
import { html, render, useState, useEffect, useMemo, useRef, useCallback } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js'
export { html, render, useState, useEffect, useMemo, useRef, useCallback }

export const fmt = v => (v == null ? '–' : Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ''))
export const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
export const fmtDateLong = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
export const fmtWeekday = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })
export const fmtClock = sec => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

// Stroke icons, 24-unit grid.
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  plan: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  dumbbell: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  stats: 'M5 20V12M10 20V6M15 20v-9M20 20V9',
  food: 'M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M7 3v4M17 3c-2 0-3 3-3 6s1 4 3 4v8',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M5 12.5 10 17.5 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', down: 'M5 9l7 7 7-7', up: 'M5 15l7-7 7 7',
  plus: 'M12 5v14M5 12h14',
  flame: 'M12 21c-4 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.5 3 3 3 5 1-1 1.5-2 1.5-3.5 2.5 2 4.5 4.5 4.5 7.5 0 3.4-2 6-6 6z',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5M9.5 2.5h5',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 3',
  scale: 'M4 4h16v16H4zM8.5 9.5a5 5 0 0 1 7 0M12 9.5 13 12',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  pause: 'M8 5v14M16 5v14', play: 'M7 5l12 7-12 7z',
  minimize: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7', expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
  link: 'M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1',
  grip: 'M9 6h.5M15 6h.5M9 12h.5M15 12h.5M9 18h.5M15 18h.5',
  drop: 'M12 3c3.6 4.4 6 7.7 6 10.8a6 6 0 0 1-12 0C6 10.7 8.4 7.4 12 3z',
}
export const Icon = ({ name, size = 22, class: cls = '' }) => html`<svg class=${'ic ' + cls} viewBox="0 0 24 24" width=${size} height=${size} aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d=${ICONS[name] || ''} /></svg>`

export function Stepper({ id, value, step, onChange, unit, min = 0, label }) {
  const set = v => onChange(Math.max(min, Math.round(v * 100) / 100))
  return html`<div class="stepper" role="group" aria-label=${label}>
    <button type="button" class="step-btn" aria-label=${'Less ' + (label || '')} onClick=${() => set((+value || 0) - step)}>−</button>
    <input id=${id} inputmode="decimal" class="step-input" value=${value ?? ''} aria-label=${label} onFocus=${e => e.target.select()}
      onChange=${e => set(parseFloat(e.target.value.replace(',', '.')) || 0)} />
    ${unit && html`<span class="step-unit">${unit}</span>`}
    <button type="button" class="step-btn" aria-label=${'More ' + (label || '')} onClick=${() => set((+value || 0) + step)}>+</button>
  </div>`
}

export function Segmented({ options, value, onChange, label, small }) {
  return html`<div class=${'seg' + (small ? ' seg-sm' : '')} role="radiogroup" aria-label=${label}>
    ${options.map(o => html`<button type="button" role="radio" aria-checked=${value === o.value} class=${'seg-btn' + (value === o.value ? ' on' : '')} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`
}

export function Chips({ options, value, onChange, label, small }) {
  return html`<div class=${'chips' + (small ? ' chips-sm' : '')} role="radiogroup" aria-label=${label}>
    ${options.map(o => html`<button type="button" role="radio" aria-checked=${value === o.value} class=${'chip' + (value === o.value ? ' on' : '')} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`
}

export function Sheet({ open, title, onClose, children, tall }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return html`<div class="sheet-wrap" onClick=${e => e.target === e.currentTarget && onClose()}>
    <div class=${'sheet' + (tall ? ' tall' : '')} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="grabber" aria-hidden="true"></div>
      <header class="sheet-head"><h2>${title}</h2><button class="circle-btn" aria-label="Close" onClick=${onClose}><${Icon} name="x" size=${18} /></button></header>
      <div class="sheet-body">${children}</div>
    </div>
  </div>`
}

/** A list of actions in a sheet: [{label, icon, onClick, danger, hint}] */
export function ActionSheet({ open, title, actions, onClose }) {
  return html`<${Sheet} open=${open} title=${title} onClose=${onClose}>
    <div class="group">${actions.filter(Boolean).map(a => html`<button class=${'row-btn' + (a.danger ? ' danger' : '')} onClick=${() => { onClose(); a.onClick() }}>
      ${a.icon && html`<span class="row-ic"><${Icon} name=${a.icon} size=${20} /></span>`}<span class="row-main"><span>${a.label}</span>${a.hint && html`<small>${a.hint}</small>`}</span></button>`)}</div>
  </${Sheet}>`
}

// Scroll wheel: snap list from `min` to `max` seconds in `step`s. Default 15 s up to 15 min.
export function WheelPicker({ value, onChange, min = 0, max = 900, step = 15, format = fmtClock, label = 'Rest time' }) {
  const ref = useRef(null)
  const values = useMemo(() => Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step), [min, max, step])
  const ITEM = 40
  const idx = Math.max(0, values.indexOf(Math.round(value / step) * step))
  useEffect(() => { if (ref.current) ref.current.scrollTop = idx * ITEM }, [])
  const timer = useRef(null)
  const onScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const i = Math.min(values.length - 1, Math.max(0, Math.round(ref.current.scrollTop / ITEM)))
      if (values[i] !== value) onChange(values[i])
    }, 90)
  }
  const nudge = d => { const i = Math.min(values.length - 1, Math.max(0, idx + d)); ref.current.scrollTo({ top: i * ITEM, behavior: 'smooth' }) }
  return html`<div class="wheel" role="spinbutton" aria-label=${label} aria-valuenow=${value} aria-valuetext=${format(value)} tabindex="0"
      onKeyDown=${e => { if (e.key === 'ArrowUp') { e.preventDefault(); nudge(-1) } if (e.key === 'ArrowDown') { e.preventDefault(); nudge(1) } }}>
    <div class="wheel-band" aria-hidden="true"></div>
    <div class="wheel-list" ref=${ref} onScroll=${onScroll}>
      <div class="wheel-pad"></div>
      ${values.map(v => html`<div class=${'wheel-item' + (v === value ? ' on' : '')} onClick=${() => { onChange(v); ref.current.scrollTo({ top: values.indexOf(v) * ITEM, behavior: 'smooth' }) }}>${format(v)}</div>`)}
      <div class="wheel-pad"></div>
    </div>
  </div>`
}

// Horizontal swipe on a row: left past the threshold → onLeft, right → onRight. Vertical scroll wins.
export function useSwipe({ onLeft, onRight, threshold = 80 }) {
  const [dx, setDx] = useState(0)
  const st = useRef(null)
  const handlers = {
    onPointerDown: e => { if (e.pointerType === 'mouse' && e.button !== 0) return; st.current = { x: e.clientX, y: e.clientY, lock: null } },
    onPointerMove: e => {
      const s = st.current
      if (!s) return
      const mx = e.clientX - s.x, my = e.clientY - s.y
      if (s.lock == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (s.lock === 'x') { setDx(Math.max(-140, Math.min(140, mx))); try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ } }
    },
    onPointerUp: () => {
      const s = st.current
      st.current = null
      if (s?.lock === 'x') { if (dx <= -threshold) onLeft?.(); else if (dx >= threshold) onRight?.() }
      setDx(0)
    },
    onPointerCancel: () => { st.current = null; setDx(0) },
  }
  return { dx, handlers }
}

export function Field({ label, children, hint }) {
  return html`<label class="field"><span class="field-label">${label}</span>${children}${hint && html`<span class="field-hint">${hint}</span>`}</label>`
}

export function Toggle({ id, checked, onChange, label, hint }) {
  return html`<label class="toggle-row" for=${id}><span class="row-main"><span>${label}</span>${hint && html`<small>${hint}</small>`}</span>
    <input id=${id} type="checkbox" class="switch" checked=${checked} onChange=${e => onChange(e.target.checked)} /></label>`
}

// Two-tap confirm, since dialogs aren't available everywhere this runs.
export function ConfirmButton({ children, confirmText = 'Tap again to confirm', onConfirm, class: cls = 'btn ghost' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t) }, [armed])
  return html`<button type="button" class=${cls + (armed ? ' danger' : '')} onClick=${() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>${armed ? confirmText : children}</button>`
}

export function Empty({ title, children, icon }) {
  return html`<div class="card empty">${icon && html`<span class="empty-ic"><${Icon} name=${icon} size=${26} /></span>`}<p class="empty-title">${title}</p><div class="empty-body">${children}</div></div>`
}

export function PageHead({ title, sub, children }) {
  return html`<header class="page-head"><div class="page-titles"><h1 class="large-title">${title}</h1>${sub && html`<p class="page-sub">${sub}</p>`}</div><div class="page-actions">${children}</div></header>`
}
