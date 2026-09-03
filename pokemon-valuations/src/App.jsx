import { useState, useEffect, useMemo } from 'react'

const RARITY_ORDER = ["Common","Uncommon","Rare","Double Rare","Ultra Rare","ACE SPEC Rare","Illustration Rare","Special Illustration Rare","Hyper Rare"]
const RARITY_CLASS = {
  "Common":"r-common","Uncommon":"r-uncommon","Rare":"r-rare","Double Rare":"r-dr",
  "Ultra Rare":"r-ur","ACE SPEC Rare":"r-ace","Illustration Rare":"r-ir","Special Illustration Rare":"r-sir","Hyper Rare":"r-hr"
}
const RARITY_SHORT = {
  "Common":"Common","Uncommon":"Uncommon","Rare":"Rare","Double Rare":"Double Rare",
  "Ultra Rare":"Ultra Rare","ACE SPEC Rare":"ACE SPEC","Illustration Rare":"IR","Special Illustration Rare":"SIR","Hyper Rare":"Hyper Rare"
}
// Set list and page size are derived from the loaded data at runtime, so the
// catalog covering the whole card game (not just a handful of hand-picked
// sets) never requires touching this file.
const PAGE_SIZE = 100

function fmtMoney(v) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  return '$' + v.toFixed(2)
}

function VerdictBadge({ verdict }) {
  if (verdict === "OVERVALUED") return <span className="verdict-badge v-over">▲ Overvalued</span>
  if (verdict === "UNDERVALUED") return <span className="verdict-badge v-under">▼ Undervalued</span>
  return <span className="verdict-badge v-fair">Fair</span>
}

function ResidBar({ residual }) {
  const clamped = Math.max(-1.5, Math.min(1.5, residual))
  const pct = Math.abs(clamped) / 1.5 * 50
  const color = residual >= 0 ? "var(--over)" : "var(--under)"
  const left = residual >= 0 ? "50%" : (50 - pct) + "%"
  return (
    <div className="resid-bar-wrap">
      <div className="resid-bar" style={{ left, width: pct + '%', background: color }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--text-faint)', opacity: 0.4 }} />
    </div>
  )
}

function PctChange({ value }) {
  if (value === null || value === undefined) return <span className="num" style={{ color: 'var(--text-faint)' }}>—</span>
  if (value === 0) return <span className="num" style={{ color: 'var(--text-dim)' }}>0.0%</span>
  const up = value > 0
  const color = up ? "var(--under)" : "var(--over)"
  return <span className="num" style={{ color }}>{up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%</span>
}

function Sparkline({ points }) {
  if (!points || points.length < 2) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  const w = 64, h = 22, pad = 2
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const stepX = (w - pad * 2) / (points.length - 1)
  const coords = points.map((p, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (p - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const up = points[points.length - 1] >= points[0]
  const color = up ? "var(--under)" : "var(--over)"
  return (
    <svg width={w} height={h} className="sparkline">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export default function App() {
  const [payload, setPayload] = useState(null)
  const [search, setSearch] = useState("")
  const [set, setSet] = useState("ALL")
  const [rarity, setRarity] = useState("ALL")
  const [verdict, setVerdict] = useState("ALL")
  const [sortKey, setSortKey] = useState("residual_log")
  const [sortDir, setSortDir] = useState(-1)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/cards_data.json').then(r => r.json()).then(setPayload)
  }, [])

  // Defensive: until the daily workflow has run at least once against this
  // branch, public/cards_data.json may still be in the old plain-array shape
  // from before automated tracking. Support both so the site never gets
  // stuck on "Loading card data…" in the interim.
  const data = payload ? (Array.isArray(payload) ? payload : payload.cards) : null

  const setOrder = useMemo(() => {
    if (!data) return []
    const counts = {}
    for (const d of data) counts[d.set] = (counts[d.set] || 0) + 1
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
  }, [data])

  const rarityOrder = useMemo(() => {
    if (!data) return RARITY_ORDER
    const known = new Set(RARITY_ORDER)
    const extra = [...new Set(data.map(d => d.rarity))].filter(r => r && !known.has(r)).sort()
    return [...RARITY_ORDER, ...extra]
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter(d => {
      if (set !== "ALL" && d.set !== set) return false
      if (rarity !== "ALL" && d.rarity !== rarity) return false
      if (verdict !== "ALL" && d.verdict !== verdict) return false
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [data, set, rarity, verdict, search])

  const sorted = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (av === null || av === undefined) av = -Infinity
      if (bv === null || bv === undefined) bv = -Infinity
      if (typeof av === "string") return av.localeCompare(bv) * sortDir
      return (av - bv) * sortDir
    })
  }, [filtered, sortKey, sortDir])

  useEffect(() => { setPage(1) }, [set, rarity, verdict, search, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(key === "name" ? 1 : -1) }
  }

  if (!data) return <div className="loading-state">Loading card data…</div>

  const underCount = data.filter(d => d.verdict === "UNDERVALUED").length
  const overCount = data.filter(d => d.verdict === "OVERVALUED").length
  const topPrice = Math.max(...data.map(d => d.price))
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns = [
    { key: "name", label: "Card" },
    { key: "set", label: "Set" },
    { key: "rarity", label: "Rarity" },
    { key: "hp", label: "HP", num: true },
    { key: "pull_cost", label: "Pull Cost", num: true },
    { key: "price", label: "Price", num: true },
    { key: "pct_change_7d", label: "7d", num: true },
    { key: "pct_change_30d", label: "30d", num: true },
    { key: "sparkline", label: "Trend", sortable: false },
    { key: "predicted_price", label: "Model Fair Value", num: true },
    { key: "residual_log", label: "Signal" },
    { key: "verdict", label: "Verdict" },
  ]

  return (
    <>
      <header>
        <p className="eyebrow">
          {setOrder.length} sets · {data.length} cards tracked
          {payload.latest_price_date && ` · prices as of ${payload.latest_price_date}`}
        </p>
        <h1>Valuation Browser</h1>
        <p className="subtitle">
          Fair-value model fit within each set's own rarity tiers, cross-checked against TCGplayer market price and
          Cardmarket (EUR) trend price. Prices are pulled automatically once a day. Click any column to sort.
        </p>
        <div className="stat-row">
          <div className="stat"><div className="n num">{data.length}</div><div className="l">cards tracked</div></div>
          <div className="stat under"><div className="n num">{underCount}</div><div className="l">undervalued</div></div>
          <div className="stat over"><div className="n num">{overCount}</div><div className="l">overvalued</div></div>
          <div className="stat"><div className="n num">${topPrice.toFixed(0)}</div><div className="l">priciest card</div></div>
        </div>
      </header>

      <div className="controls">
        <div className="filter-group">
          <label className="filter-label">Search</label>
          <input type="text" placeholder="Card name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label">Set</label>
          <select className="filter-select" value={set} onChange={e => setSet(e.target.value)}>
            <option value="ALL">All sets ({setOrder.length})</option>
            {setOrder.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Rarity</label>
          <select className="filter-select" value={rarity} onChange={e => setRarity(e.target.value)}>
            <option value="ALL">All rarities ({rarityOrder.length})</option>
            {rarityOrder.map(r => <option key={r} value={r}>{RARITY_SHORT[r] || r}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Verdict</label>
          <div className="chip-group">
            {["ALL", "UNDERVALUED", "OVERVALUED", "fair"].map(v => (
              <div key={v} className={"chip" + (verdict === v ? " active" : "")} onClick={() => setVerdict(v)}>
                {v === "ALL" ? "All" : v === "fair" ? "Fair" : v[0] + v.slice(1).toLowerCase()}
              </div>
            ))}
          </div>
        </div>
        <div className="spacer" />
        <div className="count-label">{sorted.length} shown</div>
      </div>

      <table>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={(c.num ? "num-col " : "") + (sortKey === c.key ? "sorted" : "")}
                  onClick={() => c.sortable === false ? null : handleSort(c.key)}
                  style={c.sortable === false ? { cursor: "default" } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map(d => (
            <tr key={d.set + "-" + d.number}>
              <td className="name"><span className="card-num num">#{d.number}</span>{d.name}</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '12.5px' }}>{d.set}</td>
              <td><span className={"rarity-chip " + (RARITY_CLASS[d.rarity] || "r-common")}>{RARITY_SHORT[d.rarity] || d.rarity}</span></td>
              <td className="num-col num">{d.hp > 0 ? d.hp : "—"}</td>
              <td className="num-col num">
                {d.pull_cost !== null ? "$" + d.pull_cost.toLocaleString() : <span style={{ color: 'var(--text-faint)' }}>—</span>}
              </td>
              <td className="num-col num">
                {fmtMoney(d.price)}
                {d.cardmarket_price_eur != null &&
                  <div className="cardmarket-line">€{d.cardmarket_price_eur.toFixed(2)} Cardmarket</div>}
              </td>
              <td className="num-col"><PctChange value={d.pct_change_7d} /></td>
              <td className="num-col"><PctChange value={d.pct_change_30d} /></td>
              <td><Sparkline points={d.sparkline} /></td>
              <td className="num-col num">{fmtMoney(d.predicted_price)}</td>
              <td><ResidBar residual={d.residual_log} /></td>
              <td><VerdictBadge verdict={d.verdict} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="empty-state">No cards match your filters.</div>}

      {sorted.length > 0 &&
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      }

      <footer>
        Prices are point-in-time market snapshots, not appraisals or investment advice. "Model Fair Value" comes from a
        linear regression fit separately within each set's own rarity tiers on HP, ex-status, and a subjective popularity score.
        Pull costs use TCGplayer Authentication Center's verified specific-pull-odds at $5/pack MSRP — verified only for
        Prismatic Evolutions so far; every other set shows no pull cost until that's sourced.
        7d/30d change and the trend sparkline come from a daily automated pull of TCGplayer market prices (and Cardmarket
        EUR trend prices where available) via the pokemontcg.io API — those fields fill in as more days accumulate.
        {payload.generated_at && ` Data last refreshed ${new Date(payload.generated_at).toLocaleString()}.`}
      </footer>
    </>
  )
}
