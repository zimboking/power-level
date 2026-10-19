// The fun layer: a power level that climbs with your strength and consistency, tiers that
// change how the fighter looks, and "you've lifted a ..." comparisons for total volume.
import { currentE1rm, workoutVolume } from './strength.js'

export const TIERS = [
  { min: 0, name: 'Rookie', hair: '#2a2420', aura: null },
  { min: 3000, name: 'Awakened', hair: '#3a2e28', aura: '#cfd8e6' },
  { min: 4500, name: 'Ascended', hair: '#f2c230', aura: '#ffd84a' },
  { min: 6000, name: 'Ascended II', hair: '#ffcf33', aura: '#ffb703', sparks: true },
  { min: 8000, name: 'Crimson God', hair: '#e2384d', aura: '#ff4d6d', sparks: true },
  { min: 9500, name: 'Azure Limit', hair: '#4cc9f0', aura: '#4cc9f0', sparks: true },
  { min: 11500, name: 'Ultra Instinct-ish', hair: '#d9d4ff', aura: '#b8b0ff', sparks: true },
]

const BIG_LIFTS = ['bench', 'squat', 'deadlift', 'ohp', 'row']

// Strength counts most (best recent e1RM of the big lifts × 10), consistency adds on top.
export function powerLevel(workouts) {
  const strength = BIG_LIFTS.reduce((sum, id) => sum + (currentE1rm(workouts, id) || 0), 0) * 10
  const sessions = workouts.length * 25
  const volume = workouts.reduce((s, w) => s + workoutVolume(w), 0) / 500
  return Math.round(strength + sessions + volume)
}

export function tierFor(level) {
  let idx = 0
  TIERS.forEach((t, i) => { if (level >= t.min) idx = i })
  const tier = TIERS[idx]
  const next = TIERS[idx + 1] || null
  const progress = next ? (level - tier.min) / (next.min - tier.min) : 1
  return { ...tier, idx, next, progress: Math.max(0, Math.min(1, progress)) }
}

// Real-ish masses in kg. The last one is a joke goal: a volcano is about 10^14 kg of rock.
export const LIFTED_LADDER = [
  { kg: 90, name: 'a fridge', art: 'fridge' },
  { kg: 450, name: 'a grand piano', art: 'piano' },
  { kg: 900, name: 'a dairy cow', art: 'cow' },
  { kg: 1500, name: 'a family car', art: 'car' },
  { kg: 6000, name: 'an African elephant', art: 'elephant' },
  { kg: 8000, name: 'a T. rex', art: 'trex' },
  { kg: 12000, name: 'a school bus', art: 'bus' },
  { kg: 60000, name: 'a Leopard 2 tank', art: 'tank' },
  { kg: 150000, name: 'a blue whale', art: 'whale' },
  { kg: 440000, name: 'a fully loaded 747', art: 'jet' },
  { kg: 2000000, name: 'the Space Shuttle stack', art: 'shuttle' },
  { kg: 7300000, name: 'the Eiffel Tower', art: 'eiffel' },
  { kg: 6.6e9, name: 'the Great Pyramid of Giza', art: 'pyramid' },
  { kg: 1.0e14, name: 'a volcano', art: 'volcano' },
]

export function liftedComparison(totalKg) {
  let best = null
  for (const item of LIFTED_LADDER) if (totalKg >= item.kg) best = item
  const next = LIFTED_LADDER.find(i => i.kg > totalKg) || null
  return {
    best,
    times: best ? totalKg / best.kg : 0,
    next,
    toNext: next ? next.kg - totalKg : 0,
    progress: next ? totalKg / next.kg : 1,
  }
}

export function formatKg(kg) {
  if (kg >= 1e9) return (kg / 1e9).toFixed(1) + ' Mt'
  if (kg >= 1e6) return (kg / 1e6).toFixed(1) + ' kt'
  if (kg >= 1e4) return (kg / 1000).toFixed(1) + ' t'
  return Math.round(kg).toLocaleString() + ' kg'
}
