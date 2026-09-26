import { NavLink } from 'react-router-dom'
import { useCollections } from '../lib/store.jsx'
import { isAlertTriggered } from '../lib/shared.jsx'

export default function NavBar({ cardByKey }) {
  const { wishlist } = useCollections()
  const alertCount = wishlist.filter(w => {
    const live = cardByKey.get(w.key)
    const price = live ? live.price : w.addedPrice
    return isAlertTriggered(w, price)
  }).length

  const linkClass = ({ isActive }) => "nav-link" + (isActive ? " active" : "")
  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <NavLink to="/" end className="nav-brand">Valuation Browser</NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/search" className={linkClass}>Search</NavLink>
          <NavLink to="/collections" className={linkClass}>Collections</NavLink>
          <NavLink to="/wishlist" className={linkClass}>
            Wishlist
            {alertCount > 0 && <span className="nav-alert-badge">{alertCount}</span>}
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
