import { useState, useEffect, useMemo, useRef } from 'react'

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

// A card's price history used to ship as a bare array of numbers
// ("sparkline"). It's now [date, price] pairs ("history") so the expanded
// chart can label real dates. Normalize both shapes here so the site
// doesn't break in the window between this shipping and the next daily
// data refresh actually producing the new shape.
function getHistory(d) {
  if (d.history) return d.history
  if (d.sparkline) return d.sparkline.map(v => [null, v])
  return []
}

function parseUrlState() {
  if (typeof window === "undefined") return {}
  const params = new URLSearchParams(window.location.search)
  return {
    search: params.get("q") || "",
    set: params.get("set") || "ALL",
    rarity: params.get("rarity") || "ALL",
    verdict: params.get("verdict") || "ALL",
    sortKey: params.get("sort") || "residual_log",
    sortDir: params.get("dir") === "asc" ? 1 : -1,
    page: Math.max(1, parseInt(params.get("page"), 10) || 1),
  }
}
const initialUrlState = parseUrlState()

function fmtMoney(v) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  return '$' + v.toFixed(2)
}

function VerdictBadge({ verdict }) {
  if (verdict === "OVERVALUED") return <span className="verdict-badge v-over">▲ Overvalued</span>
  if (verdict === "UNDERVALUED") return <span className="verdict-badge v-under">▼ Undervalued</span>
  if (verdict === "fair") return <span className="verdict-badge v-fair">Fair</span>
  // null -- the peer group this card was compared against was too small or
  // too uniform (e.g. every card defaulting to the same HP/popularity) for
  // the comparison to mean anything. Showing a confident-looking verdict
  // anyway would just be a plausible-sounding wrong answer.
  return <span className="verdict-badge v-unknown" title="Too few comparable cards in this set/rarity to judge">Insufficient data</span>
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

function Sparkline({ history }) {
  const points = history.map(h => h[1])
  if (points.length < 2) return <span style={{ color: 'var(--text-faint)' }}>—</span>
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

function PriceHistoryModal({ card, onClose }) {
  const [hoverIdx, setHoverIdx] = useState(null)

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const pairs = getHistory(card)
  const w = 640, h = 220, padL = 8, padR = 8, padT = 16, padB = 28

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h3>{card.name}</h3>
        <p className="modal-sub">{card.set} · #{card.number} · {RARITY_SHORT[card.rarity] || card.rarity}</p>

        {pairs.length < 2 ? (
          <p className="modal-empty">Not enough price history yet — check back after a few more daily updates.</p>
        ) : (
          <HistoryChart pairs={pairs} w={w} h={h} padL={padL} padR={padR} padT={padT} padB={padB}
                         hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
        )}
      </div>
    </div>
  )
}

function HistoryChart({ pairs, w, h, padL, padR, padT, padB, hoverIdx, setHoverIdx }) {
  const prices = pairs.map(p => p[1])
  const min = Math.min(...prices), max = Math.max(...prices)
  const range = (max - min) || 1
  const stepX = pairs.length > 1 ? (w - padL - padR) / (pairs.length - 1) : 0
  const xAt = i => padL + i * stepX
  const yAt = v => padT + (1 - (v - min) / range) * (h - padT - padB)
  const linePoints = pairs.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p[1]).toFixed(1)}`).join(" ")
  const areaPoints = `${xAt(0).toFixed(1)},${(h - padB).toFixed(1)} ${linePoints} ${xAt(pairs.length - 1).toFixed(1)},${(h - padB).toFixed(1)}`
  const up = prices[prices.length - 1] >= prices[0]
  const color = up ? "var(--under)" : "var(--over)"
  const activeIdx = hoverIdx ?? pairs.length - 1
  const active = pairs[activeIdx]

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (w / rect.width)
    let idx = stepX > 0 ? Math.round((x - padL) / stepX) : 0
    idx = Math.max(0, Math.min(pairs.length - 1, idx))
    setHoverIdx(idx)
  }

  return (
    <>
      <div className="modal-readout">
        <span className="modal-readout-date">{active[0] || "—"}</span>
        <span className="modal-readout-price num">${active[1].toFixed(2)}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="history-chart"
           onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
        <polygon points={areaPoints} fill={color} opacity="0.14" />
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" />
        {hoverIdx !== null && (
          <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={padT} y2={h - padB} stroke="var(--text-faint)" strokeDasharray="3,3" />
        )}
        <circle cx={xAt(activeIdx)} cy={yAt(active[1])} r="3.5" fill={color} />
        <text x={padL} y={h - 8} fontSize="10" fill="var(--text-faint)">{pairs[0][0] || ""}</text>
        <text x={w - padR} y={h - 8} fontSize="10" fill="var(--text-faint)" textAnchor="end">{pairs[pairs.length - 1][0] || ""}</text>
      </svg>
    </>
  )
}

function MoverRow({ d, onClick }) {
  return (
    <div className="mover-row" onClick={onClick}>
      <div className="mover-name-set">
        <span className="mover-name">{d.name}</span>
        <span className="mover-set">{d.set}</span>
      </div>
      <span className="num mover-price">{fmtMoney(d.price)}</span>
      <PctChange value={d.pct_change_7d} />
    </div>
  )
}

function MoversPanel({ data, onPick }) {
  const withChange = useMemo(
    () => data.filter(d => d.pct_change_7d !== null && d.pct_change_7d !== undefined),
    [data]
  )

  if (withChange.length === 0) {
    return (
      <div className="movers-panel movers-empty">
        7-day movers need a week of daily history to compare against — check back soon.
      </div>
    )
  }

  const gainers = withChange.slice().sort((a, b) => b.pct_change_7d - a.pct_change_7d).slice(0, 5)
  const losers = withChange.slice().sort((a, b) => a.pct_change_7d - b.pct_change_7d).slice(0, 5)

  return (
    <div className="movers-panel">
      <div className="movers-col">
        <div className="movers-title">Top gainers · 7d</div>
        {gainers.map(d => <MoverRow key={d.set + "-" + d.number} d={d} onClick={() => onPick(d)} />)}
      </div>
      <div className="movers-col">
        <div className="movers-title">Top losers · 7d</div>
        {losers.map(d => <MoverRow key={d.set + "-" + d.number} d={d} onClick={() => onPick(d)} />)}
      </div>
    </div>
  )
}

export default function App() {
  const [payload, setPayload] = useState(null)
  const [search, setSearch] = useState(initialUrlState.search)
  const [set, setSet] = useState(initialUrlState.set)
  const [rarity, setRarity] = useState(initialUrlState.rarity)
  const [verdict, setVerdict] = useState(initialUrlState.verdict)
  const [sortKey, setSortKey] = useState(initialUrlState.sortKey)
  const [sortDir, setSortDir] = useState(initialUrlState.sortDir)
  const [page, setPage] = useState(initialUrlState.page)
  const [historyCard, setHistoryCard] = useState(null)

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

  // Skip the very first run so a page number restored from the URL survives
  // the initial render instead of being immediately reset to 1.
  const isFirstFilterRun = useRef(true)
  useEffect(() => {
    if (isFirstFilterRun.current) { isFirstFilterRun.current = false; return }
    setPage(1)
  }, [set, rarity, verdict, search, sortKey, sortDir])

  // Keep the URL in sync so a filtered/sorted view can be bookmarked or
  // shared -- replaceState (not push) so this never pollutes back-button history.
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (set !== "ALL") params.set("set", set)
    if (rarity !== "ALL") params.set("rarity", rarity)
    if (verdict !== "ALL") params.set("verdict", verdict)
    if (sortKey !== "residual_log") params.set("sort", sortKey)
    if (sortDir === 1) params.set("dir", "asc")
    if (page !== 1) params.set("page", String(page))
    const qs = params.toString()
    const url = window.location.pathname + (qs ? "?" + qs : "")
    window.history.replaceState(null, "", url)
  }, [search, set, rarity, verdict, sortKey, sortDir, page])

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
    { key: "history", label: "Trend", sortable: false },
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
          Cardmarket (EUR) trend price. Prices are pulled automatically once a day. Click any column to sort, click a
          card's trend to see its full price history.
        </p>
        <div className="stat-row">
          <div className="stat"><div className="n num">{data.length}</div><div className="l">cards tracked</div></div>
          <div className="stat under"><div className="n num">{underCount}</div><div className="l">undervalued</div></div>
          <div className="stat over"><div className="n num">{overCount}</div><div className="l">overvalued</div></div>
          <div className="stat"><div className="n num">${topPrice.toFixed(0)}</div><div className="l">priciest card</div></div>
        </div>
      </header>

      <MoversPanel data={data} onPick={setHistoryCard} />

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

      <div className="table-wrap">
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
                <td className="name">
                  <div className="card-name-cell">
                    {d.image_small && <img src={d.image_small} alt="" className="card-thumb" loading="lazy" />}
                    <span><span className="card-num num">#{d.number}</span>{d.name}</span>
                  </div>
                </td>
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
                <td className="trend-cell" onClick={() => setHistoryCard(d)} title="Click for full price history">
                  <Sparkline history={getHistory(d)} />
                </td>
                <td className="num-col num">{fmtMoney(d.predicted_price)}</td>
                <td><ResidBar residual={d.residual_log} /></td>
                <td><VerdictBadge verdict={d.verdict} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        linear regression fit separately within each set's own rarity tiers on HP, ex-status, and a subjective popularity score;
        cards in a set/rarity group too small or too uniform to compare show "Insufficient data" instead of a guess.
        Pull costs use TCGplayer Authentication Center's verified specific-pull-odds at $5/pack MSRP — verified only for
        Prismatic Evolutions so far; every other set shows no pull cost until that's sourced.
        7d/30d change and the price history come from a daily automated pull of TCGplayer market prices (and Cardmarket
        EUR trend prices where available) via the pokemontcg.io API — those fields fill in as more days accumulate.
        {payload.generated_at && ` Data last refreshed ${new Date(payload.generated_at).toLocaleString()}.`}
      </footer>

      {historyCard && <PriceHistoryModal card={historyCard} onClose={() => setHistoryCard(null)} />}
    </>
  )
}
