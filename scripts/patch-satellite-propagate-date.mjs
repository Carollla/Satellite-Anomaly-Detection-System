import { readFileSync, writeFileSync } from "node:fs";

const file = "assets/main.localfix3.js";
let s = readFileSync(file, "utf8");

if (s.includes("SPACEMAN_PROPAGATE_DATE_PATCH")) {
  console.log("satellite propagate date patch is already installed");
  process.exit(0);
}

const from = 'try{h=ll(a,e).position??null}catch{return null}';
const to = 'try{/* SPACEMAN_PROPAGATE_DATE_PATCH */h=ll(a,e.getUTCFullYear(),e.getUTCMonth()+1,e.getUTCDate(),e.getUTCHours(),e.getUTCMinutes(),e.getUTCSeconds()+e.getUTCMilliseconds()/1e3).position??null}catch{return null}';

const count = s.split(from).length - 1;
if (count !== 1) {
  throw new Error(`Expected one propagate(Date) call in hi(), found ${count}`);
}

s = s.replace(from, to);
writeFileSync(file, s, "utf8");
console.log("Patched satellite propagation to pass UTC date parts");
