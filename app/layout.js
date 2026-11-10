import Link from "next/link";
import AppShell from "@/components/AppShell";
import { APP_ENV } from "@/lib/format";
import "./globals.css";

// Files in public/ are served under the GitHub Pages sub-path, so app metadata links need it too
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const DEV = APP_ENV === "dev";

export const metadata = {
  title: DEV ? "Call Journal (dev)" : "Call Journal",
  robots: DEV ? { index: false, follow: false } : undefined,
  description: "Research US, Hong Kong and Singapore stocks, make a call, and see if you were right.",
  applicationName: "Call Journal",
  manifest: `${BASE}/manifest.webmanifest`,
  icons: {
    icon: [{ url: `${BASE}/icons/favicon-32.png`, sizes: "32x32" }, { url: `${BASE}/icons/icon-192.png`, sizes: "192x192" }],
    apple: `${BASE}/icons/apple-touch-icon.png`,
  },
  appleWebApp: { capable: true, title: "Call Journal", statusBarStyle: "black-translucent" },
};

export const viewport = {
  themeColor: "#0f1216",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // use the full screen on phones with a notch when opened as an app
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="logo">◆</span> Call Journal
            {DEV && <span className="dev-badge" title="Test site: changes here aren't live yet">DEV</span>}
          </Link>
          <nav>
            <AppShell />
            <Link href="/">Stocks</Link>
            <Link href="/calls/">My calls</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          Practice journal for learning. Not investment advice. Prices refresh about every 15 minutes in market hours (may be delayed); company data daily. Sources: Yahoo Finance, Google News, Seeking Alpha, Nasdaq.
        </footer>
      </body>
    </html>
  );
}
