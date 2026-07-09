import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

function replaceOnce(original, patched, label) {
  if (source.includes(patched)) {
    console.log(`${label} patch is already installed`);
    return;
  }
  const count = source.split(original).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label} target, found ${count}`);
  source = source.replace(original, patched);
  console.log(`Patched ${label}`);
}

const showStart = "Rn.prototype.showPersistentCustomOrbits=function(){";
const showEnd = "Rn.prototype._schedulePersistentCustomOrbits=function";
const start = source.indexOf(showStart);
const end = source.indexOf(showEnd, start);
if (start < 0 || end < 0) {
  throw new Error("Could not locate showPersistentCustomOrbits block");
}

const currentShow = source.slice(start, end);
const patchedShow =
  'Rn.prototype.showPersistentCustomOrbits=function(){var i;if(!this.dots||!this.dots.movingPoints||!this._calculateSatelliteOrbit||!this.highlightedOrbits||!this.orbitProgramInfo)return!1;const t=new Map;let e=0;for(const s of this.dots.movingPoints)if(this._isCustomPersistentOrbitSatellite(s)){e++;const n=this._customPersistentOrbitKey(s);t.has(n)||t.set(n,s)}const o=new Set(Array.from(t.keys()).map(s=>"custom:"+s));for(const[s,n]of Array.from(this.highlightedOrbits.entries()))n!=null&&n._customPersistentOrbit&&!o.has(String(s))&&(this._removeSatelliteOrbit?this._removeSatelliteOrbit(s):(this.highlightedOrbits.delete(s),this.orbitBuffers&&this.orbitBuffers.delete(s)));for(const[s,n]of t.entries()){const o="custom:"+s;if(!this.highlightedOrbits.has(o)){this._calculateSatelliteOrbit(n);const a=this.highlightedOrbits.get(n.norad_id),r=this.orbitBuffers.get(n.norad_id);a&&(a._customPersistentOrbit=!0,a.expiresAt=void 0,this.highlightedOrbits.set(o,a),this.highlightedOrbits.delete(n.norad_id));r&&(this.orbitBuffers.set(o,r),this.orbitBuffers.delete(n.norad_id))}}return e&&console.log(`Custom persistent MEO/GEO orbit planes active: ${t.size} unique orbits for ${e} satellites`),(i=this.dots)&&(i.need_recalc=!0),e>0};';

if (currentShow === patchedShow) {
  console.log("persistent custom orbit key separation patch is already installed");
} else {
  source = source.slice(0, start) + patchedShow + source.slice(end);
  console.log("Patched persistent custom orbit key separation");
}

replaceOnce(
  "M=!!(this._isCustomPersistentOrbitSatellite&&this._isCustomPersistentOrbitSatellite(r.satellite));",
  "M=!!r._customPersistentOrbit;",
  "render dimming only for persistent custom orbits"
);

replaceOnce(
  '{const i=Rn.prototype._highlight;Rn.prototype._highlight=function(t,...e){const s=this.dots&&this.dots.movingPoints?this.dots.movingPoints[t]:null,n=this._isCustomPersistentOrbitSatellite&&this._isCustomPersistentOrbitSatellite(s),o=i.call(this,t,...e);return n&&s&&typeof s.ndx=="number"&&(this.satBit(s.ndx,3,0),this.satBit(s.ndx,4,0)),o}}',
  "{const i=Rn.prototype._highlight;Rn.prototype._highlight=function(t,...e){return i.call(this,t,...e)}}",
  "clicked MEO/GEO highlight behavior"
);

writeFileSync(bundlePath, source, "utf8");
