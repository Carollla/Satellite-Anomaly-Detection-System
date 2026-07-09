import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const original =
  'Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o;return((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key)||((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)==="GEO Compute"?"geo-compute":((n=i==null?void 0:i.metadata)==null?void 0:n.hardware_name)==="MEO Backbone"?"meo-backbone":((o=i==null?void 0:i.hardware_name)==="GEO Compute"?"geo-compute":i!=null&&i.hardware_name==="MEO Backbone"?"meo-backbone":null)};';

const previous =
  'Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o;const a=((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key)||i==null?void 0:i.layer_key;if(a==="geo-compute"||a==="meo-backbone")return a;const r=((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)||((n=i==null?void 0:i._raw)==null?void 0:n.hardware_name)||((o=i==null?void 0:i.tleData)==null?void 0:o.hardware_name)||i==null?void 0:i.hardware_name;return r==="GEO Compute"?"geo-compute":r==="MEO Backbone"?"meo-backbone":null};';

const patched =
  'Rn.prototype._customPersistentOrbitLayer=function(i){var t,e,s,n,o;const a=((t=i==null?void 0:i._raw)==null?void 0:t.layer_key)||((e=i==null?void 0:i.metadata)==null?void 0:e.layer_key);if(a==="geo-compute"||a==="meo-backbone")return a;if((i==null?void 0:i.layer_key)==="geo-compute"||(i==null?void 0:i.layer_key)==="meo-backbone")return i.layer_key;const r=((s=i==null?void 0:i.metadata)==null?void 0:s.hardware_name)||((n=i==null?void 0:i._raw)==null?void 0:n.hardware_name)||((o=i==null?void 0:i.tleData)==null?void 0:o.hardware_name)||(i==null?void 0:i.hardware_name);return r==="GEO Compute"?"geo-compute":r==="MEO Backbone"?"meo-backbone":null};';

if (source.includes(patched)) {
  console.log("Custom persistent orbit layer key fix is already installed");
} else {
  const target = source.includes(original) ? original : previous;
  const count = source.split(target).length - 1;
  if (count !== 1) throw new Error(`Expected one layer key function target, found ${count}`);
  source = source.replace(target, patched);
  writeFileSync(bundlePath, source, "utf8");
  console.log("Fixed custom persistent orbit layer key detection");
}
