import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const original = "u_orbitFlow:(this._orbitFlow??1)&&this.highlightedOrbits.size<=3?1:0";
const patched = "u_orbitFlow:(this._orbitFlow??1)&&this.highlightedOrbits.size<=64?1:0";

if (source.includes(patched)) {
  console.log("Orbit flow animation patch is already installed");
} else {
  const count = source.split(original).length - 1;
  if (count !== 1) throw new Error(`Expected one orbit flow expression, found ${count}`);
  source = source.replace(original, patched);
  writeFileSync(bundlePath, source, "utf8");
  console.log("Enabled orbit flow animation for persistent MEO/GEO orbits");
}
