import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = join(__dirname, "..");

const V3_DIR = join(EXT_ROOT, "webview-ui");

if (!existsSync(V3_DIR)) {
  console.error(
    `ERROR: in-project webview UI folder not found at "${V3_DIR}". Expected the React UI source there.`
  );
  process.exit(1);
}

const V3_DIST = join(V3_DIR, "dist");
const TARGET_DIR = join(EXT_ROOT, "dist", "webview-ui");

if (!existsSync(V3_DIST)) {
  console.error(
    `ERROR: v3 build output not found at "${V3_DIST}". Build it first:\n  cd "${V3_DIR}" && npm install && npm run build`
  );
  process.exit(1);
}

if (existsSync(TARGET_DIR)) {
  rmSync(TARGET_DIR, { recursive: true, force: true });
}
mkdirSync(TARGET_DIR, { recursive: true });

// Copy entire dist directory (not just index.html)
function copyDir(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(V3_DIST, TARGET_DIR);

const indexFile = join(TARGET_DIR, "index.html");
const kb = (Buffer.byteLength(readFileSync(indexFile)) / 1024).toFixed(0);
console.log(`OK: synced v3 webview -> ${TARGET_DIR} (${kb} KB)`);
