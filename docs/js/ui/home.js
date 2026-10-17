// Home: the fighter, a weight check, today's food at a glance, and goal progress.
import { html, useState, useEffect, Sheet, Field, Chips, fmt, fmtDate, ConfirmButton } from './core.js'
import { PowerCard, Fighter } from './hero.js'
import { TIERS, liftedComparison, formatKg } from '../power.js'
import { workoutVolume } from '../strength.js'
import { sumEntries, ACTIVITY, GOALS, energyUnitOf, toUnit, fmtEnergy, ENERGY_UNITS } from '../nutrition.js'
import { journeyFor, latestBodyweight } from '../plan.js'
import { percentThere } from '../journey.js'
import { exInfo } from '../exercises.js'
import { dailyTargets } from './food.js'
import { today, isStandalone, makeBackup, parseBackup, downloadFile } from '../store.js'
import { makeExampleData } from '../examples.js'

const daysSince = iso => (iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 864e5) : Infinity)

function WeighIn({ app }) {
  const last = latestBodyweight(app.state.profile)
  const [kg, setKg] = useState(last || 80)
  useEffect(() => { if (last) setKg(last) }, [last])
  const todays = app.state.profile.weighins.find(w => w.date === today())
  const save = e => {
    e.preventDefault()
    const v = parseFloat(String(kg).replace(',', '.'))
    if (!(v > 20 && v < 400)) return
    app.update(s => ({ ...s, profile: { ...s.profile, weighins: [...s.profile.weighins.filter(w => w.date !== today()), { date: today(), kg: v }] } }), ['profile'])
    app.toast('Weight logged')
  }
  const sorted = [...app.state.profile.weighins].sort((a, b) => a.date.localeCompare(b.date))
  const weekAgo = sorted.filter(w => w.date <= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)).pop()
  const delta = last && weekAgo ? last - weekAgo.kg : null
  return html`<section class="panel weigh">
    <div class="panel-head"><h2 class="h2">Weight check</h2>${delta != null && html`<span class=${'delta ' + (delta > 0 ? 'up' : 'down')}>${delta > 0 ? '+' : ''}${fmt(Math.round(delta * 10) / 10)} kg this week</span>`}</div>
    <form class="inline-form" onSubmit=${save}>
      <input id="weigh-kg" class="input" inputmode="decimal" aria-label="Body weight in kilograms" value=${kg} onInput=${e => setKg(e.target.value)} />
      <span>kg</span>
      <button class="btn primary">${todays ? 'Update today' : 'Log today'}</button>
    </form>
    ${todays && html`<p class="muted small">Logged ${fmt(todays.kg)} kg today. Weigh at the same time each morning for a cleaner trend.</p>`}
  </section>`
}

function TierSheet({ open, onClose, level }) {
  return html`<${Sheet} open=${open} title="Power tiers" onClose=${onClose}>
    <p class="muted">Your power level grows with your estimated 1RMs on the big lifts (bench, squat, deadlift, overhead press, row), plus every session and every kilo you move.</p>
    <ul class="tier-list">${TIERS.map((t, i) => html`<li class=${level >= t.min ? 'got' : ''}><${Fighter} tier=${{ ...t, idx: i }} size=${56} /><div><b>${t.name}</b><span>${t.min.toLocaleString()}+</span></div></li>`)}</ul>
  </${Sheet}>`
}

export function SettingsSheet({ open, onClose, app }) {
  const s = app.state.profile.settings
  const set = patch => app.update(st => ({ ...st, profile: { ...st.profile, settings: { ...st.profile.settings, ...patch } } }), ['profile'])
  const [json, setJson] = useState('')
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState(null)
  const standalone = isStandalone()
  const stamp = () => app.update(st => ({ ...st, profile: { ...st.profile, lastBackup: today() } }), ['profile'])
  const exportData = async () => {
    const text = makeBackup(app.state)
    if (standalone) { downloadFile(`power-level-backup-${today()}.json`, text); stamp(); setMsg('Backup saved to your downloads. Keep it somewhere safe, like Google Drive or iCloud.'); return }
    try { await navigator.clipboard.writeText(text); stamp(); setMsg('Copied all your data to the clipboard.') } catch { setJson(text); setMsg('Select the text below and copy it.') }
  }
  const readBackup = text => {
    try { const d = parseBackup(text); setPending(d); setMsg('') } catch { setPending(null); setMsg('That doesn’t look like a Power Level backup.') }
  }
  const onFile = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 15e6) { setMsg('That file is too big to be a backup.'); return }
    f.text().then(readBackup, () => setMsg('Couldn’t read that file.'))
  }
  const restore = () => { app.replaceAll(pending); setPending(null); setJson(''); setMsg('Restored from backup.') }
  const num = (k, label, hint) => html`<${Field} label=${label} hint=${hint}><input id=${'set-' + k} class="input" inputmode="decimal" value=${s[k] ?? ''} onChange=${e => set({ [k]: parseFloat(e.target.value) || null })} /></${Field}>`
  return html`<${Sheet} open=${open} title="Settings" onClose=${onClose}>
    <div class="stack">
      <h3 class="h3">You</h3>
      <${Chips} small label="Sex" value=${s.sex} onChange=${v => set({ sex: v })} options=${[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
      <div class="row-2">${num('age', 'Age')}${num('height', 'Height (cm)')}</div>
      ${num('goalWeight', 'Goal body weight (kg)', 'Optional. Shown as a line on your weight chart.')}
      <${Field} label="Activity"><select id="set-activity" class="input select" value=${s.activity} onChange=${e => set({ activity: e.target.value })}>${Object.entries(ACTIVITY).map(([v, a]) => html`<option value=${v}>${a.label}</option>`)}</select></${Field}>
      <${Field} label="Energy unit" hint="Food is stored the same either way, so you can switch any time."><${Chips} small label="Energy unit" value=${energyUnitOf(s)} onChange=${v => set({ energy: v })} options=${Object.entries(ENERGY_UNITS).map(([value, label]) => ({ value, label }))} /></${Field}>
      <${Field} label="Nutrition goal"><${Chips} small label="Nutrition goal" value=${s.goal} onChange=${v => set({ goal: v })} options=${Object.entries(GOALS).map(([v, g]) => ({ value: v, label: g.label }))} /></${Field}>
      <h3 class="h3">Gym</h3>
      <div class="row-2">${num('bar', 'Barbell (kg)')}${num('rest', 'Rest timer (sec)')}</div>
      <${Field} label="Plates you have (kg)" hint="Comma separated. Used for the plate picture."><input id="set-plates" class="input" value=${(s.plates || []).join(', ')} onChange=${e => set({ plates: e.target.value.split(',').map(x => parseFloat(x)).filter(x => x > 0) })} /></${Field}>
      <h3 class="h3">Your data</h3>
      <p class="muted small">${app.mode === 'cloud' ? 'Saved to your account on this page. Only you can see it.' : 'Saved on this phone only, not online. Download a backup now and then so a lost phone or cleared browser doesn’t take your history with it.'}</p>
      ${app.state.profile.lastBackup && html`<p class="muted small">Last backup: ${fmtDate(app.state.profile.lastBackup)}</p>`}
      ${standalone ? html`<div class="row-btns">
          <button class="btn primary" onClick=${exportData}>Download backup</button>
          <label class="btn file-btn">Restore from file<input id="set-restore" type="file" accept="application/json,.json" onChange=${onFile} /></label>
        </div>`
        : html`<div class="row-btns"><button class="btn" onClick=${exportData}>Copy export</button><button class="btn" disabled=${!json.trim()} onClick=${() => readBackup(json)}>Import pasted data</button></div>
        <textarea id="set-json" class="input" rows="3" placeholder="Paste an export here to import" value=${json} onInput=${e => setJson(e.target.value)}></textarea>`}
      ${pending && html`<div class="callout"><p>This backup has <b>${pending.workouts.length} workouts</b>. Restoring replaces everything currently on this device.</p>
        <div class="row-btns"><${ConfirmButton} class="btn primary" confirmText="Tap again to replace" onConfirm=${restore}>Restore it</${ConfirmButton}><button class="btn ghost" onClick=${() => setPending(null)}>Cancel</button></div></div>`}
      ${msg && html`<p class="small" role="status">${msg}</p>`}
      ${app.state.workouts.length === 0 && html`<button class="btn ghost" onClick=${() => { app.replaceAll(makeExampleData(app.state.profile)); onClose() }}>Load example data to explore</button>`}
      ${app.state.profile.example && html`<${ConfirmButton} class="btn ghost" confirmText="Tap again to clear everything" onConfirm=${() => app.replaceAll({ profile: { ...app.state.profile, example: false, weighins: [], goals: [] }, workouts: [], food: {} })}>Clear example data</${ConfirmButton}>`}
    </div>
  </${Sheet}>`
}

export function HomeView({ app }) {
  const { workouts, profile, food, active } = app.state
  const [tiers, setTiers] = useState(false)
  const total = workouts.reduce((s, w) => s + workoutVolume(w), 0)
  const cmp = liftedComparison(total)
  const tgt = dailyTargets(profile)
  const tot = sumEntries(food[today()])
  const unit = energyUnitOf(profile.settings)
  const goals = profile.goals.filter(g => !g.achieved)
  const last = [...workouts].sort((a, b) => b.date.localeCompare(a.date))[0]
  return html`<div class="stack">
    <${PowerCard} level=${app.power.level} tier=${app.power.tier} onTap=${() => setTiers(true)} />
    ${isStandalone() && !profile.example && workouts.length >= 3 && daysSince(profile.lastBackup) >= 14 && html`<div class="callout"><span class="small">${profile.lastBackup ? `No backup for ${daysSince(profile.lastBackup)} days.` : 'You haven’t backed up yet.'} Your data lives only on this phone.</span>
      <button class="btn small" onClick=${() => { downloadFile(`power-level-backup-${today()}.json`, makeBackup(app.state)); app.update(st => ({ ...st, profile: { ...st.profile, lastBackup: today() } }), ['profile']) }}>Download backup</button></div>`}
    ${profile.example && html`<p class="callout small">You're looking at example data. Clear it in Settings when you're ready to start.</p>`}
    ${!profile.example && workouts.length === 0 && html`<div class="callout"><b>New here?</b><span class="small">Start a workout below, or look around with eight weeks of example training first. You can clear it any time.</span>
      <button class="btn small" onClick=${() => app.replaceAll(makeExampleData(profile))}>Load example data</button></div>`}
    <button class="btn primary wide big" onClick=${() => app.go('train')}>${active ? 'Resume workout' : 'Start workout'}</button>
    ${last && html`<p class="muted small center">Last session: ${last.name}, ${fmtDate(last.date)} · ${formatKg(workoutVolume(last))}</p>`}
    ${goals.length > 0 && html`<section class="panel"><div class="panel-head"><h2 class="h2">Goals</h2><button class="link" onClick=${() => app.go('goals')}>All goals</button></div>
      ${goals.map(g => { const j = journeyFor(g, workouts, profile, today()); const pct = percentThere(g.start, j.current, g.target); return html`<div class="goal-mini">
        <div><b>${exInfo(g.exId).name} → ${g.target} kg</b><span class="muted small">${fmt(j.current)} kg now · ${j.reachable ? 'ETA ' + fmtDate(j.etaDate) : 'long road'}</span></div>
        <div class="meter" role="progressbar" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100" aria-label=${exInfo(g.exId).name + ' goal progress'}><span style=${{ width: pct + '%' }}></span></div></div>` })}
    </section>`}
    <${WeighIn} app=${app} />
    <section class="panel" onClick=${() => app.go('food')}>
      <div class="panel-head"><h2 class="h2">Food today</h2><span class="muted small">${tgt ? `${fmtEnergy(Math.max(0, tgt.kcal - tot.kcal), unit)} left` : 'Set targets in Settings'}</span></div>
      <div class="macro-bars">${[[unit === 'kj' ? 'Energy' : 'Calories', toUnit(tot.kcal, unit), tgt && toUnit(tgt.kcal, unit), 'kcal'], ['Protein', tot.p, tgt?.protein, 'p'], ['Carbs', tot.c, tgt?.carbs, 'c'], ['Fat', tot.f, tgt?.fat, 'f']].map(([l, v, t, k]) => html`
        <div class="mb"><span>${l}</span><div class=${'meter m-' + k}><span style=${{ width: (t ? Math.min(100, (v / t) * 100) : 0) + '%' }}></span></div><span class="tnum">${Math.round(v)}${t ? ' / ' + t : ''}</span></div>`)}</div>
    </section>
    ${total > 0 && html`<section class="panel lifted" onClick=${() => app.go('progress')}><p class="eyebrow">All-time lifted</p><p class="h2">${formatKg(total)}${cmp.best ? html` · ${cmp.times >= 10 ? Math.round(cmp.times) : cmp.times.toFixed(1)} × ${cmp.best.name.replace(/^an? /, '')}` : ''}</p>
      ${cmp.next && html`<p class="muted small">Next up: ${cmp.next.name}</p>`}</section>`}
    <${TierSheet} open=${tiers} onClose=${() => setTiers(false)} level=${app.power.level} />
  </div>`
}
