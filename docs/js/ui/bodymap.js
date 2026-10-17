// Front and back body outlines (MuscleMap, MIT) shaded per muscle. `levels` maps a region to
// 0–4; `tone` picks the colour ramp (volume green, fatigue red→green, untrained amber, focus).
import { html, useState, useEffect } from './core.js'
import { loadBody, INERT, MUSCLE_NAME } from '../muscles.js'

export function BodyMap({ levels = {}, tone = 'vol', sex = 'male', onPick, size = 'md', label = 'Body map' }) {
  const [body, setBody] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => { loadBody().then(setBody, () => setErr(true)) }, [])
  if (err) return html`<p class="muted small">The body map couldn’t load. Check your connection and try again.</p>`
  if (!body) return html`<div class=${'bodymap ' + size} aria-busy="true"><div class="body-ph"></div><div class="body-ph"></div></div>`
  const views = body[sex] || body.male
  return html`<div class=${'bodymap tone-' + tone + ' ' + size} role="img" aria-label=${label}>
    ${['front', 'back'].map(side => {
      const v = views[side]
      return html`<svg viewBox=${v.vb} class="body-svg" aria-hidden="true">
        ${Object.entries(v.p).map(([part, paths]) => {
          const inert = INERT.includes(part)
          const lvl = inert ? 0 : levels[part] || 0
          return html`<g class=${'part ' + (inert ? 'inert' : 'lvl' + lvl)} onClick=${!inert && onPick ? () => onPick(part) : undefined}>
            ${!inert && html`<title>${MUSCLE_NAME[part] || part}</title>`}
            ${paths.map(d => html`<path d=${d} />`)}</g>`
        })}
      </svg>`
    })}
  </div>`
}

/** Highlights one exercise's muscles: primary strong, secondary soft. */
export function ExerciseMuscles({ ex, sex, size = 'sm' }) {
  const levels = {}
  for (const m of ex.s || []) levels[m] = 2
  for (const m of ex.p || []) levels[m] = 4
  return html`<${BodyMap} levels=${levels} tone="focus" sex=${sex} size=${size} label=${'Muscles worked: ' + [...(ex.p || []), ...(ex.s || [])].map(m => MUSCLE_NAME[m] || m).join(', ')} />`
}
