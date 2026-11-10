// Small display + data-loading helpers shared by the pages.

// Files in public/ live under the GitHub Pages sub-path (e.g. /call-journal), so prefix fetches with it.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function loadJson(path) {
  const res = await fetch(`${BASE}/data/${path}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(res.status === 404 ? "not-found" : `HTTP ${res.status}`);
  return res.json();
}

export const loadStock = (symbol) => loadJson(`s/${encodeURIComponent(symbol)}.json`);

// index.json stores rows as arrays to stay small; turn them back into objects and add derived fields.
let indexPromise = null;
export function loadIndex({ refresh = false } = {}) {
  if (refresh) indexPromise = null;
  indexPromise ??= loadJson("index.json").then((d) => ({
    updatedAt: d.updatedAt,
    fx: d.fx || { USD: 1 },
    stocks: d.rows.map((r) => {
      const s = Object.fromEntries(d.columns.map((c, i) => [c, r[i]]));
      const rate = d.fx?.[s.currency] ?? null;
      s.tradedUsd = isNum(s.volume) && isNum(s.price) && rate ? s.volume * s.price * rate : null;
      s.upside = isNum(s.targetMean) && isNum(s.price) && s.price > 0 ? (s.targetMean / s.price - 1) * 100 : null;
      return s;
    }),
  })).catch((e) => { indexPromise = null; throw e; });
  return indexPromise;
}

// Re-run `fn` every few minutes while the page is open and visible, so prices stay current.
export function startAutoRefresh(fn, minutes = 5) {
  let last = Date.now();
  const run = () => {
    // Skip while the tab is hidden, and don't refetch more than once a minute when switching tabs
    if (document.visibilityState !== "visible" || Date.now() - last < 60000) return;
    last = Date.now();
    fn();
  };
  const id = setInterval(run, minutes * 60000);
  document.addEventListener("visibilitychange", run);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", run); };
}

export const stockHref = (symbol) => `/stock/?s=${encodeURIComponent(symbol)}`;

export const isNum = (n) => typeof n === "number" && isFinite(n);

const SYMBOLS = { USD: "$", SGD: "S$", HKD: "HK$", CNY: "CN¥", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$", TWD: "NT$" };
export const cur = (code) => (code ? SYMBOLS[code] ?? `${code} ` : "$");

export function money(n, digits = 2, currency = "USD", auto = true) {
  if (!isNum(n)) return "—";
  // Penny stocks (common in SG/HK) need more decimals to be meaningful.
  // Pass auto=false for amounts like a price change, where a small number doesn't mean a penny stock.
  const d = auto && Math.abs(n) < 1 && n !== 0 && digits === 2 ? 3 : digits;
  return `${n < 0 ? "-" : ""}${cur(currency)}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

// 5096291172352 -> "$5.10T"
export function big(n, currency = "USD") {
  if (!isNum(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const p = currency === null ? "" : cur(currency);
  for (const [v, s] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]]) {
    if (a >= v) return `${sign}${p}${(a / v).toFixed(2)}${s}`;
  }
  return `${sign}${p}${a.toFixed(2)}`;
}

// 0.117 -> "11.7%"  (ratio=true)   or   2.43 -> "+2.43%" (signed)
export function pct(n, { ratio = false, signed = false, digits = 1 } = {}) {
  if (!isNum(n)) return "—";
  const v = ratio ? n * 100 : n;
  return `${signed && v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export const num = (n, digits = 2) => (isNum(n) ? n.toFixed(digits) : "—");

export function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export const CONSENSUS = {
  strong_buy: "Strong buy", buy: "Buy", hold: "Hold", underperform: "Underperform", sell: "Sell",
};

export const MARKET_NAMES = { US: "United States", HK: "Hong Kong", SG: "Singapore" };
