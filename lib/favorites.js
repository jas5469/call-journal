"use client";

// Favourite stocks, saved in this browser. Components stay in sync through a small event.
import { useEffect, useState } from "react";
import { STORE } from "./format";

const KEY = `${STORE}favorites:v1`;
const EVENT = `${STORE}favorites`;

export function loadFavorites() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(symbol) {
  const favs = loadFavorites();
  const next = favs.includes(symbol) ? favs.filter((s) => s !== symbol) : [...favs, symbol];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
  return next;
}

export function useFavorites() {
  const [favs, setFavs] = useState([]);
  useEffect(() => {
    const sync = () => setFavs(loadFavorites());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // other tabs
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return favs;
}

export function Star({ symbol, favs, size = 18 }) {
  const on = favs.includes(symbol);
  return (
    <button
      type="button"
      className={`star ${on ? "on" : ""}`}
      style={{ fontSize: size }}
      aria-pressed={on}
      aria-label={on ? `Remove ${symbol} from favourites` : `Add ${symbol} to favourites`}
      title={on ? "Remove from favourites" : "Add to favourites"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(symbol); }}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
