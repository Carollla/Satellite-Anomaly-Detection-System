import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const originalColorBlock =
  'let u;if(c)u=[.2,.8,1,.5];else{u=[1,0,0,1];const y=r.satellite.ndx;(k=this.dots.movingPoints[y])!=null&&k.tips_says_burned?u=[1,0,0,.6]:this.dots.dotColors&&y!==void 0&&(u=[this.dots.dotColors[y*4],this.dots.dotColors[y*4+1],this.dots.dotColors[y*4+2],.6])}';

const patchedColorBlock =
  'let u,M=!1;if(c)u=[.2,.8,1,.5];else{u=[1,0,0,1];const y=r.satellite.ndx;M=!!(this._isCustomPersistentOrbitSatellite&&this._isCustomPersistentOrbitSatellite(r.satellite));(k=this.dots.movingPoints[y])!=null&&k.tips_says_burned?u=[1,0,0,.6]:this.dots.dotColors&&y!==void 0&&(u=[this.dots.dotColors[y*4],this.dots.dotColors[y*4+1],this.dots.dotColors[y*4+2],.6]);M&&(u=[u[0]*.72,u[1]*.72,u[2]*.72,Math.min(u[3],.28)])}';

const originalWidthBlock = "u_minScreenPx:.5,u_maxScreenPx:4";
const patchedWidthBlock = "u_minScreenPx:M?.45:.5,u_maxScreenPx:M?1.1:4";

if (source.includes(patchedColorBlock) && source.includes(patchedWidthBlock)) {
  console.log("Custom MEO/GEO orbit style patch is already installed");
} else {
  const colorCount = source.split(originalColorBlock).length - 1;
  if (colorCount !== 1) throw new Error(`Expected one orbit color block, found ${colorCount}`);

  const widthCount = source.split(originalWidthBlock).length - 1;
  if (widthCount !== 1) throw new Error(`Expected one orbit width block, found ${widthCount}`);

  source = source.replace(originalColorBlock, patchedColorBlock);
  source = source.replace(originalWidthBlock, patchedWidthBlock);
  writeFileSync(bundlePath, source, "utf8");
  console.log("Darkened and thinned persistent custom MEO/GEO orbits");
}
