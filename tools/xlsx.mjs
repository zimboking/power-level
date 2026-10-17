// Minimal .xlsx reader for build scripts: no dependencies, just enough of the zip and
// SpreadsheetML formats to read plain cell values. Handles stored and deflated entries,
// shared strings and inline strings. Not a general spreadsheet library.
import { inflateRawSync } from 'node:zlib'

function unzip(buf) {
  // Find the end-of-central-directory record (scan back over any trailing comment).
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('not a zip file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = {}
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory')
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    files[name] = () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const raw = buf.subarray(start, start + size)
      if (method === 0) return raw
      if (method === 8) return inflateRawSync(raw)
      throw new Error(`unsupported zip method ${method} for ${name}`)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENTITIES[e] ?? m))
// All <t> text inside a fragment (rich text splits a string over several runs).
const texts = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join('')

// Column letters to a 0-based index: A → 0, Z → 25, AA → 26.
export const colIndex = ref => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

// Returns { sheetName: rows[][] } with each row an array of strings (missing cells are '').
export function readXlsx(buf) {
  const files = unzip(buf)
  const read = name => files[name]?.().toString('utf8')
  const shared = [...(read('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]))
  const rels = Object.fromEntries([...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map(m => [
    m[0].match(/Id="([^"]+)"/)[1], m[0].match(/Target="([^"]+)"/)[1].replace(/^\/?(xl\/)?/, 'xl/'),
  ]))
  const out = {}
  for (const m of read('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = decode(m[0].match(/name="([^"]+)"/)[1])
    const xml = read(rels[m[0].match(/r:id="([^"]+)"/)[1]])
    if (!xml) continue
    const rows = []
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row = []
      for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = c[1].match(/r="([A-Z]+\d+)"/)?.[1]
        const type = c[1].match(/t="([^"]+)"/)?.[1]
        const body = c[2] || ''
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        const val = type === 's' ? shared[+v] : type === 'inlineStr' ? texts(body) : v != null ? decode(v) : ''
        const at = ref ? colIndex(ref) : row.length
        while (row.length < at) row.push('')
        row[at] = val ?? ''
      }
      rows.push(row)
    }
    out[name] = rows
  }
  return out
}
