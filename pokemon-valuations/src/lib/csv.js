// Minimal CSV read/write -- handles quoted fields containing commas, quotes,
// or newlines so card/set names with commas in them don't corrupt a round trip.

export function toCsv(rows, columns) {
  const escape = v => {
    const s = String(v ?? "")
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [columns.join(",")]
  for (const row of rows) lines.push(columns.map(c => escape(row[c])).join(","))
  return lines.join("\r\n")
}

export function parseCsv(text) {
  const rows = []
  let field = "", row = [], inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === ',') { row.push(field); field = ""; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; continue }
    field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  if (rows.length === 0) return []

  const header = rows[0].map(h => h.trim())
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ""))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])))
}
