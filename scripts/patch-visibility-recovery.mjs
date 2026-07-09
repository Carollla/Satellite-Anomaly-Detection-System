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

replaceOnce(
  'Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o;const a=((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key);if(a==="geo-compute"||a==="meo-backbone")return a;if((i==null?void 0:i.layer_key)==="geo-compute"||(i==null?void 0:i.layer_key)==="meo-backbone")return i.layer_key;const r=((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)||((n=i==null?void 0:i._raw)==null?void 0:n.hardware_name)||((o=i==null?void 0:i.tleData)==null?void 0:o.hardware_name)||(i==null?void 0:i.hardware_name);return r==="GEO Compute"?"geo-compute":r==="MEO Backbone"?"meo-backbone":null};',
  'Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o,a;const r=((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key);if(r==="geo-compute"||r==="meo-backbone")return r;if((i==null?void 0:i.layer_key)==="geo-compute"||(i==null?void 0:i.layer_key)==="meo-backbone")return i.layer_key;const l=((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)||((n=i==null?void 0:i._raw)==null?void 0:n.hardware_name)||((o=i==null?void 0:i.tleData)==null?void 0:o.hardware_name)||(i==null?void 0:i.hardware_name);if(l==="GEO Compute")return"geo-compute";if(l==="MEO Backbone")return"meo-backbone";const c=Number((i==null?void 0:i.norad_id)||((a=i==null?void 0:i.tleData)==null?void 0:a.norad)||(((a=i==null?void 0:i.tleData)==null?void 0:a.orbital_elements)||{}).norad_id);return c>=80445&&c<=80450?"geo-compute":c>=80421&&c<=80444?"meo-backbone":null};',
  "MEO/GEO layer detection fallback"
);

replaceOnce(
  'Rn.prototype._customPersistentOrbitKey=function(i){var t,e,s,n,o;const a=this._customPersistentOrbitLayer?this._customPersistentOrbitLayer(i):null;if(a==="geo-compute")return"geo-compute:ring";const r=(t=i==null?void 0:i._raw)==null?void 0:t.plane,l=(e=i==null?void 0:i.plane)!=null?e:r,c=(s=i==null?void 0:i._raw)==null?void 0:s.orbital_elements,d=(n=i==null?void 0:i.tleData)==null?void 0:n.orbital_elements,h=(o=c==null?void 0:c.right_ascension)!=null?o:d==null?void 0:d.right_ascension;return a+":"+(l!=null?"p"+l:h!=null?"raan"+Math.round(h):i==null?void 0:i.norad_id)};',
  'Rn.prototype._customPersistentOrbitKey=function(i){var t,e,s,n,o,a;const r=this._customPersistentOrbitLayer?this._customPersistentOrbitLayer(i):null,l=Number((i==null?void 0:i.norad_id)||((a=i==null?void 0:i.tleData)==null?void 0:a.norad)||(((a=i==null?void 0:i.tleData)==null?void 0:a.orbital_elements)||{}).norad_id);if(r==="geo-compute")return"geo-compute:ring";if(r==="meo-backbone"&&l>=80421&&l<=80444)return"meo-backbone:p"+Math.floor((l-80421)/8);const c=(t=i==null?void 0:i._raw)==null?void 0:t.plane,d=(e=i==null?void 0:i.plane)!=null?e:c,h=(s=i==null?void 0:i._raw)==null?void 0:s.orbital_elements,u=(n=i==null?void 0:i.tleData)==null?void 0:n.orbital_elements,f=(o=h==null?void 0:h.right_ascension)!=null?o:u==null?void 0:u.right_ascension;return r+":"+(d!=null?"p"+d:f!=null?"raan"+Math.round(f):i==null?void 0:i.norad_id)};',
  "MEO/GEO unique orbit key fallback"
);

replaceOnce(
  'M&&(u=[u[0]*.35,u[1]*.35,u[2]*.35,Math.min(u[3],.08)])',
  'M&&(u=[.45,.62,.9,.34])',
  "visible custom orbit color"
);

replaceOnce(
  "u_minScreenPx:M?.18:.5,u_maxScreenPx:M?.55:4",
  "u_minScreenPx:M?.5:.5,u_maxScreenPx:M?1.15:4",
  "visible custom orbit thickness"
);

replaceOnce(
  "u_orbitFlow:(this._orbitFlow??1)&&this.highlightedOrbits.size<=64?(M?.18:1):0",
  "u_orbitFlow:(this._orbitFlow??1)&&this.highlightedOrbits.size<=64?(M?.45:1):0",
  "visible custom orbit flow"
);

replaceOnce(
  "this.lineBufferInfo=Pt(this.gl,{position:{numComponents:3,data:this.latLongLines}}),this.horizonSegments=180",
  "this.lineBufferInfo=Pt(this.gl,{position:{numComponents:3,data:this.latLongLines}}),this.borderBufferInfo=this.lineBufferInfo,this.horizonSegments=180",
  "fallback border buffer"
);

replaceOnce(
  'if(this.RENDER(Jh)&&(this.show_latlon||!this.textures_loaded||this.fadeAlpha<1)&&!I&&!this._mode("pov")&&this.eyeDistance<D){const V=this.eyeDistance<=L?.8:.8*(1-(this.eyeDistance-L)/(D-L));n.enable(n.BLEND),n.blendFunc(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA),n.enable(n.CULL_FACE),n.cullFace(n.BACK),n.useProgram(this.lineProgramInfo.program),xt(n,this.lineProgramInfo,this.lineBufferInfo),_t(this.lineProgramInfo,{u_worldViewProjection:this.worldViewProjection,u_worldInverseTranspose:y,u_lightDirection:S,u_fadeAlpha:this.fadeStartup,u_color:[.6,.4,.4,V]}),n.drawArrays(n.LINES,0,this.latLongLines.length/3),n.disable(n.BLEND),n.disable(n.CULL_FACE)}',
  'if(this.lineBufferInfo&&!I&&!this._mode("pov")&&this.eyeDistance<D){const V=Math.max(this.eyeDistance<=L?.8:.8*(1-(this.eyeDistance-L)/(D-L)),.7);n.disable(n.DEPTH_TEST),n.enable(n.BLEND),n.blendFunc(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA),n.enable(n.CULL_FACE),n.cullFace(n.BACK),n.useProgram(this.lineProgramInfo.program),xt(n,this.lineProgramInfo,this.lineBufferInfo),_t(this.lineProgramInfo,{u_worldViewProjection:this.worldViewProjection,u_worldInverseTranspose:y,u_lightDirection:S,u_fadeAlpha:this.fadeStartup,u_color:[1,.86,.28,V]}),n.drawArrays(n.LINES,0,this.latLongLines.length/3),n.disable(n.BLEND),n.disable(n.CULL_FACE),n.enable(n.DEPTH_TEST)}',
  "always-visible reference lines"
);

replaceOnce(
  'if(this.RENDER(ur)&&this.show_borders&&this.eyeDistance>=1.15&&this.eyeDistance<q&&this.borderBufferInfo&&!I){const V=this.eyeDistance<=z?.8:.8*(1-(this.eyeDistance-z)/(q-z));',
  'if(this.borderBufferInfo&&!I&&this.eyeDistance>=1.01&&this.eyeDistance<q){const V=Math.max(this.eyeDistance<=z?.8:.8*(1-(this.eyeDistance-z)/(q-z)),.75);',
  "always-visible border condition"
);

writeFileSync(bundlePath, source, "utf8");
