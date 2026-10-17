// Regenerates the data files the app loads on demand:
//   node tools/build-data.mjs <free-exercise-db exercises.json> <MuscleMap-derived body-paths.js>
// js/data/catalog.json  ← free-exercise-db (The Unlicense), trimmed to what the app shows
// js/data/body.json     ← MuscleMap body outlines (MIT, see NOTICE.md)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [catalogPath, bodyPath] = process.argv.slice(2)
if (!catalogPath || !bodyPath) { console.error('usage: node tools/build-data.mjs <exercises.json> <body-paths.js>'); process.exit(1) }
mkdirSync(join(ROOT, 'js', 'data'), { recursive: true })

// Dataset muscle names → body-map regions.
const MUSCLE = {
  abdominals: 'abs', abductors: 'gluteal', adductors: 'adductors', biceps: 'biceps', calves: 'calves', chest: 'chest',
  forearms: 'forearm', glutes: 'gluteal', hamstrings: 'hamstring', lats: 'upper-back', 'lower back': 'lower-back',
  'middle back': 'upper-back', neck: 'neck', quadriceps: 'quadriceps', shoulders: 'deltoids', traps: 'trapezius', triceps: 'triceps',
}
const EQ = { 'body only': 'bodyweight', 'e-z curl bar': 'ez', kettlebells: 'kettlebell', bands: 'band', 'medicine ball': 'other', 'exercise ball': 'other', 'foam roll': 'other' }
const uniq = a => [...new Set(a)]

const raw = JSON.parse(readFileSync(catalogPath, 'utf8'))
const catalog = raw
  .filter(e => e.category !== 'stretching' && e.equipment !== 'foam roll')
  .map(e => {
    const p = uniq((e.primaryMuscles || []).map(m => MUSCLE[m]).filter(Boolean))
    const s = uniq((e.secondaryMuscles || []).map(m => MUSCLE[m]).filter(m => m && !p.includes(m)))
    return {
      id: e.id, n: e.name, eq: EQ[e.equipment] || e.equipment || 'other', p, s,
      c: e.category, lv: e.level, mc: e.mechanic || null, img: (e.images || []).length,
      ins: (e.instructions || []).map(t => t.trim()).filter(Boolean),
    }
  })
  .sort((a, b) => a.n.localeCompare(b.n))
writeFileSync(join(ROOT, 'js', 'data', 'catalog.json'), JSON.stringify(catalog))

const body = (await import(pathToFileURL(resolve(bodyPath)).href)).default
writeFileSync(join(ROOT, 'js', 'data', 'body.json'), JSON.stringify(body))
console.log(`catalog: ${catalog.length} exercises · body: ${Object.keys(body).join(', ')}`)
