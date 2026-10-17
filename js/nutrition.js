// Calories and macros. Targets come from Mifflin-St Jeor × activity, adjusted for the goal.
// Foods are per 100 g unless a serving is given; `g` on a serving is its weight in grams.

export const ACTIVITY = {
  sedentary: { label: 'Desk job, little else', factor: 1.2 },
  light: { label: 'Training 2–3× a week', factor: 1.375 },
  moderate: { label: 'Training 4–5× a week', factor: 1.55 },
  high: { label: 'Training 6× + active job', factor: 1.725 },
}
export const GOALS = {
  cut: { label: 'Lose fat', delta: -450 },
  maintain: { label: 'Maintain', delta: 0 },
  lean: { label: 'Lean bulk', delta: 250 },
  bulk: { label: 'Bulk', delta: 450 },
}

export function bmr({ sex, weight, height, age }) {
  if (!(weight > 0 && height > 0 && age > 0)) return null
  const base = 10 * weight + 6.25 * height - 5 * age
  return Math.round(sex === 'female' ? base - 161 : base + 5)
}

export function targets(profile) {
  const b = bmr(profile)
  if (!b) return null
  const tdee = b * (ACTIVITY[profile.activity]?.factor || 1.55)
  const kcal = Math.round((tdee + (GOALS[profile.goal]?.delta || 0)) / 10) * 10
  const protein = Math.round(profile.weight * (profile.goal === 'cut' ? 2.2 : 2))
  const fat = Math.round(profile.weight * 0.8)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat, tdee: Math.round(tdee) }
}

// Quick picks. [name, kcal, protein, carbs, fat] per 100 g, plus an optional common serving.
// These are rough estimates typed from general knowledge, not taken from a cited table, so
// they carry src: 'est' and the UI labels them as estimates. Sourced data is in js/foods.js.
const RAW = [
  ['Chicken breast, cooked', 165, 31, 0, 3.6, 'breast', 170],
  ['Chicken thigh, cooked', 209, 26, 0, 10.9, 'thigh', 110],
  ['Beef mince 5 %, cooked', 175, 26, 0, 8],
  ['Steak, rump, cooked', 200, 30, 0, 8.5, 'steak', 250],
  ['Salmon, cooked', 206, 22, 0, 12.4, 'fillet', 150],
  ['Tuna in springwater', 116, 26, 0, 1, 'tin (95 g)', 95],
  ['Eggs', 143, 12.6, 0.7, 9.5, 'egg', 50],
  ['Egg whites', 52, 11, 0.7, 0.2],
  ['Greek yoghurt, low fat', 59, 10, 3.6, 0.4, 'tub (170 g)', 170],
  ['Milk, full cream', 64, 3.3, 4.7, 3.6, 'cup (250 ml)', 258],
  ['Milk, skim', 35, 3.5, 5, 0.1, 'cup (250 ml)', 258],
  ['Whey protein', 400, 80, 8, 6, 'scoop (30 g)', 30],
  ['Cheddar cheese', 403, 25, 1.3, 33, 'slice (20 g)', 20],
  ['Cottage cheese', 98, 11, 3.4, 4.3],
  ['White rice, cooked', 130, 2.7, 28, 0.3, 'cup', 186],
  ['Brown rice, cooked', 123, 2.7, 25.6, 1, 'cup', 195],
  ['Pasta, cooked', 158, 5.8, 31, 0.9, 'cup', 140],
  ['Rolled oats', 379, 13, 68, 6.5, '½ cup (40 g)', 40],
  ['Bread, wholemeal', 247, 13, 41, 3.4, 'slice', 40],
  ['Wrap / tortilla', 300, 8, 50, 7, 'wrap', 60],
  ['Potato, boiled', 87, 1.9, 20, 0.1, 'medium', 170],
  ['Sweet potato, baked', 90, 2, 21, 0.2, 'medium', 150],
  ['Banana', 89, 1.1, 23, 0.3, 'banana', 120],
  ['Apple', 52, 0.3, 14, 0.2, 'apple', 180],
  ['Blueberries', 57, 0.7, 14, 0.3, 'cup', 148],
  ['Broccoli', 34, 2.8, 7, 0.4, 'cup', 90],
  ['Mixed salad leaves', 17, 1.5, 2.9, 0.2],
  ['Avocado', 160, 2, 8.5, 14.7, '½ avocado', 75],
  ['Olive oil', 884, 0, 0, 100, 'tbsp', 14],
  ['Butter', 717, 0.9, 0.1, 81, 'tsp', 5],
  ['Peanut butter', 588, 25, 20, 50, 'tbsp', 16],
  ['Almonds', 579, 21, 22, 50, 'handful (30 g)', 30],
  ['Honey', 304, 0.3, 82, 0, 'tbsp', 21],
  ['Protein bar', 360, 33, 35, 12, 'bar (60 g)', 60],
  ['Muesli bar', 420, 7, 64, 15, 'bar (31 g)', 31],
  ['Cooked bacon', 541, 37, 1.4, 42, 'rasher', 15],
  ['Ham, sliced', 145, 21, 1.5, 6, 'slice', 15],
  ['Baked beans', 81, 4.8, 11, 0.4, '½ can (210 g)', 210],
  ['Lentils, cooked', 116, 9, 20, 0.4, 'cup', 198],
  ['Tofu, firm', 144, 15.6, 2.3, 8.7],
  ['Pizza, supreme', 266, 11, 30, 11, 'slice', 110],
  ['Hamburger, takeaway', 254, 13, 26, 11, 'burger', 220],
  ['Hot chips', 312, 3.4, 41, 15, 'medium serve', 120],
  ['Meat pie', 255, 8, 23, 15, 'pie', 175],
  ['Sushi roll, salmon', 150, 5, 27, 2.5, 'roll', 100],
  ['Beer, full strength', 43, 0.5, 3.6, 0, 'schooner (425 ml)', 425],
  ['Coke', 42, 0, 10.6, 0, 'can (375 ml)', 375],
  ['Coffee, flat white', 50, 3, 4.4, 2.5, 'regular', 220],
]

export const FOODS = RAW.map(([name, kcal, p, c, f, unit, g], i) => ({
  id: 'f' + i, src: 'est', name, kcal, p, c, f, ...(unit ? { serving: { unit, g } } : {}),
}))

// Macros for an amount of a food, in grams.
export function macrosFor(food, grams) {
  const k = (Number(grams) || 0) / 100
  const r = v => Math.round(v * k * 10) / 10
  return { kcal: Math.round(food.kcal * k), p: r(food.p), c: r(food.c), f: r(food.f) }
}

export function sumEntries(entries) {
  return (entries || []).reduce((t, e) => ({
    kcal: t.kcal + (e.kcal || 0), p: t.p + (e.p || 0), c: t.c + (e.c || 0), f: t.f + (e.f || 0),
  }), { kcal: 0, p: 0, c: 0, f: 0 })
}

// Energy units. Everything is stored in kcal; kJ is display and entry only (1 kcal = 4.184 kJ).
export const KJ_PER_KCAL = 4.184
export const ENERGY_UNITS = { kcal: 'kcal', kj: 'kJ' }
export const energyUnitOf = settings => (settings?.energy === 'kj' ? 'kj' : 'kcal')
export const toUnit = (kcal, unit) => Math.round((Number(kcal) || 0) * (unit === 'kj' ? KJ_PER_KCAL : 1))
export const fromUnit = (value, unit) => Math.round((Number(value) || 0) / (unit === 'kj' ? KJ_PER_KCAL : 1))
export const fmtEnergy = (kcal, unit) => `${toUnit(kcal, unit).toLocaleString()} ${ENERGY_UNITS[unit] || 'kcal'}`
