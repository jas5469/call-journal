"use client";

import { useState } from "react";
import { CONSENSUS, isNum, money, pct, timeAgo } from "@/lib/format";

const BUCKETS = [
  ["strongBuy", "Strong buy", "var(--up)"],
  ["buy", "Buy", "color-mix(in srgb, var(--up) 55%, var(--card))"],
  ["hold", "Hold", "var(--muted)"],
  ["sell", "Sell", "color-mix(in srgb, var(--down) 55%, var(--card))"],
  ["strongSell", "Strong sell", "var(--down)"],
];

export default function Analysts({ analysts, analystNews, price, currency, full, market }) {
  const m = (v, d = 2) => money(v, d, currency);
  const [bigOnly, setBigOnly] = useState(true);
  const [showAll, setShowAll] = useState(false);

  if (!analysts || (!analysts.consensus && !analysts.actions?.length && !isNum(analysts.targetMean))) {
    return (
      <section className="card">
        <h2>Analysts</h2>
        <p className="muted small">No analyst coverage found for this stock.</p>
      </section>
    );
  }

  const a = analysts;
  const total = BUCKETS.reduce((s, [k]) => s + (a.trend?.[k] || 0), 0);
  const upside = isNum(a.targetMean) ? (a.targetMean / price - 1) * 100 : null;
  const actions = a.actions.filter((x) => !bigOnly || x.bigBank);
  const shown = showAll ? actions : actions.slice(0, 10);

  // Where the low / average / high targets and today's price sit on one line
  const lo = Math.min(a.targetLow ?? price, price);
  const hi = Math.max(a.targetHigh ?? price, price);
  const at = (v) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50);

  return (
    <section className="card">
      <h2>Analysts</h2>

      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div>
          <div className="small muted">Consensus{isNum(a.count) ? ` of ${a.count}` : ""}</div>
          {a.consensus ? <span className={`pill big ${a.consensus}`}>{CONSENSUS[a.consensus] || a.consensus}</span> : "—"}
        </div>
        <div>
          <div className="small muted">Average price target</div>
          <div className="tile-num">{m(a.targetMean)}</div>
          {upside != null && <div className={`small ${upside >= 0 ? "up" : "down"}`}>{pct(upside, { signed: true })} from now</div>}
        </div>
      </div>

      {total > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="stackbar" role="img" aria-label={BUCKETS.map(([k, l]) => `${l} ${a.trend[k]}`).join(", ")}>
            {BUCKETS.map(([k, , color]) => a.trend[k] > 0 && (
              <div key={k} style={{ flex: a.trend[k], background: color }} />
            ))}
          </div>
          <div className="row small muted" style={{ gap: 12 }}>
            {BUCKETS.map(([k, label]) => <span key={k}>{label} {a.trend[k]}</span>)}
          </div>
        </div>
      )}

      {isNum(a.targetLow) && isNum(a.targetHigh) && (
        <div style={{ marginTop: 14 }}>
          <div className="small muted">Price target range</div>
          <div className="rangebar">
            <div className="tick" style={{ left: `${at(a.targetMean)}%` }} title="Average target" />
            <div className="dot" style={{ left: `${at(price)}%` }} title="Price now" />
          </div>
          <div className="row small muted" style={{ justifyContent: "space-between" }}>
            <span>low {m(a.targetLow)}</span><span>● now {m(price)} · | avg {m(a.targetMean)}</span><span>high {m(a.targetHigh)}</span>
          </div>
        </div>
      )}

      {!full && <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>Price targets and rating changes are collected for the largest companies only.</p>}

      {full && market !== "US" && (
        <p className="small muted" style={{ marginTop: 20, marginBottom: 0 }}>
          Firm-by-firm rating changes are only available for US stocks.
        </p>
      )}

      {full && market === "US" && <>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 20 }}>
        <h3>Rating changes, last 6 months</h3>
        <div className="seg" role="group" aria-label="Which firms">
          <button type="button" className={bigOnly ? "on" : ""} onClick={() => setBigOnly(true)}>Big banks</button>
          <button type="button" className={!bigOnly ? "on" : ""} onClick={() => setBigOnly(false)}>All firms</button>
        </div>
      </div>
      {actions.length === 0 ? (
        <p className="muted small">No {bigOnly ? "big-bank " : ""}rating changes in the last 6 months.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Firm</th><th>Rating</th><th className="r">Target</th></tr></thead>
            <tbody>
              {shown.map((x, i) => (
                <tr key={i}>
                  <td className="small nowrap">{x.date}</td>
                  <td><strong>{x.firm}</strong><div className="small muted">{x.action}</div></td>
                  <td className="small">
                    {x.fromGrade && x.fromGrade !== x.toGrade ? <>{x.fromGrade} → </> : null}
                    <span className={x.action === "Upgrade" ? "up" : x.action === "Downgrade" ? "down" : ""}>{x.toGrade || "—"}</span>
                  </td>
                  <td className="r small nowrap">
                    {isNum(x.priorTarget) && x.priorTarget !== x.target && <span className="muted">{m(x.priorTarget, 0)} → </span>}
                    <span className={x.targetAction === "Raises" ? "up" : x.targetAction === "Lowers" ? "down" : ""}>{m(x.target, 0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {actions.length > 10 && (
            <button type="button" className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${actions.length}`}
            </button>
          )}
        </div>
      )}

      </>}

      {full && <>
      <h3 style={{ marginTop: 20 }}>What analysts are saying</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        Banks&apos; full research notes are paid; these are news write-ups of their views.
      </p>
      {analystNews?.length ? (
        <ul className="news">
          {analystNews.map((n, i) => (
            <li key={i}>
              <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
              <div className="small muted">{n.outlet} · {timeAgo(n.time)}</div>
            </li>
          ))}
        </ul>
      ) : <p className="muted small">No analyst write-ups found.</p>}
      </>}
    </section>
  );
}
