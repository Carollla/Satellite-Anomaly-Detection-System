import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoBase = "/Satellite-Anomaly-Detection-System/";
const baseScript = `<script>document.write('<base href="' + (location.hostname.endsWith('.github.io') ? '${repoBase}' : '/') + '">');</script>`;
const adapterScript = `<script src="assets/spaceman-pages-adapter.js"></script>`;

for (const file of listFiles(root)) {
  if (extname(file).toLowerCase() !== ".html") continue;
  let html = readFileSync(file, "utf8");

  html = html
    .replace(/(href|src)="\/(?!\/|Satellite-Anomaly-Detection-System\/)/g, `$1="`)
    .replace(/url\(\/(?!\/|Satellite-Anomaly-Detection-System\/)/g, "url(");

  if (!html.includes("<base href=")) {
    html = html.includes("<head>")
      ? html.replace("<head>", `<head>\n${baseScript}`)
      : `${baseScript}\n${html}`;
  }

  if (!html.includes("spaceman-pages-adapter.js")) {
    const moduleScript = html.match(/<script[^>]+src="assets\/main[^"]+\.js"[^>]*><\/script>/);
    html = moduleScript
      ? html.replace(moduleScript[0], `${adapterScript}\n  ${moduleScript[0]}`)
      : html.replace("</head>", `${adapterScript}\n</head>`);
  }

  try {
    writeFileSync(file, html, "utf8");
  } catch (error) {
    if (error && error.code === "EPERM") {
      console.warn(`Skipped read-only HTML: ${file}`);
      continue;
    }
    throw error;
  }
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "dist-pages" || entry.name === "data") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
