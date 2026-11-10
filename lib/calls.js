// Your calls live in this browser only (no accounts yet).
// Clearing site data, or opening the app on another device, starts you with an empty journal.

const KEY = "call-journal:calls:v1";

export function loadCalls() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

// Returns false if the browser refused to save (e.g. storage full or blocked)
function save(calls) {
  try {
    localStorage.setItem(KEY, JSON.stringify(calls));
    return true;
  } catch {
    return false;
  }
}

// Throws if the call couldn't be saved, so the form can say so instead of silently losing it
export function addCall(call) {
  const calls = [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...call }, ...loadCalls()];
  if (!save(calls)) throw new Error("Your browser couldn't save this call (storage full or blocked).");
  return calls;
}

export function deleteCall(id) {
  const calls = loadCalls().filter((c) => c.id !== id);
  save(calls);
  return calls;
}

export function dueDate(call) {
  const due = new Date(call.createdAt);
  due.setDate(due.getDate() + call.horizonDays);
  return due;
}

// Once a call's check-back date has passed, lock in the closing price on that date
// (or the next trading day) so the grade never changes afterwards.
// `history` is the stock's daily closes [{date: "YYYY-MM-DD", close}], oldest first.
// `closedThrough` is the last date with a final close (the daily full run's date): during the day,
// the newest chart point is a live price, which must not be locked in as a closing price.
export function settleCall(id, history, closedThrough) {
  const calls = loadCalls();
  const call = calls.find((c) => c.id === id);
  if (!call || call.exitPrice != null || !history?.length) return calls;
  const day = dueDate(call).toISOString().slice(0, 10);
  if (day < history[0].date) return calls; // older than our chart data: can't find the right close
  const point = history.find((p) => p.date >= day && (!closedThrough || p.date <= closedThrough));
  if (!point) return calls; // the check-back day hasn't closed yet in our data
  call.exitPrice = point.close;
  call.exitDate = point.date;
  save(calls);
  return calls;
}

// How a call is doing. Settled calls use their locked-in exit price; others use the latest price.
// "right" means the price moved the way you said: up for bullish, down for bearish.
export function grade(call, currentPrice) {
  const due = dueDate(call);
  const open = Date.now() < due.getTime();
  const price = call.exitPrice ?? currentPrice;
  if (typeof price !== "number") return { open, due, movePct: null, right: null };
  const movePct = ((price - call.entryPrice) / call.entryPrice) * 100;
  const yourWayPct = call.direction === "bull" ? movePct : -movePct;
  // A move of exactly 0 is "flat": neither right nor wrong yet.
  return {
    open, due, movePct, yourWayPct, settled: call.exitPrice != null,
    right: yourWayPct === 0 ? null : yourWayPct > 0, flat: yourWayPct === 0,
  };
}

export const HORIZONS = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
];
