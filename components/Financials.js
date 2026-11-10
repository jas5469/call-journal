"use client";

import { useState } from "react";
import { big, isNum, money, pct } from "@/lib/format";

function label(date, mode) {
  const d = new Date(date + "T00:00:00Z");
  if (mode === "annual") return `FY ${d.getUTCFullYear()}`;
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} '${String(d.getUTCFullYear()).slice(2)}`;
}

export default function Financials({ statements }) {
  const [mode, setMode] = useState("annual");
  const s = statements?.[mode];
  const ccy = statements?.currency || "USD";
  const hasAny = statements && (statements.annual?.rows.length || statements.quarterly?.rows.length);

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Financial statements {statements?.currency && <span className="small muted">in {statements.currency}</span>}</h2>
        {hasAny ? (
          <div className="seg" role="group" aria-label="Period">
            <button type="button" className={mode === "annual" ? "on" : ""} onClick={() => setMode("annual")}>Yearly</button>
            <button type="button" className={mode === "quarterly" ? "on" : ""} onClick={() => setMode("quarterly")}>Quarterly</button>
          </div>
        ) : null}
      </div>

      {!hasAny || !s?.rows.length ? (
        <p className="muted small">Not available for this {hasAny ? "period" : "stock (it may be a fund)"}.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th></th>
                {s.dates.map((d) => <th key={d} className="r">{label(d, mode)}</th>)}
                <th className="r" title={mode === "annual" ? "Change from the year before" : "Change from the quarter before"}>Change</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row) => {
                const [prev, last] = row.values.slice(-2);
                const change = isNum(prev) && isNum(last) && prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : null;
                return (
                  <tr key={row.key}>
                    <td className="nowrap">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={`r nowrap ${isNum(v) && v < 0 ? "down" : ""}`}>
                        {row.perShare ? money(v, 2, ccy) : big(v, ccy)}
                      </td>
                    ))}
                    <td className={`r small ${change == null ? "" : change >= 0 ? "up" : "down"}`}>{pct(change, { signed: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
