// Shared UI pieces. Preact + htm from a pinned CDN build: no build step, works as a static page.
import { html, render, useState, useEffect, useMemo, useRef, useCallback } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js'
export { html, render, useState, useEffect, useMemo, useRef, useCallback }

export const fmt = v => (v == null ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ''))
export const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
export const fmtDateLong = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function Stepper({ id, value, step, onChange, unit, min = 0, label }) {
  const set = v => onChange(Math.max(min, Math.round(v * 100) / 100))
  return html`<div class="stepper" role="group" aria-label=${label}>
    <button type="button" class="step-btn" aria-label=${'Less ' + (label || '')} onClick=${() => set((+value || 0) - step)}>−</button>
    <input id=${id} inputmode="decimal" class="step-input" value=${value ?? ''} aria-label=${label}
      onChange=${e => set(parseFloat(e.target.value.replace(',', '.')) || 0)} />
    ${unit && html`<span class="step-unit">${unit}</span>`}
    <button type="button" class="step-btn" aria-label=${'More ' + (label || '')} onClick=${() => set((+value || 0) + step)}>+</button>
  </div>`
}

export function Chips({ options, value, onChange, label, small }) {
  return html`<div class=${'chips' + (small ? ' chips-sm' : '')} role="radiogroup" aria-label=${label}>
    ${options.map(o => html`<button type="button" role="radio" aria-checked=${value === o.value}
      class=${'chip' + (value === o.value ? ' on' : '')} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`
}

export function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return html`<div class="sheet-wrap" onClick=${e => e.target === e.currentTarget && onClose()}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${title}>
      <header class="sheet-head"><h2>${title}</h2><button class="icon-btn" aria-label="Close" onClick=${onClose}>✕</button></header>
      <div class="sheet-body">${children}</div>
    </div>
  </div>`
}

// Two-tap confirm, since the viewer never shows confirm() dialogs.
export function ConfirmButton({ children, confirmText = 'Tap again to confirm', onConfirm, class: cls = 'btn ghost' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t) }, [armed])
  return html`<button type="button" class=${cls + (armed ? ' danger' : '')} onClick=${() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>${armed ? confirmText : children}</button>`
}

export function Field({ label, children, hint }) {
  return html`<label class="field"><span class="field-label">${label}</span>${children}${hint && html`<span class="field-hint">${hint}</span>`}</label>`
}

export function Empty({ title, children }) {
  return html`<div class="empty"><p class="empty-title">${title}</p><div class="empty-body">${children}</div></div>`
}
