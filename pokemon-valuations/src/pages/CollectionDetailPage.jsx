import { useState, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCollections } from '../lib/store.jsx'
import { fmtMoney } from '../lib/shared.jsx'
import { cardKey } from '../lib/cardKey.js'
import { toCsv, parseCsv } from '../lib/csv.js'

const CSV_COLUMNS = ["Set", "Number", "Name", "Rarity", "Quantity", "Price", "Subtotal"]

export default function CollectionDetailPage({ data, cardByKey, onPickHistory }) {
  const { id } = useParams()
  const { collections, addCardToCollection, setCardQuantity, removeCardFromCollection, importCardsToCollection } = useCollections()
  const collection = collections.find(c => c.id === id)
  const [query, setQuery] = useState("")
  const [importSummary, setImportSummary] = useState(null)
  const fileInputRef = useRef(null)

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return data.filter(d => d.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, data])

  if (!collection) {
    return (
      <>
        <header><h1>Collection not found</h1></header>
        <div className="page-body">
          <div className="empty-state"><Link to="/collections">← Back to Collections</Link></div>
        </div>
      </>
    )
  }

  const rows = collection.cards.map(entry => {
    const live = cardByKey.get(entry.key)
    return {
      ...entry,
      price: live ? live.price : entry.addedPrice,
      image_small: live ? live.image_small : entry.image_small,
      live,
    }
  })
  const total = rows.reduce((sum, r) => sum + r.price * r.quantity, 0)
  const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0)

  function handleExport() {
    const csv = toCsv(rows.map(r => ({
      Set: r.set, Number: r.number, Name: r.name, Rarity: r.rarity,
      Quantity: r.quantity, Price: r.price.toFixed(2), Subtotal: (r.price * r.quantity).toFixed(2),
    })), CSV_COLUMNS)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${collection.name.replace(/[^a-z0-9]+/gi, "_") || "collection"}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Matches each CSV row to a real card: an exact set+number+name match first
  // (what our own export produces, so re-importing it round-trips exactly),
  // falling back to set+number alone, then to name alone -- but only when
  // that fallback resolves to exactly one card, since guessing wrong would
  // silently add the wrong card to someone's collection.
  function resolveImportRow(row) {
    const set = row.Set || row.set || ""
    const number = row.Number || row.number || ""
    const name = row.Name || row.name || ""

    if (set && number && name) {
      const exact = cardByKey.get(cardKey({ set, number, name }))
      if (exact) return exact
    }
    if (set && number) {
      const candidates = data.filter(d => d.set.toLowerCase() === set.toLowerCase() && String(d.number) === String(number))
      if (candidates.length === 1) return candidates[0]
    }
    if (name) {
      const candidates = data.filter(d => d.name.toLowerCase() === name.toLowerCase())
      if (candidates.length === 1) return candidates[0]
    }
    return null
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsedRows = parseCsv(String(reader.result))
      const matched = []
      const unmatched = []
      for (const row of parsedRows) {
        const card = resolveImportRow(row)
        if (card) {
          const qty = parseInt(row.Quantity || row.quantity, 10)
          matched.push({ card, quantity: Number.isFinite(qty) && qty > 0 ? qty : 1 })
        } else {
          unmatched.push(row.Name || row.name || `${row.Set || ""} #${row.Number || "?"}`)
        }
      }
      if (matched.length > 0) importCardsToCollection(collection.id, matched)
      const parts = [`Imported ${matched.length} card${matched.length === 1 ? "" : "s"}`]
      if (unmatched.length > 0) {
        parts.push(`${unmatched.length} row${unmatched.length === 1 ? "" : "s"} not found (${unmatched.slice(0, 5).join(", ")}${unmatched.length > 5 ? "…" : ""})`)
      }
      setImportSummary(parts.join(" · "))
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <>
      <header>
        <p className="eyebrow"><Link to="/collections">← All Collections</Link></p>
        <h1>{collection.name}</h1>
        <div className="stat-row">
          <div className="stat"><div className="n num">${total.toFixed(2)}</div><div className="l">total value</div></div>
          <div className="stat"><div className="n num">{totalQty}</div><div className="l">cards</div></div>
        </div>
      </header>

      <div className="page-body">
        <div className="add-card-search">
          <input type="text" placeholder="Search a card to add…" value={query} onChange={e => setQuery(e.target.value)} />
          {matches.length > 0 && (
            <div className="add-card-results">
              {matches.map(d => (
                <button key={d.set + "|" + d.number} className="add-card-result" onClick={() => { addCardToCollection(collection.id, d); setQuery("") }}>
                  <span>{d.name}</span>
                  <span className="add-card-result-set">{d.set}</span>
                  <span className="num">{fmtMoney(d.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="csv-actions">
          <button className="btn-secondary" onClick={handleExport} disabled={rows.length === 0}>⬇ Export CSV</button>
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>⬆ Import CSV</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: "none" }} />
        </div>
        {importSummary && <div className="import-summary">{importSummary}</div>}

        {rows.length === 0 ? (
          <div className="empty-state">No cards in this collection yet — search above to add some.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Card</th><th>Set</th><th className="num-col">Qty</th>
                  <th className="num-col">Price</th><th className="num-col">Subtotal</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key}>
                    <td className="name">
                      <div className="card-name-cell">
                        {r.image_small && <img src={r.image_small} alt="" className="card-thumb" loading="lazy" onError={e => { e.target.style.display = "none" }} />}
                        <span onClick={() => r.live && onPickHistory(r.live)} style={{ cursor: r.live ? "pointer" : "default" }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '12.5px' }}>{r.set}</td>
                    <td className="num-col">
                      <div className="qty-stepper">
                        <button onClick={() => setCardQuantity(collection.id, r.key, r.quantity - 1)} aria-label="Decrease quantity">−</button>
                        <span className="num">{r.quantity}</span>
                        <button onClick={() => setCardQuantity(collection.id, r.key, r.quantity + 1)} aria-label="Increase quantity">+</button>
                      </div>
                    </td>
                    <td className="num-col num">{fmtMoney(r.price)}</td>
                    <td className="num-col num">{fmtMoney(r.price * r.quantity)}</td>
                    <td><button className="row-remove" onClick={() => removeCardFromCollection(collection.id, r.key)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
