"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/format";

export default function News({ items }) {
  const [outlet, setOutlet] = useState("All");
  const [showAll, setShowAll] = useState(false);

  if (!items?.length) {
    return <section className="card"><h2>News</h2><p className="muted small">No recent headlines found.</p></section>;
  }

  // Outlets ordered by how many headlines they have here
  const counts = {};
  for (const n of items) counts[n.outlet] = (counts[n.outlet] || 0) + 1;
  const outlets = ["All", ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
  const filtered = outlet === "All" ? items : items.filter((n) => n.outlet === outlet);
  const shown = showAll ? filtered : filtered.slice(0, 10);

  return (
    <section className="card">
      <h2>News <span className="small muted">from {outlets.length - 1} outlets</span></h2>
      <div className="chips" style={{ marginBottom: 12 }}>
        {outlets.map((o) => (
          <button key={o} type="button" className={`chip ${o === outlet ? "on" : ""}`} onClick={() => { setOutlet(o); setShowAll(false); }}>
            {o}{o !== "All" && <span className="muted"> {counts[o]}</span>}
          </button>
        ))}
      </div>
      <ul className="news">
        {shown.map((n, i) => (
          <li key={i}>
            <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
            <div className="small muted">{n.outlet} · {timeAgo(n.time)}</div>
          </li>
        ))}
      </ul>
      {filtered.length > 10 && (
        <button type="button" className="link" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${filtered.length}`}
        </button>
      )}
    </section>
  );
}
