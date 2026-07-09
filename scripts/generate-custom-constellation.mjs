import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputDir = join(root, "json", "local-api");
const backupDir = join(outputDir, "backup-starlink-original");

const metadataPath = join(outputDir, "satellites-starlink-active.json");
const tlePath = join(outputDir, "v2-tle-starlink.txt");
const noradsPath = join(outputDir, "starlink-norads.json");

const earthRadiusKm = 6378.137;
const muKm3s2 = 398600.4418;
const epochDate = new Date("2026-07-06T00:00:00Z");
const epoch = tleEpoch(epochDate);

const layers = [
  {
    key: "leo-a",
    displayName: "LEO Shell A",
    prefix: "LEO-A",
    walker: "Walker Delta 300/20/1",
    type: "delta",
    total: 300,
    planes: 20,
    phasing: 1,
    altitudeKm: 550,
    inclinationDeg: 53
  },
  {
    key: "leo-b",
    displayName: "LEO Shell B",
    prefix: "LEO-B",
    walker: "Walker Star 120/10/0",
    type: "star",
    total: 120,
    planes: 10,
    phasing: 0,
    altitudeKm: 530,
    inclinationDeg: 97.6
  },
  {
    key: "meo-backbone",
    displayName: "MEO Backbone",
    prefix: "MEO",
    walker: "Walker Delta 24/3/1",
    type: "delta",
    total: 24,
    planes: 3,
    phasing: 1,
    altitudeKm: 21500,
    inclinationDeg: 55
  },
  {
    key: "geo-compute",
    displayName: "GEO Compute",
    prefix: "GEO",
    walker: "Geostationary ring 6/1/0",
    type: "geo",
    total: 6,
    planes: 1,
    phasing: 0,
    altitudeKm: 35786,
    inclinationDeg: 0.05
  }
];

ensureBackup(metadataPath);
ensureBackup(tlePath);
if (existsSync(noradsPath)) ensureBackup(noradsPath);

const satellites = [];
const tleBlocks = [`V:custom-${epoch}`];
const norads = [];
let norad = 80001;

for (const layer of layers) {
  const satsPerPlane = layer.total / layer.planes;
  if (!Number.isInteger(satsPerPlane)) {
    throw new Error(`${layer.displayName}: total must be divisible by planes`);
  }

  for (let plane = 0; plane < layer.planes; plane += 1) {
    const raanDeg = layer.type === "star"
      ? (180 * plane) / layer.planes
      : (360 * plane) / layer.planes;

    for (let slot = 0; slot < satsPerPlane; slot += 1) {
      const satNorad = norad++;
      const layerIndex = satellites.filter((sat) => sat.layer_key === layer.key).length + 1;
      const meanAnomalyDeg = layer.type === "geo"
        ? (360 * slot) / layer.total
        : ((360 * slot) / satsPerPlane + (360 * layer.phasing * plane) / layer.total) % 360;
      const meanMotion = meanMotionRevPerDay(layer.altitudeKm);
      const semiMajorAxisKm = earthRadiusKm + layer.altitudeKm;
      const eccentricity = layer.type === "geo" ? 0.00001 : 0.0001;
      const name = `${layer.prefix}-${String(layerIndex).padStart(3, "0")}`;

      satellites.push({
        norad_id: satNorad,
        sat_name: name,
        intldes: "      2026-001",
        sat_type: layer.altitudeKm >= 20000 ? "communications" : "internet",
        status: "active",
        orbit_classifications: orbitClassifications(layer),
        decay_date: null,
        created_at: "2026-07-06T00:00:00.000Z",
        constellation_name: "starlink",
        hardware_name: layer.displayName,
        launch_name: layer.walker,
        launch_datetime_utc: "2026-07-06T00:00:00.000Z",
        launch_date: "2026-07-06",
        mass_kg: layer.type === "geo" ? "2500.00" : layer.altitudeKm >= 20000 ? "900.00" : "300.00",
        fcc_group: layer.key,
        norad2keys: {},
        layer_key: layer.key,
        walker_pattern: layer.walker,
        plane,
        slot,
        altitude_km: layer.altitudeKm,
        inclination_deg: layer.inclinationDeg,
        orbital_elements: {
          norad_id: satNorad,
          inclination: layer.inclinationDeg,
          eccentricity,
          drag_term: "0",
          bstar: "0",
          mean_motion: meanMotion,
          epoch_year: 2026,
          epoch_day: Number(epoch.slice(2)),
          arg_perigee: 0,
          right_ascension: normalizeDegrees(raanDeg),
          mean_anomaly: normalizeDegrees(meanAnomalyDeg),
          period: 1440 / meanMotion,
          semi_major_axis: semiMajorAxisKm
        }
      });
      norads.push(satNorad);
      tleBlocks.push(
        String(satNorad),
        makeLine1(satNorad),
        makeLine2({
          norad: satNorad,
          inclinationDeg: layer.inclinationDeg,
          raanDeg,
          eccentricity,
          argPerigeeDeg: 0,
          meanAnomalyDeg,
          meanMotion
        })
      );
    }
  }
}

const metadata = {
  notice: "Synthetic local constellation generated from user-defined Walker shell parameters.",
  success: true,
  constellation: "starlink",
  sat_type: "*",
  count: satellites.length,
  filters: {
    constellation: "starlink",
    status: "active"
  },
  generated_at: new Date().toISOString(),
  epoch,
  layers: layers.map(({ key, displayName, walker, total, planes, phasing, altitudeKm, inclinationDeg }) => ({
    key,
    displayName,
    walker,
    total,
    planes,
    phasing,
    altitudeKm,
    inclinationDeg
  })),
  data: satellites
};

writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`, "utf8");
writeFileSync(tlePath, `${tleBlocks.join("\n")}\n`, "utf8");
writeFileSync(noradsPath, `${JSON.stringify({ success: true, count: norads.length, data: norads })}\n`, "utf8");

console.log(`Generated ${satellites.length} satellites`);
for (const layer of layers) {
  console.log(`- ${layer.displayName}: ${layer.total} satellites, ${layer.walker}, ${layer.altitudeKm} km, ${layer.inclinationDeg} deg`);
}
console.log(`Wrote ${metadataPath}`);
console.log(`Wrote ${tlePath}`);

function ensureBackup(path) {
  if (!existsSync(path)) return;
  mkdirSync(backupDir, { recursive: true });
  const target = join(backupDir, path.split(/[\\/]/).pop());
  if (!existsSync(target)) {
    writeFileSync(target, readFileSync(path));
  }
}

function orbitClassifications(layer) {
  if (layer.type === "geo") return "GEO, GEOSTATIONARY, EQUATORIAL";
  if (layer.altitudeKm >= 20000) return "MEO, CIRCULAR";
  return layer.inclinationDeg > 90 ? "LEO, CIRCULAR, POLAR" : "LEO, CIRCULAR";
}

function meanMotionRevPerDay(altitudeKm) {
  const semiMajorAxisKm = earthRadiusKm + altitudeKm;
  const periodSeconds = 2 * Math.PI * Math.sqrt((semiMajorAxisKm ** 3) / muKm3s2);
  return 86400 / periodSeconds;
}

function tleEpoch(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const day = (date.getTime() - start) / 86400000 + 1;
  return `${String(year).slice(-2)}${day.toFixed(8).padStart(12, "0")}`;
}

function makeLine1(noradId) {
  const base = `1 ${String(noradId).padStart(5, "0")}U 26001A   ${epoch}  .00000000  00000-0  00000-0 0  999`;
  return withChecksum(base);
}

function makeLine2({
  norad,
  inclinationDeg,
  raanDeg,
  eccentricity,
  argPerigeeDeg,
  meanAnomalyDeg,
  meanMotion
}) {
  const eccentricityText = Math.round(eccentricity * 1e7).toString().padStart(7, "0");
  const base = [
    "2",
    String(norad).padStart(5, "0"),
    inclinationDeg.toFixed(4).padStart(8, " "),
    normalizeDegrees(raanDeg).toFixed(4).padStart(8, " "),
    eccentricityText,
    normalizeDegrees(argPerigeeDeg).toFixed(4).padStart(8, " "),
    normalizeDegrees(meanAnomalyDeg).toFixed(4).padStart(8, " "),
    meanMotion.toFixed(8).padStart(11, " "),
    "    0"
  ].join(" ");
  return withChecksum(base);
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function withChecksum(line) {
  const trimmed = line.slice(0, 68).padEnd(68, " ");
  let sum = 0;
  for (const char of trimmed) {
    if (char >= "0" && char <= "9") sum += Number(char);
    else if (char === "-") sum += 1;
  }
  return `${trimmed}${sum % 10}`;
}
