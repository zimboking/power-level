// One exercise inside a session: demo, muscles, last time, bar maths, why this target, and the
// sets. The maths (1RM, next-set adjustment, plates, warm-ups) happens here so you never do it.
import { html, useState, useEffect, fmt, fmtDate, fmtClock, Icon, ActionSheet, Sheet, WheelPicker } from './core.js'
import { SetRow, EffortSheet } from './set-row.js'
import { ExerciseDemo } from './media.js'
import { ExerciseMuscles } from './bodymap.js'
import { e1rm, nextSetAdvice, platesFor, warmupSets } from '../strength.js'
import { exInfo, stepFor, usesPlates, barWeight, BAR_TYPES, EQUIPMENT_NAMES, isTimed, isBodyweight, isReformer, withLoadPref, instructionsFor } from '../exercises.js'
import { POLICIES, effortLabel } from '../progression.js'
import { policyOf, lastTimeLine, bestEverE1rm, entriesFor } from '../plan.js'
import { bestsOf, repsAtLeast, lastNoteFor } from '../records.js'
import { TIME_UNITS, DIST_UNITS, timeUnitOf, tracksDistance, distUnitOf } from '../duration.js'
import { MUSCLE_NAME } from '../muscles.js'
import { primeAudio } from './rest.js'

export function PlateBar({ weight, bar = 20, plates, label = 'Barbell' }) {
  const { perSide, remainder, ok } = platesFor(weight, bar, plates)
  const colors = { 25: 'p25', 20: 'p20', 15: 'p15', 10: 'p10', 5: 'p5', 2.5: 'p2', 1.25: 'p1' }
  const hgt = p => (p >= 15 ? 54 : p >= 10 ? 46 : p >= 5 ? 36 : 28)
  let x = 204
  const right = perSide.map(p => { const w = p >= 10 ? 11 : 7; const r = { p, x, w }; x += w + 2; return r })
  return html`<figure class="platebar">
    <svg viewBox="0 0 300 64" role="img" aria-label=${`${weight} kg: ${perSide.join(', ') || 'nothing'} each side of a ${bar} kg ${label}`}>
      <rect x="4" y="29" width="292" height="6" rx="3" class="bar-steel" />
      <rect x="96" y="22" width="8" height="20" rx="2" class="bar-collar" /><rect x="196" y="22" width="8" height="20" rx="2" class="bar-collar" />
      ${right.map(r => html`<rect x=${r.x} y=${32 - hgt(r.p) / 2} width=${r.w} height=${hgt(r.p)} rx="2" class=${'plate ' + (colors[r.p] || 'p1')} />`)}
      ${right.map(r => html`<rect x=${300 - r.x - r.w} y=${32 - hgt(r.p) / 2} width=${r.w} height=${hgt(r.p)} rx="2" class=${'plate ' + (colors[r.p] || 'p1')} />`)}
    </svg>
    <figcaption>${label} ${bar} kg · ${perSide.length ? html`each side <b>${perSide.join(' + ')}</b>` : 'no plates'}${!ok && remainder > 0 ? html` <span class="warn">(${fmt(remainder)} kg can’t be made with your plates)</span>` : ''}</figcaption>
  </figure>`
}

function InfoSheet({ ex, open, onClose, sex }) {
  const [ins, setIns] = useState(null)
  useEffect(() => { if (open && ins == null) instructionsFor(ex).then(setIns) }, [open])
  return html`<${Sheet} open=${open} title=${ex.name} onClose=${onClose} tall>
    <${ExerciseMuscles} ex=${ex} sex=${sex} size="md" />
    <p class="muted small center">${[...(ex.p || []).map(m => html`<b>${MUSCLE_NAME[m] || m}</b>`), ...(ex.s || []).map(m => MUSCLE_NAME[m] || m)].reduce((a, b, i) => (i ? [...a, ' · ', b] : [b]), [])}</p>
    ${ex.cues?.length > 0 && html`<div class="card-flat"><p class="section-label">Think about</p><ol class="cues">${ex.cues.map(c => html`<li>${c}</li>`)}</ol></div>`}
    ${ins?.length > 0 && html`<div class="card-flat"><p class="section-label">How to</p><ol class="cues">${ins.map(c => html`<li>${c}</li>`)}</ol></div>`}
  </${Sheet}>`
}

export function ExerciseCard({ entry, label, index, count, app, view, onChange, onSetDone, onRemove, onMove, onToggleSuperset, isLinked, onSwap, demoMin, onToggleDemo }) {
  const { profile, workouts } = app.state
  const settings = profile.settings
  const ex = exInfo(entry.exId)
  const step = stepFor(ex)
  const timed = isTimed(ex), bw = isBodyweight(ex)
  const unit = timeUnitOf(ex, profile.settings)
  const dist = tracksDistance(ex) ? distUnitOf(ex, profile.settings) : null
  const [unitSheet, setUnitSheet] = useState(false)
  const scale = settings.effort === 'rpe' ? 'rpe' : 'rir'
  const showEffort = settings.showEffort !== false
  const bar = barWeight(ex, settings)
  const [menu, setMenu] = useState(false)
  const [setMenuIdx, setSetMenuIdx] = useState(null)
  const [effortIdx, setEffortIdx] = useState(null)
  const [restFor, setRestFor] = useState(null) // 'exercise' | set index
  const [progSheet, setProgSheet] = useState(false)
  const [info, setInfo] = useState(false)
  const [plateIdx, setPlateIdx] = useState(null)
  const prevBest = bestEverE1rm(workouts, entry.exId)
  const prev = bestsOf(entriesFor(workouts, entry.exId))
  // A done set is a record if it beats the estimated 1RM, the heaviest weight or the most reps at that weight.
  const isRecord = st => !!(prev && st.done && !st.warmup && st.r > 0 && ((st.w || 0) > prev.weight
    || (prev.e1rm > 0 && st.w > 0 && e1rm(st.w, st.r, st.rir ?? 0) > prev.e1rm) || st.r > repsAtLeast(prev, st.w || 0)))
  const lastNote = lastNoteFor(workouts, entry.exId)
  const [noteOpen, setNoteOpen] = useState(false)
  const last = lastTimeLine(workouts, entry.exId, r => effortLabel(r, scale))
  const firstWork = entry.sets.find(s => !s.warmup)
  const policy = entry.cfg.goal ? 'goal' : policyOf(entry.cfg, ex, settings)

  // Switching to bodyweight clears the weight on this exercise's sets (a belt can be added back).
  const setLoad = bodyweight => {
    app.setSetting({ loadPrefs: withLoadPref(settings.loadPrefs, ex, bodyweight) })
    if (bodyweight) onChange({ ...entry, sets: entry.sets.map(s => ({ ...s, w: 0 })) })
  }
  const patchSet = (i, patch) => onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? { ...s, ...patch, auto: false } : s)) })
  const toggleDone = i => {
    primeAudio()
    const s = entry.sets[i]
    const nowDone = !s.done
    let sets = entry.sets.map((x, j) => (j === i ? { ...x, done: nowDone, rir: x.rir ?? (x.warmup || !showEffort ? null : entry.cfg.rir) } : x))
    let advice = entry.advice
    if (nowDone && !s.warmup && !timed && !entry.cfg.pyramid) {
      const a = nextSetAdvice(sets[i], entry.cfg, step)
      const follows = (x, j) => j > i && !x.warmup && !x.done && x.auto
      const n = sets.filter(follows).length
      if (a && n) {
        sets = sets.map((x, j) => (follows(x, j) ? { ...x, w: a.w, r: a.r } : x))
        advice = a.change !== 0 ? a.why + (n > 1 ? ` Remaining ${n} sets updated.` : ' Next set updated.') : a.why
      } else if (a) advice = 'Last set done. ' + (a.change > 0 ? 'Next session will go up.' : a.change < 0 ? 'Next session will adjust.' : 'Nailed it.')
    }
    onChange({ ...entry, sets, advice })
    if (nowDone) onSetDone(entry, sets[i])
  }
  const removeSet = i => {
    const removed = entry.sets[i]
    const before = entry
    onChange({ ...entry, sets: entry.sets.filter((_, j) => j !== i) })
    app.toast({ text: (removed.warmup ? 'Warm-up' : 'Set') + ' deleted', action: { label: 'Undo', run: () => onChange(before) } })
  }
  const copySet = i => {
    const s = entry.sets[i]
    onChange({ ...entry, sets: [...entry.sets.slice(0, i + 1), { ...s, done: false, auto: false }, ...entry.sets.slice(i + 1)] })
  }
  const addSet = () => {
    const lastW = [...entry.sets].reverse().find(s => !s.warmup) || { w: entry.target.w, r: entry.cfg.repsMin, sec: entry.target.sec }
    onChange({ ...entry, sets: [...entry.sets, { w: lastW.w, r: lastW.r, sec: lastW.sec, dist: lastW.dist, rest: lastW.rest, rir: null, done: false, auto: true }] })
  }
  const addWarmups = () => {
    const w = warmupSets(firstWork?.w || entry.target.w, bar, step).map(s => ({ ...s, rir: null, done: false }))
    onChange({ ...entry, sets: [...w, ...entry.sets.filter(s => !s.warmup)] })
  }
  const setCfg = patch => onChange({ ...entry, cfg: { ...entry.cfg, ...patch } })

  const perSideW = firstWork?.w > bar && bar ? fmt((firstWork.w - bar) / 2) : null
  // One plates link, on the next set to do, keeps the table quiet.
  const platesIdx = bar > 0 ? entry.sets.findIndex(x => !x.done && x.w > 0) : -1
  let workNo = 0
  const s = setMenuIdx != null ? entry.sets[setMenuIdx] : null
  return html`<article class=${'ex-card view-' + view + (entry.group ? ' in-superset' : '')} id=${'ex-' + entry.key}>
    ${view === 'focus' && html`<p class="ex-count">Exercise ${index + 1} / ${count}${label ? ` · superset ${label}` : ''}</p>
      <${ExerciseDemo} ex=${ex} sex=${settings.sex} minimized=${demoMin} onToggle=${onToggleDemo} />`}
    <header class="ex-head">
      ${label && html`<span class="ss-tag">${label}</span>`}
      <h3 class="ex-name" onClick=${() => setInfo(true)}>${ex.name}</h3>
      <button class="circle-btn" aria-label=${'Options for ' + ex.name} onClick=${() => setMenu(true)}><${Icon} name="more" /></button>
    </header>
    <div class="tag-row">
      ${(ex.p || []).slice(0, 2).map(m => html`<span class="tag">${MUSCLE_NAME[m] || m}</span>`)}
      <span class="tag">${EQUIPMENT_NAMES[ex.eq] || ex.eq}</span>
      ${prevBest > 0 && html`<span class="tag">Best: ${fmt(prevBest)} kg 1RM</span>`}
      ${ex.uni && html`<span class="tag">Per side</span>`}
    </div>
    ${last && html`<p class="last-time">Last time (${fmtDate(last.date)}): ${last.text}</p>`}
    ${lastNote && lastNote.text !== entry.note?.trim() && html`<p class="last-note"><${Icon} name="edit" size=${14} /> Note from ${fmtDate(lastNote.date)}: ${lastNote.text}</p>`}
    ${bar > 0 && firstWork?.w > 0 && html`<p class="bar-line"><${Icon} name="dumbbell" size=${15} /> ${BAR_TYPES[ex.eq]} ${bar} kg${perSideW ? ` · ${perSideW} kg per side` : ''}</p>`}
    <p class=${'prog-line k-' + entry.target.kind}><${Icon} name=${entry.target.kind === 'deload' || entry.target.kind === 'down' ? 'down' : entry.target.kind === 'hold' ? 'right' : 'up'} size=${15} />
      <b>${policy === 'goal' ? 'Goal journey' : POLICIES[policy]?.name}</b> · ${entry.target.why}</p>

    <div class="sets-box">
      <div class=${'set-row set-head' + (showEffort ? '' : ' no-effort')} aria-hidden="true"><span></span><span>${dist ? DIST_UNITS[dist].head : ex.eq === 'reformer' ? 'SPRINGS' : bw ? '+KG' : 'WEIGHT (KG)'}</span><span>${timed ? TIME_UNITS[unit].head : ex.uni ? 'REPS/SIDE' : 'REPS'}</span>${showEffort && html`<span>${scale.toUpperCase()}</span>`}<span></span></div>
      ${entry.sets.map((st, i) => {
        const tag = st.warmup ? 'W' : String(++workNo)
        const est = !st.warmup && !timed && st.r > 0 && st.w > 0 ? e1rm(st.w, st.r, st.rir ?? entry.cfg.rir) : null
        return html`<${SetRow} key=${i + '-' + entry.sets.length} set=${st} tag=${tag} ex=${ex} step=${step} scale=${scale} showEffort=${showEffort} timed=${timed} unit=${unit} dist=${dist} bodyweight=${bw} perSide=${ex.uni}
          est=${st.done ? est : null} isPr=${isRecord(st)} plates=${i === platesIdx || plateIdx === i} platesOpen=${plateIdx === i} onPlates=${() => setPlateIdx(plateIdx === i ? null : i)}
          onPatch=${p => patchSet(i, p)} onToggle=${() => toggleDone(i)} onDelete=${() => removeSet(i)} onCopy=${() => copySet(i)} onMenu=${() => setSetMenuIdx(i)} onEffort=${() => setEffortIdx(i)} />
          ${plateIdx === i && html`<${PlateBar} weight=${st.w} bar=${bar} plates=${settings.plates} label=${BAR_TYPES[ex.eq]} />`}`
      })}
      <div class="sets-actions">
        <button class="text-btn" onClick=${addSet}><${Icon} name="plus" size=${16} /> Add set</button>
        ${bar > 0 && !entry.sets.some(x => x.warmup) && html`<button class="text-btn" onClick=${addWarmups}><${Icon} name="flame" size=${16} /> Warm-ups</button>`}
        <button class="text-btn" onClick=${() => setRestFor('exercise')}><${Icon} name="timer" size=${16} /> ${fmtClock(entry.cfg.rest || settings.rest || 150)}</button>
        ${!(noteOpen || entry.note) && html`<button class="text-btn" onClick=${() => setNoteOpen(true)}><${Icon} name="edit" size=${16} /> Note</button>`}
      </div>
      ${(noteOpen || entry.note) && html`<input id=${'note-' + entry.key} class="input ex-note" maxlength="200" placeholder=${lastNote ? 'e.g. ' + lastNote.text : 'Note for this exercise, e.g. seat height 4'}
        aria-label=${'Note for ' + ex.name} value=${entry.note || ''} onInput=${e => onChange({ ...entry, note: e.target.value })} autoFocus=${noteOpen && !entry.note} />`}
    </div>
    ${entry.advice && html`<p class="advice" role="status">${entry.advice}</p>`}

    <${ActionSheet} open=${menu} title=${ex.name} onClose=${() => setMenu(false)} actions=${[
      { label: 'How to & muscles', icon: 'info', onClick: () => setInfo(true) },
      { label: 'Swap exercise', icon: 'swap', onClick: onSwap },
      { label: isLinked ? 'Unlink superset' : 'Superset with next', icon: 'link', onClick: onToggleSuperset },
      { label: 'Progression rule', icon: 'up', hint: policy === 'goal' ? 'Set by your goal' : POLICIES[policy]?.name, onClick: () => setProgSheet(true) },
      { label: entry.cfg.pyramid ? 'Turn off pyramid sets' : 'Pyramid sets', icon: 'stats', hint: 'Own weight, reps and rest per set', onClick: () => setCfg({ pyramid: !entry.cfg.pyramid }) },
      { label: 'Rest time', icon: 'timer', hint: fmtClock(entry.cfg.rest || settings.rest || 150), onClick: () => setRestFor('exercise') },
      timed && { label: 'Time in', icon: 'timer', hint: TIME_UNITS[unit].label, onClick: () => setUnitSheet(true) },
      !timed && !isReformer(ex) && { label: bw ? 'Use weight' : 'Bodyweight, no weight', icon: 'dumbbell', hint: bw ? 'Logged as bodyweight now' : 'For chin-ups, push-ups, dips…', onClick: () => setLoad(!bw) },
      index > 0 && { label: 'Move up', icon: 'up', onClick: () => onMove(-1) },
      index < count - 1 && { label: 'Move down', icon: 'down', onClick: () => onMove(1) },
      { label: 'Remove exercise', icon: 'trash', danger: true, onClick: onRemove },
    ]} />
    <${ActionSheet} open=${s != null} title=${s?.warmup ? 'Warm-up set' : 'Set ' + (setMenuIdx != null ? entry.sets.slice(0, setMenuIdx + 1).filter(x => !x.warmup).length : '')} onClose=${() => setSetMenuIdx(null)} actions=${s ? [
      { label: s.warmup ? 'Make it a working set' : 'Make it a warm-up', icon: 'flame', onClick: () => patchSet(setMenuIdx, { warmup: !s.warmup }) },
      !s.warmup && { label: s.failure ? 'Not to failure' : 'Taken to failure', icon: 'bolt', onClick: () => patchSet(setMenuIdx, { failure: !s.failure, rir: s.failure ? s.rir : 0 }) },
      { label: 'Rest after this set', icon: 'timer', hint: s.rest ? fmtClock(s.rest) : 'Uses the exercise rest', onClick: () => setRestFor(setMenuIdx) },
      { label: 'Copy set', icon: 'copy', hint: 'or swipe right', onClick: () => copySet(setMenuIdx) },
      { label: 'Delete set', icon: 'trash', hint: 'or swipe left', danger: true, onClick: () => removeSet(setMenuIdx) },
    ] : []} />
    <${EffortSheet} open=${effortIdx != null} scale=${scale} value=${effortIdx != null ? entry.sets[effortIdx]?.rir : null} onClose=${() => setEffortIdx(null)} onPick=${v => patchSet(effortIdx, { rir: v })} />
    <${Sheet} open=${restFor != null} title=${restFor === 'exercise' ? 'Rest between sets' : 'Rest after this set'} onClose=${() => setRestFor(null)}>
      <${WheelPicker} value=${restFor === 'exercise' ? entry.cfg.rest || settings.rest || 150 : entry.sets[restFor]?.rest || entry.cfg.rest || settings.rest || 150}
        onChange=${v => (restFor === 'exercise' ? setCfg({ rest: v }) : patchSet(restFor, { rest: v }))} />
      ${restFor !== 'exercise' && html`<button class="btn ghost" onClick=${() => { patchSet(restFor, { rest: undefined }); setRestFor(null) }}>Use the exercise rest</button>`}
      <button class="btn primary" onClick=${() => setRestFor(null)}>Done</button>
    </${Sheet}>
    <${Sheet} open=${progSheet} title="Progression rule" onClose=${() => setProgSheet(false)}>
      ${policy === 'goal' ? html`<p class="muted">This lift follows your goal journey, which sets each week's sets, reps and weight.</p>` : html`
      <div class="group">${Object.entries(POLICIES).filter(([k]) => (timed ? ['time', 'off'] : ['double', 'linear', 'greyskull', 'triple', 'off']).includes(k)).map(([k, p]) => html`
        <button class=${'row-btn' + (policy === k ? ' on' : '')} onClick=${() => { setCfg({ prog: k, pyramid: false }); setProgSheet(false) }}><span class="row-main"><span>${p.name}</span><small>${p.desc}</small></span>${policy === k && html`<${Icon} name="check" />`}</button>`)}</div>
      <p class="muted small">Takes effect from the next session. Save the workout as a routine to keep it.</p>`}
    </${Sheet}>
    <${InfoSheet} ex=${ex} open=${info} onClose=${() => setInfo(false)} sex=${settings.sex} />
    <${Sheet} open=${unitSheet} title=${'Time in, for ' + ex.name} onClose=${() => setUnitSheet(false)}>
      <div class="group">${Object.entries(TIME_UNITS).map(([k, u]) => html`<button class=${'row-btn' + (unit === k ? ' on' : '')} onClick=${() => { app.setSetting({ timeUnits: { ...(settings.timeUnits || {}), [ex.id]: k } }); setUnitSheet(false) }}>
        <span class="row-main"><span>${u.label}</span></span>${unit === k && html`<${Icon} name="check" />`}</button>`)}</div>
      <p class="muted small">Only changes how this exercise is shown and entered. Your logged times stay as they are.</p>
    </${Sheet}>
  </article>`
}
