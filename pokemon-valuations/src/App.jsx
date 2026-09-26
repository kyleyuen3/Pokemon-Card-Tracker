import { useState, useEffect, useMemo } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import HomePage from './pages/HomePage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import CollectionsPage from './pages/CollectionsPage.jsx'
import CollectionDetailPage from './pages/CollectionDetailPage.jsx'
import WishlistPage from './pages/WishlistPage.jsx'
import { CollectionsProvider } from './lib/store.jsx'
import { PriceHistoryModal } from './lib/shared.jsx'
import { cardKey } from './lib/cardKey.js'

// Keying on the path forces a remount on every navigation, which is what
// re-triggers the CSS entrance animation (see .page-transition) each time --
// a plain re-render wouldn't replay it.
function AnimatedRoutes({ data, payload, cardByKey, onPickHistory }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<HomePage data={data} payload={payload} onPickHistory={onPickHistory} />} />
        <Route path="/search" element={<SearchPage data={data} payload={payload} onPickHistory={onPickHistory} />} />
        <Route path="/collections" element={<CollectionsPage cardByKey={cardByKey} />} />
        <Route path="/collections/:id" element={<CollectionDetailPage data={data} cardByKey={cardByKey} onPickHistory={onPickHistory} />} />
        <Route path="/wishlist" element={<WishlistPage data={data} cardByKey={cardByKey} onPickHistory={onPickHistory} />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [payload, setPayload] = useState(null)
  const [historyCard, setHistoryCard] = useState(null)

  useEffect(() => {
    fetch('/cards_data.json').then(r => r.json()).then(setPayload)
  }, [])

  // Defensive: until the daily workflow has run at least once against this
  // branch, public/cards_data.json may still be in the old plain-array shape
  // from before automated tracking. Support both so the site never gets
  // stuck on "Loading card data…" in the interim.
  const data = payload ? (Array.isArray(payload) ? payload : payload.cards) : null

  // Lets Collections/Wishlist always show a card's live price/image instead
  // of whatever it was when the card got added, without needing to carry
  // the whole dataset around wherever a saved card is displayed.
  const cardByKey = useMemo(() => {
    const map = new Map()
    if (data) for (const d of data) map.set(cardKey(d), d)
    return map
  }, [data])

  if (!data) return <div className="loading-state">Loading card data…</div>

  return (
    <CollectionsProvider>
      <HashRouter>
        <NavBar cardByKey={cardByKey} />
        <AnimatedRoutes data={data} payload={payload} cardByKey={cardByKey} onPickHistory={setHistoryCard} />

        {historyCard && <PriceHistoryModal card={historyCard} onClose={() => setHistoryCard(null)} />}
      </HashRouter>
    </CollectionsProvider>
  )
}
