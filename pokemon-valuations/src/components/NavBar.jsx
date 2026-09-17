import { NavLink } from 'react-router-dom'

export default function NavBar() {
  const linkClass = ({ isActive }) => "nav-link" + (isActive ? " active" : "")
  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <NavLink to="/" end className="nav-brand">Valuation Browser</NavLink>
        <div className="nav-links">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/search" className={linkClass}>Search</NavLink>
          <NavLink to="/collections" className={linkClass}>Collections</NavLink>
          <NavLink to="/wishlist" className={linkClass}>Wishlist</NavLink>
        </div>
      </div>
    </nav>
  )
}
