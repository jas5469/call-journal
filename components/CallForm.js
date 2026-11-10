"use client";

import Link from "next/link";
import { useState } from "react";
import { addCall, HORIZONS } from "@/lib/calls";
import { money } from "@/lib/format";

export default function CallForm({ symbol, quote, onSaved }) {
  const [direction, setDirection] = useState(null);
  const [reason, setReason] = useState("");
  const [links, setLinks] = useState("");
  const [horizonDays, setHorizonDays] = useState(14);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!direction || !reason.trim()) return;
    try {
      addCall({
        symbol,
        name: quote.name,
        direction,
        reason: reason.trim(),
        links: links.split(/\s+/).filter((l) => /^https?:\/\/\S+$/.test(l)),
        horizonDays,
        entryPrice: quote.price,
        currency: quote.currency,
      });
    } catch (err) {
      setSaveError(err.message); // keep what was typed so nothing is lost
      return;
    }
    setSaveError("");
    setDirection(null);
    setReason("");
    setLinks("");
    setSaved(true);
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Make a call</h2>
      <div className="toggle">
        <button type="button" aria-pressed={direction === "bull"} className={`bull ${direction === "bull" ? "on" : ""}`}
          onClick={() => { setDirection("bull"); setSaved(false); }}>
          ▲ Bullish
        </button>
        <button type="button" aria-pressed={direction === "bear"} className={`bear ${direction === "bear" ? "on" : ""}`}
          onClick={() => { setDirection("bear"); setSaved(false); }}>
          ▼ Bearish
        </button>
      </div>

      <label htmlFor="reason">Why? Your reasoning in a sentence or two</label>
      <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000}
        placeholder="e.g. Guidance beat and data-center demand still accelerating; the market hasn't priced it in yet." />

      <label htmlFor="links">Sources (paste links, one per line, optional)</label>
      <textarea id="links" value={links} onChange={(e) => setLinks(e.target.value)} style={{ minHeight: 60 }}
        placeholder="https://..." />

      <label htmlFor="horizon">Check back in</label>
      <select id="horizon" value={horizonDays} onChange={(e) => setHorizonDays(+e.target.value)}>
        {HORIZONS.map((h) => <option key={h.days} value={h.days}>{h.label}</option>)}
      </select>

      <p className="small muted" style={{ margin: "12px 0" }}>
        Locks in the latest price of <strong>{money(quote.price, 2, quote.currency)}</strong> as your starting point.
      </p>
      <button type="submit" disabled={!direction || !reason.trim()} style={{ width: "100%" }}>
        Save call
      </button>
      {saveError && <p className="notice small" style={{ marginBottom: 0 }}>{saveError}</p>}
      {saved && <p className="small up" style={{ marginBottom: 0 }}>Saved. <Link href="/calls/">View my calls →</Link></p>}
    </form>
  );
}
