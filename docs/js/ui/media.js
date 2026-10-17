// Exercise pictures. free-exercise-db ships a start and an end photo per exercise; flipping
// between them reads as a simple demo. Tap to pause, Minimize to tuck it away.
import { html, useState, useEffect, Icon } from './core.js'
import { imageUrls } from '../exercises.js'
import { ExerciseMuscles } from './bodymap.js'

export function ExerciseDemo({ ex, sex, minimized, onToggle }) {
  const urls = imageUrls(ex)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setI(0); setFailed(false) }, [ex.id])
  useEffect(() => {
    if (paused || urls.length < 2 || minimized) return
    const t = setInterval(() => setI(x => (x + 1) % urls.length), 1100)
    return () => clearInterval(t)
  }, [paused, urls.length, minimized, ex.id])
  if (minimized) return html`<button class="demo-mini" onClick=${onToggle}><${Icon} name="expand" size=${16} /> Show demo</button>`
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return html`<figure class="demo">
    ${urls.length && !failed ? html`<div class="demo-frame" onClick=${() => setPaused(!paused)}>
        ${urls.map((u, k) => html`<img crossorigin="anonymous" src=${u} alt=${k === 0 ? ex.name + ' demonstration' : ''} class=${k === (reduced ? 0 : i) ? 'on' : ''} loading="lazy" decoding="async" width="400" height="300" onError=${() => setFailed(true)} />`)}
      </div>`
      : html`<div class="demo-frame demo-body"><${ExerciseMuscles} ex=${ex} sex=${sex} size="md" /></div>`}
    <div class="demo-ctrls">
      <button class="pill-btn" onClick=${onToggle}><${Icon} name="minimize" size=${15} /> Minimize</button>
      ${urls.length > 1 && !failed && html`<button class="pill-btn" onClick=${() => setPaused(!paused)}><${Icon} name=${paused ? 'play' : 'pause'} size=${15} /> ${paused ? 'tap to play' : 'tap to pause'}</button>`}
    </div>
  </figure>`
}

export function Thumb({ ex }) {
  const url = imageUrls(ex)[0]
  const [bad, setBad] = useState(false)
  return url && !bad ? html`<img class="thumb" crossorigin="anonymous" src=${url} alt="" loading="lazy" decoding="async" width="56" height="42" onError=${() => setBad(true)} />`
    : html`<span class="thumb thumb-ph" aria-hidden="true">${(ex.name || '?').slice(0, 1)}</span>`
}
