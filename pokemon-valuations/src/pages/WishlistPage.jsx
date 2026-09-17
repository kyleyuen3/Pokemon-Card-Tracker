import { useState, useMemo } from 'react'
import { useCollections } from '../lib/store.jsx'
import { fmtMoney } from '../lib/shared.jsx'

export default function WishlistPage({ data, cardByKey, onPickHistory }) {
  const { wishlist, toggleWishlist } = useCollections()
  const [query, setQuery] = useState("")

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return data.filter(d => d.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, data])

  const rows = wishlist.map(entry => {
    const live = cardByKey.get(entry.key)
    return {
      ...entry,
      price: live ? live.price : entry.addedPrice,
      image_small: live ? live.image_small : entry.image_small,
      live,
    }
  })
  const total = rows.reduce((sum, r) => sum + r.price, 0)

  return (
    <>
      <header>
        <p className="eyebrow">{rows.length} card{rows.length === 1 ? "" : "s"} on your wishlist</p>
        <h1>Wishlist</h1>
        <p className="subtitle">Cards you want, kept separate from what you actually own.</p>
        <div className="stat-row">
          <div className="stat"><div className="n num">${total.toFixed(2)}</div><div className="l">total if bought today</div></div>
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
              <thead><tr><th>Card</th><th>Set</th><th className="num-col">Price</th><th></th></tr></thead>
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
                    <td className="num-col num">{fmtMoney(r.price)}</td>
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
