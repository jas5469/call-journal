import { big, isNum, money, num, pct } from "@/lib/format";

// The "at a glance" numbers. Each tile has a one-line plain-English hint on hover.
export default function KeyStats({ stats, price, currency }) {
  if (!stats) {
    return <section className="card"><h2>At a glance</h2><p className="muted small">Not available for this stock.</p></section>;
  }
  const s = stats;
  // Market cap is in the trading currency; company figures are in the currency the company reports in
  const fc = s.financialCurrency || currency;
  const net = isNum(s.totalCash) && isNum(s.totalDebt) ? s.totalCash - s.totalDebt : null;
  const range52 = isNum(s.fiftyTwoWeekLow) && isNum(s.fiftyTwoWeekHigh) && s.fiftyTwoWeekHigh > s.fiftyTwoWeekLow
    ? Math.min(Math.max((price - s.fiftyTwoWeekLow) / (s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow), 0), 1)
    : null;

  const tiles = [
    ["Market cap", big(s.marketCap, currency), "Total value of all shares"],
    ["P/B", num(s.priceToBook), "Price ÷ book value (net assets) per share"],
    ["EPS (12m)", money(s.eps, 2, currency), "Earnings per share over the last 12 months"],
    ["P/E (trailing)", num(s.trailingPE, 1), "Price ÷ last 12 months' earnings per share"],
    ["P/E (forward)", num(s.forwardPE, 1), "Price ÷ next 12 months' expected earnings"],
    ["PEG", num(s.pegRatio), "P/E divided by expected growth; around 1 is often called fair"],
    ["Revenue (12m)", big(s.revenue, fc), "Sales over the last 12 months"],
    ["Revenue growth", pct(s.revenueGrowth, { ratio: true, signed: true }), "Latest quarter vs the same quarter last year"],
    ["Earnings growth", pct(s.earningsGrowth, { ratio: true, signed: true }), "Latest quarter vs the same quarter last year"],
    ["Gross margin", pct(s.grossMargin, { ratio: true }), "Share of revenue left after the direct cost of sales"],
    ["Operating margin", pct(s.operatingMargin, { ratio: true }), "Share of revenue left after running costs"],
    ["Net margin", pct(s.profitMargin, { ratio: true }), "Share of revenue kept as profit"],
    ["Return on equity", pct(s.returnOnEquity, { ratio: true }), "Profit ÷ shareholders' equity"],
    ["Free cash flow", big(s.freeCashflow, fc), "Cash generated after investment, last 12 months"],
    ["Cash", big(s.totalCash, fc), "Cash and short-term investments"],
    ["Debt", big(s.totalDebt, fc), "Total borrowings"],
    ["Net cash", big(net, fc), "Cash minus debt; negative means net debt"],
    ["Dividend yield", pct(s.dividendYield, { ratio: true, digits: 2 }), "Yearly dividend ÷ price"],
    ["Beta", num(s.beta), "Volatility vs the market; 1 = moves with the market"],
  ].filter(([, v]) => v !== "—");

  return (
    <section className="card">
      <h2>At a glance</h2>
      {tiles.length === 0 && <p className="muted small">No company figures for this one (it may be a fund).</p>}
      <div className="tiles">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="tile" title={hint}>
            <div className="small muted">{label}</div>
            <div className="tile-num">{value}</div>
          </div>
        ))}
      </div>
      {range52 != null && (
        <div style={{ marginTop: 14 }}>
          <div className="small muted">52-week range</div>
          <div className="rangebar"><div className="dot" style={{ left: `${range52 * 100}%` }} /></div>
          <div className="row small muted" style={{ justifyContent: "space-between" }}>
            <span>{money(s.fiftyTwoWeekLow, 2, currency)}</span><span>now {money(price, 2, currency)}</span><span>{money(s.fiftyTwoWeekHigh, 2, currency)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
