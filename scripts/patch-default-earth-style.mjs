import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const original = "this.show_texstyle=this.show_texstyle??2";
const patched = "this.show_texstyle=this.show_texstyle??0";

if (source.includes(patched)) {
  console.log("Default Earth day/night style patch is already installed");
} else {
  const count = source.split(original).length - 1;
  if (count !== 1) throw new Error(`Expected one default texture style expression, found ${count}`);
  source = source.replace(original, patched);
  writeFileSync(bundlePath, source, "utf8");
  console.log("Set default Earth style to day/night high-resolution mode");
}
