// Food: daily calories and macros against targets worked out from your profile and goal.
import { html, useState, useEffect, useMemo, Sheet, Field, Chips, fmt, fmtDateLong } from './core.js'
import { Ring } from './charts.js'
import { Scanner, cameraAvailable } from './scanner.js'
import { targets, macrosFor, sumEntries, energyUnitOf, toUnit, fromUnit, fmtEnergy, ENERGY_UNITS } from '../nutrition.js'
import { loadFoods, rankFoods, ESTIMATES, SOURCES, sourceOf } from '../foods.js'
import { lookupBarcode, searchProducts, cleanBarcode, validBarcode, perServing } from '../off.js'
import { latestBodyweight } from '../plan.js'
import { uid, today } from '../store.js'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const shiftDate = (iso, d) => { const t = new Date(iso + 'T00:00:00'); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10) }

export function dailyTargets(profile) {
  const s = profile.settings
  return targets({ ...s, weight: latestBodyweight(profile) || s.weight })
}

const UNIT_OPTS = Object.entries(ENERGY_UNITS).map(([value, label]) => ({ value, label }))
const OFF_DEBOUNCE_MS = 900
const NUM_KEYS = [['kcal', null], ['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g']]

// Where a food's numbers came from, shown on every result.
function SourceTag({ food }) {
  const src = sourceOf(food)
  const label = src === 'custom' && food.origin === 'off' ? 'Saved · Open Food Facts' : SOURCES[src].label
  return html`<em class=${'src-tag src-' + src} title=${SOURCES[src].title}>${label}</em>`
}

function FoodList({ foods, unit, onPick }) {
  return html`<ul class="pick-list">${foods.map(f => html`<li><button onClick=${() => onPick(f)}>
    <span class="pick-top"><b>${f.name}</b><${SourceTag} food=${f} /></span>
    <span>${fmtEnergy(f.kcal, unit)} · ${fmt(f.p)}P ${fmt(f.c)}C ${fmt(f.f)}F per 100 g</span></button></li>`)}</ul>`
}

// Search tab: the AFCD, your saved foods and the quick-pick estimates, all offline.
function SearchFoods({ open, custom, unit, onPick }) {
  const [q, setQ] = useState('')
  const [afcd, setAfcd] = useState({ list: [], err: false })
  useEffect(() => { if (open) loadFoods().then(list => setAfcd({ list, err: false }), () => setAfcd({ list: [], err: true })) }, [open])
  const results = useMemo(() => rankFoods(q, [custom, afcd.list, ESTIMATES]), [q, custom, afcd.list])
  return html`<input id="food-search" class="input" type="search" placeholder="Search foods, e.g. chicken breast" value=${q} onInput=${e => setQ(e.target.value)} />
    ${afcd.err && html`<p class="warn small">Couldn’t load the food database. Your saved foods and quick picks still work.</p>`}
    ${q.trim() ? (results.length ? html`<${FoodList} foods=${results} unit=${unit} onPick=${onPick} />` : html`<p class="muted small">No matches. Try fewer words, or check Packaged for branded foods.</p>`)
      : html`${custom.length > 0 && html`<p class="h3">Your saved foods</p><${FoodList} foods=${custom.slice(0, 8)} unit=${unit} onPick=${onPick} />`}
        <p class="h3">Quick picks</p>
        <p class="muted small">Rough estimates typed into the app, not from a cited table. Search to get values from the Australian Food Composition Database.</p>
        <${FoodList} foods=${ESTIMATES} unit=${unit} onPick=${onPick} />`}`
}

// Packaged tab: Open Food Facts by camera, typed barcode or name. Needs a connection.
function PackagedFoods({ unit, onPick }) {
  const [scan, setScan] = useState(false)
  const [code, setCode] = useState('')
  const [q, setQ] = useState('')
  const [state, setState] = useState({ busy: false, msg: '', list: [] })
  const lookup = async bc => {
    setScan(false); setCode(cleanBarcode(bc)); setState({ busy: true, msg: '', list: [] })
    try {
      const food = await lookupBarcode(bc)
      if (food) { setState({ busy: false, msg: '', list: [] }); onPick(food) }
      else setState({ busy: false, msg: 'That barcode isn’t in Open Food Facts yet. Use Quick add with the label’s numbers.', list: [] })
    } catch (err) { setState({ busy: false, msg: err.message, list: [] }) }
  }
  useEffect(() => {
    const term = q.trim()
    if (term.length < 3) return
    const t = setTimeout(async () => {
      setState({ busy: true, msg: '', list: [] })
      try {
        const list = await searchProducts(term)
        setState({ busy: false, msg: list.length ? '' : 'No products with full nutrition info found. Try the barcode instead.', list })
      } catch (err) { setState({ busy: false, msg: err.kind === 'offline' ? err.message : 'Open Food Facts search isn’t answering right now. Scanning or typing the barcode usually still works.', list: [] }) }
    }, OFF_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q])
  return html`<div class="stack">
    ${scan ? html`<${Scanner} onCode=${lookup} /><button class="btn ghost" onClick=${() => setScan(false)}>Stop scanning</button>`
      : cameraAvailable() && html`<button class="btn primary" onClick=${() => setScan(true)}>Scan a barcode</button>`}
    <form class="inline-form" onSubmit=${e => { e.preventDefault(); lookup(code) }}>
      <input id="off-barcode" class="input" inputmode="numeric" autocomplete="off" placeholder="Or type the barcode" value=${code} onInput=${e => setCode(e.target.value)} />
      <button class="btn" disabled=${!validBarcode(code) || state.busy}>Look up</button>
    </form>
    <input id="off-search" class="input" type="search" placeholder="Search products by name" value=${q} onInput=${e => setQ(e.target.value)} />
    ${state.busy && html`<p class="muted small" role="status">Asking Open Food Facts…</p>`}
    ${state.msg && html`<p class="warn small" role="status">${state.msg}</p>`}
    ${state.list.length > 0 && html`<${FoodList} foods=${state.list} unit=${unit} onPick=${onPick} />`}
    <p class="muted small">Product data from Open Food Facts, a crowd-sourced database. Check it against the label: you can edit the numbers before adding.</p>
  </div>`
}

// A picked food: choose the amount; Open Food Facts numbers can be corrected first.
function PickedFood({ food, unit, onBack, onAdd, onSaveCustom }) {
  const editable = sourceOf(food) === 'off'
  const [vals, setVals] = useState(() => ({ kcal: toUnit(food.kcal, unit), p: food.p, c: food.c, f: food.f }))
  const [grams, setGrams] = useState(food.serving?.g || 100)
  const [save, setSave] = useState(editable)
  const cur = editable ? { ...food, kcal: fromUnit(vals.kcal, unit), p: +vals.p || 0, c: +vals.c || 0, f: +vals.f || 0 } : food
  const m = macrosFor(cur, grams)
  const serve = perServing(cur)
  const add = () => {
    if (editable && save) onSaveCustom({ id: 'c' + uid(), src: 'custom', origin: 'off', ref: food.ref, name: cur.name, kcal: cur.kcal, p: cur.p, c: cur.c, f: cur.f, ...(food.serving ? { serving: food.serving } : {}) })
    onAdd({ name: cur.name, grams: +grams, src: sourceOf(food), ...(food.ref ? { ref: food.ref } : {}), ...m })
  }
  return html`<div class="stack">
    <div class="pick-top"><p class="h2">${food.name}</p><${SourceTag} food=${food} /></div>
    ${(food.pack || food.ref) && sourceOf(food) !== 'afcd' && html`<p class="muted small">${[food.pack && 'Pack: ' + food.pack, food.ref && 'Barcode ' + food.ref].filter(Boolean).join(' · ')}</p>`}
    ${editable ? html`<p class="small">Per 100 g${food.complete === false ? html` · <span class="warn">some values are missing, check the label</span>` : ''}</p>
      <div class="row-4">${NUM_KEYS.map(([k, l]) => html`<${Field} label=${l || ENERGY_UNITS[unit]}><input id=${'off-' + k} class="input" inputmode="decimal" value=${vals[k]} onInput=${e => setVals({ ...vals, [k]: e.target.value })} /></${Field}>`)}</div>`
      : html`<p class="muted small">Per 100 g: ${fmtEnergy(food.kcal, unit)} · ${fmt(food.p)}P ${fmt(food.c)}C ${fmt(food.f)}F</p>`}
    ${serve && html`<p class="muted small">Per ${food.serving.unit} (${food.serving.g} g): ${fmtEnergy(serve.kcal, unit)} · ${fmt(serve.p)}P ${fmt(serve.c)}C ${fmt(serve.f)}F</p>`}
    ${food.serving && html`<div class="chips chips-sm">${[0.5, 1, 2].map(n => html`<button class="chip" onClick=${() => setGrams(Math.round(food.serving.g * n))}>${n} ${food.serving.unit.split(' (')[0]}</button>`)}</div>`}
    <${Field} label="Amount (grams)"><input id="food-grams" class="input" inputmode="decimal" value=${grams} onInput=${e => setGrams(e.target.value)} /></${Field}>
    <p class="macro-line"><b>${fmtEnergy(m.kcal, unit)}</b> · ${fmt(m.p)} g protein · ${fmt(m.c)} g carbs · ${fmt(m.f)} g fat</p>
    ${editable && html`<label class="toggle"><input id="off-save" type="checkbox" checked=${save} onChange=${e => setSave(e.target.checked)} /> Save to my foods so it works offline next time</label>`}
    <div class="row-btns"><button class="btn ghost" onClick=${onBack}>Back</button><button class="btn primary grow" onClick=${add}>Add</button></div>
  </div>`
}

function AddFood({ open, meal, onClose, onAdd, custom, onSaveCustom, sample, unit }) {
  const [mode, setMode] = useState('search')
  const [pick, setPick] = useState(null)
  const [quick, setQuick] = useState({ name: '', kcal: '', p: '', c: '', f: '' })
  const [ai, setAi] = useState({ text: '', busy: false, err: '' })
  // Labels in Australia often list kJ, so quick add can take either, whatever the display unit.
  const [qUnit, setQUnit] = useState(unit)
  useEffect(() => { if (open) setQUnit(unit) }, [open, unit])
  const reset = () => { setQUnit(unit); setPick(null); setMode('search'); setQuick({ name: '', kcal: '', p: '', c: '', f: '' }); setAi({ text: '', busy: false, err: '' }) }
  const close = () => { reset(); onClose() }
  const addEntry = e => { onAdd({ id: uid(), meal, ...e }); close() }
  const addQuick = save => {
    const e = { name: quick.name || 'Quick add', kcal: fromUnit(quick.kcal, qUnit), p: +quick.p || 0, c: +quick.c || 0, f: +quick.f || 0 }
    if (save && quick.name) onSaveCustom({ id: 'c' + uid(), src: 'custom', name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f, serving: { unit: 'serve', g: 100 } })
    addEntry({ ...e, src: 'custom' })
  }
  const estimate = async () => {
    if (!sample || !ai.text.trim()) return
    setAi({ ...ai, busy: true, err: '' })
    try {
      const out = await sample.json(`Estimate the nutrition of this meal as eaten in Australia. Reply with JSON only: {"name": short name, "kcal": number, "p": grams protein, "c": grams carbs, "f": grams fat}. Meal: ${ai.text.slice(0, 400)}`, { modelTier: 'quick' })
      if (!out || typeof out.kcal !== 'number') throw new Error('bad')
      setQuick({ name: String(out.name || ai.text).slice(0, 60), kcal: toUnit(out.kcal, qUnit), p: Math.round(out.p || 0), c: Math.round(out.c || 0), f: Math.round(out.f || 0) })
      setMode('quick'); setAi({ text: '', busy: false, err: '' })
    } catch (err) {
      setAi({ ...ai, busy: false, err: err?.code === 'not_granted' ? 'AI estimates are switched off for this page.' : 'Couldn’t estimate that one. Try describing portions, or enter it by hand.' })
    }
  }
  return html`<${Sheet} open=${open} title=${'Add to ' + meal} onClose=${close}>
    ${pick && html`<${PickedFood} key=${pick.id} food=${pick} unit=${unit} onBack=${() => setPick(null)} onAdd=${addEntry} onSaveCustom=${onSaveCustom} />`}
    <div class="stack" hidden=${!!pick}>
    <${Chips} small label="How to add" value=${mode} onChange=${setMode} options=${[{ value: 'search', label: 'Search' }, { value: 'packaged', label: 'Packaged' }, { value: 'quick', label: 'Quick add' }, ...(sample ? [{ value: 'ai', label: 'Describe it' }] : [])]} />
    ${mode === 'search' && html`<${SearchFoods} open=${open} custom=${custom} unit=${unit} onPick=${setPick} />`}
    ${mode === 'packaged' && html`<${PackagedFoods} unit=${unit} onPick=${setPick} />`}
    ${mode === 'quick' && html`<form class="stack" onSubmit=${e => { e.preventDefault(); addQuick(false) }}>
      <${Field} label="Name"><input id="q-name" class="input" value=${quick.name} onInput=${e => setQuick({ ...quick, name: e.target.value })} placeholder="e.g. Mum's lasagne" /></${Field}>
      <${Field} label="Energy unit"><${Chips} small label="Energy unit" value=${qUnit} onChange=${u => { setQuick(q => ({ ...q, kcal: q.kcal === '' ? '' : toUnit(fromUnit(q.kcal, qUnit), u) })); setQUnit(u) }} options=${UNIT_OPTS} /></${Field}>
      <div class="row-4">${NUM_KEYS.map(([k, l]) => html`<${Field} label=${l || ENERGY_UNITS[qUnit]}><input id=${'q-' + k} class="input" inputmode="decimal" value=${quick[k]} onInput=${e => setQuick({ ...quick, [k]: e.target.value })} /></${Field}>`)}</div>
      <div class="row-btns"><button class="btn primary grow">Add</button><button type="button" class="btn" onClick=${() => addQuick(true)} disabled=${!quick.name}>Add & save food</button></div>
    </form>`}
    ${mode === 'ai' && html`<div class="stack">
      <p class="muted">Describe what you ate and Claude estimates the macros. You can check and edit before adding.</p>
      <textarea id="ai-text" class="input" rows="3" placeholder="e.g. large chicken burrito bowl with guac, no sour cream" value=${ai.text} onInput=${e => setAi({ ...ai, text: e.target.value })}></textarea>
      <button class="btn primary" disabled=${ai.busy || !ai.text.trim()} onClick=${estimate}>${ai.busy ? 'Estimating…' : 'Estimate'}</button>
      ${ai.err && html`<p class="warn small">${ai.err}</p>`}
    </div>`}
    </div>
  </${Sheet}>`
}

export function FoodView({ app }) {
  const { profile, food } = app.state
  const [date, setDate] = useState(today())
  const [meal, setMeal] = useState(null)
  const entries = food[date] || []
  const tot = sumEntries(entries)
  const tgt = dailyTargets(profile)
  const unit = energyUnitOf(profile.settings)
  const setUnit = u => app.update(s => ({ ...s, profile: { ...s.profile, settings: { ...s.profile.settings, energy: u } } }), ['profile'])
  const setDay = list => app.update(s => ({ ...s, food: { ...s.food, [date]: list } }), ['f:' + date])
  const yesterday = food[shiftDate(date, -1)] || []
  const week = Array.from({ length: 7 }, (_, i) => sumEntries(food[shiftDate(date, -i)]).kcal).filter(k => k > 0)
  return html`<div class="stack">
    <div class="food-top">
    <div class="date-nav">
      <button class="icon-btn" aria-label="Previous day" onClick=${() => setDate(shiftDate(date, -1))}>‹</button>
      <b>${date === today() ? 'Today' : fmtDateLong(date)}</b>
      <button class="icon-btn" aria-label="Next day" disabled=${date >= today()} onClick=${() => setDate(shiftDate(date, 1))}>›</button>
    </div>
    <${Chips} small label="Show energy in" value=${unit} onChange=${setUnit} options=${UNIT_OPTS} />
    </div>
    <section class="panel rings">
      <${Ring} className="r-kcal" value=${toUnit(tot.kcal, unit)} target=${tgt && toUnit(tgt.kcal, unit)} label=${unit === 'kj' ? 'Energy (kJ)' : 'Calories'} unit="" />
      <${Ring} className="r-p" value=${tot.p} target=${tgt?.protein} label="Protein" unit="g" />
      <${Ring} className="r-c" value=${tot.c} target=${tgt?.carbs} label="Carbs" unit="g" />
      <${Ring} className="r-f" value=${tot.f} target=${tgt?.fat} label="Fat" unit="g" />
    </section>
    ${tgt ? html`<p class="muted small center">${tgt.kcal - tot.kcal >= 0 ? `${fmtEnergy(tgt.kcal - tot.kcal, unit)} left` : `${fmtEnergy(tot.kcal - tgt.kcal, unit)} over`} · maintenance ≈ ${fmtEnergy(tgt.tdee, unit)}${week.length > 1 ? ` · 7-day average ${fmtEnergy(week.reduce((a, b) => a + b, 0) / week.length, unit)}` : ''}</p>`
      : html`<p class="warn small">Add your height and age in Settings to get calorie and macro targets.</p>`}
    ${entries.length === 0 && yesterday.length > 0 && html`<button class="btn" onClick=${() => setDay(yesterday.map(e => ({ ...e, id: uid() })))}>Copy yesterday's food</button>`}
    ${MEALS.map(m => {
      const list = entries.filter(e => e.meal === m)
      const st = sumEntries(list)
      return html`<section class="panel meal">
        <div class="panel-head"><h2 class="h2">${m}</h2><span class="muted small">${fmtEnergy(st.kcal, unit)}</span></div>
        ${list.map(e => html`<div class="food-row"><div><b>${e.name}</b><span class="muted small">${e.grams ? e.grams + ' g · ' : ''}${fmt(e.p)}P ${fmt(e.c)}C ${fmt(e.f)}F</span></div>
          <span class="tnum">${toUnit(e.kcal, unit).toLocaleString()}</span><button class="icon-btn" aria-label=${'Remove ' + e.name} onClick=${() => setDay(entries.filter(x => x.id !== e.id))}>✕</button></div>`)}
        <button class="btn small ghost" onClick=${() => setMeal(m)}>+ Add food</button>
      </section>`
    })}
    <${AddFood} open=${!!meal} meal=${meal} onClose=${() => setMeal(null)} custom=${profile.customFoods || []} sample=${app.sample} unit=${unit}
      onAdd=${e => setDay([...(app.state.food[date] || []), e])}
      onSaveCustom=${f => app.update(s => ({ ...s, profile: { ...s.profile, customFoods: [f, ...(s.profile.customFoods || [])] } }), ['profile'])} />
  </div>`
}
