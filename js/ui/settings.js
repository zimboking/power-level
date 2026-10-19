// Settings: you, training, equipment, your data.
import { html, useState, Sheet, Field, Segmented, Toggle, WheelPicker, ConfirmButton, fmtDate, fmtClock } from './core.js'
import { ACTIVITY, GOALS, ENERGY_UNITS, energyUnitOf } from '../nutrition.js'
import { BAR_TYPES, DEFAULT_BARS } from '../exercises.js'
import { emptyPlan } from '../schedule.js'
import { today, isStandalone, makeBackup, parseBackup, downloadFile } from '../store.js'
import { makeExampleData } from '../examples.js'
import { capyOn } from '../water.js'
import { POLICIES } from '../progression.js'
import { DEFAULT_PROGS, defaultProgOf } from '../plan.js'
import { listPhotos, putPhotos, makePhotoBackup, parsePhotoBackup, newPhotos } from '../photos.js'

export function SettingsSheet({ open, onClose, app }) {
  const s = app.state.profile.settings
  const set = patch => app.setSetting(patch)
  const [json, setJson] = useState('')
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState(null)
  const [restWheel, setRestWheel] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const standalone = isStandalone()
  const plan = { ...emptyPlan(), ...(app.state.profile.plan || {}) }
  const stamp = () => app.update(st => ({ ...st, profile: { ...st.profile, lastBackup: today() } }), ['profile'])
  const exportData = async () => {
    const text = makeBackup(app.state)
    if (standalone) { downloadFile(`power-level-backup-${today()}.json`, text); stamp(); setMsg('Backup saved to your downloads. Keep a copy somewhere safe, like Google Drive or iCloud.'); return }
    try { await navigator.clipboard.writeText(text); stamp(); setMsg('Copied all your data to the clipboard.') } catch { setJson(text); setMsg('Select the text below and copy it.') }
  }
  const readBackup = text => { try { setPending(parseBackup(text)); setMsg('') } catch { setPending(null); setMsg('That doesn’t look like a Power Level backup.') } }
  const onFile = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 15e6) { setMsg('That file is too big to be a backup.'); return }
    f.text().then(readBackup, () => setMsg('Couldn’t read that file.'))
  }
  const exportPhotos = async () => {
    setPhotoBusy(true); setPhotoMsg('')
    try {
      const photos = await listPhotos()
      if (!photos.length) setPhotoMsg('No progress photos to back up yet.')
      else { downloadFile(`power-level-photos-${today()}.json`, await makePhotoBackup(photos)); setPhotoMsg(`Saved ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} to your downloads. Keep the file with your other backup.`) }
    } catch { setPhotoMsg('Couldn’t read your photos in this browser.') }
    setPhotoBusy(false)
  }
  const onPhotoFile = async e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 500e6) { setPhotoMsg('That file is too big to be a photo backup.'); return }
    setPhotoBusy(true); setPhotoMsg('')
    try {
      let incoming
      try { incoming = parsePhotoBackup(await f.text()) } catch { setPhotoMsg('That doesn’t look like a Power Level photo backup.'); setPhotoBusy(false); return }
      const add = newPhotos(await listPhotos(), incoming)
      if (add.length) await putPhotos(add)
      setPhotoMsg(add.length ? `Added ${add.length} ${add.length === 1 ? 'photo' : 'photos'}. Photos already here were left alone.` : 'All of those photos are already here.')
    } catch { setPhotoMsg('Couldn’t save the photos in this browser.') }
    setPhotoBusy(false)
  }
  const num = (k, label, hint, obj = s, apply = v => set({ [k]: v })) => html`<${Field} label=${label} hint=${hint}><input id=${'set-' + k} class="input" inputmode="decimal" value=${obj[k] ?? ''} onChange=${e => apply(parseFloat(e.target.value) || null)} /></${Field}>`
  const bars = { ...DEFAULT_BARS, ...(s.bar ? { barbell: s.bar } : {}), ...(s.bars || {}) }
  return html`<${Sheet} open=${open} title="Settings" onClose=${onClose} tall>
    <p class="section-label">You</p>
    <div class="card-flat stack">
      <${Segmented} small label="Body" value=${s.sex} onChange=${v => set({ sex: v })} options=${[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
      <div class="row-2">${num('age', 'Age')}${num('height', 'Height (cm)')}</div>
      ${num('goalWeight', 'Goal body weight (kg)', 'Shown as a line on your weight chart.')}
      <${Field} label="Activity"><select id="set-activity" class="input" value=${s.activity} onChange=${e => set({ activity: e.target.value })}>${Object.entries(ACTIVITY).map(([v, a]) => html`<option value=${v}>${a.label}</option>`)}</select></${Field}>
      <${Field} label="Nutrition goal"><select id="set-goal" class="input" value=${s.goal} onChange=${e => set({ goal: e.target.value })}>${Object.entries(GOALS).map(([v, g]) => html`<option value=${v}>${g.label}</option>`)}</select></${Field}>
      <${Field} label="Energy unit"><${Segmented} small label="Energy unit" value=${energyUnitOf(s)} onChange=${v => set({ energy: v })} options=${Object.entries(ENERGY_UNITS).map(([value, label]) => ({ value, label }))} /></${Field}>
    </div>
    <p class="section-label">Training</p>
    <div class="group">
      <div class="toggle-row"><span class="row-main"><span>Workout screen</span><small>Guided shows one exercise at a time with its demo.</small></span><${Segmented} small label="Workout screen" value=${s.view === 'list' ? 'list' : 'focus'} onChange=${v => set({ view: v })} options=${[{ value: 'focus', label: 'Guided' }, { value: 'list', label: 'List' }]} /></div>
      <label class="toggle-row" for="set-prog"><span class="row-main"><span>Default progression</span><small>For exercises without their own rule. ${POLICIES[defaultProgOf(s)].desc}</small></span>
        <select id="set-prog" class="input select" value=${defaultProgOf(s)} onChange=${e => set({ defaultProg: e.target.value })}>${DEFAULT_PROGS.map(k => html`<option value=${k}>${POLICIES[k].name}</option>`)}</select></label>
      <${Toggle} id="set-effort" checked=${s.showEffort !== false} onChange=${v => set({ showEffort: v })} label="Effort column" hint="Log how hard each set felt. Powers the smart adjustments." />
      ${s.showEffort !== false && html`<div class="toggle-row"><span class="row-main"><span>Effort scale</span><small>RIR = reps left in the tank. RPE = 10 − RIR.</small></span><${Segmented} small label="Effort scale" value=${s.effort === 'rpe' ? 'rpe' : 'rir'} onChange=${v => set({ effort: v })} options=${[{ value: 'rir', label: 'RIR' }, { value: 'rpe', label: 'RPE' }]} /></div>`}
      <button class="toggle-row" onClick=${() => setRestWheel(true)}><span class="row-main"><span>Default rest</span><small>Each exercise and set can have its own.</small></span><b>${fmtClock(s.rest || 150)}</b></button>
      <${Toggle} id="set-flash" checked=${!!s.restFlash} onChange=${v => set({ restFlash: v })} label="Flash the screen when rest ends" hint="For loud gyms where you won't hear the beep." />
      <${Toggle} id="set-beep" checked=${s.restSound !== false} onChange=${v => set({ restSound: v })} label="Beep when rest ends" />
      <div class="toggle-row"><span class="row-main"><span>Week starts on</span></span><${Segmented} small label="Week starts on" value=${plan.weekStart} onChange=${v => app.update(st => ({ ...st, profile: { ...st.profile, plan: { ...plan, weekStart: v } } }), ['profile'])} options=${[{ value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }]} /></div>
    </div>
    <p class="section-label">Extras</p>
    <div class="group">
      <${Toggle} id="set-capyspa" checked=${capyOn(s)} onChange=${v => set({ capyspa: v })} label="CapySpa water tracker" hint="Capy’s hot spring fills as you drink. Turning it off hides the tab and the Home card; your water log is kept." />
    </div>
    <p class="section-label">Equipment</p>
    <div class="card-flat stack">
      <div class="row-2">${Object.entries(BAR_TYPES).map(([k, l]) => num(k, l + ' (kg)', null, bars, v => set({ bars: { ...bars, [k]: v || DEFAULT_BARS[k] } })))}</div>
      <${Field} label="Plates you have (kg)" hint="Comma separated. The plate picture only uses these."><input id="set-plates" class="input" value=${(s.plates || []).join(', ')} onChange=${e => set({ plates: e.target.value.split(',').map(x => parseFloat(x)).filter(x => x > 0) })} /></${Field}>
    </div>
    <p class="section-label">Your data</p>
    <div class="card-flat stack">
      <p class="muted small">${app.mode === 'cloud' ? 'Saved to your account on this page. Only you can see it.' : 'Saved on this phone only, not online. Download a backup now and then so a lost phone or cleared browser doesn’t take your history with it.'}</p>
      ${app.state.profile.lastBackup && html`<p class="muted small">Last backup: ${fmtDate(app.state.profile.lastBackup)}</p>`}
      ${standalone ? html`<div class="row-btns"><button class="btn primary" onClick=${exportData}>Download backup</button><label class="btn file-btn">Restore from file<input id="set-restore" type="file" accept="application/json,.json" onChange=${onFile} /></label></div>`
        : html`<div class="row-btns"><button class="btn" onClick=${exportData}>Copy export</button><button class="btn" disabled=${!json.trim()} onClick=${() => readBackup(json)}>Import pasted data</button></div>
        <textarea id="set-json" class="input" rows="3" placeholder="Paste an export here to import" value=${json} onInput=${e => setJson(e.target.value)}></textarea>`}
      ${standalone && html`<p class="muted small">Progress photos are big, so they get their own file. Restoring adds the ones missing here and never deletes any.</p>
        <div class="row-btns"><button class="btn" disabled=${photoBusy} onClick=${exportPhotos}>${photoBusy ? 'Working…' : 'Download photos'}</button><label class="btn file-btn">Restore photos<input id="set-restore-photos" type="file" accept="application/json,.json" disabled=${photoBusy} onChange=${onPhotoFile} /></label></div>
        ${photoMsg && html`<p class="small" role="status">${photoMsg}</p>`}`}
      ${pending && html`<div class="callout"><p>This backup has <b>${pending.workouts.length} workouts</b>. Restoring replaces everything currently on this device.</p>
        <div class="row-btns"><${ConfirmButton} class="btn primary" confirmText="Tap again to replace" onConfirm=${() => { app.replaceAll(pending); setPending(null); setJson(''); setMsg('Restored from backup.') }}>Restore it</${ConfirmButton}><button class="btn ghost" onClick=${() => setPending(null)}>Cancel</button></div></div>`}
      ${msg && html`<p class="small" role="status">${msg}</p>`}
      ${app.state.workouts.length === 0 && html`<button class="btn ghost" onClick=${() => { app.replaceAll(makeExampleData(app.state.profile)); onClose() }}>Load example data to explore</button>`}
      ${app.state.profile.example && html`<${ConfirmButton} class="btn ghost" confirmText="Tap again to clear everything" onConfirm=${() => app.replaceAll({ profile: { ...app.state.profile, example: false, weighins: [], goals: [], templates: [], plan: emptyPlan() }, workouts: [], food: {} })}>Clear example data</${ConfirmButton}>`}
    </div>
    <p class="muted small center">Exercise photos: free-exercise-db (public domain). Body diagram: MuscleMap (MIT).</p>
    <p class="muted small center">Food data: Australian Food Composition Database, Release 3, by Food Standards Australia New Zealand (CC BY 4.0); FSANZ does not endorse this app. Packaged products: Open Food Facts contributors (ODbL). Quick picks are rough estimates, not from a cited table.</p>
    <p class="muted small center">CapySpa: from Water-habit-app-2 by zimboking (Apache 2.0). Drink ratios follow the Beverage Hydration Index (Maughan et al., 2016).</p>
    <${Sheet} open=${restWheel} title="Default rest" onClose=${() => setRestWheel(false)}>
      <${WheelPicker} value=${s.rest || 150} onChange=${v => set({ rest: v })} />
      <button class="btn primary" onClick=${() => setRestWheel(false)}>Done</button>
    </${Sheet}>
  </${Sheet}>`
}
