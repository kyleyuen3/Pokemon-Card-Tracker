import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollections } from '../lib/store.jsx'

function resolvePrice(entry, cardByKey) {
  const live = cardByKey.get(entry.key)
  return live ? live.price : entry.addedPrice
}

function collectionValue(collection, cardByKey) {
  return collection.cards.reduce((sum, entry) => sum + resolvePrice(entry, cardByKey) * entry.quantity, 0)
}

export default function CollectionsPage({ cardByKey }) {
  const { collections, createCollection, deleteCollection } = useCollections()
  const [name, setName] = useState("")

  function handleCreate(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createCollection(trimmed)
    setName("")
  }

  function handleDelete(e, id, collectionName) {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(`Delete "${collectionName}"? This can't be undone.`)) deleteCollection(id)
  }

  const overallTotal = collections.reduce((sum, c) => sum + collectionValue(c, cardByKey), 0)
  const overallCards = collections.reduce((sum, c) => sum + c.cards.reduce((n, x) => n + x.quantity, 0), 0)

  return (
    <>
      <header>
        <p className="eyebrow">{collections.length} collection{collections.length === 1 ? "" : "s"} · {overallCards} cards total</p>
        <h1>My Collections</h1>
        <p className="subtitle">
          Track what you actually own, split across as many collections as you want. Values update live with the daily price data.
        </p>
        <div className="stat-row">
          <div className="stat"><div className="n num">${overallTotal.toFixed(2)}</div><div className="l">total value, all collections</div></div>
          <div className="stat"><div className="n num">{overallCards}</div><div className="l">cards owned</div></div>
        </div>
      </header>

      <div className="page-body">
        <form className="new-collection-form" onSubmit={handleCreate}>
          <input type="text" placeholder="New collection name…" value={name} onChange={e => setName(e.target.value)} />
          <button type="submit" className="btn-primary">+ Create Collection</button>
        </form>

        {collections.length === 0 ? (
          <div className="empty-state">No collections yet — create one above to start tracking cards you own.</div>
        ) : (
          <div className="collection-grid">
            {collections.map(c => {
              const value = collectionValue(c, cardByKey)
              const qty = c.cards.reduce((n, x) => n + x.quantity, 0)
              return (
                <Link to={`/collections/${c.id}`} key={c.id} className="collection-card">
                  <button className="collection-delete" onClick={e => handleDelete(e, c.id, c.name)} aria-label={`Delete ${c.name}`}>×</button>
                  <div className="collection-card-name">{c.name}</div>
                  <div className="collection-card-stats">
                    <span>{qty} card{qty === 1 ? "" : "s"}</span>
                    <span className="num">${value.toFixed(2)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
