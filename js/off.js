// Open Food Facts (ODbL): packaged products by barcode or name. Online only; every call
// rejects with an OffError the UI can show, and nothing here is needed for the app to work.
import { KJ_PER_KCAL } from './nutrition.js'

const API = 'https://world.openfoodfacts.org'
// Open Food Facts asks apps to identify themselves. Browsers won't let a page set User-Agent,
// so this goes in X-User-Agent, which their CORS setup allows.
export const APP_ID = 'PowerLevel/1.0 (https://github.com/zimboking/power-level)'
// Busy servers answer 503 without CORS headers, which the browser reports as a network error,
// so a failed request gets one more try after a short pause.
const RETRY_AFTER_MS = 3000
const RETRYABLE = new Set(['network', 'down', 'busy'])
const wait = ms => new Promise(r => setTimeout(r, ms))
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
  // Fibre in g; sodium arrives in g (or only as salt, which is 2.5 × sodium) and is kept in mg.
  const fib = n(nu.fiber_100g), naG = n(nu.sodium_100g) ?? (n(nu.salt_100g) != null ? n(nu.salt_100g) / 2.5 : null)
  const brand = (Array.isArray(product.brands) ? product.brands[0] : String(product.brands || '').split(',')[0]).trim()
  const base = String(product.product_name_en || product.product_name || product.generic_name || '').trim()
  const name = (base && brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${base}` : base || brand || 'Product ' + product.code).slice(0, 80)
  const sg = n(product.serving_quantity)
  return {
    id: 'off:' + product.code, ref: String(product.code), src: 'off', name,
    kcal: kcal ?? 0, p: r1(p ?? 0), c: r1(c ?? 0), f: r1(f ?? 0),
    ...(fib != null ? { fib: r1(fib) } : {}), ...(naG != null ? { na: Math.round(naG * 1000) } : {}),
    complete: kcal != null && p != null && c != null && f != null,
    ...(sg ? { serving: { unit: 'serve' + (product.serving_size ? ` (${String(product.serving_size).slice(0, 24)})` : ''), g: Math.round(sg) } } : {}),
    ...(product.quantity ? { pack: String(product.quantity).slice(0, 30) } : {}),
  }
}

async function getJsonOnce(url, fetchImpl) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OffError('offline', 'You’re offline. Open Food Facts needs a connection.')
  let res
  try { res = await fetchImpl(url, { headers: { Accept: 'application/json', 'X-User-Agent': APP_ID } }) } catch { throw new OffError('network', 'Couldn’t reach Open Food Facts. Check your connection and try again.') }
  if (res.status === 429 || res.status === 503) throw new OffError('busy', 'Open Food Facts is busy. Wait a minute and try again.')
  if (!res.ok) throw new OffError('down', `Open Food Facts didn’t answer (error ${res.status}).`)
  try { return await res.json() } catch { throw new OffError('down', 'Open Food Facts sent something unexpected.') }
}

async function getJson(url, { fetchImpl = fetch, retryAfterMs = RETRY_AFTER_MS } = {}) {
  try { return await getJsonOnce(url, fetchImpl) } catch (err) {
    if (!RETRYABLE.has(err.kind)) throw err
    await wait(retryAfterMs)
    return getJsonOnce(url, fetchImpl)
  }
}

export const cleanBarcode = s => String(s || '').replace(/\D/g, '')
export const validBarcode = s => /^\d{8,14}$/.test(cleanBarcode(s))

// Resolves to a food, or null when the product isn't in Open Food Facts.
// opts: { fetchImpl, retryAfterMs } (for tests).
export async function lookupBarcode(code, opts) {
  const bc = cleanBarcode(code)
  if (!validBarcode(bc)) throw new OffError('bad', 'That doesn’t look like a barcode (8 to 14 digits).')
  const data = await getJson(`${API}/api/v2/product/${bc}.json?fields=${FIELDS}`, opts)
  if (data.status !== 1 || !data.product) return null
  return productToFood({ ...data.product, code: data.product.code || bc })
}

// Name search. Open Food Facts allows about 10 searches a minute and asks apps not to search
// as you type, so the UI only searches when you press the button. Results are cached for the
// session. (search.openfoodfacts.org sends no CORS headers, so a web page can't use it.)
const searchCache = new Map()
export async function searchProducts(q, opts) {
  const term = String(q || '').trim().toLowerCase()
  if (term.length < 3) return []
  if (searchCache.has(term)) return searchCache.get(term)
  const data = await getJson(`${API}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`, opts)
  const list = (data.products || []).map(productToFood).filter(f => f && f.complete)
  searchCache.set(term, list)
  return list
}

// Per-serving macros from a per-100 g food.
export const perServing = food => (food.serving ? {
  kcal: Math.round(food.kcal * food.serving.g / 100),
  p: r1(food.p * food.serving.g / 100), c: r1(food.c * food.serving.g / 100), f: r1(food.f * food.serving.g / 100),
  ...(food.fib != null ? { fib: r1(food.fib * food.serving.g / 100) } : {}), ...(food.na != null ? { na: Math.round(food.na * food.serving.g / 100) } : {}),
} : null)
