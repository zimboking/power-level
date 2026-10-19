// Food data: AFCD conversion, search ranking, Open Food Facts parsing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { convertRows, kjToKcal } from '../tools/build-foods.mjs'
import { readXlsx, colIndex } from '../tools/xlsx.mjs'
import { rankFoods, afcdFood, ESTIMATES, sourceOf, words } from '../js/foods.js'
import { productToFood, lookupBarcode, searchProducts, perServing, validBarcode, APP_ID } from '../js/off.js'

const AFCD = JSON.parse(readFileSync(new URL('../js/data/foods.json', import.meta.url), 'utf8')).map(afcdFood)
const top = (q, lists = [[], AFCD, ESTIMATES], n = 1) => rankFoods(q, lists, n).map(f => f.name)

// ---- Conversion ----
const HEADER = ['Public Food Key', 'Classification', 'Derivation', 'Food Name', 'Energy with dietary fibre, equated \r\n(kJ)', 'Energy, without dietary fibre, equated \r\n(kJ)', 'Protein \r\n(g)', 'Fat, total \r\n(g)', 'Available carbohydrate, with sugar alcohols \r\n(g)', 'Total dietary fibre \r\n(g)', 'Sodium (Na) \r\n(mg)']

test('converts AFCD rows: kJ to kcal, rounding, header found below title rows', () => {
  const rows = [['Release 3 - Nutrient profiles (per 100 g)'], [], HEADER,
    ['F002593', '1', 'Analysed', 'Chicken, breast, lean flesh, grilled, no added fat', '598', '598', '29.81', '2.54', '0', '0', '62.4'],
    ['F000001', '1', 'x', 'Water, tap', '0', '0', '', '', '', '', '3'],
    ['', '', '', '', '', '', '', '', '', '', '']]
  assert.deepEqual(convertRows(rows), [
    ['F002593', 'Chicken, breast, lean flesh, grilled, no added fat', 143, 29.8, 0, 2.5, 0, 62],
    ['F000001', 'Water, tap', 0, 0, 0, 0, 0, 3],
  ])
})

test('kJ to kcal uses 4.184', () => {
  assert.equal(kjToKcal(4184), 1000)
  assert.equal(kjToKcal(1236), 295)
})

test('conversion fails loudly on a missing column or bad number', () => {
  assert.throws(() => convertRows([HEADER.slice(0, 5), ['F1', '', '', 'x', '1']]), /Missing column/)
  assert.throws(() => convertRows([HEADER, ['F1', '', '', 'x', 'abc', '', '1', '1', '1', '1', '1']]), /Bad number/)
})

// A tiny hand-built .xlsx: one deflated sheet with a shared and an inline string.
function zip(files) {
  const locals = [], centrals = []
  let off = 0
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text)), nm = Buffer.from(name)
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt16LE(nm.length, 26)
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42)
    locals.push(lh, nm, data); centrals.push(ch, nm); off += 30 + nm.length + data.length
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(centrals.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16)
  return Buffer.concat([...locals, cd, end])
}

test('reads a minimal xlsx with shared, inline and numeric cells', () => {
  const buf = zip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="All per 100 g" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>Fish &amp; chips</t></si><si><r><t>Two</t></r><r><t xml:space="preserve"> runs</t></r></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>12.5</v></c></row><row r="2"><c r="B2" t="inlineStr"><is><t>inline</t></is></c><c r="D2" t="s"><v>1</v></c></row></sheetData></worksheet>',
  })
  assert.deepEqual(readXlsx(buf), { 'All per 100 g': [['Fish & chips', '', '12.5'], ['', 'inline', '', 'Two runs']] })
  assert.equal(colIndex('AA3'), 26)
})

test('bundled foods.json has the full AFCD release with sane values', () => {
  assert.equal(AFCD.length, 1588)
  for (const f of AFCD) {
    assert.match(f.ref, /^F\d{6}$/)
    assert.ok(f.kcal >= 0 && f.kcal <= 900, f.name)
    assert.ok(f.p + f.c + f.f <= 101, f.name)
  }
})

// ---- Ranking ----
test('"chicken breast" finds cooked chicken breast first, not stock or eggs', () => {
  const [first] = top('chicken breast')
  assert.match(first, /^Chicken, breast, lean flesh, (baked|grilled|fried|casseroled|roasted)/)
  assert.ok(!top('chicken breast', undefined, 5).some(n => /stock|soup|egg/i.test(n)))
})

test('asking for raw gets raw', () => {
  assert.match(top('raw chicken breast')[0], /^Chicken, breast, .*raw/)
})

test('plurals and spelling variants match', () => {
  assert.match(top('eggs')[0], /^Egg/)
  assert.match(top('rolled oats')[0], /^Oats, rolled/)
  assert.match(top('yogurt')[0], /^Yoghurt/)
  assert.deepEqual(words('Potatoes, Yogurt'), ['potato', 'yoghurt'])
})

test('plain fluid milk beats powder and evaporated', () => {
  assert.match(top('milk')[0], /^Milk, cow, fluid/)
})

test('sourced data outranks the estimates; saved foods outrank both', () => {
  assert.equal(sourceOf(rankFoods('chicken breast', [[], AFCD, ESTIMATES], 1)[0]), 'afcd')
  const mine = { id: 'c1', name: 'Chicken breast, Mum’s marinade', kcal: 170, p: 30, c: 2, f: 4 }
  const [first] = rankFoods('chicken breast', [[mine], AFCD, ESTIMATES], 1)
  assert.equal(first.id, 'c1')
  assert.equal(sourceOf(first), 'custom')
})

test('every estimate is labelled as one', () => {
  assert.ok(ESTIMATES.length >= 45)
  assert.ok(ESTIMATES.every(f => sourceOf(f) === 'est'))
})

test('empty query returns nothing and duplicates are dropped', () => {
  assert.deepEqual(rankFoods('  ', [AFCD]), [])
  const r = rankFoods('banana', [AFCD, AFCD], 50)
  assert.equal(new Set(r.map(f => f.id)).size, r.length)
})

// ---- Open Food Facts ----
const PRODUCT = {
  code: '9300633603024', product_name: 'Greek Style Yoghurt', brands: 'Chobani,Something', quantity: '907 g',
  serving_size: '170 g', serving_quantity: 170,
  nutriments: { 'energy-kj_100g': 418, proteins_100g: 9.6, carbohydrates_100g: 4.04, fat_100g: 0.2 },
}

test('OFF product converts kJ-only energy and builds a serving', () => {
  const f = productToFood(PRODUCT)
  assert.equal(f.name, 'Chobani Greek Style Yoghurt')
  assert.equal(f.src, 'off')
  assert.equal(f.kcal, 100)
  assert.equal(f.c, 4)
  assert.equal(f.complete, true)
  assert.deepEqual(f.serving, { unit: 'serve (170 g)', g: 170 })
  assert.deepEqual(perServing(f), { kcal: 170, p: 16.3, c: 6.8, f: 0.3 })
})

test('OFF product with missing macros is flagged incomplete', () => {
  const f = productToFood({ code: '1', product_name: 'Mystery', nutriments: { 'energy-kcal_100g': 250 } })
  assert.equal(f.complete, false)
  assert.equal(f.kcal, 250)
  assert.equal(f.serving, undefined)
})

const res = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })

const opts = fetchImpl => ({ fetchImpl, retryAfterMs: 0 })

test('barcode lookup: found, not found, bad input, network failure', async () => {
  const calls = []
  const found = await lookupBarcode('9300 6336 03024', opts((url, init) => { calls.push([url, init]); return res(200, { status: 1, product: PRODUCT }) }))
  assert.equal(found.ref, '9300633603024')
  assert.match(calls[0][0], /\/api\/v2\/product\/9300633603024\.json\?fields=/)
  assert.equal(calls[0][1].headers['X-User-Agent'], APP_ID)
  assert.match(APP_ID, /^PowerLevel\/[\d.]+ \(.+\)$/)
  assert.equal(await lookupBarcode('9300633603024', opts(() => res(200, { status: 0 }))), null)
  await assert.rejects(lookupBarcode('123', opts(() => res(200, {}))), e => e.kind === 'bad')
  await assert.rejects(lookupBarcode('9300633603024', opts(() => Promise.reject(new TypeError('Failed to fetch')))), e => e.kind === 'network')
  await assert.rejects(lookupBarcode('9300633603024', opts(() => res(503, {}))), e => e.kind === 'busy')
  assert.ok(validBarcode('12345678') && !validBarcode('1234567'))
})

test('a failed request is retried once, then gives up', async () => {
  let n = 0
  const flaky = () => (++n === 1 ? Promise.reject(new TypeError('Failed to fetch')) : res(200, { status: 1, product: PRODUCT }))
  assert.equal((await lookupBarcode('9300633603024', opts(flaky))).ref, '9300633603024')
  assert.equal(n, 2)
  let m = 0
  await assert.rejects(lookupBarcode('9300633603024', opts(() => { m++; return res(503, {}) })), e => e.kind === 'busy')
  assert.equal(m, 2)
  // A "not a barcode" mistake isn't retried.
  let k = 0
  await assert.rejects(lookupBarcode('12', opts(() => { k++ })), e => e.kind === 'bad')
  assert.equal(k, 0)
})

test('name search uses the classic endpoint and keeps only complete products', async () => {
  const urls = []
  const list = await searchProducts('tim tams', opts(url => {
    urls.push(url)
    return res(200, { products: [{ ...PRODUCT, brands: 'Arnott’s', product_name: 'Tim Tam' }, { code: '2', product_name: 'No data', nutriments: {} }] })
  }))
  assert.equal(urls.length, 1)
  assert.match(urls[0], /\/cgi\/search\.pl\?search_terms=tim%20tams&/)
  assert.deepEqual(list.map(f => f.name), ['Arnott’s Tim Tam'])
  // Cached: no further calls for the same term.
  await searchProducts('Tim Tams ', opts(() => { throw new Error('should be cached') }))
  assert.deepEqual(await searchProducts('ab', opts(() => { throw new Error('too short') })), [])
})

test('fibre and sodium: AFCD rows carry them, totals count only foods that list them', async () => {
  const { sumEntries, macrosFor, extraTargets } = await import('../js/nutrition.js')
  const oats = AFCD.find(f => f.name === 'Oats, rolled, uncooked')
  assert.ok(oats.fib > 5 && oats.na >= 0)
  const m = macrosFor(oats, 50)
  assert.equal(m.fib, Math.round(oats.fib * 5) / 10)
  const t = sumEntries([m, { kcal: 100, p: 1, c: 1, f: 1 }])
  assert.equal(t.fib, m.fib)
  assert.equal(t.unknown, 1)
  assert.deepEqual(extraTargets({ sex: 'female' }), { fib: 25, na: 2000 })
  assert.deepEqual(extraTargets({ sex: 'male' }), { fib: 30, na: 2000 })
})

test('Open Food Facts fibre and sodium: sodium in g becomes mg, salt is used when sodium is missing', async () => {
  const { productToFood } = await import('../js/off.js')
  const base = { code: '9300000000000', product_name: 'Muesli', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 10 } }
  const a = productToFood({ ...base, nutriments: { ...base.nutriments, fiber_100g: 8.24, sodium_100g: 0.12 } })
  assert.deepEqual([a.fib, a.na], [8.2, 120])
  const b = productToFood({ ...base, nutriments: { ...base.nutriments, salt_100g: 1 } })
  assert.equal(b.na, 400)
  const c = productToFood(base)
  assert.equal('fib' in c || 'na' in c, false)
})
