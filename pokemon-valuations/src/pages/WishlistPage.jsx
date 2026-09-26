import { useState, useEffect, useMemo } from 'react'
import { useCollections } from '../lib/store.jsx'
import { fmtMoney, isAlertTriggered } from '../lib/shared.jsx'

function AlertPriceInput({ value, onCommit }) {
  const [text, setText] = useState(value != null ? String(value) : "")
  useEffect(() => { setText(value != null ? String(value) : "") }, [value])

  function commit() {
    const num = parseFloat(text)
    onCommit(Number.isFinite(num) && num > 0 ? num : null)
  }

  return (
    <input
      type="number" step="0.01" min="0" placeholder="Set target…"
      className="alert-price-input"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur() }}
    />
  )
}

export default function WishlistPage({ data, cardByKey, onPickHistory }) {
  const { wishlist, toggleWishlist, setWishlistAlert } = useCollections()
  const [query, setQuery] = useState("")

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return data.filter(d => d.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, data])

  const rows = wishlist
    .map(entry => {
      const live = cardByKey.get(entry.key)
      const price = live ? live.price : entry.addedPrice
      return {
        ...entry,
        price,
        image_small: live ? live.image_small : entry.image_small,
        live,
        triggered: isAlertTriggered(entry, price),
      }
    })
    // Cards whose alert just fired float to the top -- that's the whole point
    // of "alerts" on a site with no way to push a notification to you.
    .sort((a, b) => (b.triggered - a.triggered))

  const total = rows.reduce((sum, r) => sum + r.price, 0)
  const triggeredCount = rows.filter(r => r.triggered).length

  return (
    <>
      <header>
        <p className="eyebrow">{rows.length} card{rows.length === 1 ? "" : "s"} on your wishlist</p>
        <h1>Wishlist</h1>
        <p className="subtitle">
          Cards you want, kept separate from what you actually own. Set a target price on any card and it'll surface
          here (and as a badge on the Wishlist tab) once the market price drops to meet it.
        </p>
        <div className="stat-row">
          <div className="stat"><div className="n num">${total.toFixed(2)}</div><div className="l">total if bought today</div></div>
          <div className={"stat" + (triggeredCount > 0 ? " under" : "")}>
            <div className="n num">{triggeredCount}</div><div className="l">alerts triggered</div>
          </div>
        </div>
      </header>

      <div className="page-body">
        <div className="add-card-search">
          <input type="text" placeholder="Search a card to add…" value={query} onChange={e => setQuery(e.target.value)} />
          {matches.length > 0 && (
            <div className="add-card-results">
              {matches.map(d => (
                <button key={d.set + "|" + d.number} className="add-card-result" onClick={() => { toggleWishlist(d); setQuery("") }}>
                  <span>{d.name}</span>
                  <span className="add-card-result-set">{d.set}</span>
                  <span className="num">{fmtMoney(d.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">Nothing here yet — search above to add cards you're hoping to get.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Card</th><th>Set</th><th className="num-col">Price</th>
                  <th className="num-col">Alert At</th><th></th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key} className={r.triggered ? "wishlist-row-triggered" : undefined}>
                    <td className="name">
                      <div className="card-name-cell">
                        {r.image_small && <img src={r.image_small} alt="" className="card-thumb" loading="lazy" onError={e => { e.target.style.display = "none" }} />}
                        <span onClick={() => r.live && onPickHistory(r.live)} style={{ cursor: r.live ? "pointer" : "default" }}>{r.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '12.5px' }}>{r.set}</td>
                    <td className="num-col num">{fmtMoney(r.price)}</td>
                    <td className="num-col">
                      <AlertPriceInput value={r.alertPrice} onCommit={v => setWishlistAlert(r.key, v)} />
                    </td>
                    <td>
                      {r.triggered && <span className="alert-badge">🔔 Target hit</span>}
                    </td>
                    <td><button className="row-remove" onClick={() => toggleWishlist(r)}>Remove</button></td>
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
