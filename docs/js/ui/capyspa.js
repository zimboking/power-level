// CapySpa: a cosy onsen-themed water tracker. Drink, and Capy's hot spring fills up. Ported from
// zimboking/Water-habit-app-2 (Apache 2.0) into Power Level: data lives in state.water (saved as
// 'h:<date>', included in backups), ratios and goal in profile.settings.
import { html, useState, useEffect, useMemo, useRef, Sheet, Icon, PageHead, Segmented, useSwipe } from './core.js'
import { OnsenScene, CapyRing } from './onsen.js'
import { CapyStats } from './capy-stats.js'
import {
  BEVERAGES, TYPE_ORDER, QUICK_ADDS, STAGES, DEFAULT_RATIOS, RATIO_MIN, RATIO_MAX, GOAL_MIN, GOAL_MAX,
  ratiosOf, goalOf, netOf, logsOf, pctOf, stageFor, clamp, drinkName, nextUnlock, streak,
  addLog, removeLog, updateLog, setMood, dateOf, toHHMM, tsFromHHMM,
} from '../water.js'
import { uid, today } from '../store.js'

const fmtMl = n => Math.round(n).toLocaleString('en-AU')
const timeLabel = ts => new Date(ts).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
const PANELS = [{ value: 'spa', label: 'Spa' }, { value: 'log', label: 'Log' }, { value: 'stats', label: 'Stats' }]

/** Today's numbers and every CapySpa action, shared by the tab and the Home card. */
export function useCapy(app) {
  const { water = {}, profile } = app.state
  const s = profile.settings
  const ratios = ratiosOf(s), goal = goalOf(s), date = today()
  const logs = logsOf(water, date)
  const total = logs.reduce((n, l) => n + netOf(l, ratios), 0)
  const pct = pctOf(total, goal)
  const save = (fn, dates) => app.update(st => ({ ...st, water: fn(st.water || {}) }), dates.map(d => 'h:' + d))

  const add = (type, volume, ts = Date.now(), name) => {
    const entry = { id: uid(), type, volume, ts, ...(name ? { name } : {}) }
    save(w => addLog(w, entry).water, [dateOf(ts)])
    const net = netOf(entry, ratios)
    const onToday = dateOf(ts) === date
    const after = total + (onToday ? net : 0)
    let sub = onToday ? `${pctOf(after, goal)}% of goal` : 'logged for yesterday'
    if (onToday && total < goal && after >= goal) sub = 'Goal reached! Full zen 🔥'
    else if (onToday && stageFor(pctOf(after, goal)) > stageFor(pct)) { const st = STAGES[stageFor(pctOf(after, goal))]; sub = `Unlocked ${st.emoji} ${st.name}!` }
    app.toast({ text: `+${volume} ml ${drinkName(entry)} ${BEVERAGES[type].emoji} · ${sub}`, action: { label: 'Undo', run: () => save(w => removeLog(w, entry.id).water, [dateOf(ts)]) } })
  }
  const remove = id => {
    const { log, date: d } = removeLog(app.state.water || {}, id)
    if (!log) return
    save(w => removeLog(w, id).water, [d])
    app.toast({ text: `Deleted ${log.volume} ml ${drinkName(log)}`, action: { label: 'Undo', run: () => save(w => (removeLog(w, id).log ? w : addLog(w, log).water), [d]) } })
  }
  const change = (id, patch) => {
    const { dates } = updateLog(app.state.water || {}, id, patch)
    save(w => updateLog(w, id, patch).water, dates)
    app.toast(`Updated: ${patch.volume} ml ${drinkName(patch)} at ${timeLabel(patch.ts)}`)
  }
  return {
    ratios, goal, date, logs, total, pct, stage: stageFor(pct),
    streak: streak(water, ratios, goal, date),
    mood: water[date]?.mood || null,
    add, remove, change,
    pickMood: m => save(w => setMood(w, date, m), [date]),
    setRatio: (t, r) => app.setSetting({ capyRatios: { ...ratios, [t]: r } }),
    resetRatios: () => app.setSetting({ capyRatios: { ...DEFAULT_RATIOS } }),
    setGoal: g => app.setSetting({ waterGoal: clamp(g, GOAL_MIN, GOAL_MAX) }),
  }
}

export const BevBadge = ({ type, small }) => html`<span class=${'bev-badge bev-' + type + (small ? ' sm' : '')} aria-hidden="true">${BEVERAGES[type].emoji}</span>`

function TypePicker({ value, onChange, ratios }) {
  return html`<div class="cs-types" role="radiogroup" aria-label="Drink">${TYPE_ORDER.map(t => html`<button type="button" role="radio" aria-checked=${value === t}
    class=${'cs-type' + (value === t ? ' on' : '')} onClick=${() => onChange(t)}><span class="cs-emoji">${BEVERAGES[t].emoji}</span><b>${BEVERAGES[t].label}</b><small>×${ratios[t].toFixed(2)}</small></button>`)}</div>`
}

function VolumeControl({ value, onChange }) {
  const set = v => onChange(clamp(v, 50, 1500))
  return html`<div class="cs-vol">
    <div class="cs-vol-row"><button type="button" class="circle-btn" aria-label="Less" onClick=${() => set(value - 50)}>−</button>
      <span><b class="tnum">${value}</b> ml</span><button type="button" class="circle-btn" aria-label="More" onClick=${() => set(value + 50)}>+</button></div>
    <input type="range" class="cs-range" min="50" max="1000" step="10" value=${Math.min(value, 1000)} aria-label="Volume in ml" onInput=${e => set(Number(e.target.value))} />
  </div>`
}

function CustomSheet({ open, onClose, capy }) {
  const [type, setType] = useState('water')
  const [volume, setVolume] = useState(350)
  const [time, setTime] = useState(() => toHHMM(Date.now()))
  useEffect(() => { if (open) setTime(toHHMM(Date.now())) }, [open])
  const net = Math.round(volume * capy.ratios[type])
  return html`<${Sheet} open=${open} title="Custom sip" onClose=${onClose}>
    <${TypePicker} value=${type} onChange=${setType} ratios=${capy.ratios} />
    <${VolumeControl} value=${volume} onChange=${setVolume} />
    <div class="chips chips-sm">${[100, 200, 250, 330, 500, 750].map(v => html`<button type="button" class=${'chip' + (volume === v ? ' on' : '')} onClick=${() => setVolume(v)}>${v} ml</button>`)}</div>
    <div class="cs-time-row"><label><${Icon} name="timer" size=${18} /><input id="cs-time" type="time" class="input" value=${time} onInput=${e => setTime(e.target.value)} aria-label="Time" /></label>
      <span class="muted small">Net <b class="tnum">${net} ml</b></span></div>
    <button class="btn primary big cs-go" onClick=${() => { capy.add(type, volume, tsFromHHMM(time, capy.date)); onClose() }}>Add ${volume} ml ${BEVERAGES[type].label}</button>
  </${Sheet}>`
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 56 }, (_, i) => ({
    left: Math.random() * 100, size: 6 + Math.random() * 6, delay: Math.random() * 0.6, dur: 2.2 + Math.random() * 1.2,
    dx: (Math.random() - 0.5) * 140, rot: (Math.random() - 0.5) * 900, round: i % 3 === 0, c: i % 6,
  })), [])
  return html`<div class="cs-confetti-wrap" aria-hidden="true">${pieces.map(p => html`<span class=${'cs-confetti c' + p.c} style=${{
    left: p.left + '%', width: p.size + 'px', height: (p.round ? p.size : p.size * 0.5) + 'px', borderRadius: p.round ? '99px' : '2px',
    animationDelay: p.delay + 's', animationDuration: p.dur + 's', '--dx': p.dx + 'px', '--rot': p.rot + 'deg' }}></span>`)}</div>`
}

function NextLine({ capy }) {
  const u = nextUnlock(capy.total, capy.goal)
  if (u.next) return html`<p class="cs-next">Drink <b>${fmtMl(u.need)} ml</b> more to unlock ${u.next.emoji} <b>${u.next.name}</b>: ${u.next.unlock}.</p>`
  if (capy.pct < 100) return html`<p class="cs-next">Turtle buddy aboard! <b>${fmtMl(u.need)} ml</b> to full zen and today's 🔥 streak.</p>`
  return html`<p class="cs-next">Full zen reached. Capy, turtle and the yuzu salute you. 🐢✨</p>`
}

function SpaPanel({ capy, onCustom }) {
  const [squish, setSquish] = useState(0)
  const [hearts, setHearts] = useState([])
  const [towel, setTowel] = useState(0)
  const [confetti, setConfetti] = useState(0)
  const prev = useRef({ total: capy.total, stage: capy.stage })
  useEffect(() => {
    const p = prev.current
    if (p.stage < 1 && capy.stage >= 1) setTowel(k => k + 1)
    if (p.total < capy.goal && capy.total >= capy.goal) setConfetti(k => k + 1)
    prev.current = { total: capy.total, stage: capy.stage }
  }, [capy.total, capy.stage])
  useEffect(() => { if (!towel) return; const t = setTimeout(() => setTowel(0), 1600); return () => clearTimeout(t) }, [towel])
  useEffect(() => { if (!confetti) return; const t = setTimeout(() => setConfetti(0), 3800); return () => clearTimeout(t) }, [confetti])
  useEffect(() => { if (!squish) return; const t = setTimeout(() => setSquish(0), 700); return () => clearTimeout(t) }, [squish])
  const tap = () => {
    setSquish(k => k + 1)
    const batch = Array.from({ length: 3 }, (_, i) => ({ id: uid(), x: 44 + Math.random() * 12, dx: (Math.random() - 0.5) * 70, delay: i * 0.12 }))
    setHearts(h => [...h, ...batch])
    setTimeout(() => setHearts(h => h.filter(x => !batch.includes(x))), 1800)
  }
  const left = Math.max(0, capy.goal - capy.total)
  return html`<div class="stack">
    <section class="card cs-sum">
      <${CapyRing} pct=${capy.pct} />
      <div class="cs-sum-text"><small class="muted">Net hydration today</small>
        <p class="cs-total"><b class="tnum">${fmtMl(capy.total)}</b> <span>/ ${fmtMl(capy.goal)} ml</span></p>
        <div class="meter cs-meter"><span class=${capy.pct >= 100 ? 'done' : ''} style=${{ width: clamp(capy.pct, 0, 100) + '%' }}></span></div>
        <small class="muted">${left > 0 ? `${fmtMl(left)} ml to go` : `Goal smashed by ${fmtMl(capy.total - capy.goal)} ml 🎉`}</small></div>
    </section>
    <section class="cs-scene-card">
      <div class="cs-scene">
        <${OnsenScene} pct=${capy.pct} id="spa" onTap=${tap} squish=${squish > 0} towelDrop=${towel} />
        <span class="cs-badge left">${STAGES[capy.stage].emoji} ${STAGES[capy.stage].name}</span>
        <span class="cs-badge right">❤️ Tap Capy</span>
        ${hearts.map(h => html`<span key=${h.id} class="cs-heart" style=${{ left: h.x + '%', '--dx': h.dx + 'px', animationDelay: h.delay + 's' }}>❤️</span>`)}
      </div>
      <div class="cs-scene-foot">
        <div class="cs-stages">${STAGES.map((s, i) => html`<div class=${'cs-stage' + (i <= capy.stage ? ' on' : '') + (i === 3 ? ' gold' : '')}><span></span><small>${s.emoji} ${s.at}%</small></div>`)}</div>
        <${NextLine} capy=${capy} />
      </div>
    </section>
    <div class="cs-quick">
      ${QUICK_ADDS.map(q => html`<button class=${'cs-quick-btn bev-' + q.type} aria-label=${`Add ${q.volume} ml ${q.label}`} onClick=${() => capy.add(q.type, q.volume, Date.now(), q.name)}>
        <span class="cs-emoji">${q.emoji}</span><b>+${q.volume}</b><small>${q.label}</small></button>`)}
      <button class="cs-quick-btn custom" aria-label="Add a custom drink" onClick=${onCustom}><span class="cs-plus"><${Icon} name="plus" size=${16} /></span><b>Custom</b><small>any sip</small></button>
    </div>
    ${confetti > 0 && html`<${Confetti} key=${confetti} />`}
  </div>`
}

function LogRow({ log, capy, editing, onEdit, onDone }) {
  const { dx, handlers } = useSwipe({ onLeft: () => capy.remove(log.id), onRight: onEdit })
  const [draft, setDraft] = useState(null)
  useEffect(() => { if (editing) setDraft({ type: log.type, volume: log.volume, time: toHHMM(log.ts) }) }, [editing])
  const r = capy.ratios[log.type] ?? 1
  return html`<div class=${'cs-log' + (editing ? ' editing' : '')}>
    <div class="set-swipe">
      <div class="swipe-bg" aria-hidden="true"><span class="sw-copy"><${Icon} name="edit" size=${18} /> Edit</span><span class="sw-del">Delete <${Icon} name="trash" size=${18} /></span></div>
      <div class="cs-log-row" style=${dx && !editing ? { transform: `translateX(${dx}px)` } : null} ...${editing ? {} : handlers}>
        <${BevBadge} type=${log.type} />
        <div class="row-main"><span class="cs-log-top"><b>${drinkName(log)}</b><b class="tnum">${log.volume} ml</b></span>
          <small class="cs-log-top">${timeLabel(log.ts)} · ×${r.toFixed(2)}<span><b class="cs-net tnum">${netOf(log, capy.ratios)} ml</b> net</span></small></div>
        ${!editing && html`<button class="icon-btn" aria-label=${`Edit ${drinkName(log)} at ${timeLabel(log.ts)}`} onClick=${onEdit}><${Icon} name="edit" size=${18} /></button>`}
      </div>
    </div>
    ${editing && draft && html`<div class="cs-edit">
      <${TypePicker} value=${draft.type} onChange=${type => setDraft({ ...draft, type })} ratios=${capy.ratios} />
      <${VolumeControl} value=${draft.volume} onChange=${volume => setDraft({ ...draft, volume })} />
      <div class="cs-time-row"><label><${Icon} name="timer" size=${18} /><input type="time" class="input" value=${draft.time} aria-label="Time" onInput=${e => setDraft({ ...draft, time: e.target.value })} /></label>
        <span class="muted small">Net <b class="tnum">${Math.round(draft.volume * capy.ratios[draft.type])} ml</b></span></div>
      <div class="row-btns"><button class="btn danger-text" onClick=${() => { onDone(); capy.remove(log.id) }}>Delete</button><span class="right"></span>
        <button class="btn" onClick=${onDone}>Cancel</button>
        <button class="btn primary cs-go" onClick=${() => { capy.change(log.id, { type: draft.type, volume: draft.volume, ts: tsFromHHMM(draft.time, dateOf(log.ts)), name: draft.type === log.type ? log.name : undefined }); onDone() }}>Save</button></div>
    </div>`}
  </div>`
}

function HydrationCalculator({ capy }) {
  const custom = TYPE_ORDER.some(t => capy.ratios[t] !== DEFAULT_RATIOS[t])
  const step = (t, d) => capy.setRatio(t, Math.round(clamp(capy.ratios[t] + d, RATIO_MIN, RATIO_MAX) * 100) / 100)
  return html`<section class="card">
    <div class="card-head"><p class="card-title">Hydration calculator</p>${custom && html`<button class="text-btn" onClick=${capy.resetRatios}>Reset defaults</button>`}</div>
    <p class="small muted">Net hydration = volume × ratio. Capy's onsen, your goal and your streak all track <b>net ml</b>.</p>
    <div class="cs-goal-row"><span class="row-main"><span>Daily goal</span><small>Steps of 100 ml</small></span>
      <div class="cs-ratio"><button class="circle-btn" aria-label="Lower daily goal" disabled=${capy.goal <= GOAL_MIN} onClick=${() => capy.setGoal(capy.goal - 100)}>−</button>
        <b class="tnum">${fmtMl(capy.goal)} ml</b><button class="circle-btn" aria-label="Raise daily goal" disabled=${capy.goal >= GOAL_MAX} onClick=${() => capy.setGoal(capy.goal + 100)}>+</button></div></div>
    ${TYPE_ORDER.map(t => { const r = capy.ratios[t], b = BEVERAGES[t]; return html`<div class="cs-ratio-row"><${BevBadge} type=${t} small />
      <span class="row-main"><span>${b.label}</span><small>${r === DEFAULT_RATIOS[t] ? b.note : `Custom ratio. 250 ml counts as ${Math.round(250 * r)} ml.`}</small></span>
      <div class="cs-ratio"><button class="circle-btn" aria-label=${`Lower ${b.label} ratio`} disabled=${r <= RATIO_MIN} onClick=${() => step(t, -0.05)}>−</button>
        <b class=${'tnum' + (r === DEFAULT_RATIOS[t] ? '' : ' cs-custom')}>×${r.toFixed(2)}</b>
        <button class="circle-btn" aria-label=${`Raise ${b.label} ratio`} disabled=${r >= RATIO_MAX} onClick=${() => step(t, 0.05)}>+</button></div></div>` })}
    <p class="field-hint">Defaults follow the Beverage Hydration Index (Maughan et al., 2016) and a coffee trial by Killer et al. (2014): at everyday intake these drinks hydrate like water. Change a ratio only if your doctor advises it. Changes apply to every day's drinks.</p>
  </section>`
}

function LogPanel({ capy, onCustom }) {
  const [editing, setEditing] = useState(null)
  const sorted = [...capy.logs].sort((a, b) => b.ts - a.ts)
  const vol = capy.logs.reduce((n, l) => n + l.volume, 0)
  return html`<div class="stack">
    <div class="cs-tiles">${[['Drinks', capy.logs.length, ''], ['Volume', fmtMl(vol), 'ml'], ['Net', fmtMl(capy.total), 'ml']].map(([k, v, u]) => html`
      <div class="cs-tile"><small>${k}</small><b class="tnum">${v} <span>${u}</span></b></div>`)}</div>
    <button class="btn primary cs-go" onClick=${onCustom}><${Icon} name="plus" size=${18} /> Log a drink</button>
    ${sorted.length ? html`<p class="muted small">Swipe a drink right to edit, left to delete.</p>
      <div class="stack cs-logs">${sorted.map(l => html`<${LogRow} key=${l.id} log=${l} capy=${capy} editing=${editing === l.id} onEdit=${() => setEditing(l.id)} onDone=${() => setEditing(null)} />`)}</div>`
      : html`<div class="card empty"><span class="cs-emoji big">🫙</span><p class="empty-title">No sips yet today</p><p class="empty-body">Capy's bath is running dry. Log your first drink.</p></div>`}
    <${HydrationCalculator} capy=${capy} />
  </div>`
}

export function CapySpaView({ app }) {
  const capy = useCapy(app)
  const [panel, setPanel] = useState(() => { try { return localStorage.getItem('pl.capy') || 'spa' } catch { return 'spa' } })
  const [custom, setCustom] = useState(false)
  const choose = p => { setPanel(p); try { localStorage.setItem('pl.capy', p) } catch { /* private mode */ } window.scrollTo(0, 0) }
  return html`<div class="stack capy">
    <${PageHead} title="CapySpa" sub=${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}>
      <span class="cs-streak" title="Days in a row at your goal"><${Icon} name="flame" size=${16} /> ${capy.streak} ${capy.streak === 1 ? 'day' : 'days'}</span>
    </${PageHead}>
    <${Segmented} label="CapySpa section" value=${panel} onChange=${choose} options=${PANELS} />
    ${panel === 'spa' && html`<${SpaPanel} capy=${capy} onCustom=${() => setCustom(true)} />`}
    ${panel === 'log' && html`<${LogPanel} capy=${capy} onCustom=${() => setCustom(true)} />`}
    ${panel === 'stats' && html`<${CapyStats} app=${app} capy=${capy} />`}
    <${CustomSheet} open=${custom} onClose=${() => setCustom(false)} capy=${capy} />
  </div>`
}

/** The small CapySpa card on Home: today's water and a one-tap glass. */
export function CapyHomeCard({ app }) {
  const capy = useCapy(app)
  return html`<section class="card cs-home" onClick=${() => app.go('capyspa')}>
    <div class="card-head"><p class="card-title">CapySpa</p><span class="muted small">${STAGES[capy.stage].emoji} ${capy.pct >= 100 ? 'Full zen' : STAGES[capy.stage].name}</span></div>
    <div class="cs-home-row"><${CapyRing} pct=${capy.pct} size=${64} />
      <div class="row-main"><span class="cs-home-total"><b class="tnum">${fmtMl(capy.total)}</b> <small>/ ${fmtMl(capy.goal)} ml</small></span><small>${capy.streak ? `🔥 ${capy.streak} day streak` : 'Net water today'}</small></div>
      <button class="pill-go cs-pill" aria-label="Add 250 ml water" onClick=${e => { e.stopPropagation(); capy.add('water', 250) }}>+250 💧</button></div>
  </section>`
}
