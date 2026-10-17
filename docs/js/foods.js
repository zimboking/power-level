// Food search across every source: your saved foods, the Australian Food Composition Database
// (AFCD, FSANZ), and the app's quick-pick estimates. Every food carries `src` so the UI can say
// where its numbers came from.
import { FOODS } from './nutrition.js'

export const SOURCES = {
  custom: { label: 'Saved', title: 'A food you saved' },
  afcd: { label: 'AFCD', title: 'Australian Food Composition Database (FSANZ)' },
  off: { label: 'Open Food Facts', title: 'Open Food Facts, from the product label' },
  est: { label: 'Estimate', title: 'Rough estimate typed into the app, not from a cited table' },
}
// Saved foods from before sources existed have no `src`; they are the user's own.
export const sourceOf = food => (SOURCES[food?.src] ? food.src : 'custom')

// AFCD Release 3, per 100 g. Fetched once; the service worker keeps it for offline use.
let foodsPromise = null
export const afcdFood = ([ref, name, kcal, p, c, f]) => ({ id: 'afcd:' + ref, ref, src: 'afcd', name, kcal, p, c, f })
export function loadFoods() {
  foodsPromise = foodsPromise || fetch(new URL('./data/foods.json', import.meta.url)).then(r => {
    if (!r.ok) throw new Error('foods ' + r.status)
    return r.json()
  }).then(rows => rows.map(afcdFood)).catch(err => { foodsPromise = null; throw err })
  return foodsPromise
}

// ---- Ranking ----
// Names in the AFCD read "Chicken, breast, lean flesh, grilled, no added fat": the first
// comma part says what the food is, later parts describe it. A query word that matches the
// first part counts most, so "chicken breast" finds chicken breast before "Egg, chicken" or
// "Soup, chicken & noodle". Cooked forms get a small lift over raw unless you ask for raw.
const SPELLING = { yogurt: 'yoghurt', yoghourt: 'yoghurt', flavor: 'flavour', color: 'colour', donut: 'doughnut', ketchup: 'tomato sauce' }
const stem = w => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y'
  : w.length > 4 && /(ches|shes|oes)$/.test(w) ? w.slice(0, -2)
  : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
export const words = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9%]+/).filter(Boolean).flatMap(w => (SPELLING[w] || w).split(' ')).map(stem)

const COOKED = new Set(['cooked', 'grilled', 'baked', 'roasted', 'roast', 'boiled', 'steamed', 'fried', 'barbecued', 'poached', 'microwaved', 'casseroled', 'stir', 'pan', 'prepared'])
const SEGMENT_WEIGHT = [10, 6, 4, 3]
const SOURCE_BONUS = { custom: 3, off: 2, afcd: 0, est: -6 }
const CONCENTRATED = new Set(['powder', 'dried', 'dry', 'concentrate', 'dehydrated', 'condensed', 'evaporated'])
const NICHE = new Set(['human', 'infant', 'baby', 'toddler'])

// Index a food once: the words in each comma part of its name.
const indexed = new WeakMap()
function indexOf(food) {
  let ix = indexed.get(food)
  if (!ix) {
    const parts = String(food.name).split(',').map(words)
    ix = { parts, all: parts.flat() }
    indexed.set(food, ix)
  }
  return ix
}

// Score one food for the query words. Returns 0 when no query word matches.
export function scoreFood(food, qWords) {
  if (!qWords.length) return 0
  const { parts, all } = indexOf(food)
  let score = 0, matched = 0
  for (const q of qWords) {
    let best = 0
    parts.forEach((ws, i) => {
      for (const w of ws) {
        const hit = w === q ? 1 : w.startsWith(q) ? 0.7 : 0
        if (hit) best = Math.max(best, hit * (SEGMENT_WEIGHT[i] ?? 2))
      }
    })
    if (best) { matched++; score += best }
  }
  if (!matched) return 0
  // Every query word matched beats any partial match.
  score += matched === qWords.length ? 100 : matched * 20
  // The name starting with one of the query words (its head noun) is a strong signal.
  if (qWords.includes(all[0])) score += 4
  const asked = w => qWords.includes(w)
  if (!asked('raw') && all.some(w => COOKED.has(w))) score += 2
  if (!asked('raw') && all.includes('raw')) score -= 1.5
  // Milk powder, dried fruit and the like only when asked for.
  if (all.some(w => CONCENTRATED.has(w) && !asked(w))) score -= 3
  if (all.some(w => NICHE.has(w) && !asked(w))) score -= 8
  // Shorter names are usually the plain version of the food.
  score -= Math.max(0, all.length - qWords.length) * 0.15
  return score + (SOURCE_BONUS[sourceOf(food)] || 0)
}

// lists: arrays of foods (saved, AFCD, estimates…). Returns the best `limit` matches.
export function rankFoods(q, lists, limit = 30) {
  const qWords = words(q)
  const seen = new Set()
  const pool = lists.flat().filter(f => f && !seen.has(f.id) && seen.add(f.id))
  if (!qWords.length) return []
  return pool.map(f => [scoreFood(f, qWords), f]).filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0] || a[1].name.length - b[1].name.length).slice(0, limit).map(([, f]) => f)
}

// Quick picks: the app's built-in estimates, labelled as such.
export const ESTIMATES = FOODS
