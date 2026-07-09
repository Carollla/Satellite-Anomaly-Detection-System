import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../assets/main.localfix3.js", import.meta.url));
let source = readFileSync(bundlePath, "utf8");

const originalShells = 'name:"Starlink Shells",description:"Colors Starlink satellites by observed orbital shell (Gen1, Gen2, Polar, SSO)",config:{shells:[{name:"Gen1-I",inclination:53,altitude_km:475,color:[.2,.6,1,1]},{name:"Gen1-II",inclination:53,altitude_km:550,color:[0,.9,.5,1]},{name:"Gen1-Transit",inclination:53,altitude_km:375,color:[.4,.8,1,.8]},{name:"Gen2",inclination:43,altitude_km:500,color:[1,.5,.1,1]},{name:"Gen2-Transit",inclination:43,altitude_km:375,color:[1,.75,.4,.8]},{name:"Polar",inclination:70,altitude_km:575,color:[.8,.2,1,1]},{name:"SSO Shell 1",inclination:97.5,altitude_km:475,color:[1,.2,.4,1]},{name:"SSO Shell 2",inclination:97.5,altitude_km:550,color:[1,.6,.8,1]}],inclinationTolerance:2,altitudeTolerance:40,unknownColor:[.4,.4,.4,1]}';
const customShells = 'name:"Custom Constellation Layers",description:"Colors satellites by the four configured LEO/MEO/GEO layers",config:{shells:[{name:"LEO Shell A",inclination:53,altitude_km:550,color:[.2,.6,1,1]},{name:"LEO Shell B",inclination:97.6,altitude_km:530,color:[1,.2,.6,1]},{name:"MEO Backbone",inclination:55,altitude_km:21500,color:[0,.9,.5,1]},{name:"GEO Compute",inclination:.05,altitude_km:35786,color:[1,.75,.2,1]}],inclinationTolerance:2,altitudeTolerance:120,unknownColor:[.4,.4,.4,1]}';

const originalTitle = 'title:"Starlink Shells"';
const customTitle = 'title:"Custom Layers"';
const originalOther = 'sublabel:"Transit / unclassified"';
const customOther = 'sublabel:"Unclassified"';
const originalInitLog = "Starlink Shells filter initialized";
const customInitLog = "Custom layer filter initialized";

replaceOnce(originalShells, customShells);
source = source.replaceAll(originalTitle, customTitle);
source = source.replaceAll(originalOther, customOther);
source = source.replaceAll(originalInitLog, customInitLog);

writeFileSync(bundlePath, source, "utf8");
console.log("Patched Custom Constellation Layers filter in assets/main.localfix3.js");

function replaceOnce(search, replacement) {
  const count = source.split(search).length - 1;
  if (count === 0 && source.includes(replacement)) {
    console.log("Custom shell filter is already patched");
    return;
  }
  if (count !== 1) {
    throw new Error(`Expected one match, found ${count}`);
  }
  source = source.replace(search, replacement);
}
