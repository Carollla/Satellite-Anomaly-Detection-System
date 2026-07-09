import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const replacements = [
  {
    name: "constellation/type bgtitle",
    original: 'if(this.show_constellation||this.show_type){const r=this.show_type||this.show_constellation,l=((o=(n=this.dots)==null?void 0:n.movingPoints)==null?void 0:o.length)||0;e.innerHTML=`${r}`+(t?"":`<div class="bgtitle-count">${l.toLocaleString()} satellites</div>`);return}',
    patched: 'if(this.show_constellation||this.show_type){const r=this.show_type||this.show_constellation,l=((o=(n=this.dots)==null?void 0:n.movingPoints)==null?void 0:o.length)||0;e.innerHTML=`SPACEMAN`+(t?"":`<div class="bgtitle-count">${l.toLocaleString()} satellites</div>`);return}',
  },
  {
    name: "multi-satellite bgtitle",
    original: 'else{const r=s[0].name||"Satellite";e.innerHTML=`${r} and more<div class="bgtitle-count">${s.length.toLocaleString()} satellites</div>`}}getConstellationMenuItems()',
    patched: 'else e.innerHTML=`SPACEMAN<div class="bgtitle-count">${s.length.toLocaleString()} satellites</div>`}getConstellationMenuItems()',
  },
];

let changed = false;

for (const { name, original, patched } of replacements) {
  if (source.includes(patched)) {
    console.log(`${name} patch is already installed`);
    continue;
  }

  const count = source.split(original).length - 1;
  if (count !== 1) throw new Error(`Expected one ${name} target, found ${count}`);
  source = source.replace(original, patched);
  changed = true;
  console.log(`Patched ${name} to SPACEMAN`);
}

if (changed) writeFileSync(bundlePath, source, "utf8");
