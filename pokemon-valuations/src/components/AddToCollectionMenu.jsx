import { useState, useRef, useEffect } from 'react'
import { useCollections } from '../lib/store.jsx'
import { cardKey } from '../lib/cardKey.js'

export default function AddToCollectionMenu({ card }) {
  const { collections, wishlist, addCardToCollection, toggleWishlist, createCollection } = useCollections()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const ref = useRef(null)
  const key = cardKey(card)
  const inWishlist = wishlist.some(w => w.key === key)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  function handleCreateAndAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const id = createCollection(name)
    addCardToCollection(id, card)
    setNewName("")
    setOpen(false)
  }

  return (
    <div className="add-menu" ref={ref}>
      <button className="add-menu-btn" onClick={() => setOpen(o => !o)}>+ Add</button>
      {open && (
        <div className="add-menu-panel">
          <button className={"add-menu-item" + (inWishlist ? " active" : "")} onClick={() => { toggleWishlist(card); setOpen(false) }}>
            {inWishlist ? "★ In Wishlist" : "☆ Add to Wishlist"}
          </button>
          {collections.length > 0 && <div className="add-menu-sep" />}
          {collections.map(c => (
            <button key={c.id} className="add-menu-item" onClick={() => { addCardToCollection(c.id, card); setOpen(false) }}>
              + {c.name}
            </button>
          ))}
          <div className="add-menu-sep" />
          <form onSubmit={handleCreateAndAdd} className="add-menu-new">
            <input type="text" placeholder="New collection…" value={newName} onChange={e => setNewName(e.target.value)} />
            <button type="submit">Add</button>
          </form>
        </div>
      )}
    </div>
  )
}
