// Open Food Facts (ODbL): packaged products by barcode or name. Online only; every call
// rejects with an OffError the UI can show, and nothing here is needed for the app to work.
import { KJ_PER_KCAL } from './nutrition.js'

const API = 'https://world.openfoodfacts.org'
const SEARCH_ALT = 'https://search.openfoodfacts.org/search'
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,quantity,serving_size,serving_quantity,nutriments'

export class OffError extends Error {
  constructor(kind, message) { super(message); this.kind = kind }
}

const r1 = v => Math.round(v * 10) / 10
const n = v => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : null }

// Energy per 100 g in kcal: the kcal figure if given, else kJ (labels here are in kJ).
function kcal100(nu) {
  const kcal = n(nu['energy-kcal_100g'])
  if (kcal != null) return Math.round(kcal)
  const kj = n(nu['energy-kj_100g']) ?? (nu.energy_unit !== 'kcal' ? n(nu.energy_100g) : null)
  return kj == null ? null : Math.round(kj / KJ_PER_KCAL)
}

// An OFF product to a food in the app's shape (per 100 g). Returns null without usable macros.
export function productToFood(product) {
  if (!product) return null
  const nu = product.nutriments || {}
  const kcal = kcal100(nu)
  const p = n(nu.proteins_100g), c = n(nu.carbohydrates_100g), f = n(nu.fat_100g)
  const brand = (Array.isArray(product.brands) ? product.brands[0] : String(product.brands || '').split(',')[0]).trim()
  const base = String(product.product_name_en || product.product_name || product.generic_name || '').trim()
  const name = (base && brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${base}` : base || brand || 'Product ' + product.code).slice(0, 80)
  const sg = n(product.serving_quantity)
  return {
    id: 'off:' + product.code, ref: String(product.code), src: 'off', name,
    kcal: kcal ?? 0, p: r1(p ?? 0), c: r1(c ?? 0), f: r1(f ?? 0),
    complete: kcal != null && p != null && c != null && f != null,
    ...(sg ? { serving: { unit: 'serve' + (product.serving_size ? ` (${String(product.serving_size).slice(0, 24)})` : ''), g: Math.round(sg) } } : {}),
    ...(product.quantity ? { pack: String(product.quantity).slice(0, 30) } : {}),
  }
}

async function getJson(url, fetchImpl) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OffError('offline', 'You’re offline. Open Food Facts needs a connection.')
  let res
  try { res = await fetchImpl(url, { headers: { Accept: 'application/json' } }) } catch { throw new OffError('network', 'Couldn’t reach Open Food Facts. Check your connection and try again.') }
  if (res.status === 429) throw new OffError('busy', 'Open Food Facts is busy. Wait a minute and try again.')
  if (!res.ok) throw new OffError('down', `Open Food Facts didn’t answer (error ${res.status}).`)
  try { return await res.json() } catch { throw new OffError('down', 'Open Food Facts sent something unexpected.') }
}

export const cleanBarcode = s => String(s || '').replace(/\D/g, '')
export const validBarcode = s => /^\d{8,14}$/.test(cleanBarcode(s))

// Resolves to a food, or null when the product isn't in Open Food Facts.
export async function lookupBarcode(code, fetchImpl = fetch) {
  const bc = cleanBarcode(code)
  if (!validBarcode(bc)) throw new OffError('bad', 'That doesn’t look like a barcode (8 to 14 digits).')
  const data = await getJson(`${API}/api/v2/product/${bc}.json?fields=${FIELDS}`, fetchImpl)
  if (data.status !== 1 || !data.product) return null
  return productToFood({ ...data.product, code: data.product.code || bc })
}

// Name search. Open Food Facts rate-limits search (about 10 a minute), so callers debounce,
// and results are cached for the session. Tries the classic endpoint, then the newer one.
const searchCache = new Map()
export async function searchProducts(q, fetchImpl = fetch) {
  const term = String(q || '').trim().toLowerCase()
  if (term.length < 3) return []
  if (searchCache.has(term)) return searchCache.get(term)
  const urls = [
    `${API}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`,
    `${SEARCH_ALT}?q=${encodeURIComponent(term)}&page_size=12&fields=${FIELDS}`,
  ]
  let lastErr
  for (const url of urls) {
    try {
      const data = await getJson(url, fetchImpl)
      const list = (data.products || data.hits || []).map(productToFood).filter(f => f && f.complete)
      searchCache.set(term, list)
      return list
    } catch (err) {
      if (err.kind === 'offline') throw err
      lastErr = err
    }
  }
  throw lastErr
}

// Per-serving macros from a per-100 g food.
export const perServing = food => (food.serving ? {
  kcal: Math.round(food.kcal * food.serving.g / 100),
  p: r1(food.p * food.serving.g / 100), c: r1(food.c * food.serving.g / 100), f: r1(food.f * food.serving.g / 100),
} : null)
