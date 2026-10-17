// One exercise inside the active workout: target, sets, live 1RM, smart next-set adjustment,
// form cues and a plate-loading picture. All the maths happens here so you never do it.
import { html, useState, fmt, Stepper } from './core.js'
import { e1rm, nextSetAdvice, platesFor, warmupSets } from '../strength.js'
import { exInfo, stepFor } from '../exercises.js'
import { REST_PRESETS, fmtClock, primeAudio } from './rest.js'

const RIR_OPTS = [0, 1, 2, 3, 4]

export function PlateBar({ weight, bar = 20, plates }) {
  const { perSide, remainder, ok } = platesFor(weight, bar, plates)
  const colors = { 25: 'p25', 20: 'p20', 15: 'p15', 10: 'p10', 5: 'p5', 2.5: 'p2', 1.25: 'p1' }
  const hgt = p => (p >= 15 ? 54 : p >= 10 ? 46 : p >= 5 ? 36 : 28)
  // Grip in the middle (x 106–194), collars at 98 and 194, plates stack outward from each collar.
  let x = 204
  const right = perSide.map(p => { const w = p >= 10 ? 11 : 7; const r = { p, x, w }; x += w + 2; return r })
  return html`<figure class="platebar">
    <svg viewBox="0 0 300 64" role="img" aria-label=${`${weight} kg: ${perSide.join(', ') || 'empty bar'} each side`}>
      <rect x="4" y="29" width="292" height="6" rx="3" class="bar-steel" />
      <rect x="96" y="22" width="8" height="20" rx="2" class="bar-collar" />
      <rect x="196" y="22" width="8" height="20" rx="2" class="bar-collar" />
      ${right.map(r => html`<rect x=${r.x} y=${32 - hgt(r.p) / 2} width=${r.w} height=${hgt(r.p)} rx="2" class=${'plate ' + colors[r.p]} />`)}
      ${right.map(r => html`<rect x=${300 - r.x - r.w} y=${32 - hgt(r.p) / 2} width=${r.w} height=${hgt(r.p)} rx="2" class=${'plate ' + colors[r.p]} />`)}
    </svg>
    <figcaption>${perSide.length ? html`Each side: <b>${perSide.join(' + ')}</b>` : 'Just the bar'}${!ok && remainder > 0 ? html` <span class="warn">(${fmt(remainder)} kg can’t be loaded)</span>` : ''}</figcaption>
  </figure>`
}

export function ExerciseCard({ entry, index, label, settings, prevBest, onChange, onSetDone, onRemove, onMove, onToggleSuperset, isLinked }) {
  const ex = exInfo(entry.exId)
  const step = stepFor(ex)
  const [showCues, setShowCues] = useState(false)
  const [plateFor, setPlateFor] = useState(null)
  const firstWork = entry.sets.find(s => !s.warmup)

  const patchSet = (i, patch) => onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? { ...s, ...patch, auto: false } : s)) })

  const toggleDone = i => {
    primeAudio()
    const s = entry.sets[i]
    const nowDone = !s.done
    let sets = entry.sets.map((x, j) => (j === i ? { ...x, done: nowDone, rir: x.rir ?? (x.warmup ? null : entry.cfg.rir) } : x))
    let advice = entry.advice
    if (nowDone && !s.warmup) {
      const done = sets[i]
      const a = nextSetAdvice(done, entry.cfg, step)
      const nextIdx = sets.findIndex((x, j) => j > i && !x.warmup && !x.done)
      if (a && nextIdx >= 0) {
        // Every remaining set you haven't touched by hand follows the new weight.
        const follows = (x, j) => j > i && !x.warmup && !x.done && x.auto
        const n = sets.filter(follows).length
        sets = sets.map((x, j) => (follows(x, j) ? { ...x, w: a.w, r: a.r } : x))
        advice = a.change !== 0 && n ? a.why + (n > 1 ? ` Remaining ${n} sets updated.` : ' Next set updated.') : a.why
      } else if (a) advice = 'Last set done. ' + (a.change > 0 ? 'Next session will go up.' : a.change < 0 ? 'Next session will adjust down.' : 'Nailed it.')
    }
    onChange({ ...entry, sets, advice })
    if (nowDone) onSetDone(entry, sets[i])
  }

  const addSet = () => {
    const last = [...entry.sets].reverse().find(s => !s.warmup) || { w: entry.target.w, r: entry.cfg.repsMin }
    onChange({ ...entry, sets: [...entry.sets, { w: last.w, r: last.r, rir: null, done: false, auto: true }] })
  }
  const addWarmups = () => {
    const bar = ex.eq === 'barbell' ? settings.bar || 20 : 0
    const w = warmupSets(firstWork?.w || entry.target.w, bar, step).map(s => ({ ...s, rir: null, done: false }))
    onChange({ ...entry, sets: [...w, ...entry.sets.filter(s => !s.warmup)] })
  }
  const removeSet = i => onChange({ ...entry, sets: entry.sets.filter((_, j) => j !== i) })

  let workNo = 0
  return html`<article class=${'ex-card' + (entry.group ? ' in-superset' : '')} id=${'ex-' + entry.key}>
    <header class="ex-head">
      ${label && html`<span class="ss-tag" title="Superset">${label}</span>`}
      <div class="ex-title">
        <h3>${ex.name}</h3>
        <p class="ex-target">${entry.cfg.sets} × ${entry.cfg.repsMin}${entry.cfg.repsMax !== entry.cfg.repsMin ? '–' + entry.cfg.repsMax : ''} @ RIR ${entry.cfg.rir}${entry.target.w ? html` · <b>${fmt(entry.target.w)} kg</b>` : ''}</p>
      </div>
      <div class="ex-tools">
        <button class="icon-btn" aria-label="Move up" onClick=${() => onMove(-1)}>↑</button>
        <button class="icon-btn" aria-label="Move down" onClick=${() => onMove(1)}>↓</button>
        <button class="icon-btn" aria-label="Remove exercise" onClick=${onRemove}>✕</button>
      </div>
    </header>
    <p class="why">${entry.target.why}</p>

    <div class="sets">
      <div class="set-row set-head" aria-hidden="true"><span>Set</span><span>kg</span><span>Reps</span><span>RIR</span><span></span></div>
      ${entry.sets.map((s, i) => {
        const tag = s.warmup ? 'W' : String(++workNo)
        const est = !s.warmup && s.r > 0 ? e1rm(s.w, s.r, s.rir ?? entry.cfg.rir) : null
        const isPr = s.done && est && prevBest > 0 && est > prevBest
        return html`<div class=${'set-row' + (s.done ? ' done' : '') + (s.warmup ? ' warm' : '')}>
          <button class="set-tag" aria-label=${(s.warmup ? 'Warm-up set' : 'Set ' + tag) + '. Tap to remove.'} title="Remove set" onClick=${() => removeSet(i)}>${tag}</button>
          <${Stepper} id=${`w-${entry.key}-${i}`} label="Weight" value=${s.w} step=${step} onChange=${v => patchSet(i, { w: v })} />
          <${Stepper} id=${`r-${entry.key}-${i}`} label="Reps" value=${s.r} step=${1} onChange=${v => patchSet(i, { r: v })} />
          ${s.warmup ? html`<span class="rir-none">warm-up</span>` : html`<select class="rir-select" aria-label="Reps in reserve" value=${s.rir ?? ''} onChange=${e => patchSet(i, { rir: e.target.value === '' ? null : +e.target.value })}>
            <option value="">${entry.cfg.rir}?</option>
            ${RIR_OPTS.map(o => html`<option value=${o}>${o === 4 ? '4+' : o}</option>`)}
          </select>`}
          <button class=${'check' + (s.done ? ' on' : '')} aria-pressed=${s.done} aria-label=${s.done ? 'Mark not done' : 'Mark done'} onClick=${() => toggleDone(i)}>✓</button>
          <div class="set-meta">
            ${est && html`<span class="e1rm">≈ ${fmt(est)} kg 1RM</span>`}
            ${isPr && html`<span class="pr">PR</span>`}
            ${ex.eq === 'barbell' && s.w > 0 && html`<button class="link" onClick=${() => setPlateFor(plateFor === i ? null : i)}>${plateFor === i ? 'hide plates' : 'plates'}</button>`}
          </div>
          ${plateFor === i && html`<div class="set-plates"><${PlateBar} weight=${s.w} bar=${settings.bar || 20} plates=${settings.plates} /></div>`}
        </div>`
      })}
    </div>
    ${entry.advice && html`<p class="advice" role="status">${entry.advice}</p>`}
    <div class="ex-actions">
      <button class="btn small" onClick=${addSet}>+ Set</button>
      ${ex.eq === 'barbell' && !entry.sets.some(s => s.warmup) && html`<button class="btn small" onClick=${addWarmups}>+ Warm-ups</button>`}
      <button class=${'btn small' + (isLinked ? ' on' : '')} onClick=${onToggleSuperset}>${isLinked ? 'Unlink superset' : 'Superset with next'}</button>
      <label class="rest-pick"><span class="sr">Rest between sets</span>⏱
        <select id=${'rest-' + entry.key} aria-label="Rest between sets" value=${entry.cfg.rest || settings.rest || 150} onChange=${e => onChange({ ...entry, cfg: { ...entry.cfg, rest: +e.target.value } })}>
          ${[...new Set([...REST_PRESETS, entry.cfg.rest || settings.rest || 150])].sort((a, b) => a - b).map(s => html`<option value=${s}>${fmtClock(s)}</option>`)}
        </select></label>
      ${ex.cues?.length > 0 && html`<button class="btn small ghost" aria-expanded=${showCues} onClick=${() => setShowCues(!showCues)}>Form cues</button>`}
    </div>
    ${showCues && html`<ol class="cues">${ex.cues.map(c => html`<li>${c}</li>`)}</ol>`}
  </article>`
}
