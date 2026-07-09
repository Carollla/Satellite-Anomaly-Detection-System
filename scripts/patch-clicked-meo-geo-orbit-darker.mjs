import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const original =
  'let u,M=!1;if(c)u=[.2,.8,1,.5];else{u=[1,0,0,1];const y=r.satellite.ndx;M=!!r._customPersistentOrbit;(k=this.dots.movingPoints[y])!=null&&k.tips_says_burned?u=[1,0,0,.6]:this.dots.dotColors&&y!==void 0&&(u=[this.dots.dotColors[y*4],this.dots.dotColors[y*4+1],this.dots.dotColors[y*4+2],.6]);M&&(u=[u[0]*.35,u[1]*.35,u[2]*.35,Math.min(u[3],.08)])}';

const patched =
  'let u,M=!1,T=!1;if(c)u=[.2,.8,1,.5];else{u=[1,0,0,1];const y=r.satellite.ndx;M=!!r._customPersistentOrbit,T=!M&&!!(this._isCustomPersistentOrbitSatellite&&this._isCustomPersistentOrbitSatellite(r.satellite));(k=this.dots.movingPoints[y])!=null&&k.tips_says_burned?u=[1,0,0,.6]:this.dots.dotColors&&y!==void 0&&(u=[this.dots.dotColors[y*4],this.dots.dotColors[y*4+1],this.dots.dotColors[y*4+2],.6]);T&&(u=[u[0]*.72,u[1]*.72,u[2]*.72,Math.min(u[3],.5)]),M&&(u=[u[0]*.35,u[1]*.35,u[2]*.35,Math.min(u[3],.08)])}';

if (source.includes(patched)) {
  console.log("clicked MEO/GEO darker orbit patch is already installed");
} else {
  const count = source.split(original).length - 1;
  if (count !== 1) throw new Error(`Expected one clicked MEO/GEO orbit color target, found ${count}`);
  source = source.replace(original, patched);
  writeFileSync(bundlePath, source, "utf8");
  console.log("Patched clicked MEO/GEO orbit color darker");
}
