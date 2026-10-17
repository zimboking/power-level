// Builds js/data/foods.json from the Australian Food Composition Database (AFCD), Release 3,
// by Food Standards Australia New Zealand (CC BY 4.0). Download "Nutrient profiles" from
// https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/australian-food-composition-database-download-excel-files
//
//   node tools/build-foods.mjs "<AFCD Release 3 - Nutrient profiles.xlsx>"
//
// Output: [[publicFoodKey, name, kcal, protein, carbs, fat], ...], all per 100 g edible portion.
// Energy is FSANZ's "Energy with dietary fibre, equated" (the figure on Australian labels),
// converted from kJ to kcal. Carbs are "Available carbohydrate, with sugar alcohols".
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readXlsx } from './xlsx.mjs'

export const KJ_PER_KCAL = 4.184
const SHEET = /per 100 ?g/i
const COLUMNS = {
  id: /^public food key$/,
  name: /^food name$/,
  kj: /^energy with dietary fibre, equated \(kj\)$/,
  p: /^protein \(g\)$/,
  f: /^fat, total \(g\)$/,
  c: /^available carbohydrate, with sugar alcohols \(g\)$/,
}

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim()
const num = s => (clean(s) === '' ? 0 : Number(s))
const r1 = v => Math.round(v * 10) / 10

export const kjToKcal = kj => Math.round(kj / KJ_PER_KCAL)

// rows: the sheet as arrays of strings. Finds the header row by its column names.
export function convertRows(rows) {
  const at = rows.findIndex(r => r.some(c => COLUMNS.id.test(clean(c).toLowerCase())))
  if (at < 0) throw new Error('No "Public Food Key" header row found')
  const head = rows[at].map(c => clean(c).toLowerCase())
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([k, re]) => {
    const i = head.findIndex(h => re.test(h))
    if (i < 0) throw new Error(`Missing column for ${k}`)
    return [k, i]
  }))
  const out = []
  for (const r of rows.slice(at + 1)) {
    const id = clean(r[col.id]), name = clean(r[col.name])
    if (!id || !name) continue
    const vals = [num(r[col.kj]), num(r[col.p]), num(r[col.c]), num(r[col.f])]
    if (vals.some(v => !Number.isFinite(v))) throw new Error(`Bad number for ${id} ${name}`)
    const [kj, p, c, f] = vals
    out.push([id, name, kjToKcal(kj), r1(p), r1(c), r1(f)])
  }
  return out
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = process.argv[2]
  if (!src) { console.error('Usage: node tools/build-foods.mjs "<AFCD Release 3 - Nutrient profiles.xlsx>"'); process.exit(1) }
  const book = readXlsx(readFileSync(src))
  const sheet = Object.keys(book).find(n => SHEET.test(n))
  if (!sheet) throw new Error('No "per 100 g" sheet in ' + src)
  const foods = convertRows(book[sheet])
  const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'data', 'foods.json')
  writeFileSync(dest, '[\n' + foods.map(f => JSON.stringify(f)).join(',\n') + '\n]\n')
  console.log(`Wrote ${foods.length} foods to ${dest}`)
}
