// One set. The set number is its own menu; swipe left to delete (with Undo), right to copy.
// Effort is optional and colour-coded, shown as RIR or RPE.
import { html, useState, Stepper, Sheet, Icon, useSwipe, fmt } from './core.js'
import { EFFORT, effortLabel, effortTone } from '../progression.js'
import { TIME_UNITS, DIST_UNITS, toUnit, fromUnit, toDist, fromDist } from '../duration.js'

export function EffortSheet({ open, scale, value, onPick, onClose }) {
  return html`<${Sheet} open=${open} title=${scale === 'rpe' ? 'How hard was it? (RPE)' : 'Reps in reserve (RIR)'} onClose=${onClose}>
    <div class="group">${EFFORT.map(e => html`<button class=${'row-btn effort-row' + (value === e.rir ? ' on' : '')} onClick=${() => { onPick(e.rir); onClose() }}>
      <span class=${'effort-dot ' + e.tone}>${scale === 'rpe' ? 10 - e.rir : e.rir === 4 ? '4+' : e.rir}</span>
      <span class="row-main"><span>${e.label}</span><small>${e.line}</small></span></button>`)}
      <button class="row-btn" onClick=${() => { onPick(null); onClose() }}><span class="effort-dot">–</span><span class="row-main"><span>Clear</span></span></button>
    </div>
  </${Sheet}>`
}

export function SetRow({ set, tag, ex, step, scale, showEffort, timed, unit = 's', dist = null, bodyweight, perSide, est, isPr, onPatch, onToggle, onDelete, onCopy, onMenu, onEffort, plates, platesOpen, onPlates }) {
  const { dx, handlers } = useSwipe({ onLeft: onDelete, onRight: onCopy })
  return html`<div class="set-wrap"><div class="set-swipe">
    <div class="swipe-bg" aria-hidden="true"><span class="sw-copy"><${Icon} name="copy" size=${18} /> Copy</span><span class="sw-del">Delete <${Icon} name="trash" size=${18} /></span></div>
    <div class=${'set-row' + (set.done ? ' done' : '') + (set.warmup ? ' warm' : '') + (showEffort ? '' : ' no-effort')} style=${dx ? { transform: `translateX(${dx}px)` } : null} ...${handlers}>
      <button class=${'set-num' + (set.failure ? ' fail' : '')} aria-label=${(set.warmup ? 'Warm-up set' : 'Set ' + tag) + ' options'} onClick=${onMenu}>${tag}</button>
      ${dist ? html`<${Stepper} label=${'Distance in ' + DIST_UNITS[dist].label.toLowerCase()} value=${toDist(set.dist, dist)} step=${DIST_UNITS[dist].step} onChange=${v => onPatch({ dist: fromDist(v, dist) })} unit=${DIST_UNITS[dist].short} />`
        : ex.eq === 'reformer' ? html`<span class="bw-add springs" title="Springs go in the exercise note">Springs<small>in note</small></span>`
        : bodyweight && !(set.w > 0) && !timed
        ? html`<button class="bw-add" onClick=${() => onPatch({ w: step })} aria-label="Add weight (dip belt)">BW<small>+ kg</small></button>`
        : html`<${Stepper} label=${bodyweight ? 'Added weight' : 'Weight'} value=${set.w} step=${step} onChange=${v => onPatch({ w: v })} />`}
      ${timed ? html`<${Stepper} label=${TIME_UNITS[unit].label} value=${toUnit(set.sec, unit)} step=${TIME_UNITS[unit].step} onChange=${v => onPatch({ sec: fromUnit(v, unit) })} unit=${TIME_UNITS[unit].short} />`
        : html`<${Stepper} label=${perSide ? 'Reps per side' : 'Reps'} value=${set.r} step=${1} onChange=${v => onPatch({ r: v })} />`}
      ${showEffort && (set.warmup ? html`<span aria-hidden="true"></span>`
        : html`<button class=${'effort-btn ' + effortTone(set.rir)} onClick=${onEffort}>${effortLabel(set.rir, scale).replace(' ', ' ')}</button>`)}
      <button class=${'done-circle' + (set.done ? ' on' : '')} aria-pressed=${set.done} aria-label=${set.done ? 'Mark not done' : 'Mark done'} onClick=${onToggle}><${Icon} name="check" size=${20} /></button>
    </div></div>
    ${(est || isPr || perSide || set.rest || plates) && html`<div class="set-meta">
      ${isPr && html`<span class="pr">PR</span>`}
      ${est && html`<span>≈ ${fmt(est)} kg 1RM</span>`}
      ${perSide && html`<span>per side</span>`}
      ${set.failure && html`<span class="fail-tag">to failure</span>`}
      ${set.rest && html`<span><${Icon} name="timer" size=${13} /> ${Math.floor(set.rest / 60)}:${String(set.rest % 60).padStart(2, '0')} rest</span>`}
      ${plates && set.w > 0 && html`<button class="link" onClick=${onPlates}>${platesOpen ? 'hide plates' : 'plates'}</button>`}
    </div>`}
  </div>`
}
