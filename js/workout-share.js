// A finished workout as a short message to send to mates. Pure, so it's easy to test.
import { workoutVolume, isWork, setDone } from './strength.js'
import { liftedComparison, formatKg } from './power.js'
import { exInfo } from './exercises.js'
import { fmtDuration, fmtDistance } from './duration.js'

const kg = w => (Number.isInteger(w) ? String(w) : String(Math.round(w * 10) / 10))

/** "100 kg × 8, 8 · 95 kg × 7": runs of the same weight share one label. */
export function setsLine(entry) {
  const sets = (entry.sets || []).filter(s => isWork(s) && setDone(s))
  const ex = exInfo(entry.exId)
  if (ex.mode === 'time' || sets.some(s => s.sec > 0)) return sets.map(s => [s.dist && fmtDistance(s.dist), fmtDuration(s.sec)].filter(Boolean).join(' in ')).join(', ')
  const runs = []
  for (const s of sets) {
    const w = s.w || 0
    const last = runs[runs.length - 1]
    if (last && last.w === w) last.reps.push(s.r)
    else runs.push({ w, reps: [s.r] })
  }
  return runs.map(r => `${r.w > 0 ? kg(r.w) + ' kg × ' : ''}${r.reps.join(', ')}${r.w > 0 ? '' : ' reps'}`).join(' · ')
}

/**
 * The message: title line, totals, one line per exercise (marking records), and the app link.
 * prNames: names of exercises that set a record this session.
 */
export function workoutText(w, { prNames = [], url = '' } = {}) {
  const date = new Date(w.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '')
  const vol = workoutVolume(w)
  const cmp = liftedComparison(vol)
  const sets = w.entries.reduce((n, e) => n + (e.sets || []).filter(s => isWork(s) && setDone(s)).length, 0)
  const totals = [`${w.entries.length} ${w.entries.length === 1 ? 'exercise' : 'exercises'}`, `${sets} sets`, w.durationMin ? `${w.durationMin} min` : '', vol > 0 ? `${formatKg(vol)} lifted` : ''].filter(Boolean).join(' · ')
  const lines = w.entries.map(e => {
    const name = exInfo(e.exId).name
    return `• ${name}: ${setsLine(e)}${prNames.includes(name) ? ' 🏆 PR' : ''}`
  })
  return [
    `💪 ${w.name} · ${date}`,
    totals + (cmp.best ? `\n≈ ${cmp.times >= 10 ? Math.round(cmp.times) : cmp.times.toFixed(1)} × ${cmp.best.name.replace(/^an? /, '')}` : ''),
    '',
    ...lines,
    ...(url ? ['', `Tracked with Power Level: ${url}`] : []),
  ].join('\n')
}
