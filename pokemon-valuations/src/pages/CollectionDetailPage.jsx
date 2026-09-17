import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCollections } from '../lib/store.jsx'
import { fmtMoney } from '../lib/shared.jsx'

export default function CollectionDetailPage({ data, cardByKey, onPickHistory }) {
  const { id } = useParams()
  const { collections, addCardToCollection, setCardQuantity, removeCardFromCollection } = useCollections()
  const collection = collections.find(c => c.id === id)
  const [query, setQuery] = useState("")

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
