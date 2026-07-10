import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "dist-pages");
const repoBase = "/Satellite-Anomaly-Detection-System";

const skip = new Set([
  ".git",
  ".github",
  ".agents",
  ".codex",
  "dist-pages",
  "server.mjs",
  "server.err.log",
  "server.out.log",
  "spaceman-ai.config.json",
  "\u89c6\u9891.mp4"
]);

const skipDirs = new Set([
  "data"
]);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

copyTree(root, out);
writeFileSync(join(out, ".nojekyll"), "", "utf8");

const adapter = `<script src="${repoBase}/assets/spaceman-pages-adapter.js?v=20260710-perf3"></script>`;
for (const file of listFiles(out)) {
  if (extname(file).toLowerCase() !== ".html") continue;
  let html = readFileSync(file, "utf8");
  html = html
    .replace(/(href|src)="\/(?!\/)/g, `$1="${repoBase}/`)
    .replace(/url\(\/(?!\/)/g, `url(${repoBase}/`);
  html = html.replace(/\s*<script\s+src=["'][^"']*spaceman-pages-adapter\.js(?:\?[^"']*)?["']><\/script>/g, "");
  if (html.includes("assets/main.localfix3.js")) {
    html = html.replace(/(\s*<script\b(?=[^>]*assets\/main\.localfix3\.js)[^>]*><\/script>)/, `\n  ${adapter}$1`);
  } else {
    html = html.includes("</head>") ? html.replace("</head>", `${adapter}</head>`) : `${adapter}${html}`;
  }
  writeFileSync(file, html, "utf8");
}

console.log(`Built GitHub Pages bundle at ${relative(root, out)}`);

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    const sourcePath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourcePath, destPath);
    } else if (entry.isFile()) {
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(sourcePath, destPath);
    }
  }
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
