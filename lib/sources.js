// Fetches prices and news from free, keyless, UNOFFICIAL sources.
// Used only by scripts/fetch-data.js (at build time / in the scheduled GitHub job), never in the browser.
//
//   News           : Yahoo Finance RSS, Google News RSS, Seeking Alpha RSS (US), Nasdaq RSS (US)
//   Analyst news   : Google News RSS search for "<ticker or company> analyst price target"
//
// These feeds are for personal, non-commercial use and can change or block requests without warning.

export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw Object.assign(new Error(`${new URL(url).hostname} ${res.status}`), { status: res.status });
  return res;
}

// ---------- News ----------
// Every stock: Yahoo Finance feed + a Google News search.
// Largest US stocks also get Seeking Alpha and Nasdaq (only they are worth the extra requests).
function feedsFor(symbol, market, name, top) {
  const q = (x) => encodeURIComponent(x);
  // Google's search is fuzzy, so keep only headlines that name the company or ticker
  const google = (query) => ({ outlet: null, url: `https://news.google.com/rss/search?q=${q(query)}&hl=en-US&gl=US&ceid=US:en`, mustMatch: relevance(symbol, market, name) });
  const feeds = [
    { outlet: "Yahoo Finance", url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${q(symbol)}&region=US&lang=en-US` },
    google(market === "US" ? `${symbol} stock` : `"${cleanName(name)}" shares`),
  ];
  if (market === "US" && top) {
    feeds.push(
      { outlet: "Seeking Alpha", url: `https://seekingalpha.com/api/sa/combined/${q(symbol)}.xml` },
      { outlet: "Nasdaq", url: `https://www.nasdaq.com/feed/rssoutbound?symbol=${q(symbol)}` },
    );
  }
  return feeds;
}

// "Tencent Holdings Limited" -> "Tencent Holdings" (specific enough to skip Tencent Music etc.)
function cleanName(name) {
  const cleaned = name
    .replace(/\b(limited|ltd|inc|corp|corporation|plc|co|company)\b\.?/gi, "")
    .replace(/,+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name;
}

// Merge several feeds, drop duplicates, newest first.
async function mergeFeeds(feeds, limit) {
  const results = await Promise.allSettled(feeds.map(async (f) => {
    const items = parseRss(await (await get(f.url)).text(), f.outlet);
    if (!f.mustMatch) return items;
    const relevant = items.filter((n) => f.mustMatch.test(n.title));
    // If nothing matches, the company is probably known by another name: keep the search results
    return relevant.length ? relevant : items;
  }));
  const seen = new Set();
  const items = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const n of r.value) {
      // Letters and digits in any script, so Chinese headlines don't all collapse to one key
      const key = n.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(n);
    }
  }
  const failed = results.filter((r) => r.status === "rejected").map((r) => r.reason.message);
  items.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
  return { items: items.slice(0, limit), failed };
}

export const fetchNews = (symbol, market, name, top = false) => mergeFeeds(feedsFor(symbol, market, name, top), 30);

export const fetchAnalystNews = (symbol, market, name) => {
  const subject = market === "US" ? symbol : `"${cleanName(name)}"`;
  return mergeFeeds([{
    outlet: null,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${subject} analyst price target`)}&hl=en-US&gl=US&ceid=US:en`,
    mustMatch: relevance(symbol, market, name),
  }], 10);
};

// Headline must mention the ticker (US) or the company's first distinctive word ("Tencent", "DBS").
// "Tencent Music" still matches "Tencent", but unrelated stories (other companies) are dropped.
function relevance(symbol, market, name) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const words = cleanName(name).split(" ").filter((w) => w.length >= 3 && !/^(the|group|holdings?|international|technologies|bank)$/i.test(w));
  const terms = [words[0] || cleanName(name)];
  if (market === "US") terms.push(symbol.replace("-", "."), symbol);
  else terms.push(symbol.replace(/\.(HK|SI)$/, "").replace(/^0+/, "")); // "700", "D05"
  // Initials, for companies known by an abbreviation: "Oversea-Chinese Banking Corporation" -> "OCBC"
  const initials = name.split(/[\s-]+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("");
  if (initials.length >= 3) terms.push(initials);
  // Unicode-aware word edges, so names with accents or non-Latin letters still match
  return new RegExp(`(?<![\\p{L}\\p{N}])(${terms.filter(Boolean).map(esc).join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

export function parseRss(xml, defaultOutlet) {
  const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
    return m ? decode(m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim()) : null;
  };
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)].map(([, b]) => {
    let title = tag(b, "title") || "";
    let outlet = tag(b, "source");
    // Google News appends the publisher to the title: "Headline - Reuters"
    if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3));
    // Yahoo syndicates other outlets and names them at the start of the description: "Reuters -- ..."
    const lead = (tag(b, "description") || "").match(/^([A-Z][\w.&' ]{1,30}?)\s?--/);
    if (!outlet && lead) outlet = lead[1].trim();
    outlet = outlet || defaultOutlet;
    const link = tag(b, "link");
    if (!outlet && link) {
      try { outlet = new URL(link).hostname.replace(/^www\./, ""); } catch {}
    }
    const date = tag(b, "pubDate");
    const time = date && !isNaN(new Date(date)) ? new Date(date).toISOString() : null;
    return { title: stripTags(title), url: link, outlet: outlet || "Unknown", time };
  }).filter((n) => n.title && /^https?:\/\//.test(n.url || ""));
}

const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();

// Skip invalid or half-pair (surrogate) code points: they'd make broken text that crashes URL encoding
const codePoint = (n) => (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "");

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => codePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
