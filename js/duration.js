// Timed exercises are stored in seconds and shown in the unit chosen for the exercise.
export const TIME_UNITS = {
  s: { label: 'Seconds', short: 's', head: 'SECONDS', per: 1, step: 5, grow: 5 },
  min: { label: 'Minutes', short: 'min', head: 'MINUTES', per: 60, step: 1, grow: 60 },
  h: { label: 'Hours', short: 'h', head: 'HOURS', per: 3600, step: 0.25, grow: 300 },
}
export const MAX_SECONDS = 24 * 3600
// Where a new timed exercise starts: a 30 s hold, a 20 min effort, an hour out.
export const START_SECONDS = { s: 30, min: 1200, h: 3600 }

/** The unit for an exercise: your override in settings, else the exercise's own, else seconds. */
export const timeUnitOf = (ex, settings) => {
  const u = settings?.timeUnits?.[ex?.id] || ex?.timeUnit
  return TIME_UNITS[u] ? u : 's'
}

/** Seconds → a number in the unit (two decimals at most), for an input. */
export const toUnit = (sec, unit) => Math.round(((sec || 0) / TIME_UNITS[unit].per) * 100) / 100

/** A number in the unit → whole seconds, kept between 1 s and a day. */
export const fromUnit = (value, unit) => Math.min(MAX_SECONDS, Math.max(1, Math.round((+value || 0) * TIME_UNITS[unit].per)))

/** Seconds → "45 s", "12 min", "2:30 min", "1 h 30 min". */
export function fmtDuration(sec) {
  const t = Math.max(0, Math.round(sec || 0))
  if (t < 60) return `${t} s`
  if (t < 3600) {
    const m = Math.floor(t / 60), s = t % 60
    return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`
  }
  const h = Math.floor(t / 3600), m = Math.round((t % 3600) / 60)
  return m ? `${h} h ${m} min` : `${h} h`
}
