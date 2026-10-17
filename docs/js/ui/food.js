// Food: daily calories and macros against targets worked out from your profile and goal.
import { html, useState, useEffect, Sheet, Field, Chips, fmt, fmtDateLong } from './core.js'
import { Ring } from './charts.js'
import { targets, macrosFor, sumEntries, searchFoods, energyUnitOf, toUnit, fromUnit, fmtEnergy, ENERGY_UNITS } from '../nutrition.js'
import { latestBodyweight } from '../plan.js'
import { uid, today } from '../store.js'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const shiftDate = (iso, d) => { const t = new Date(iso + 'T00:00:00'); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10) }

export function dailyTargets(profile) {
  const s = profile.settings
  return targets({ ...s, weight: latestBodyweight(profile) || s.weight })
}

const UNIT_OPTS = Object.entries(ENERGY_UNITS).map(([value, label]) => ({ value, label }))

function AddFood({ open, meal, onClose, onAdd, custom, onSaveCustom, sample, unit }) {
  const [mode, setMode] = useState('search')
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const [grams, setGrams] = useState(100)
  const [quick, setQuick] = useState({ name: '', kcal: '', p: '', c: '', f: '' })
  const [ai, setAi] = useState({ text: '', busy: false, err: '' })
  // Labels in Australia often list kJ, so quick add can take either, whatever the display unit.
  const [qUnit, setQUnit] = useState(unit)
  useEffect(() => { if (open) setQUnit(unit) }, [open, unit])
  const reset = () => { setQUnit(unit); setPick(null); setQ(''); setGrams(100); setQuick({ name: '', kcal: '', p: '', c: '', f: '' }); setAi({ text: '', busy: false, err: '' }) }
  const close = () => { reset(); onClose() }
  const addPicked = () => { onAdd({ id: uid(), meal, name: pick.name, grams: +grams, ...macrosFor(pick, grams) }); close() }
  const addQuick = save => {
    const e = { name: quick.name || 'Quick add', kcal: fromUnit(quick.kcal, qUnit), p: +quick.p || 0, c: +quick.c || 0, f: +quick.f || 0 }
    if (save && quick.name) onSaveCustom({ id: 'c' + uid(), name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f, serving: { unit: 'serve', g: 100 } })
    onAdd({ id: uid(), meal, ...e }); close()
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
  const results = searchFoods(q, custom)
  return html`<${Sheet} open=${open} title=${'Add to ' + meal} onClose=${close}>
    <${Chips} small label="How to add" value=${mode} onChange=${m => { setMode(m); setPick(null) }} options=${[{ value: 'search', label: 'Search' }, { value: 'quick', label: 'Quick add' }, ...(sample ? [{ value: 'ai', label: 'Describe it' }] : [])]} />
    ${mode === 'search' && !pick && html`<input id="food-search" class="input" placeholder="Search foods" value=${q} onInput=${e => setQ(e.target.value)} />
      <ul class="pick-list">${results.map(f => html`<li><button onClick=${() => { setPick(f); setGrams(f.serving?.g || 100) }}><b>${f.name}</b><span>${fmtEnergy(f.kcal, unit)} · ${f.p}P ${f.c}C ${f.f}F per 100 g</span></button></li>`)}</ul>`}
    ${mode === 'search' && pick && (() => {
      const m = macrosFor(pick, grams)
      return html`<div class="stack"><p class="h2">${pick.name}</p>
        ${pick.serving && html`<div class="chips chips-sm">${[0.5, 1, 2].map(n => html`<button class="chip" onClick=${() => setGrams(Math.round(pick.serving.g * n))}>${n} ${pick.serving.unit}</button>`)}</div>`}
        <${Field} label="Amount (grams)"><input id="food-grams" class="input" inputmode="decimal" value=${grams} onInput=${e => setGrams(e.target.value)} /></${Field}>
        <p class="macro-line"><b>${fmtEnergy(m.kcal, unit)}</b> · ${fmt(m.p)} g protein · ${fmt(m.c)} g carbs · ${fmt(m.f)} g fat</p>
        <div class="row-btns"><button class="btn ghost" onClick=${() => setPick(null)}>Back</button><button class="btn primary grow" onClick=${addPicked}>Add</button></div></div>`
    })()}
    ${mode === 'quick' && html`<form class="stack" onSubmit=${e => { e.preventDefault(); addQuick(false) }}>
      <${Field} label="Name"><input id="q-name" class="input" value=${quick.name} onInput=${e => setQuick({ ...quick, name: e.target.value })} placeholder="e.g. Mum's lasagne" /></${Field}>
      <${Field} label="Energy unit"><${Chips} small label="Energy unit" value=${qUnit} onChange=${u => { setQuick(q => ({ ...q, kcal: q.kcal === '' ? '' : toUnit(fromUnit(q.kcal, qUnit), u) })); setQUnit(u) }} options=${UNIT_OPTS} /></${Field}>
      <div class="row-4">${[['kcal', ENERGY_UNITS[qUnit]], ['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g']].map(([k, l]) => html`<${Field} label=${l}><input id=${'q-' + k} class="input" inputmode="decimal" value=${quick[k]} onInput=${e => setQuick({ ...quick, [k]: e.target.value })} /></${Field}>`)}</div>
      <div class="row-btns"><button class="btn primary grow">Add</button><button type="button" class="btn" onClick=${() => addQuick(true)} disabled=${!quick.name}>Add & save food</button></div>
    </form>`}
    ${mode === 'ai' && html`<div class="stack">
      <p class="muted">Describe what you ate and Claude estimates the macros. You can check and edit before adding.</p>
      <textarea id="ai-text" class="input" rows="3" placeholder="e.g. large chicken burrito bowl with guac, no sour cream" value=${ai.text} onInput=${e => setAi({ ...ai, text: e.target.value })}></textarea>
      <button class="btn primary" disabled=${ai.busy || !ai.text.trim()} onClick=${estimate}>${ai.busy ? 'Estimating…' : 'Estimate'}</button>
      ${ai.err && html`<p class="warn small">${ai.err}</p>`}
    </div>`}
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
