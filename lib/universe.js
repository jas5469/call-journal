// Lists every stock on the US, Singapore and Hong Kong exchanges using Yahoo's screener,
// plus 6-month price history in batches. Keyless, unofficial.

import { yahooJson } from "./yahoo.js";
import { UA } from "./sources.js";

// Yahoo exchange codes per market. US excludes over-the-counter (OTC/pink-sheet) listings.
export const MARKETS = {
  US: { region: "us", exchanges: ["NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS"] },
  HK: { region: "hk", exchanges: ["HKG"] },
  SG: { region: "sg", exchanges: ["SES"] },
};

const PAGE = 250;

async function screenPage(market, offset) {
  const { region, exchanges } = MARKETS[market];
  const body = {
    size: PAGE,
    offset,
    sortField: "intradaymarketcap",
    sortType: "DESC",
    quoteType: "EQUITY",
    query: {
      operator: "AND",
      operands: [
        { operator: "EQ", operands: ["region", region] },
        { operator: "OR", operands: exchanges.map((e) => ({ operator: "EQ", operands: ["exchange", e] })) },
      ],
    },
    userId: "",
    userIdType: "guid",
  };
  const json = await yahooJson("https://query2.finance.yahoo.com/v1/finance/screener?lang=en-US&region=US&formatted=false", { method: "POST", body });
  const r = json.finance?.result?.[0];
  if (!r) throw new Error(json.finance?.error?.description || "screener returned nothing");
  return { total: r.total, quotes: r.quotes || [] };
}

// Score "2.3 - Buy" -> "buy" (same keys as quoteSummary's recommendationKey)
function consensusFrom(rating) {
  const score = parseFloat(rating);
  if (!isFinite(score)) return null;
  if (score <= 1.5) return "strong_buy";
  if (score <= 2.5) return "buy";
  if (score <= 3.5) return "hold";
  if (score <= 4.5) return "underperform";
  return "sell";
}

const n = (v) => (typeof v === "number" && isFinite(v) ? v : null);

function toStock(q, market) {
  return {
    symbol: q.symbol,
    market,
    name: q.longName || q.shortName || q.displayName || q.symbol,
    shortName: q.shortName || q.longName || q.symbol,
    exchange: q.fullExchangeName || q.exchange,
    currency: q.currency || null,
    price: n(q.regularMarketPrice),
    change: n(q.regularMarketChange),
    changePct: n(q.regularMarketChangePercent),
    asOf: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : null,
    consensus: consensusFrom(q.averageAnalystRating),
    ratingScore: n(parseFloat(q.averageAnalystRating)),
    stats: {
      marketCap: n(q.marketCap),
      trailingPE: n(q.trailingPE),
      forwardPE: n(q.forwardPE),
      priceToBook: n(q.priceToBook),
      eps: n(q.epsTrailingTwelveMonths),
      dividendYield: n(q.trailingAnnualDividendYield), // ratio, e.g. 0.0031
      fiftyTwoWeekLow: n(q.fiftyTwoWeekLow),
      fiftyTwoWeekHigh: n(q.fiftyTwoWeekHigh),
      avgVolume3m: n(q.averageDailyVolume3Month),
      volume: n(q.regularMarketVolume),
    },
  };
}

// Yahoo also lists inactive codes (HK has ~9,600 entries but only ~2,600 real stocks),
// so keep only stocks that have traded in the last 3 months.
function keep(s, market) {
  if (s.price == null || s.price <= 0) return false;
  if (!(s.stats.avgVolume3m > 0)) return false;
  if (!s.currency) return false;
  // HK: ordinary HKD lines only (the RMB "8xxxx" counters duplicate their HKD line)
  if (market === "HK" && (!/^\d{4,5}\.HK$/.test(s.symbol) || s.currency !== "HKD")) return false;
  if (market === "SG" && !/\.SI$/.test(s.symbol)) return false;
  if (market === "US") {
    // Skip preferred shares, warrants, units and rights: by ticker (BAC-PE, XYZ-WT, ABC-U, DEF-R)
    // and by name, which also catches Nasdaq-style tickers without a dash (ACGLO, AGNCN, LUCYW)
    if (/\./.test(s.symbol) || /-(P[A-Z]?|WT|WS|U|UN|R|RT)$/.test(s.symbol)) return false;
    // Phrases are specific so real companies like "Preferred Bank" or MLP "Common Units" stay in
    if (/\b(warrants?|preferred (stock|shares?|securities)|preference shares|series [a-z]+ preferred|depositary shares,? each representing|units?,? each consisting|rights?,? each|subordinated debentures|notes due|% (senior |subordinated )?notes)\b/i.test(s.name)) return false;
  }
  return true;
}

export async function listMarket(market, { log = () => {} } = {}) {
  const out = new Map();
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await screenPage(market, offset);
    total = page.total;
    if (!page.quotes.length) break;
    for (const q of page.quotes) {
      const s = toStock(q, market);
      if (keep(s, market)) out.set(s.symbol, s);
    }
    offset += PAGE;
    log(`  ${market}: ${Math.min(offset, total)}/${total}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  return [...out.values()];
}

// 6-month daily closes for up to 20 symbols per request.
export async function fetchSpark(symbols) {
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(",")}&range=6mo&interval=1d`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 5000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`spark ${res.status}`);
    const json = await res.json();
    const out = {};
    for (const [sym, d] of Object.entries(json)) {
      const ts = d?.timestamp || [];
      const close = d?.close || [];
      out[sym] = ts
        .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: close[i] }))
        .filter((p) => typeof p.close === "number")
        .map((p) => ({ ...p, close: +p.close.toFixed(4) }));
    }
    return out;
  }
  throw new Error("spark kept being rate limited");
}
