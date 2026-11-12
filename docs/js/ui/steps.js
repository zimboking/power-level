// Steps on Home: today's count against a goal, the last seven days, and a sheet to type or
// paste the number from the phone's health app.
import { html, useState, useEffect, Sheet, Icon, fmtDateLong } from './core.js'
import { stepGoalOf, stepsOf, setSteps, stepsWeek, stepsAverage, stepStreak, parseSteps, STEP_GOAL_MIN, STEP_GOAL_MAX } from '../steps.js'
import { addDays } from '../schedule.js'
import { today } from '../store.js'

const num = n => Math.round(n).toLocaleString('en-AU')
const dayShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'narrow' })
const canPaste = () => typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

/** Save a day's steps (profile.steps). Shared by the sheet and the #steps= link. */
export const saveSteps = (app, date, n) => app.update(s => ({ ...s, profile: { ...s.profile, steps: setSteps(s.profile.steps, date, n) } }), ['profile'])

function StepsSheet({ open, onClose, app }) {
  const { profile } = app.state
  const goal = stepGoalOf(profile.settings)
  const [date, setDate] = useState(today())
  const [val, setVal] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { if (open) { setDate(today()); setMsg('') } }, [open])
  useEffect(() => { setVal(stepsOf(profile.steps, date) ? String(stepsOf(profile.steps, date)) : '') }, [date, open])
  const typed = parseSteps(val)
  const save = e => {
    e?.preventDefault()
    if (val.trim() && typed == null) { setMsg('That doesn’t look like a step count.'); return }
    saveSteps(app, date, typed || 0)
    app.toast(typed ? `${num(typed)} steps saved${date === today() ? '' : ' for ' + fmtDateLong(date)}` : 'Steps cleared')
    onClose()
  }
  const paste = async () => {
    try {
      const n = parseSteps(await navigator.clipboard.readText())
      if (n == null) setMsg('No number found on the clipboard. Copy your step count first.')
      else { setVal(String(n)); setMsg('') }
    } catch { setMsg('Couldn’t read the clipboard. Type the number instead.') }
  }
  const setGoal = g => app.setSetting({ stepGoal: Math.max(STEP_GOAL_MIN, Math.min(STEP_GOAL_MAX, g)) })
  return html`<${Sheet} open=${open} title="Steps" onClose=${onClose}>
    <form class="stack" onSubmit=${save}>
      <div class="date-nav">
        <button type="button" class="icon-btn" aria-label="Previous day" onClick=${() => setDate(addDays(date, -1))}>‹</button>
        <b>${date === today() ? 'Today' : fmtDateLong(date)}</b>
        <button type="button" class="icon-btn" aria-label="Next day" disabled=${date >= today()} onClick=${() => setDate(addDays(date, 1))}>›</button>
      </div>
      <div class="inline-form big"><input id="steps-n" class="input" inputmode="numeric" autocomplete="off" aria-label="Steps for the day" placeholder="0" value=${val}
        onInput=${e => { setVal(e.target.value); setMsg('') }} /><span>steps</span></div>
      <div class="chips chips-sm">${[500, 1000, 2000].map(n => html`<button type="button" class="chip" onClick=${() => setVal(String((typed || 0) + n))}>+${num(n)}</button>`)}
        ${canPaste() && html`<button type="button" class="chip" onClick=${paste}>Paste</button>`}</div>
      ${msg && html`<p class="warn small" role="alert">${msg}</p>`}
      <button class="btn primary big">Save</button>
      <div class="cs-goal-row"><span class="row-main"><span>Daily goal</span><small>Steps of 500</small></span>
        <div class="cs-ratio"><button type="button" class="circle-btn" aria-label="Lower step goal" disabled=${goal <= STEP_GOAL_MIN} onClick=${() => setGoal(goal - 500)}>−</button>
          <b class="tnum">${num(goal)}</b><button type="button" class="circle-btn" aria-label="Raise step goal" disabled=${goal >= STEP_GOAL_MAX} onClick=${() => setGoal(goal + 500)}>+</button></div></div>
      <details class="steps-help"><summary class="muted small">Where do the numbers come from?</summary>
        <p class="muted small">Power Level is a web app, and phones don’t let web apps read Apple Health, Health Connect or Garmin. So it shows the day’s total you give it: look it up in Health, Garmin Connect or on your watch and type it in, or copy it and tap Paste.</p>
        <p class="muted small">On iPhone you can make it one tap: in the Shortcuts app, build a shortcut that gets today’s Steps from Health and copies the total to the clipboard, then tap Paste here. Garmin steps show up in Health once Garmin Connect is allowed to write to it.</p>
      </details>
    </form>
  </${Sheet}>`
}

/** The Steps card on Home. */
export function StepsHomeCard({ app }) {
  const { profile } = app.state
  const [open, setOpen] = useState(false)
  const goal = stepGoalOf(profile.settings), date = today()
  const now = stepsOf(profile.steps, date)
  const week = stepsWeek(profile.steps, date)
  const avg = stepsAverage(week), streak = stepStreak(profile.steps, goal, date)
  const top = Math.max(goal, ...week.map(d => d.steps))
  const pct = Math.min(100, (now / goal) * 100)
  return html`<section class="card steps-card">
    <div class="card-head"><p class="card-title">Steps</p><button class="text-btn" onClick=${() => setOpen(true)}><${Icon} name="plus" size=${16} /> ${now ? 'Update' : 'Log'}</button></div>
    <div class="steps-row">
      <div class="row-main"><span class="steps-total"><b class="tnum">${num(now)}</b> <small>/ ${num(goal)}</small></span>
        <div class="meter" role="progressbar" aria-valuenow=${Math.round(pct)} aria-valuemin="0" aria-valuemax="100" aria-label="Steps towards today's goal"><span class=${now >= goal ? 'done' : ''} style=${{ width: pct + '%' }}></span></div>
        <small>${now >= goal ? 'Goal reached' : now ? `${num(goal - now)} to go` : 'Nothing logged today'}${streak > 1 ? ` · ${streak} day streak` : ''}${avg ? ` · 7-day average ${num(avg)}` : ''}</small></div>
      <div class="steps-week" role="img" aria-label=${'Steps over the last 7 days: ' + week.map(d => num(d.steps)).join(', ')}>${week.map(d => html`<span class=${'steps-day' + (d.today ? ' today' : '') + (d.steps >= goal ? ' hit' : '')}>
        <i style=${{ height: Math.max(d.steps ? 6 : 2, (d.steps / top) * 100) + '%' }}></i><small>${dayShort(d.date)}</small></span>`)}</div>
    </div>
    <${StepsSheet} open=${open} onClose=${() => setOpen(false)} app=${app} />
  </section>`
}
