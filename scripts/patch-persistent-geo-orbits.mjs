import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const marker = "Object.assign(Rn.prototype,Db);Object.assign(Rn.prototype,Ab);Object.assign(Rn.prototype,Ib);";
const currentGeoPatchStart = `${marker}Rn.prototype._isCustomPersistentGeoSatellite=function`;
const customPatchStart = `${marker}Rn.prototype._isCustomPersistentOrbitSatellite=function`;
const patch = `${marker}Rn.prototype._isCustomPersistentOrbitSatellite=function(i){var t,e,s,n;return!!i&&(((t=i.metadata)==null?void 0:t.hardware_name)==="GEO Compute"||((e=i.metadata)==null?void 0:e.hardware_name)==="MEO Backbone"||((s=i._raw)==null?void 0:s.layer_key)==="geo-compute"||((n=i._raw)==null?void 0:n.layer_key)==="meo-backbone")};Rn.prototype.showPersistentCustomOrbits=function(){var i;if(!this.dots||!this.dots.movingPoints||!this._calculateSatelliteOrbit||!this.highlightedOrbits||!this.orbitProgramInfo)return!1;let t=0;for(const e of this.dots.movingPoints)this._isCustomPersistentOrbitSatellite(e)&&(this.highlightedOrbits&&!this.highlightedOrbits.has(e.norad_id)&&this._calculateSatelliteOrbit(e),typeof e.ndx=="number"&&(this.satBit(e.ndx,3,0),this.satBit(e.ndx,4,0)),t++);return t&&console.log(\`Custom persistent MEO/GEO orbits active: \${t}\`),(i=this.dots)&&(i.need_recalc=!0),t>0};Rn.prototype._schedulePersistentCustomOrbits=function(i=0){if(i>30)return;setTimeout(()=>{var t;((t=this.showPersistentCustomOrbits)==null?void 0:t.call(this))||this._schedulePersistentCustomOrbits(i+1)},Math.min(1e3,50+i*100))};{const i=Rn.prototype._deployMovingData;Rn.prototype._deployMovingData=function(...t){const e=i.apply(this,t);return this._schedulePersistentCustomOrbits&&this._schedulePersistentCustomOrbits(),e}}{const i=Rn.prototype._highlight;Rn.prototype._highlight=function(t,...e){const s=this.dots&&this.dots.movingPoints?this.dots.movingPoints[t]:null,n=this._isCustomPersistentOrbitSatellite&&this._isCustomPersistentOrbitSatellite(s),o=i.call(this,t,...e);return n&&s&&typeof s.ndx=="number"&&(this.satBit(s.ndx,3,0),this.satBit(s.ndx,4,0)),o}}`;

if (source.includes("_schedulePersistentCustomOrbits=function")) {
  console.log("Persistent custom MEO/GEO orbit patch is already installed");
} else if (source.includes(currentGeoPatchStart)) {
  const start = source.indexOf(currentGeoPatchStart);
  const end = source.indexOf("let le=null", start);
  if (end < 0) throw new Error("Could not find end of existing GEO patch");
  source = source.slice(0, start) + patch + source.slice(end);
  writeFileSync(bundlePath, source, "utf8");
  console.log("Upgraded persistent orbit patch to include MEO and GEO");
} else {
  const count = source.split(marker).length - 1;
  if (count !== 1) throw new Error(`Expected one prototype marker, found ${count}`);
  source = source.replace(marker, patch);
  writeFileSync(bundlePath, source, "utf8");
  console.log("Installed persistent custom MEO/GEO orbit patch");
}
