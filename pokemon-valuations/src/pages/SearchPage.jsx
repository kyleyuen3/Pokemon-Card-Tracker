import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RARITY_ORDER, RARITY_SHORT, RARITY_CLASS, getHistory, fmtMoney, VerdictBadge, ResidBar, PctChange, Sparkline } from '../lib/shared.jsx'
import AddToCollectionMenu from '../components/AddToCollectionMenu.jsx'

const PAGE_SIZE = 100

function parseParams(params) {
  return {
    search: params.get("q") || "",
    series: params.get("series") || "",
    set: params.get("set") || "",
    rarity: params.get("rarity") || "ALL",
    verdict: params.get("verdict") || "ALL",
    sortKey: params.get("sort") || "residual_log",
    sortDir: params.get("dir") === "asc" ? 1 : -1,
    page: Math.max(1, parseInt(params.get("page"), 10) || 1),
  }
}

export default function SearchPage({ data, payload, onPickHistory }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = useMemo(() => parseParams(searchParams), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState(initial.search)
  const [series, setSeries] = useState(initial.series)
  const [set, setSet] = useState(initial.set)
  const [rarity, setRarity] = useState(initial.rarity)
  const [verdict, setVerdict] = useState(initial.verdict)
  const [sortKey, setSortKey] = useState(initial.sortKey)
  const [sortDir, setSortDir] = useState(initial.sortDir)
  const [page, setPage] = useState(initial.page)

  // "Main sets" -- the era each set belongs to (Scarlet & Violet, Sword &
  // Shield, ...). "Other" (pokemontcg.io's own bucket for oddball products,
  // plus any card fetched before this field existed) always sorts last.
  const seriesOrder = useMemo(() => {
    const values = [...new Set(data.map(d => d.series || "Other"))]
    return values.sort((a, b) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b))
  }, [data])

  // The true total, independent of the series filter -- used in the header
  // eyebrow, which should always describe the whole catalog, not whatever's
  // currently narrowed down.
  const totalSetCount = useMemo(() => new Set(data.map(d => d.set)).size, [data])

  // Picking a series narrows the sub-set list to just that era's sets.
  const setOrder = useMemo(() => {
    const pool = series ? data.filter(d => (d.series || "Other") === series) : data
    return [...new Set(pool.map(d => d.set))].sort((a, b) => a.localeCompare(b))
  }, [data, series])

  const rarityOrder = useMemo(() => {
    const known = new Set(RARITY_ORDER)
    const extra = [...new Set(data.map(d => d.rarity))].filter(r => r && !known.has(r)).sort()
    return [...RARITY_ORDER, ...extra]
  }, [data])

  // Typing a set's exact name (or picking one from the list) narrows to just
  // that set; a partial search instead matches the whole family -- e.g.
  // "Scarlet & Violet" alone also surfaces "...Black Star Promos" etc.
  const setFilterIsExact = useMemo(() => setOrder.includes(set), [setOrder, set])

  const filtered = useMemo(() => {
    return data.filter(d => {
      if (series && (d.series || "Other") !== series) return false
      if (set) {
        const matches = setFilterIsExact ? d.set === set : d.set.toLowerCase().includes(set.toLowerCase())
        if (!matches) return false
      }
      if (rarity !== "ALL" && d.rarity !== rarity) return false
      if (verdict !== "ALL" && d.verdict !== verdict) return false
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [data, series, set, setFilterIsExact, rarity, verdict, search])

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
  }, [series, set, rarity, verdict, search, sortKey, sortDir])

  // Keep the URL in sync so a filtered/sorted view can be bookmarked or
  // shared -- replace (not push) so this never pollutes back-button history.
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    if (series) params.set("series", series)
    if (set) params.set("set", set)
    if (rarity !== "ALL") params.set("rarity", rarity)
    if (verdict !== "ALL") params.set("verdict", verdict)
    if (sortKey !== "residual_log") params.set("sort", sortKey)
    if (sortDir === 1) params.set("dir", "asc")
    if (page !== 1) params.set("page", String(page))
    setSearchParams(params, { replace: true })
  }, [search, series, set, rarity, verdict, sortKey, sortDir, page]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(key === "name" ? 1 : -1) }
  }

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
    { key: "add", label: "", sortable: false },
  ]

  return (
    <>
      <header>
        <p className="eyebrow">
          {totalSetCount} sets · {data.length} cards tracked
          {payload.latest_price_date && ` · prices as of ${payload.latest_price_date}`}
        </p>
        <h1>Search the Catalog</h1>
        <p className="subtitle">
          Click any column to sort, click a card's trend to see its full price history, and use "+ Add" to save a
          card to a collection or your wishlist.
        </p>
      </header>

      <div className="controls">
        <div className="filter-group">
          <label className="filter-label">Search</label>
          <input type="text" placeholder="Card name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label">Main Set</label>
          <select className="filter-select" value={series} onChange={e => { setSeries(e.target.value); setSet("") }}>
            <option value="">All eras ({seriesOrder.length})</option>
            {seriesOrder.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Sub Set</label>
          <input
            type="text"
            list="set-options"
            className="filter-select"
            placeholder={`${series ? "All in era" : "All sets"} (${setOrder.length})`}
            value={set}
            onChange={e => setSet(e.target.value)}
          />
          <datalist id="set-options">
            {setOrder.map(s => <option key={s} value={s} />)}
          </datalist>
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
                    {d.image_small && <img src={d.image_small} alt="" className="card-thumb" loading="lazy" onError={e => { e.target.style.display = "none" }} />}
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
                <td className="trend-cell" onClick={() => onPickHistory(d)} title="Click for full price history">
                  <Sparkline history={getHistory(d)} />
                </td>
                <td className="num-col num">{fmtMoney(d.predicted_price)}</td>
                <td><ResidBar residual={d.residual_log} /></td>
                <td><VerdictBadge verdict={d.verdict} /></td>
                <td><AddToCollectionMenu card={d} /></td>
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
    </>
  )
}
