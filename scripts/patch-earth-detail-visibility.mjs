import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const replacements = [
  {
    original: "const L=16,D=20;if(this.RENDER(Jh)",
    patched: "const L=90,D=160;if(this.RENDER(Jh)",
    label: "lat/lon visibility distance"
  },
  {
    original: "const z=16,q=20;if(this.RENDER(ur)",
    patched: "const z=90,q=160;if(this.RENDER(ur)",
    label: "border visibility distance"
  },
  {
    original: "this.show_borders=2,this.show_texstyle=2,this.showBottomNotification",
    patched: "this.show_borders=1,this.show_texstyle=0,this.showBottomNotification",
    label: "availability mode forcing map style"
  }
];

let changed = false;
for (const { original, patched, label } of replacements) {
  if (source.includes(patched)) {
    console.log(`${label} patch is already installed`);
    continue;
  }
  const count = source.split(original).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label} target, found ${count}`);
  source = source.replace(original, patched);
  changed = true;
  console.log(`Patched ${label}`);
}

if (changed) writeFileSync(bundlePath, source, "utf8");
