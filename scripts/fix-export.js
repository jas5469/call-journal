// Runs after `next build`. The static export saves page preload files as
//   out/calls/__next.calls/__PAGE__.txt
// but the browser asks for
//   out/calls/__next.calls.__PAGE__.txt
// Without a copy at the second path, GitHub Pages returns 404 and every page switch becomes a
// slower full reload. This adds the flat-named copies.

import { copyFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../out/", import.meta.url));
let copied = 0;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (!entry.isDirectory() || entry.name === "data" || entry.name === "_next") continue;
    if (entry.name.startsWith("__next.")) await flatten(full, dir, entry.name);
    else await walk(full);
  }
}

// Copy every file inside __next.x/... to the parent folder as __next.x.<path with dots>
async function flatten(nextDir, parent, prefix) {
  for (const entry of await readdir(nextDir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const rel = join(entry.parentPath ?? entry.path, entry.name).slice(nextDir.length + 1);
    await copyFile(join(nextDir, rel), join(parent, `${prefix}.${rel.replace(/[\\/]/g, ".")}`));
    copied++;
  }
}

await walk(OUT);
console.log(`fix-export: added ${copied} preload file copies`);
