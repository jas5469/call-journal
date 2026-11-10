"use client";

// Makes the site an installable app: registers the service worker and shows an "Install app" button.
// Chrome, Edge and Android offer a one-click install; iPhone/iPad need Share → Add to Home Screen.
import { useEffect, useState } from "react";
import { BASE } from "@/lib/format";

export default function AppShell() {
  const [prompt, setPrompt] = useState(null);   // the browser's install prompt, when offered
  const [iosHint, setIosHint] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios && !standalone) setIosHint(true);

    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setPrompt(null);
    const onNet = () => setOffline(!navigator.onLine);
    onNet();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    setPrompt(null);
  }

  return (
    <>
      {prompt && <button type="button" className="install" onClick={install}>⬇ Install app</button>}
      {!prompt && iosHint && (
        <button type="button" className="install" onClick={() => setShowIos(!showIos)}>⬇ Install app</button>
      )}
      {showIos && (
        <div className="ios-hint" role="dialog" aria-label="How to install on iPhone or iPad">
          In Safari, tap <strong>Share</strong> (the square with an arrow), then <strong>Add to Home Screen</strong>.
          <button type="button" className="link" onClick={() => setShowIos(false)}>Close</button>
        </div>
      )}
      {offline && <div className="offline">You&apos;re offline: showing the last data you opened.</div>}
    </>
  );
}
