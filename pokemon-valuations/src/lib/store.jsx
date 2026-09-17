import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { cardKey } from './cardKey.js'

const STORAGE_KEY = 'pokemon-tracker-v1'
const CollectionsContext = createContext(null)

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        collections: Array.isArray(parsed.collections) ? parsed.collections : [],
        wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
      }
    }
  } catch {
    // Corrupt JSON or storage blocked (private browsing, etc.) -- start fresh
    // rather than crash the whole app over saved collections.
  }
  return { collections: [], wishlist: [] }
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(36).slice(2)
}

// What gets stored per card: enough to render it even if the daily data
// refresh ever drops that card, plus the price at the moment it was added as
// a fallback for that same case. Live price/image always win when the card
// still resolves in the current dataset (see cardByKey in App.jsx).
function snapshot(d) {
  return { key: cardKey(d), set: d.set, number: d.number, name: d.name, rarity: d.rarity, image_small: d.image_small || null, addedPrice: d.price }
}

export function CollectionsProvider({ children }) {
  const [state, setState] = useState(loadInitial)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage unavailable -- collections still work for this session, just won't persist.
    }
  }, [state])

  const createCollection = useCallback((name) => {
    const id = makeId()
    setState(s => ({ ...s, collections: [...s.collections, { id, name, cards: [] }] }))
    return id
  }, [])

  const renameCollection = useCallback((id, name) => {
    setState(s => ({ ...s, collections: s.collections.map(c => c.id === id ? { ...c, name } : c) }))
  }, [])

  const deleteCollection = useCallback((id) => {
    setState(s => ({ ...s, collections: s.collections.filter(c => c.id !== id) }))
  }, [])

  const addCardToCollection = useCallback((collectionId, d) => {
    const key = cardKey(d)
    setState(s => ({
      ...s,
      collections: s.collections.map(c => {
        if (c.id !== collectionId) return c
        const existing = c.cards.find(x => x.key === key)
        if (existing) {
          return { ...c, cards: c.cards.map(x => x.key === key ? { ...x, quantity: x.quantity + 1 } : x) }
        }
        return { ...c, cards: [...c.cards, { ...snapshot(d), quantity: 1 }] }
      })
    }))
  }, [])

  const setCardQuantity = useCallback((collectionId, key, quantity) => {
    setState(s => ({
      ...s,
      collections: s.collections.map(c => {
        if (c.id !== collectionId) return c
        if (quantity <= 0) return { ...c, cards: c.cards.filter(x => x.key !== key) }
        return { ...c, cards: c.cards.map(x => x.key === key ? { ...x, quantity } : x) }
      })
    }))
  }, [])

  const removeCardFromCollection = useCallback((collectionId, key) => {
    setState(s => ({
      ...s,
      collections: s.collections.map(c => c.id === collectionId ? { ...c, cards: c.cards.filter(x => x.key !== key) } : c)
    }))
  }, [])

  const toggleWishlist = useCallback((d) => {
    const key = cardKey(d)
    setState(s => {
      const exists = s.wishlist.some(x => x.key === key)
      return { ...s, wishlist: exists ? s.wishlist.filter(x => x.key !== key) : [...s.wishlist, snapshot(d)] }
    })
  }, [])

  const value = {
    collections: state.collections,
    wishlist: state.wishlist,
    createCollection,
    renameCollection,
    deleteCollection,
    addCardToCollection,
    setCardQuantity,
    removeCardFromCollection,
    toggleWishlist,
  }

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>
}

export function useCollections() {
  const ctx = useContext(CollectionsContext)
  if (!ctx) throw new Error('useCollections must be used within a CollectionsProvider')
  return ctx
}
