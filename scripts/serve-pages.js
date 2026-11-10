// Serves the built site (out/) under /call-journal/, the way GitHub Pages will.
// Build first:  NEXT_PUBLIC_BASE_PATH=/call-journal npm run build
// Then:         node scripts/serve-pages.js   ->  http://localhost:4000/call-journal/

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../out/", import.meta.url));
const PREFIX = "/call-journal";
const PORT = Number(process.env.PORT || 4000);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".txt": "text/plain",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return res.writeHead(400).end("Bad request");
  }
  if (!path.startsWith(PREFIX)) {
    res.writeHead(302, { Location: `${PREFIX}/` }).end();
    return;
  }
  let file = normalize(join(ROOT, path.slice(PREFIX.length)));
  if (!file.startsWith(normalize(ROOT))) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(await readFile(join(ROOT, "404.html")).catch(() => "Not found"));
  }
}).listen(PORT, () => console.log(`Serving out/ at http://localhost:${PORT}${PREFIX}/`));
