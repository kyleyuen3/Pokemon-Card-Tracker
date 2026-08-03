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
// SET_ORDER is derived from the loaded data at runtime -- see setOrder below.
// This means adding a new set never requires touching this file.

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

export default function App() {
  const [data, setData] = useState(null)
  const [search, setSearch] = useState("")
  const [set, setSet] = useState("ALL")
  const [rarity, setRarity] = useState("ALL")
  const [verdict, setVerdict] = useState("ALL")
  const [sortKey, setSortKey] = useState("residual_log")
  const [sortDir, setSortDir] = useState(-1)

  useEffect(() => {
    fetch('/cards_data.json').then(r => r.json()).then(setData)
  }, [])

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

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(key === "name" ? 1 : -1) }
  }

  if (!data) return <div className="loading-state">Loading card data…</div>

  const setOrder = [...new Set(data.map(d => d.set))]

  const underCount = data.filter(d => d.verdict === "UNDERVALUED").length
  const overCount = data.filter(d => d.verdict === "OVERVALUED").length
  const topPrice = Math.max(...data.map(d => d.price))

  const columns = [
    { key: "name", label: "Card" },
    { key: "set", label: "Set" },
    { key: "rarity", label: "Rarity" },
    { key: "hp", label: "HP", num: true },
    { key: "pull_cost", label: "Pull Cost", num: true },
    { key: "tcgplayer_price", label: "TCGplayer", num: true },
    { key: "ebay_price", label: "eBay (PC)", num: true },
    { key: "predicted_price", label: "Model Fair Value", num: true },
    { key: "residual_log", label: "Signal" },
    { key: "verdict", label: "Verdict" },
  ]

  return (
    <>
      <header>
        <p className="eyebrow">3 sets · {data.length} cards</p>
        <h1>Valuation Browser</h1>
        <p className="subtitle">
          Fair-value model fit within each set's own rarity tiers, cross-checked against TCGplayer market price and,
          for Prismatic Evolutions, eBay-sourced (PriceCharting) sold comps. Click any column to sort.
        </p>
        <div className="stat-row">
          <div className="stat"><div className="n num">{data.length}</div><div className="l">cards tracked</div></div>
          <div className="stat under"><div className="n num">{underCount}</div><div className="l">undervalued</div></div>
          <div className="stat over"><div className="n num">{overCount}</div><div className="l">overvalued</div></div>
          <div className="stat"><div className="n num">${topPrice.toFixed(0)}</div><div className="l">priciest card</div></div>
        </div>
      </header>

      <div className="controls">
        <input type="text" placeholder="Search card name…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="chip-group">
          <div className={"chip" + (set === "ALL" ? " active" : "")} onClick={() => setSet("ALL")}>All sets</div>
          {setOrder.map(s => (
            <div key={s} className={"chip" + (set === s ? " active" : "")} onClick={() => setSet(s)}>{s}</div>
          ))}
        </div>
        <div className="chip-group">
          <div className={"chip" + (rarity === "ALL" ? " active" : "")} onClick={() => setRarity("ALL")}>All rarities</div>
          {RARITY_ORDER.map(r => (
            <div key={r} className={"chip" + (rarity === r ? " active" : "")} onClick={() => setRarity(r)}>
              {RARITY_SHORT[r]}
            </div>
          ))}
        </div>
        <div className="chip-group">
          {["ALL", "UNDERVALUED", "OVERVALUED", "fair"].map(v => (
            <div key={v} className={"chip" + (verdict === v ? " active" : "")} onClick={() => setVerdict(v)}>
              {v === "ALL" ? "All" : v === "fair" ? "Fair" : v[0] + v.slice(1).toLowerCase()}
            </div>
          ))}
        </div>
        <div className="spacer" />
        <div className="count-label">{sorted.length} shown</div>
      </div>

      <table>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={(c.num ? "num-col " : "") + (sortKey === c.key ? "sorted" : "")}
                  onClick={() => handleSort(c.key)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => {
            const disagreeClass = (d.source_disagreement_pct !== null && d.source_disagreement_pct > 20) ? "hi" : ""
            return (
              <tr key={d.set + "-" + d.number}>
                <td className="name"><span className="card-num num">#{d.number}</span>{d.name}</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '12.5px' }}>{d.set}</td>
                <td><span className={"rarity-chip " + (RARITY_CLASS[d.rarity] || "r-common")}>{RARITY_SHORT[d.rarity] || d.rarity}</span></td>
                <td className="num-col num">{d.hp > 0 ? d.hp : "—"}</td>
                <td className="num-col num">
                  {d.pull_cost !== null ? "$" + d.pull_cost.toLocaleString() : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                </td>
                <td className="num-col num">{fmtMoney(d.tcgplayer_price)}</td>
                <td className="num-col num">
                  {fmtMoney(d.ebay_price)}
                  {d.source_disagreement_pct !== null &&
                    <div className={"disagree " + disagreeClass}>{d.source_disagreement_pct.toFixed(0)}% spread</div>}
                </td>
                <td className="num-col num">{fmtMoney(d.predicted_price)}</td>
                <td><ResidBar residual={d.residual_log} /></td>
                <td><VerdictBadge verdict={d.verdict} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="empty-state">No cards match your filters.</div>}

      <footer>
        Prices are point-in-time market snapshots, not appraisals or investment advice. "Model Fair Value" comes from a
        linear regression fit separately within each set's own rarity tiers on HP, ex-status, and a subjective popularity score.
        Pull costs use TCGplayer Authentication Center's verified specific-pull-odds at $5/pack MSRP — verified only for
        Prismatic Evolutions so far; Journey Together and Destined Rivals show no pull cost until that's sourced.
        Likewise, the eBay/PriceCharting cross-check price only exists for Prismatic Evolutions right now.
        Data: TCGplayer market prices via pokemoncardlist.net; eBay-sourced ungraded prices via PriceCharting. Pulled Aug 2026.
      </footer>
    </>
  )
}
