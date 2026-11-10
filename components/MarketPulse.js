"use client";

import { isNum, pct } from "@/lib/format";

// "How's the market today": advancers vs decliners per market, and sector moves weighted by size.
export default function MarketPulse({ stocks, onPickSector, activeSector }) {
  const markets = ["US", "HK", "SG"].map((m) => {
    const list = stocks.filter((s) => s.market === m && isNum(s.changePct));
    const up = list.filter((s) => s.changePct > 0).length;
    const down = list.filter((s) => s.changePct < 0).length;
    return { m, up, down, flat: list.length - up - down, total: list.length };
  }).filter((x) => x.total > 0);

  // Size-weighted average move per sector (big companies count more, like an index)
  const bySector = {};
  for (const s of stocks) {
    if (!s.sector || !isNum(s.changePct) || !isNum(s.marketCapUsd)) continue;
    const b = (bySector[s.sector] ??= { w: 0, sum: 0, n: 0 });
    b.w += s.marketCapUsd;
    b.sum += s.marketCapUsd * s.changePct;
    b.n++;
  }
  const sectors = Object.entries(bySector)
    .map(([name, b]) => ({ name, change: b.sum / b.w, n: b.n }))
    .filter((x) => x.n >= 3)
    .sort((a, b) => b.change - a.change);
  const maxAbs = Math.max(0.5, ...sectors.map((x) => Math.abs(x.change)));

  return (
    <section className="card pulse">
      <div>
        <h2>Market breadth today</h2>
        {markets.map(({ m, up, down, flat, total }) => (
          <div key={m} className="breadth">
            <div className="row small" style={{ justifyContent: "space-between" }}>
              <strong>{m === "US" ? "US" : m === "HK" ? "Hong Kong" : "Singapore"}</strong>
              <span className="muted"><span className="up">{up} up</span> · <span className="down">{down} down</span> · {flat} flat</span>
            </div>
            <div className="stackbar" title={`${Math.round((up / total) * 100)}% of stocks rose`}>
              <div style={{ flex: up, background: "var(--up)" }} />
              <div style={{ flex: flat, background: "var(--line)" }} />
              <div style={{ flex: down, background: "var(--down)" }} />
            </div>
          </div>
        ))}
        {markets.length === 0 && <p className="muted small">No price moves to show.</p>}
      </div>

      <div>
        <h2>Sectors today <span className="small muted">size-weighted · click to filter</span></h2>
        {sectors.length === 0 && <p className="muted small">Sector data appears after the daily data run.</p>}
        <div className="sectors">
          {sectors.map((x) => (
            <button key={x.name} type="button" className={`sector ${activeSector === x.name ? "on" : ""}`}
              onClick={() => onPickSector(activeSector === x.name ? "" : x.name)}>
              <span className="sector-name">{x.name}</span>
              <span className="sector-bar">
                <span className={x.change >= 0 ? "pos" : "neg"} style={{ width: `${(Math.abs(x.change) / maxAbs) * 50}%` }} />
              </span>
              <span className={`sector-num ${x.change >= 0 ? "up" : "down"}`}>{pct(x.change, { signed: true, digits: 2 })}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
