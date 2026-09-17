import { useState, useEffect, useMemo } from 'react'

export const RARITY_ORDER = ["Common","Uncommon","Rare","Double Rare","Ultra Rare","ACE SPEC Rare","Illustration Rare","Special Illustration Rare","Hyper Rare"]
export const RARITY_CLASS = {
  "Common":"r-common","Uncommon":"r-uncommon","Rare":"r-rare","Double Rare":"r-dr",
  "Ultra Rare":"r-ur","ACE SPEC Rare":"r-ace","Illustration Rare":"r-ir","Special Illustration Rare":"r-sir","Hyper Rare":"r-hr"
}
export const RARITY_SHORT = {
  "Common":"Common","Uncommon":"Uncommon","Rare":"Rare","Double Rare":"Double Rare",
  "Ultra Rare":"Ultra Rare","ACE SPEC Rare":"ACE SPEC","Illustration Rare":"IR","Special Illustration Rare":"SIR","Hyper Rare":"Hyper Rare"
}

// A card's price history used to ship as a bare array of numbers
// ("sparkline"). It's now [date, price] pairs ("history") so the expanded
// chart can label real dates. Normalize both shapes here so the site
// doesn't break in the window between this shipping and the next daily
// data refresh actually producing the new shape.
export function getHistory(d) {
  if (d.history) return d.history
  if (d.sparkline) return d.sparkline.map(v => [null, v])
  return []
}

export function fmtMoney(v) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  return '$' + v.toFixed(2)
}

export function VerdictBadge({ verdict }) {
  if (verdict === "OVERVALUED") return <span className="verdict-badge v-over">▲ Overvalued</span>
  if (verdict === "UNDERVALUED") return <span className="verdict-badge v-under">▼ Undervalued</span>
  if (verdict === "fair") return <span className="verdict-badge v-fair">Fair</span>
  // null -- the peer group this card was compared against was too small or
  // too uniform (e.g. every card defaulting to the same HP/popularity) for
  // the comparison to mean anything. Showing a confident-looking verdict
  // anyway would just be a plausible-sounding wrong answer.
  return <span className="verdict-badge v-unknown" title="Too few comparable cards in this set/rarity to judge">Insufficient data</span>
}

export function ResidBar({ residual }) {
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

export function PctChange({ value }) {
  if (value === null || value === undefined) return <span className="num" style={{ color: 'var(--text-faint)' }}>—</span>
  if (value === 0) return <span className="num" style={{ color: 'var(--text-dim)' }}>0.0%</span>
  const up = value > 0
  const color = up ? "var(--under)" : "var(--over)"
  return <span className="num" style={{ color }}>{up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%</span>
}

export function Sparkline({ history }) {
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

export function PriceHistoryModal({ card, onClose }) {
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

function TrendTile({ d, onClick }) {
  const pct = d.pct_change_7d
  const up = pct >= 0
  const color = up ? "var(--under)" : "var(--over)"
  return (
    <div className="trend-tile" onClick={onClick}>
      <div className="trend-tile-thumb">
        {d.image_small && <img src={d.image_small} alt="" loading="lazy" onError={e => { e.target.style.display = "none" }} />}
      </div>
      <div className="trend-tile-name" title={d.name}>{d.name}</div>
      <div className="trend-tile-set" title={d.set}>{d.set}</div>
      <div className="trend-tile-bottom">
        <span className="trend-tile-price num">{fmtMoney(d.price)}</span>
        <span className="trend-tile-pct num" style={{ color }}>{up ? "▲" : "▼"}{Math.abs(pct).toFixed(1)}%</span>
      </div>
    </div>
  )
}

// A thin/low-volume card (an old vintage single, say) can have its whole
// "7-day move" created by a single fresh snapshot -- one odd TCGplayer
// listing skewing that day's market price, not a real shift. Requiring most
// of the move to have already shown up before the latest snapshot (i.e. it's
// been confirmed by more than one day of data) filters those false spikes
// out of the trending grid without hiding real, sustained moves.
function isConfirmedMove(d) {
  const pct = d.pct_change_7d
  if (pct === null || pct === undefined || pct === 0) return false
  const hist = getHistory(d)
  if (hist.length < 2) return false
  const latest = hist[hist.length - 1][1]
  const prev = hist[hist.length - 2][1]
  if (latest == null || prev == null) return false
  const baseline = latest / (1 + pct / 100)
  const totalMove = latest - baseline
  if (!isFinite(totalMove) || totalMove === 0) return false
  const lastStepMove = latest - prev
  return Math.abs(lastStepMove) < Math.abs(totalMove) * 0.5
}

// Always ranks the whole catalog, regardless of the Main Set / Sub Set /
// Rarity / Verdict filters -- a "what's moving right now" view is only
// useful if it isn't quietly scoped to whatever's currently selected.
const TRENDING_COUNT = 50
// Below $1, a card moving a cent or two swings its % change wildly (e.g.
// $0.02 -> $0.06 is "200%") without being a move anyone actually cares about.
const TRENDING_MIN_PRICE = 1

export function TrendingGrid({ data, onPick }) {
  const top = useMemo(() => {
    const withChange = data.filter(d =>
      d.pct_change_7d !== null && d.pct_change_7d !== undefined &&
      d.price >= TRENDING_MIN_PRICE &&
      isConfirmedMove(d)
    )
    return withChange
      .slice()
      .sort((a, b) => Math.abs(b.pct_change_7d) - Math.abs(a.pct_change_7d))
      .slice(0, TRENDING_COUNT)
  }, [data])

  if (top.length === 0) {
    return (
      <div className="trending-empty">
        7-day trends need a week of daily history to compare against — check back soon.
      </div>
    )
  }

  return (
    <div className="trending-section">
      <p className="trending-eyebrow">Top {top.length} Trending · 7d change · biggest sustained movers, up or down</p>
      <div className="trending-grid">
        {top.map(d => <TrendTile key={d.set + "-" + d.number} d={d} onClick={() => onPick(d)} />)}
      </div>
    </div>
  )
}
