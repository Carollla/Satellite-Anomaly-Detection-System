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

const marker = "Object.assign(Rn.prototype,Db);Object.assign(Rn.prototype,Ab);Object.assign(Rn.prototype,Ib);";
const startNeedles = [
  `${marker}Rn.prototype._customPersistentOrbitLayer=function`,
  `${marker}Rn.prototype._isCustomPersistentOrbitSatellite=function`
];
const start = startNeedles.map((needle) => source.indexOf(needle)).find((index) => index >= 0) ?? -1;
if (start < 0) throw new Error("Could not find persistent custom orbit patch block");
const end = source.indexOf("let le=null", start);
if (end < 0) throw new Error("Could not find end of persistent custom orbit patch block");

const persistentPatch = `${marker}Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o;return((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key)||((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)==="GEO Compute"?"geo-compute":((n=i==null?void 0:i.metadata)==null?void 0:n.hardware_name)==="MEO Backbone"?"meo-backbone":((o=i==null?void 0:i.hardware_name)==="GEO Compute"?"geo-compute":i!=null&&i.hardware_name==="MEO Backbone"?"meo-backbone":null)};Rn.prototype._isCustomPersistentOrbitSatellite=function(i){const t=this._customPersistentOrbitLayer?this._customPersistentOrbitLayer(i):null;return t==="geo-compute"||t==="meo-backbone"};Rn.prototype._customPersistentOrbitKey=function(i){var t,e,s,n,o;const a=this._customPersistentOrbitLayer?this._customPersistentOrbitLayer(i):null;if(a==="geo-compute")return"geo-compute:ring";const r=(t=i==null?void 0:i._raw)==null?void 0:t.plane,l=(e=i==null?void 0:i.plane)!=null?e:r,c=(s=i==null?void 0:i._raw)==null?void 0:s.orbital_elements,d=(n=i==null?void 0:i.tleData)==null?void 0:n.orbital_elements,h=(o=c==null?void 0:c.right_ascension)!=null?o:d==null?void 0:d.right_ascension;return a+":"+(l!=null?"p"+l:h!=null?"raan"+Math.round(h):i==null?void 0:i.norad_id)};Rn.prototype.showPersistentCustomOrbits=function(){var i;if(!this.dots||!this.dots.movingPoints||!this._calculateSatelliteOrbit||!this.highlightedOrbits||!this.orbitProgramInfo)return!1;const t=new Map;let e=0;for(const s of this.dots.movingPoints)if(this._isCustomPersistentOrbitSatellite(s)){e++;typeof s.ndx=="number"&&(this.satBit(s.ndx,3,0),this.satBit(s.ndx,4,0));const n=this._customPersistentOrbitKey(s);t.has(n)||t.set(n,s)}const o=new Set(Array.from(t.values()).map(s=>String(s.norad_id)));for(const[s,n]of Array.from(this.highlightedOrbits.entries()))n!=null&&n.satellite&&this._isCustomPersistentOrbitSatellite(n.satellite)&&!o.has(String(s))&&(this._removeSatelliteOrbit?this._removeSatelliteOrbit(s):(this.highlightedOrbits.delete(s),this.orbitBuffers&&this.orbitBuffers.delete(s)));for(const s of t.values())this.highlightedOrbits&&!this.highlightedOrbits.has(s.norad_id)&&this._calculateSatelliteOrbit(s);return e&&console.log(\`Custom persistent MEO/GEO orbit planes active: \${t.size} unique orbits for \${e} satellites\`),(i=this.dots)&&(i.need_recalc=!0),e>0};Rn.prototype._schedulePersistentCustomOrbits=function(i=0){if(i>30)return;setTimeout(()=>{var t;((t=this.showPersistentCustomOrbits)==null?void 0:t.call(this))||this._schedulePersistentCustomOrbits(i+1)},Math.min(1e3,50+i*100))};{const i=Rn.prototype._deployMovingData;Rn.prototype._deployMovingData=function(...t){const e=i.apply(this,t);return this._schedulePersistentCustomOrbits&&this._schedulePersistentCustomOrbits(),e}}{const i=Rn.prototype._highlight;Rn.prototype._highlight=function(t,...e){const s=this.dots&&this.dots.movingPoints?this.dots.movingPoints[t]:null,n=this._isCustomPersistentOrbitSatellite&&this._isCustomPersistentOrbitSatellite(s),o=i.call(this,t,...e);return n&&s&&typeof s.ndx=="number"&&(this.satBit(s.ndx,3,0),this.satBit(s.ndx,4,0)),o}}`;

if (source.slice(start, end) !== persistentPatch) {
  source = source.slice(0, start) + persistentPatch + source.slice(end);
  console.log("Patched persistent custom orbits to render unique MEO/GEO planes only");
} else {
  console.log("Persistent custom orbit de-duplication patch is already installed");
}

const badLayerFn =
  'Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o;return((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key)||((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)==="GEO Compute"?"geo-compute":((n=i==null?void 0:i.metadata)==null?void 0:n.hardware_name)==="MEO Backbone"?"meo-backbone":((o=i==null?void 0:i.hardware_name)==="GEO Compute"?"geo-compute":i!=null&&i.hardware_name==="MEO Backbone"?"meo-backbone":null)};';
const goodLayerFn =
  'Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o;const a=((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key);if(a==="geo-compute"||a==="meo-backbone")return a;if((i==null?void 0:i.layer_key)==="geo-compute"||(i==null?void 0:i.layer_key)==="meo-backbone")return i.layer_key;const r=((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)||((n=i==null?void 0:i._raw)==null?void 0:n.hardware_name)||((o=i==null?void 0:i.tleData)==null?void 0:o.hardware_name)||(i==null?void 0:i.hardware_name);return r==="GEO Compute"?"geo-compute":r==="MEO Backbone"?"meo-backbone":null};';
if (source.includes(badLayerFn)) {
  source = source.replace(badLayerFn, goodLayerFn);
  console.log("Fixed custom persistent orbit layer key detection");
}

replaceOnce(
  "M&&(u=[u[0]*.72,u[1]*.72,u[2]*.72,Math.min(u[3],.28)])",
  "M&&(u=[u[0]*.35,u[1]*.35,u[2]*.35,Math.min(u[3],.08)])",
  "custom orbit dimming"
);

replaceOnce(
  "u_minScreenPx:M?.45:.5,u_maxScreenPx:M?1.1:4",
  "u_minScreenPx:M?.18:.5,u_maxScreenPx:M?.55:4",
  "custom orbit thickness"
);

replaceOnce(
  "u_orbitFlow:(this._orbitFlow??1)&&this.highlightedOrbits.size<=64?1:0",
  "u_orbitFlow:(this._orbitFlow??1)&&this.highlightedOrbits.size<=64?(M?.18:1):0",
  "custom orbit flow strength"
);

replaceOnce(
  "if (u_orbitFlow > 0.5) { float saw = fract(v_segmentProgress * u_flowCount - u_time * u_flowSpeed); float head = pow(saw, 4.0); finalColor += vec3(head * 0.8); finalAlpha = clamp(finalAlpha * (1.0 + head * 0.9), 0.0, 1.0); }",
  "if (u_orbitFlow > 0.0) { float saw = fract(v_segmentProgress * u_flowCount - u_time * u_flowSpeed); float head = pow(saw, 4.0); finalColor += vec3(head * 0.8 * u_orbitFlow); finalAlpha = clamp(finalAlpha * (1.0 + head * 0.9 * u_orbitFlow), 0.0, 1.0); }",
  "orbit flow shader strength"
);

replaceOnce(
  "this.borderLineVertices=new Float32Array(q),this.borderBufferInfo=Pt(this.gl,{position:{numComponents:3,data:this.borderLineVertices}})",
  "this.borderLineVertices=new Float32Array(q);for(let V=0;V<this.borderLineVertices.length;V++)this.borderLineVertices[V]*=1.008;this.borderBufferInfo=Pt(this.gl,{position:{numComponents:3,data:this.borderLineVertices}})",
  "border line lift"
);

replaceOnce(
  "n.enable(n.BLEND),n.blendFunc(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA),n.enable(n.CULL_FACE),n.cullFace(n.BACK),n.useProgram(this.lineProgramInfo.program),xt(n,this.lineProgramInfo,this.borderBufferInfo);const j=this.worldViewProjection;_t(this.lineProgramInfo,{u_worldViewProjection:j,u_color:[1,1,1,V],u_fadeAlpha:this.fadeAlpha}),se(n,this.borderBufferInfo,n.LINES),n.disable(n.BLEND),n.disable(n.CULL_FACE)",
  "n.disable(n.DEPTH_TEST),n.enable(n.BLEND),n.blendFunc(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA),n.enable(n.CULL_FACE),n.cullFace(n.BACK),n.useProgram(this.lineProgramInfo.program),xt(n,this.lineProgramInfo,this.borderBufferInfo);const j=this.worldViewProjection;_t(this.lineProgramInfo,{u_worldViewProjection:j,u_color:[1,.88,.35,Math.max(V,.85)],u_fadeAlpha:this.fadeAlpha}),se(n,this.borderBufferInfo,n.LINES),n.disable(n.BLEND),n.disable(n.CULL_FACE),n.enable(n.DEPTH_TEST)",
  "border line depth and color"
);

replaceOnce("this.show_borders=this.show_borders??1", "this.show_borders=1", "force borders on at startup");
replaceOnce("this.show_latlon=this.show_latlon??1", "this.show_latlon=1", "force lat/lon on at startup");
replaceOnce("this.show_texstyle=this.show_texstyle??0", "this.show_texstyle=0", "force day/night style at startup");

writeFileSync(bundlePath, source, "utf8");
