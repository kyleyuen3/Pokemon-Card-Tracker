import { Link } from 'react-router-dom'
import { TrendingGrid } from '../lib/shared.jsx'

export default function HomePage({ data, payload, onPickHistory }) {
  const underCount = data.filter(d => d.verdict === "UNDERVALUED").length
  const overCount = data.filter(d => d.verdict === "OVERVALUED").length
  const topPrice = Math.max(...data.map(d => d.price))
  const totalSetCount = new Set(data.map(d => d.set)).size

  return (
    <>
      <header>
        <p className="eyebrow">
          {totalSetCount} sets · {data.length} cards tracked
          {payload.latest_price_date && ` · prices as of ${payload.latest_price_date}`}
        </p>
        <h1>Valuation Browser</h1>
        <p className="subtitle">
          Fair-value model fit within each set's own rarity tiers, cross-checked against TCGplayer market price and
          Cardmarket (EUR) trend price. Prices are pulled automatically once a day.
        </p>
        <div className="stat-row">
          <div className="stat"><div className="n num">{data.length}</div><div className="l">cards tracked</div></div>
          <div className="stat under"><div className="n num">{underCount}</div><div className="l">undervalued</div></div>
          <div className="stat over"><div className="n num">{overCount}</div><div className="l">overvalued</div></div>
          <div className="stat"><div className="n num">${topPrice.toFixed(0)}</div><div className="l">priciest card</div></div>
        </div>
        <div className="home-cta">
          <Link to="/search" className="btn-primary">Search the full catalog →</Link>
        </div>
      </header>

      <TrendingGrid data={data} onPick={onPickHistory} />
    </>
  )
}
