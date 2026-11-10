"use client";

import { useEffect, useRef, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { big, isNum, money, pct } from "@/lib/format";

// Claude's take on a stock, two ways:
//  1. Live: with your own Anthropic API key (kept only in this browser), Claude writes an analysis
//     automatically when you open a stock. Results are saved per stock per data update, so reopening
//     a stock doesn't charge again.
//  2. Without a key: a button opens claude.ai with the same data pre-filled (uses your Claude account).

const MAX_URL_PROMPT = 6000;

export function buildPrompt(data, myCalls) {
  const { quote: q, stats: s = {}, analysts: a, history = [], news, statements, profile } = data;
  const c = (v, d = 2) => money(v, d, q.currency);
  const fc = s.financialCurrency || q.currency;
  const perf = (days) => {
    const p = history.at(-1 - days)?.close;
    return isNum(p) && isNum(q.price) ? pct((q.price / p - 1) * 100, { signed: true }) : "n/a";
  };

  const lines = [
    `Give me a balanced, plain-English analysis of ${q.name} (${data.symbol}, ${q.exchange}) to help me form my own view.`,
    "Please cover: 1) what the business does and what drives it, 2) the bull case, 3) the bear case and key risks,",
    "4) how the valuation looks against its growth and peers, 5) what the recent news and analyst moves suggest,",
    "6) the 3 things I should watch next. End with a short summary of the main question a buyer is betting on.",
    "Point out anything in the data below that looks odd or out of date. I'm learning, so explain jargon briefly.",
    "",
    `DATA (as of ${data.updatedAt?.slice(0, 10)}, prices in ${q.currency}):`,
    `- Price ${c(q.price)}, today ${pct(q.changePct, { signed: true, digits: 2 })}; 1 month ${perf(21)}, 3 months ${perf(63)}, 6 months ${perf(history.length - 1)}`,
    `- 52-week range ${c(s.fiftyTwoWeekLow)} – ${c(s.fiftyTwoWeekHigh)}; market cap ${big(s.marketCap, q.currency)}`,
  ];
  if (profile?.sector) lines.push(`- Sector: ${profile.sector} / ${profile.industry}${profile.country ? `, ${profile.country}` : ""}`);
  const ratios = [
    isNum(s.trailingPE) && `P/E ${s.trailingPE.toFixed(1)}`, isNum(s.forwardPE) && `forward P/E ${s.forwardPE.toFixed(1)}`,
    isNum(s.priceToBook) && `P/B ${s.priceToBook.toFixed(2)}`, isNum(s.dividendYield) && `dividend yield ${pct(s.dividendYield, { ratio: true, digits: 2 })}`,
    isNum(s.revenueGrowth) && `revenue growth ${pct(s.revenueGrowth, { ratio: true, signed: true })}`,
    isNum(s.profitMargin) && `net margin ${pct(s.profitMargin, { ratio: true })}`,
    isNum(s.returnOnEquity) && `ROE ${pct(s.returnOnEquity, { ratio: true })}`,
    isNum(s.freeCashflow) && `free cash flow ${big(s.freeCashflow, fc)}`,
    isNum(s.totalCash) && isNum(s.totalDebt) && `cash ${big(s.totalCash, fc)} vs debt ${big(s.totalDebt, fc)}`,
  ].filter(Boolean);
  if (ratios.length) lines.push(`- Key numbers: ${ratios.join("; ")}`);

  if (a?.consensus) {
    let t = `- Analysts: consensus ${a.consensus.replace("_", " ")}${isNum(a.count) ? ` (${a.count} analysts)` : ""}`;
    if (isNum(a.targetMean)) t += `; price targets low ${c(a.targetLow)}, average ${c(a.targetMean)}, high ${c(a.targetHigh)}`;
    lines.push(t);
  }
  const recent = (a?.actions || []).slice(0, 6).map((x) =>
    `${x.date} ${x.firm}: ${x.action}${x.toGrade ? ` ${x.toGrade}` : ""}${isNum(x.target) ? `, target ${c(x.target, 0)}` : ""}`);
  if (recent.length) lines.push(`- Recent rating changes: ${recent.join(" | ")}`);

  const rev = statements?.annual?.rows?.find((r) => r.key === "TotalRevenue");
  const ni = statements?.annual?.rows?.find((r) => r.key === "NetIncome");
  if (rev && statements.annual.dates.length) {
    const yrs = statements.annual.dates.map((d) => d.slice(0, 4));
    lines.push(`- Revenue by year (${statements.currency}): ${yrs.map((y, i) => `${y} ${big(rev.values[i], null)}`).join(", ")}`);
    if (ni) lines.push(`- Net income by year: ${yrs.map((y, i) => `${y} ${big(ni.values[i], null)}`).join(", ")}`);
  }
  if (news?.length) {
    lines.push("- Recent headlines:");
    for (const n of news.slice(0, 8)) lines.push(`  • ${n.title} (${n.outlet}, ${n.time?.slice(0, 10) ?? "undated"})`);
  }
  if (myCalls?.length) {
    lines.push("- My own past calls on this stock:");
    for (const m of myCalls.slice(0, 5)) {
      lines.push(`  • ${m.createdAt.slice(0, 10)} ${m.direction === "bull" ? "Bullish" : "Bearish"} at ${c(m.entryPrice)}: "${m.reason}"`);
    }
    lines.push("Challenge my reasoning in those calls too.");
  }
  return lines.join("\n");
}

const KEY_STORE = "call-journal:anthropic-key";
const AUTO_STORE = "call-journal:claude-auto";
const CACHE_PREFIX = "call-journal:claude-take:";
const MODEL = "claude-opus-5-5";

const SYSTEM = [
  "You write short, balanced stock analyses for someone learning to judge stocks for themselves.",
  "Use only the data provided plus general knowledge of the company; say when something can't be judged from it.",
  "Format: a one-line summary without a verdict, then short sections with markdown headings:",
  "## Business, ## Bull case, ## Bear case and risks, ## Valuation, ## What to watch.",
  "Use bullet points, plain English, and keep the whole reply under 350 words.",
  "Do not tell the reader to buy, sell or hold, and do not give personal financial advice;",
  "describe the evidence on both sides so they can decide.",
].join(" ");

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };

// Saved analyses are capped so they can never fill the browser's storage (which would stop calls
// and favourites from saving). Keeps the newest MAX_SAVED, and only the latest one per stock.
const MAX_SAVED = 60;
const INDEX_KEY = "call-journal:claude-take-index";
function saveTake(cacheKey, symbol, text) {
  let index = [];
  try { index = JSON.parse(read(INDEX_KEY)) || []; } catch {}
  const prefix = `${CACHE_PREFIX}${symbol}:`;
  for (const k of index.filter((k) => k.startsWith(prefix) && k !== cacheKey)) write(k, null); // older days, same stock
  index = [cacheKey, ...index.filter((k) => !k.startsWith(prefix))];
  for (const k of index.slice(MAX_SAVED)) write(k, null);
  index = index.slice(0, MAX_SAVED);
  write(INDEX_KEY, JSON.stringify(index));
  write(cacheKey, text);
}

// The final text, built from the finished message rather than the streamed pieces: if Claude declined
// and a fallback model took over, only the text after the last switch point is the real answer.
function finalText(msg) {
  const lastSwitch = msg.content.map((b) => b.type).lastIndexOf("fallback");
  return msg.content.slice(lastSwitch + 1).filter((b) => b.type === "text").map((b) => b.text).join("");
}

// Friendly name for whichever model actually answered
const modelName = (id) => (id || MODEL).replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2").replace(/-(\d+)$/, " $1")
  .replace(/^\w/, (c) => c.toUpperCase());

export default function ClaudeTake({ data, myCalls }) {
  const [key, setKey] = useState(null); // saved API key ("" = none; null = not loaded yet)
  const [auto, setAuto] = useState(true);
  const [draftKey, setDraftKey] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [answeredBy, setAnsweredBy] = useState(null);
  const streamRef = useRef(null);

  const prompt = buildPrompt(data, myCalls);
  const cacheKey = `${CACHE_PREFIX}${data.symbol}:${data.detailUpdatedAt || data.updatedAt?.slice(0, 10)}`;

  useEffect(() => {
    setKey(read(KEY_STORE) || "");
    setAuto(read(AUTO_STORE) !== "off");
  }, []);

  // Show a saved analysis, or start one automatically when a key is set
  useEffect(() => {
    if (key === null) return;
    const cached = read(cacheKey);
    if (cached) { setText(cached); setStatus("done"); return; }
    setText(""); setStatus("idle");
    if (key && auto) run();
    return () => streamRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cacheKey]);

  async function run() {
    streamRef.current?.abort();
    setText(""); setError(""); setStatus("running");
    try {
      const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: "medium" },
        // If Claude declines, Anthropic re-runs the request on a suitable fallback model
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      });
      streamRef.current = stream;
      let out = "";
      stream.on("text", (t) => { out += t; setText(out); });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") {
        setStatus("error");
        setError("Claude declined to analyse this one. Try opening it in claude.ai below instead.");
        return;
      }
      out = finalText(msg) || out;
      if (msg.stop_reason === "max_tokens") out += "\n\n…(cut off)";
      setText(out);
      setAnsweredBy(msg.model);
      setStatus("done");
      saveTake(cacheKey, data.symbol, out);
    } catch (e) {
      if (e instanceof Anthropic.APIUserAbortError) return;
      setStatus("error");
      if (e instanceof Anthropic.AuthenticationError) setError("Your API key was rejected. Remove it and add it again.");
      else if (e instanceof Anthropic.PermissionDeniedError) setError("This API key isn't allowed to use this model.");
      else if (e instanceof Anthropic.RateLimitError) setError("Rate limited by Anthropic. Wait a minute and try again.");
      else if (e instanceof Anthropic.APIError) setError(`Anthropic API error ${e.status ?? ""}: ${e.message}`);
      else setError("Couldn't reach Anthropic. Check your connection and try again.");
    }
  }

  function saveKey(e) {
    e.preventDefault();
    const k = draftKey.trim();
    if (!k) return;
    write(KEY_STORE, k);
    setDraftKey("");
    setShowSetup(false);
    setKey(k);
  }

  function forgetKey() {
    streamRef.current?.abort();
    write(KEY_STORE, null);
    setKey("");
    setStatus("idle");
    setText("");
  }

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    write(AUTO_STORE, next ? "on" : "off");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  const href = claudeUrl(prompt);
  if (key === null) return null;

  return (
    <section className="card claude">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>✳ Claude&apos;s take</h2>
        {key && <span className="small muted">{modelName(answeredBy)} · your key</span>}
      </div>

      {key ? (
        <>
          {status === "running" && !text && <p className="small muted thinking">Claude is reading the data…</p>}
          {text && <div className="take">{renderMarkdown(text)}</div>}
          {status === "error" && <p className="notice small">{error}</p>}
          {status === "idle" && (
            <button type="button" onClick={run} style={{ marginTop: 8 }}>Write Claude&apos;s take</button>
          )}
          <div className="row small" style={{ marginTop: 10, gap: 12 }}>
            {status === "running"
              ? <button type="button" className="link" onClick={() => { streamRef.current?.abort(); setStatus(text ? "done" : "idle"); }}>Stop</button>
              : (status === "done" || status === "error") && <button type="button" className="link" onClick={run}>Regenerate</button>}
            <label className="inline-check"><input type="checkbox" checked={auto} onChange={toggleAuto} /> Write automatically</label>
            <button type="button" className="link" onClick={forgetKey}>Remove key</button>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            About 2–3 US cents per stock on your API account, saved here until the next data update. Analysis to help you
            think, not personal financial advice.
          </p>
        </>
      ) : (
        <>
          <p className="small muted" style={{ marginTop: 6 }}>
            Add your Anthropic API key and Claude writes a balanced analysis automatically whenever you open a stock
            (about 2–3 US cents each, billed to your API account).
          </p>
          {showSetup ? (
            <form onSubmit={saveKey}>
              <input type="password" autoComplete="off" spellCheck={false} value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)} placeholder="sk-ant-…" aria-label="Anthropic API key" />
              <p className="small muted">
                Create one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com ↗</a> and
                set a monthly spend limit there. The key is stored in this browser and sent only to Anthropic, but any
                other site you host on the same <code>github.io</code> address could read it, so use a key just for this app.
              </p>
              <div className="row" style={{ gap: 8 }}>
                <button type="submit" disabled={!draftKey.trim()}>Save key</button>
                <button type="button" className="ghost" onClick={() => setShowSetup(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setShowSetup(true)}>Add API key</button>
          )}
        </>
      )}

      <details style={{ marginTop: 12 }}>
        <summary className="small muted">Other ways: open in claude.ai, or copy the prompt</summary>
        <div className="row small" style={{ marginTop: 8, gap: 12 }}>
          <a className="button small-btn" href={href} target="_blank" rel="noreferrer">Open in claude.ai ↗</a>
          <button type="button" className="link" onClick={copy}>{copied ? "Copied ✓" : "Copy the prompt"}</button>
        </div>
        <pre className="prompt">{prompt}</pre>
      </details>
    </section>
  );
}

// claude.ai link with the prompt pre-filled. Trims by whole characters (never splitting an emoji)
// and drops any broken characters, which would otherwise make encodeURIComponent throw.
function claudeUrl(prompt) {
  const chars = Array.from(prompt);
  let text = chars.length > MAX_URL_PROMPT ? chars.slice(0, MAX_URL_PROMPT).join("") + "\n…(trimmed)" : prompt;
  text = wellFormed(text);
  try {
    return `https://claude.ai/new?q=${encodeURIComponent(text)}`;
  } catch {
    return "https://claude.ai/new";
  }
}

// Drop half-pair (surrogate) characters. Written as a plain loop because the regex shortcut
// (lookbehind) crashes the page on older iPhones (Safari before iOS 16.4).
function wellFormed(s) {
  if (typeof s.toWellFormed === "function") return s.toWellFormed();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { out += s[i] + s[i + 1]; i++; }
    } else if (!(c >= 0xdc00 && c <= 0xdfff)) out += s[i];
  }
  return out;
}

// Minimal, safe markdown: headings, bullets and **bold**. Builds React elements (no raw HTML),
// so nothing in the model's reply can inject markup.
function renderMarkdown(md) {
  const inline = (line, k) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={`${k}-${i}`}>{part.slice(2, -2)}</strong> : part);
  const out = [];
  let list = [];
  const flush = (k) => { if (list.length) { out.push(<ul key={`ul-${k}`}>{list}</ul>); list = []; } };
  md.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,4}\s+(.*)/);
    const b = line.match(/^\s*[-*•]\s+(.*)/);
    if (h) { flush(i); out.push(<h3 key={i}>{inline(h[1], i)}</h3>); }
    else if (b) list.push(<li key={i}>{inline(b[1], i)}</li>);
    else if (line.trim()) { flush(i); out.push(<p key={i}>{inline(line, i)}</p>); }
    else flush(i);
  });
  flush("end");
  return out;
}
