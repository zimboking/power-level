// Example data, clearly flagged (profile.example), so a new user can see every screen working
// before logging anything. Eight weeks of push / pull / legs with steady progress.
import { FOODS, macrosFor } from './nutrition.js'
import { e1rm } from './strength.js'
import { STARTER_PLANS } from './exercises.js'
import { emptyPlan } from './schedule.js'

const iso = d => d.toISOString().slice(0, 10)
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const sets = (w, reps, rir = 2, n = 3) => Array.from({ length: n }, (_, i) => ({ w, r: reps[i] ?? reps[reps.length - 1], rir: i === n - 1 ? Math.max(0, rir - 1) : rir, done: true }))
const warm = w => [{ w: 20, r: 10, warmup: true, done: true }, { w: Math.round(w * 0.5 / 2.5) * 2.5, r: 5, warmup: true, done: true }]

export function makeExampleData(profile) {
  const workouts = []
  const feelings = { 21: 'rough', 31: 'flat' }
  for (let week = 0; week < 8; week++) {
    const base = 56 - week * 7
    const bench = 72.5 + week * 2.5, squat = 115 + week * 2.5, dead = 140 + week * 5, ohp = 42.5 + week * 1.25
    const push = base, pull = base - 2, legs = base - 4
    const mk = (ago, name, entries) => workouts.push({ id: 'ex' + ago, date: daysAgo(ago), name, routineId: 'r-' + name.toLowerCase(), feeling: feelings[ago] || 'great', note: feelings[ago] === 'rough' ? 'Head cold' : '', durationMin: 62, entries })
    const f = ago => (feelings[ago] === 'rough' ? 0.9 : feelings[ago] === 'flat' ? 0.95 : 1)
    const r25 = v => Math.round(v / 2.5) * 2.5
    mk(push, 'Push', [
      { exId: 'bench', sets: [...warm(bench), ...sets(r25(bench * f(push)), [8, 7, 6])] },
      { exId: 'ohp', sets: sets(r25(ohp * f(push)), [8, 7, 7]) },
      { exId: 'lateral', group: 'ga', sets: sets(10, [15, 14, 12], 1) },
      { exId: 'pushdown', group: 'ga', sets: sets(30 + week * 2.5, [12, 12, 10], 1) },
    ])
    mk(pull, 'Pull', [
      { exId: 'deadlift', sets: [...warm(dead), ...sets(dead, [5, 5], 2, 2)] },
      { exId: 'row', sets: sets(70 + week * 2.5, [8, 8, 7]) },
      { exId: 'pullup', sets: sets(0, [10, 9, 8]) },
    ])
    mk(legs, 'Legs', [
      { exId: 'squat', sets: [...warm(squat), ...sets(r25(squat * f(legs)), [8, 7, 6])] },
      { exId: 'rdl', sets: sets(90 + week * 5, [10, 9, 8]) },
      { exId: 'legcurl', group: 'gb', sets: sets(40 + week * 2.5, [12, 12, 11], 1) },
      { exId: 'calf', group: 'gb', sets: sets(80 + week * 5, [15, 14, 12], 1) },
    ])
  }
  const weighins = Array.from({ length: 28 }, (_, i) => ({ date: daysAgo(54 - i * 2), kg: Math.round((84.6 - i * 0.07 + Math.sin(i * 1.7) * 0.4) * 10) / 10 }))
  const food = {}
  const pick = (name, g, meal) => { const f = FOODS.find(x => x.name.startsWith(name)); return { id: name + g + meal, meal, name: f.name, grams: g, ...macrosFor(f, g) } }
  food[daysAgo(0)] = [pick('Rolled oats', 60, 'Breakfast'), pick('Whey', 30, 'Breakfast'), pick('Banana', 120, 'Breakfast'), pick('Chicken breast', 200, 'Lunch'), pick('White rice', 250, 'Lunch')]
  food[daysAgo(1)] = [...food[daysAgo(0)], pick('Steak', 250, 'Dinner'), pick('Potato', 300, 'Dinner'), pick('Greek yoghurt', 170, 'Snacks')]
  return {
    profile: {
      ...profile, example: true, weighins,
      goals: [{ id: 'g-ex', exId: 'bench', target: 140, start: e1rm(72.5, 8, 2), startDate: daysAgo(42), level: null }],
      settings: { ...profile.settings, goalWeight: 82 },
      templates: STARTER_PLANS[0].routines.map(r => ({ ...r, items: r.items.map(i => ({ ...i })) })),
      plan: { ...emptyPlan(), mode: 'weekly', days: { 1: 'r-push', 3: 'r-pull', 5: 'r-legs' } },
    },
    workouts: workouts.sort((a, b) => a.date.localeCompare(b.date)),
    food,
  }
}
