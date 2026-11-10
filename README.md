# Call Journal

Research any US, Hong Kong or Singapore stock, write down your call (bullish or bearish, plus why), and get graded when the check-back date comes.
It's a practice journal for building trading judgement before real money is involved. It is not investment advice.

## What's in it

- **~9,600 stocks**: every actively traded company in the US (about 6,500), Hong Kong (about 2,600) and Singapore (about 530).
- **For every stock:**
  - price and day change
  - 6-month chart
  - company profile
  - key numbers (valuation, margins, growth, cash and debt)
  - analyst consensus and price targets
  - yearly and quarterly financial statements
  - news from Yahoo Finance and Google News
- **Extra for the largest companies** (top 500 US, 100 HK, 40 SG):
  - Seeking Alpha and Nasdaq news (US)
  - analyst write-ups
  - firm-by-firm rating changes, with a "Big banks" filter (US only)
- **Stocks page:**
  - ★ favourites
  - market tabs
  - quick lists: top gainers and losers, most traded, near 52-week high or low, analyst upside, high dividend, low P/E
  - filters for sector, company size and analyst rating
  - sorting, including A–Z
  - market breadth: how many stocks rose versus fell
  - a "sectors today" view
- **Claude's take:** add your Anthropic API key once, and Claude (Opus 5.5) writes a balanced analysis automatically whenever you open a stock. It costs about 2–3 US cents per stock on your API account. Each analysis is saved in your browser until the next daily data update, so reopening a stock doesn't charge again. The key stays in your browser and is sent only to Anthropic. Without a key, a button opens claude.ai with the same data filled in.
- **Installable app:**
  - On Chrome, Edge, Android or desktop: click **Install app**.
  - On iPhone or iPad: in Safari, tap Share → **Add to Home Screen**.
  - It opens full-screen with its own icon, and shows the last data you viewed when you're offline.
- **Your calls** are saved in your browser, with a scorecard of your hit rate.

## Where the data comes from

Free public sources, no sign-ups or API keys: Yahoo Finance (screener, prices, analyst data, financials) and RSS news feeds from Yahoo Finance, Google News, Seeking Alpha and Nasdaq.

These sources are **unofficial** and meant for personal, non-commercial use. They can change or block requests without warning.

## How it works

GitHub Pages can only host static files, so the data is collected ahead of time by `.github/workflows/deploy.yml`:

- **Full run, once a day** (22:30 UTC on weekdays, about 20–30 minutes): collects everything for every stock.
- **Prices run, every 15 minutes while markets are open** (01:00–09:00 UTC for HK and SG, 13:00–22:00 UTC for the US): refreshes prices in the last full run's data. That data is kept between runs in the Actions cache.

Open pages reload prices every 5 minutes. Prices come from free sources and can be delayed up to about 15 minutes. GitHub also sometimes starts scheduled jobs late. So this is near-live, not tick-by-tick.

You can start either run by hand: in the repository's **Actions** tab, open **Update data and deploy** and click **Run workflow**.

If most stocks fail to download (for example, because a source blocks the request), the job stops and the previous version of the site stays up.

## Run it on your computer

```bash
npm install
npm run fetch-data
npm run dev
```

Then open http://localhost:3000. The full data collection takes about 15 minutes. For a quick test with fewer stocks, or to update only prices:

```bash
LIMIT=100 npm run fetch-data
```

```bash
MODE=prices npm run fetch-data
```

## Preview the published version locally

This serves the built site under `/call-journal/`, the same way GitHub Pages does:

```bash
NEXT_PUBLIC_BASE_PATH=/call-journal npm run build
```

```bash
npm run preview
```

Then open http://localhost:4000/call-journal/.

## Code map

- `lib/universe.js`: lists every stock per market (Yahoo screener) and fetches charts in batches.
- `lib/yahoo.js`: analyst ratings, price targets, key numbers and financial statements.
- `lib/sources.js`: news from the RSS feeds.
- `lib/calls.js`: saves your calls in the browser and grades them.
- `lib/format.js`: number and currency formatting, and loading the data files.
- `components/AppShell.js`, `public/sw.js`, `public/manifest.webmanifest`: the installable app (install button, offline cache, icon).
- `scripts/fix-export.js`: a post-build fix so page switches don't do full reloads on GitHub Pages.
- `app/page.js` and `components/MarketPulse.js`: search, filters, quick lists and market breadth. `lib/favorites.js`: favourites. `components/ClaudeTake.js`: the Claude prompt. `app/stock/page.js` with `components/`: the stock page. `app/calls/page.js`: your scorecard.

## Known limits

- Prices are near-live (about every 15 minutes, may be delayed), not tick-by-tick.
- Calls, favourites, your API key and saved Claude analyses are kept in this browser only. Clearing site data or switching devices loses them.
- A call is graded on the closing price of its check-back date, which is locked in the first time you open My calls after that date.
- Anything else hosted on your `<username>.github.io` site can read data saved in this browser, including the API key. Use a key with a monthly spend limit.
- GitHub pauses scheduled jobs in repositories with no activity for 60 days. Re-enable the job from the Actions tab if that happens.
