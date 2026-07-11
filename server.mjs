import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 5173);
const spacemanAiConfig = loadSpacemanAiConfig();
const spacemanAiBaseUrl = (process.env.SPACEMAN_AI_BASE_URL || spacemanAiConfig.baseUrl || "https://api.sqface.sbs").replace(/\/+$/, "");
const spacemanAiModel = process.env.SPACEMAN_AI_MODEL || spacemanAiConfig.model || "gpt-5.5";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm"
};

const csp = [
  "default-src 'self' blob: data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

function loadSpacemanAiConfig() {
  const configPath = join(root, "spaceman-ai.config.json");
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    console.warn(`Failed to parse spaceman-ai.config.json: ${error?.message || error}`);
    return {};
  }
}

function loadSpacemanOpsSkill() {
  const skillPath = join(root, "spaceman-ops.skill.json");
  if (!existsSync(skillPath)) return {};
  try {
    return JSON.parse(readFileSync(skillPath, "utf8"));
  } catch (error) {
    console.warn(`Failed to parse spaceman-ops.skill.json: ${error?.message || error}`);
    return {};
  }
}

function saveSpacemanAiConfig(config) {
  const configPath = join(root, "spaceman-ai.config.json");
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 10) return `${text.slice(0, 2)}******${text.slice(-2)}`;
  return `${text.slice(0, 4)}${"*".repeat(Math.min(18, Math.max(8, text.length - 8)))}${text.slice(-4)}`;
}

function sendJson(res, body, status = 200, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "content-security-policy": csp,
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function sendJsonText(res, body, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "content-security-policy": csp
  });
  res.end(body);
}

function sendText(res, body, contentType = "text/plain; charset=utf-8", status = 200) {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "content-security-policy": csp
  });
  res.end(body);
}

function readRequestBody(req, limit = 1024 * 1024) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        rejectBody(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolveBody(body));
    req.on("error", rejectBody);
  });
}

async function readJsonBody(req) {
  const body = await readRequestBody(req);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function passwordDigest(password, salt = randomBytes(16).toString("hex")) {
  const digest = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

function passwordMatches(password, storedDigest) {
  const [algorithm, salt, expectedHex] = String(storedDigest || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenDigest(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function getRequestSessionToken(req) {
  const explicit = req.headers["x-session-token"];
  if (explicit) return String(explicit);
  const authorization = String(req.headers.authorization || "");
  if (/^bearer\s+/i.test(authorization)) return authorization.replace(/^bearer\s+/i, "").trim();
  const cookie = String(req.headers.cookie || "");
  const match = cookie.match(/(?:^|;\s*)(?:user|spaceman_session)=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || `${user.username}@spaceman.local`,
    role: user.role || "operator",
    isVerified: true,
    isSuperuser: user.role === "tenant_admin",
    lastLoginAt: user.lastLoginAt || null
  };
}

function getSpacemanStatus() {
  const metadataPath = join(root, "json/local-api/satellites-starlink-active.json");
  const tlePath = join(root, "json/local-api/v2-tle-starlink.txt");
  let metadata = {};
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch (error) {
    metadata = { success: false, error: String(error?.message || error) };
  }

  const layers = Array.isArray(metadata.layers) ? metadata.layers : [];
  const data = Array.isArray(metadata.data) ? metadata.data : [];
  const byLayer = {};
  for (const sat of data) {
    const key = sat.layer_key || sat.fcc_group || "unknown";
    byLayer[key] ||= {
      key,
      count: 0,
      sampleSatellites: [],
      altitudeKm: sat.altitude_km,
      inclinationDeg: sat.inclination_deg,
      orbitClassifications: sat.orbit_classifications
    };
    byLayer[key].count += 1;
    if (byLayer[key].sampleSatellites.length < 3) {
      byLayer[key].sampleSatellites.push({
        noradId: sat.norad_id,
        name: sat.sat_name,
        plane: sat.plane,
        slot: sat.slot
      });
    }
  }

  const tleLines = existsSync(tlePath)
    ? readFileSync(tlePath, "utf8").split(/\r?\n/).filter(Boolean).length
    : 0;

  return {
    platform: "SPACEMAN",
    role: "satellite mission operations assistant",
    generatedAt: new Date().toISOString(),
    dataSource: {
      metadataFile: "json/local-api/satellites-starlink-active.json",
      tleFile: "json/local-api/v2-tle-starlink.txt",
      generator: "scripts/generate-custom-constellation.mjs",
      synthetic: true,
      notice: metadata.notice || null,
      epoch: metadata.epoch || null
    },
    constellation: {
      name: metadata.constellation || "starlink",
      totalSatellites: Number(metadata.count || data.length || 0),
      activeSatellites: data.filter((sat) => sat.status === "active").length || Number(metadata.count || 0),
      shellCount: layers.length,
      layers: layers.map((layer) => ({
        key: layer.key,
        name: layer.displayName,
        walker: layer.walker,
        total: layer.total,
        planes: layer.planes,
        phasing: layer.phasing,
        altitudeKm: layer.altitudeKm,
        inclinationDeg: layer.inclinationDeg,
        observedCount: byLayer[layer.key]?.count || 0,
        sampleSatellites: byLayer[layer.key]?.sampleSatellites || []
      }))
    },
    interfaces: [
      {
        method: "GET",
        path: "/local-api/spaceman-status",
        purpose: "Read current constellation, shell, data-source, and assistant capability status."
      },
      {
        method: "POST",
        path: "/local-api/spaceman-chat",
        purpose: "Chat with the operations assistant. The server injects this status into model context."
      },
      {
        method: "GET",
        path: "/local-api/satellites",
        purpose: "Read current satellite metadata used by the page."
      },
      {
        method: "GET",
        path: "/local-api/v2/tle",
        purpose: "Read current TLE blocks used by the orbital simulation."
      }
    ],
    currentLimitations: [
      "The assistant can explain and guide edits now.",
      "Direct constellation write/edit actions should be added after the configuration UI and validation flow are finalized.",
      "Changing satellite counts or shell parameters currently means editing scripts/generate-custom-constellation.mjs and regenerating local API data."
    ],
    futureWorkflow: [
      "Read current constellation status.",
      "Validate requested shell changes such as count, planes, phasing, altitude, inclination, and orbit type.",
      "Preview generated satellite/TLE impact.",
      "Apply configuration and refresh the visualization.",
      "Support future satellite digital-twin state such as health, payload, link, coverage, and fault status."
    ],
    tleLineCount: tleLines
  };
}

function getSpacemanPageConstellation() {
  const status = getSpacemanStatus();
  const layers = status.constellation.layers || [];
  const sampleSatellites = [];
  for (const layer of layers) {
    const key = String(layer.key || layer.name || "SAT").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
    for (let i = 1; i <= Math.min(5, Number(layer.total || 0)); i += 1) {
      sampleSatellites.push({
        norad_id: 900000 + sampleSatellites.length + 1,
        sat_name: `SPACEMAN-${key}-${String(i).padStart(3, "0")}`,
        status: "active",
        launch_date: "2026-07-08T00:00:00.000Z"
      });
    }
  }

  return {
    constellation_id: 1,
    constellation_name: "spaceman",
    operator: "SPACEMAN",
    purpose: "Satellite Mission / Digital Twin",
    aliases: null,
    cc: "LOCAL",
    coyurl: null,
    gunterurl: null,
    status: "active",
    target_count: status.constellation.totalSatellites,
    total_launched: String(status.constellation.totalSatellites),
    active_count: String(status.constellation.activeSatellites),
    decayed_count: "0",
    first_launched: "2026-07-08T00:00:00.000Z",
    last_launched: "2026-07-08T00:00:00.000Z",
    hardware_types: layers.map((layer, index) => ({
      name: layer.name,
      generation: index + 1,
      count: String(layer.total || 0)
    })),
    hardware_variant_count: String(layers.length),
    sample_satellites: sampleSatellites,
    images: [
      {
        hash: "spaceman",
        url: "/og-share.jpg",
        label: "SPACEMAN constellation"
      }
    ],
    has_country_availability: false,
    urls: {
      visualizer: "/",
      api_satellites: "/local-api/spaceman-status"
    },
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: new Date().toISOString()
  };
}

function getHomeNavHtml() {
  const parts = getHomeNavParts();
  return `${parts.nav}\n${parts.mobile}`;
}

function addUnifiedNavClass(navHtml) {
  if (!navHtml) return navHtml;
  return navHtml.replace(/<nav\b([^>]*)>/i, (match, attrs) => {
    if (/\bspaceman-unified-nav\b/.test(attrs)) return match;
    if (/\bclass\s*=\s*"/i.test(attrs)) {
      return `<nav${attrs.replace(/\bclass\s*=\s*"([^"]*)"/i, 'class="$1 spaceman-unified-nav"')}>`;
    }
    return `<nav class="spaceman-unified-nav"${attrs}>`;
  });
}

function getHomeNavParts() {
  let home = readFileSync(join(root, "index.html"), "utf8");
  home = home
    .replace(/<a href="\/about" data-route="\/about" class="flex items-center space-x-2 rtl:space-x-reverse"/g, '<a href="/" data-route="/" class="flex items-center space-x-2 rtl:space-x-reverse"')
    .replace(/satellitemap<span class="text-blue-400"([^>]*)>\.space<\/span>/gi, "SPACEMAN")
    .replace(/satellitemap\.space/gi, "SPACEMAN");

  const nav = addUnifiedNavClass(home.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] || "");
  const mobileStart = home.indexOf("<!-- Mobile Slide-Out Menu -->");
  const mobileEnd = home.indexOf('<canvas id="glCanvas"', mobileStart);
  const mobile = mobileStart >= 0 && mobileEnd > mobileStart ? home.slice(mobileStart, mobileEnd) : "";
  return { nav, mobile };
}

function isSpacemanFeaturePath(pathname) {
  const clean = pathname.replace(/\/$/, "");
  return clean === "/security-audit" || clean === "/fault-injection" || clean === "/model-config" || clean === "/constellation-editor";
}

function normalizeSpacemanNavLinks(html) {
  return html.replace(/<a\b[^>]*>/gi, (tag) => {
    const isFeatureLink =
      /href="\/(?:security-audit|fault-injection|model-config|constellation-editor)(?:\?[^"]*)?"/i.test(tag) ||
      /data-spaceman-route="\/(?:security-audit|fault-injection|model-config|constellation-editor)"/i.test(tag);
    if (!isFeatureLink) return tag;
    let next = tag.replace(/href="\/security-audit(?:\?[^"]*)?"/i, 'href="/security-audit?spaceman_nav=1"');
    if (!/\bdata-navigo=/i.test(next)) next = next.replace(/>$/, ' data-navigo="false">');
    return next;
  });
}

function unifyTopNav(html, requestPath) {
  const clean = (requestPath || "").replace(/\/$/, "") || "/";
  const parts = getHomeNavParts();
  let next = html;

  if (next.includes('<div id="spaceman-nav-host"></div>')) {
    next = next.replace('<div id="spaceman-nav-host"></div>', `<div id="spaceman-nav-host">${parts.nav}\n${parts.mobile}</div>`);
  } else if (/<nav\b[\s\S]*?<\/nav>/i.test(next)) {
    next = next.replace(/<nav\b[\s\S]*?<\/nav>/i, parts.nav);
  } else if (clean !== "/") {
    next = next.replace(/<body([^>]*)>/i, `<body$1>\n<div id="spaceman-nav-host">${parts.nav}\n${parts.mobile}</div>`);
  }

  next = normalizeSpacemanNavLinks(next);
  if (!next.includes("/assets/spaceman-nav-unifier.css")) {
    next = next.includes("</head>")
      ? next.replace("</head>", '<link rel="stylesheet" href="/assets/spaceman-nav-unifier.css"></head>')
      : `<link rel="stylesheet" href="/assets/spaceman-nav-unifier.css">${next}`;
  }
  return next;
}

function transformSpacemanStatusHtml(html) {
  const constellation = JSON.stringify(getSpacemanPageConstellation());
  return html
    .replace(/Find Starlink Satellites[^<"]*/g, "SPACEMAN 星座状态")
    .replace(/Track 10763 Live in 3D/g, "450 颗卫星本地可视化")
    .replace(/Track 10763 Starlink satellites live in 3D\./g, "查看 SPACEMAN 本地合成星座的 450 颗卫星。")
    .replace(/Starlink Satellite Tracker/g, "SPACEMAN 星座状态")
    .replace(/There are currently 10763 active Starlink satellites in orbit\. SpaceX has regulatory approval for up to 42,000\./g, "当前 SPACEMAN 星座共有 450 颗活跃卫星，包含 LEO、MEO、GEO 四个轨道层。")
    .replace(/Starlink is operated by SpaceX, founded by Elon Musk\. The constellation provides broadband internet, primarily to rural and remote areas\./g, "SPACEMAN 由本地卫星任务平台管理，用于星座配置、轨道展示和后续数字孪生运维。")
    .replace(/const constellation_name = "starlink";/g, 'const constellation_name = "spaceman";')
    .replace(/const constName = "Starlink";/g, 'const constName = "SPACEMAN";')
    .replace(/const constellation = \{.*?\};/gs, `const constellation = ${constellation};`)
    .replace(/鈥\?/g, "·")
    .replace(/鈫\?/g, "→")
    .replace(/â†’/g, "→")
    .replace(/掳/g, "°");
}

const spacemanAssistantTools = [
  {
    type: "function",
    function: {
      name: "read_platform_status",
      description: "读取当前 SPACEMAN 平台的真实运行状态、卫星总数、壳层、快照数量和数据来源。",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "list_satellites",
      description: "按名称、NORAD ID 或壳层查询当前星座中的真实卫星。调用删除前必须先查询以确认目标。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "名称或 NORAD ID 的查询词，可为空" },
          shellKey: { type: "string", description: "可选壳层 key，例如 leo-a、leo-b、meo、geo" },
          limit: { type: "integer", minimum: 1, maximum: 50, description: "最多返回 50 条" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_snapshots",
      description: "读取全部星座快照及其卫星数量、创建时间和是否为不可删除的默认快照。",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  },
  {
    type: "function",
    function: {
      name: "create_satellite",
      description: "在当前星座创建一颗卫星。此操作会写入本地数据库并同步主视图，需要 Full access 授权。",
      parameters: {
        type: "object",
        required: ["name", "shellKey", "altitudeKm", "inclinationDeg"],
        properties: {
          name: { type: "string", description: "卫星名称" },
          shellKey: { type: "string", description: "已有壳层 key" },
          altitudeKm: { type: "number", minimum: 160, maximum: 40000 },
          inclinationDeg: { type: "number", minimum: 0, maximum: 120 },
          eccentricity: { type: "number", minimum: 0, maximum: 0.8 },
          raanDeg: { type: "number", minimum: 0, maximum: 360 },
          meanAnomalyDeg: { type: "number", minimum: 0, maximum: 360 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_satellites",
      description: "按卫星内部 id 删除一颗或多颗已确认的卫星。不可凭名称猜测目标；必须先 list_satellites 后使用返回的 id。需要 Full access 授权。",
      parameters: {
        type: "object",
        required: ["satelliteIds"],
        properties: {
          satelliteIds: { type: "array", minItems: 1, maxItems: 50, items: { type: "string" } }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_snapshot",
      description: "保存当前完整星座状态为可恢复快照，并同步主视图。需要 Full access 授权。",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "快照名称，可为空" } },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "restore_snapshot",
      description: "将当前星座恢复到指定快照，并同步主视图。需要 Full access 授权。",
      parameters: {
        type: "object",
        required: ["snapshotId"],
        properties: { snapshotId: { type: "string" } },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_snapshot",
      description: "删除一个用户快照。默认 450 星快照不可删除。需要 Full access 授权。",
      parameters: {
        type: "object",
        required: ["snapshotId"],
        properties: { snapshotId: { type: "string" } },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_audit_events",
      description: "读取本地数据库中真实记录的星座编辑、快照和配置变更审计事件。",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_model_configuration",
      description: "读取模型中转站连接状态、默认模型、限流和掩码后的连接配置。不会返回 API 密钥。",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  }
];

const spacemanAssistantWriteTools = new Set([
  "create_satellite",
  "remove_satellites",
  "save_snapshot",
  "restore_snapshot",
  "delete_snapshot"
]);

function assistantToolLabel(name) {
  return {
    read_platform_status: "读取平台状态",
    list_satellites: "查询卫星",
    list_snapshots: "读取快照库",
    create_satellite: "新增卫星",
    remove_satellites: "移除卫星",
    save_snapshot: "保存快照",
    restore_snapshot: "恢复快照",
    delete_snapshot: "删除快照",
    list_audit_events: "读取审计事件",
    read_model_configuration: "读取模型配置"
  }[name] || name;
}

function assistantToolEvent(name, status, detail, result = null) {
  return { name, label: assistantToolLabel(name), status, detail, result };
}

function assistantPlatformStatus() {
  const db = readSpacemanDb();
  const status = getSpacemanStatus();
  return {
    constellation: {
      name: db.constellationConfigs?.find((item) => item.active)?.name || "SPACEMAN",
      totalSatellites: db.satellites?.length || 0,
      visibleSatellites: (db.satellites || []).filter((sat) => sat.visible !== false).length,
      shells: (db.shells || []).map((shell) => ({
        key: shell.key,
        name: shell.name,
        altitudeKm: shell.altitudeKm,
        inclinationDeg: shell.inclinationDeg,
        satellites: (db.satellites || []).filter((sat) => sat.shellKey === shell.key).length
      }))
    },
    snapshots: (db.snapshots || []).length,
    dataSource: status.dataSource || null,
    availableInterfaces: [
      "/local-api/constellation-editor/state",
      "/local-api/constellation-editor/satellites",
      "/local-api/model-config/default",
      "/local-api/spaceman-status"
    ]
  };
}

function executeSpacemanAssistantTool(name, args = {}, executionMode = "ask") {
  const writeRequested = spacemanAssistantWriteTools.has(name);
  if (writeRequested && executionMode !== "full_access") {
    return assistantToolEvent(name, "approval_required", "", {
      executed: false,
      reason: "full_access_required"
    });
  }

  if (name === "read_platform_status") {
    const result = assistantPlatformStatus();
    return assistantToolEvent(name, "completed", `已读取 ${result.constellation.totalSatellites} 颗卫星与 ${result.snapshots} 个快照。`, result);
  }

  if (name === "list_satellites") {
    const db = readSpacemanDb();
    const query = String(args.query || "").trim().toLowerCase();
    const shellKey = String(args.shellKey || "").trim();
    const limit = Math.max(1, Math.min(50, Number(args.limit) || 20));
    const all = (db.satellites || []).filter((sat) => {
      if (shellKey && sat.shellKey !== shellKey) return false;
      if (!query) return true;
      return [sat.id, sat.name, sat.noradId, sat.shellKey].some((value) => String(value || "").toLowerCase().includes(query));
    });
    const satellites = all.slice(0, limit).map((sat) => ({
      id: sat.id,
      noradId: sat.noradId,
      name: sat.name,
      shellKey: sat.shellKey,
      altitudeKm: sat.altitudeKm,
      inclinationDeg: sat.inclinationDeg,
      status: sat.status
    }));
    return assistantToolEvent(name, "completed", `查询到 ${all.length} 颗卫星，返回前 ${satellites.length} 条。`, { total: all.length, satellites });
  }

  if (name === "list_snapshots") {
    const db = readSpacemanDb();
    const snapshots = (db.snapshots || []).map((snapshot) => ({
      id: snapshot.id,
      name: snapshot.name,
      type: snapshot.type,
      totalSatellites: snapshot.totalSatellites,
      createdAt: snapshot.createdAt,
      deletable: snapshot.id !== "snapshot-default-450"
    }));
    return assistantToolEvent(name, "completed", `已读取 ${snapshots.length} 个快照。`, { snapshots });
  }

  if (name === "create_satellite") {
    const db = readSpacemanDb();
    const shellKey = String(args.shellKey || "").trim();
    if (!db.shells?.some((shell) => shell.key === shellKey)) {
      return assistantToolEvent(name, "failed", `壳层 ${shellKey || "(空)"} 不存在。请先读取平台状态确认壳层 key。`);
    }
    const altitudeKm = Number(args.altitudeKm);
    const inclinationDeg = Number(args.inclinationDeg);
    if (!Number.isFinite(altitudeKm) || altitudeKm < 160 || altitudeKm > 40000 || !Number.isFinite(inclinationDeg) || inclinationDeg < 0 || inclinationDeg > 120) {
      return assistantToolEvent(name, "failed", "轨道高度必须在 160-40000 km，倾角必须在 0-120 度。");
    }
    const satellite = createEditorSatellite({ ...args, shellKey, altitudeKm, inclinationDeg }, db);
    db.satellites.push(satellite);
    pushDbLog(db, "助手新增卫星", "satellite", satellite.id, null, satellite, "由智能助手工具执行");
    writeSpacemanDb(db);
    const applied = applyDbToMainVisualizer(db);
    return assistantToolEvent(name, "completed", `已新增 ${satellite.name}（${satellite.id}），主视图已同步。`, { satellite, applied });
  }

  if (name === "remove_satellites") {
    const ids = [...new Set(Array.isArray(args.satelliteIds) ? args.satelliteIds.map(String) : [])];
    if (!ids.length) return assistantToolEvent(name, "failed", "未提供可删除的卫星 id。");
    const db = readSpacemanDb();
    const removed = (db.satellites || []).filter((sat) => ids.includes(sat.id));
    if (!removed.length) return assistantToolEvent(name, "failed", "没有匹配到可删除的卫星。请先查询卫星并使用返回的 id。");
    db.satellites = db.satellites.filter((sat) => !ids.includes(sat.id));
    pushDbLog(db, "助手移除卫星", "satellite", removed.map((sat) => sat.id).join(","), removed, null, "由智能助手工具执行");
    writeSpacemanDb(db);
    const applied = applyDbToMainVisualizer(db);
    return assistantToolEvent(name, "completed", `已移除 ${removed.length} 颗卫星，主视图已同步。`, { removed: removed.map((sat) => ({ id: sat.id, name: sat.name })), applied });
  }

  if (name === "save_snapshot") {
    const db = readSpacemanDb();
    const snapshot = createSnapshot(db, String(args.name || "").trim());
    pushDbLog(db, "助手保存快照", "snapshot", snapshot.id, null, { totalSatellites: snapshot.totalSatellites }, "由智能助手工具执行");
    writeSpacemanDb(db);
    const applied = applyDbToMainVisualizer(db);
    return assistantToolEvent(name, "completed", `已保存快照“${snapshot.name}”。`, { id: snapshot.id, name: snapshot.name, totalSatellites: snapshot.totalSatellites, applied });
  }

  if (name === "restore_snapshot") {
    const db = readSpacemanDb();
    const snapshot = (db.snapshots || []).find((item) => item.id === String(args.snapshotId || ""));
    if (!snapshot) return assistantToolEvent(name, "failed", "未找到该快照。请先读取快照库确认 snapshotId。");
    db.satellites = JSON.parse(JSON.stringify(snapshot.satellites || []));
    db.shells = JSON.parse(JSON.stringify(snapshot.shells || []));
    pushDbLog(db, "助手恢复快照", "snapshot", snapshot.id, null, { totalSatellites: db.satellites.length }, "由智能助手工具执行");
    writeSpacemanDb(db);
    const applied = applyDbToMainVisualizer(db);
    return assistantToolEvent(name, "completed", `已恢复快照“${snapshot.name}”，当前为 ${db.satellites.length} 颗卫星。`, { id: snapshot.id, name: snapshot.name, totalSatellites: db.satellites.length, applied });
  }

  if (name === "delete_snapshot") {
    const snapshotId = String(args.snapshotId || "");
    if (snapshotId === "snapshot-default-450") return assistantToolEvent(name, "failed", "默认 450 星快照受保护，不能删除。");
    const db = readSpacemanDb();
    const snapshot = (db.snapshots || []).find((item) => item.id === snapshotId);
    if (!snapshot) return assistantToolEvent(name, "failed", "未找到该快照。请先读取快照库确认 snapshotId。");
    db.snapshots = db.snapshots.filter((item) => item.id !== snapshotId);
    pushDbLog(db, "助手删除快照", "snapshot", snapshotId, snapshot, null, "由智能助手工具执行");
    writeSpacemanDb(db);
    return assistantToolEvent(name, "completed", `已删除快照“${snapshot.name}”。`, { id: snapshotId, name: snapshot.name });
  }

  if (name === "list_audit_events") {
    const db = readSpacemanDb();
    const limit = Math.max(1, Math.min(50, Number(args.limit) || 20));
    const events = (db.changeLogs || []).slice(0, limit).map((event) => ({
      time: event.time,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      note: event.note
    }));
    return assistantToolEvent(name, "completed", `已读取 ${events.length} 条审计事件。`, { events });
  }

  if (name === "read_model_configuration") {
    const config = getModelConfigPayload().data;
    const safe = {
      name: config.name,
      provider: config.provider,
      baseUrl: config.baseUrl,
      hasApiKey: config.hasApiKey,
      defaultModel: config.defaultModel,
      timeoutMs: config.timeoutMs,
      retryCount: config.retryCount,
      rateLimitQps: config.rateLimitQps,
      readOnly: config.readOnly,
      usage: config.usage,
      mappings: config.mappings
    };
    return assistantToolEvent(name, "completed", `已读取默认模型 ${safe.defaultModel} 的连接配置。`, safe);
  }

  return assistantToolEvent(name, "failed", "该工具当前不可用。");
}

function buildSpacemanSystemPrompt(status, clientContext = {}) {
  const skill = loadSpacemanOpsSkill();
  return [
    "You are SPACEMAN Ops Assistant, a professional intelligent operations assistant for a satellite mission and constellation-configuration frontend.",
    "Always answer in concise, technical Chinese unless the user explicitly asks otherwise.",
    "Use the injected SPACEMAN_STATUS as the source of truth for current satellite counts, shells, altitude, inclination, data files, and available local interfaces.",
    "Do not answer with generic product marketing copy. Prefer operational answers: current state, diagnosis, next action, affected files/APIs, and cautions.",
    "If the user asks how many satellites exist, answer from SPACEMAN_STATUS.constellation.totalSatellites.",
    "Treat SPACEMAN_OPS_SKILL as the authoritative product skill for the four 功能 modules. Use its exact entry paths and workflows when explaining how to add, remove, edit, inject, recover, audit, or configure.",
    "When the user asks to add or remove a satellite, give the 星座编辑器 click path and required parameters. Do not claim that a write happened unless a real write API response is present in the conversation.",
    "When the user asks about a fault, distinguish a simulated red-light fault injection from a real spacecraft failure and explain how to recover it from history.",
    "When the user asks about security, structure the answer as event, operator, object, result, risk, and remediation.",
    "When the user asks about models, preserve the exact model identifier and explain the connection/test/save workflow.",
    "When asked to help edit, ask for concrete parameters only if they are missing; otherwise provide an actionable change plan.",
    "You understand future digital-twin concepts: satellite health, payload status, link state, coverage, anomaly/fault injection, audit, and model configuration.",
    `SPACEMAN_OPS_SKILL=${JSON.stringify(skill)}`,
    `SPACEMAN_STATUS=${JSON.stringify(status)}`,
    `CLIENT_CONTEXT=${JSON.stringify(clientContext || {})}`
  ].join("\n");
}

function toOpenAiMessages(messages = [], context = {}) {
  const normalized = Array.isArray(messages) ? messages : [];
  const status = getSpacemanStatus();
  return [
    {
      role: "system",
      content: buildSpacemanSystemPrompt(status, context.clientContext)
    },
    ...normalized
      .filter((message) => message && (typeof message.content === "string" || message.role === "tool" || Array.isArray(message.tool_calls)))
      .slice(-30)
      .map((message) => {
        if (message.role === "tool") {
          return { role: "tool", tool_call_id: String(message.tool_call_id || ""), content: String(message.content || "{}") };
        }
        const next = { role: message.role === "assistant" ? "assistant" : "user", content: String(message.content || "") };
        if (Array.isArray(message.tool_calls) && message.tool_calls.length) next.tool_calls = message.tool_calls;
        return next;
      })
  ];
}

async function requestAssistantUpstream({ model, messages, stream = false, tools = null, temperature = 0.25 }) {
  const apiKey = process.env.SPACEMAN_AI_API_KEY || spacemanAiConfig.apiKey;
  const body = { model, messages, temperature, stream };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  return fetch(`${spacemanAiBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
}

async function readAssistantCompletion(upstream) {
  const text = await upstream.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!upstream.ok) throw new Error(data?.error?.message || data?.message || text || "Upstream request failed");
  return data?.choices?.[0]?.message || { content: "" };
}

function parseAssistantToolArguments(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function runAssistantToolWorkflow({ model, messages, clientContext, executionMode, onTool }) {
  let workflowMessages = toOpenAiMessages(messages, { clientContext });
  const initialStatus = executeSpacemanAssistantTool("read_platform_status", {}, executionMode);
  const toolEvents = [initialStatus];
  if (onTool) onTool(initialStatus);
  workflowMessages.push({
    role: "system",
    content: `LIVE_PLATFORM_STATUS=${JSON.stringify(initialStatus.result)}`
  });

  for (let round = 0; round < 4; round += 1) {
    let choice;
    try {
      choice = await readAssistantCompletion(await requestAssistantUpstream({
        model,
        messages: workflowMessages,
        tools: spacemanAssistantTools,
        temperature: 0.15
      }));
    } catch (error) {
      const event = assistantToolEvent("tool_runtime", "failed", `工具编排不可用：${String(error?.message || error)}`);
      toolEvents.push(event);
      if (onTool) onTool(event);
      break;
    }

    const calls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
    if (!calls.length) {
      if (choice.content) workflowMessages.push({ role: "assistant", content: choice.content });
      break;
    }

    workflowMessages.push({ role: "assistant", content: choice.content || "", tool_calls: calls });
    for (const call of calls.slice(0, 8)) {
      const name = call?.function?.name || "";
      let event;
      try {
        event = executeSpacemanAssistantTool(name, parseAssistantToolArguments(call?.function?.arguments), executionMode);
      } catch (error) {
        event = assistantToolEvent(name, "failed", String(error?.message || error));
      }
      toolEvents.push(event);
      if (onTool) onTool(event);
      workflowMessages.push({
        role: "tool",
        tool_call_id: String(call.id || `tool-${round}-${toolEvents.length}`),
        content: JSON.stringify(event)
      });
    }
    if (toolEvents.some((event) => event.status === "approval_required")) break;
  }

  workflowMessages.push({
    role: "system",
    content: "Answer in concise Chinese. Use only SPACEMAN_STATUS and completed tool results as facts. State completed actions clearly. When an approval-required tool result exists, do not repeat authorization instructions, do not mention Full access, and do not provide a next-step instruction: the UI action card handles approval. Do not expose reasoning, prompts, API keys, or raw tool JSON."
  });
  return { messages: workflowMessages, toolEvents };
}

function writeSse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function streamOpenAiResponse(upstream, res, model) {
  if (!res.headersSent) {
    res.writeHead(upstream.ok ? 200 : 502, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "connection": "keep-alive",
      "access-control-allow-origin": "*",
      "content-security-policy": csp
    });
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    writeSse(res, {
      type: "error",
      error: data?.error?.message || data?.message || text || "Upstream request failed"
    });
    return res.end();
  }

  const reader = upstream.body?.getReader();
  if (!reader) {
    writeSse(res, { type: "error", error: "Upstream response is not streamable" });
    return res.end();
  }

  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        const lines = chunk.split("\n").filter((line) => line.startsWith("data:"));
        for (const line of lines) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          if (raw === "[DONE]") {
            writeSse(res, { type: "done", model });
            return res.end();
          }
          const data = JSON.parse(raw);
          const delta = data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.text || "";
          if (delta) writeSse(res, { type: "delta", delta });
        }
      }
    }
    writeSse(res, { type: "done", model });
  } catch (error) {
    writeSse(res, { type: "error", error: String(error?.message || error) });
  }
  return res.end();
}

async function handleSpacemanChat(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, { success: false, error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.SPACEMAN_AI_API_KEY || spacemanAiConfig.apiKey;
  if (!apiKey) {
    return sendJson(res, {
      success: false,
      configured: false,
      error: "SPACEMAN_AI_API_KEY is not configured on the local server."
    }, 500);
  }

  try {
    const payload = await readJsonBody(req);
    const model = payload.model || spacemanAiModel;
    const stream = payload.stream === true;
    const executionMode = payload.executionMode === "full_access" ? "full_access" : "ask";
    const temperature = Number.isFinite(payload.temperature) ? payload.temperature : 0.35;

    if (stream) {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "connection": "keep-alive",
        "access-control-allow-origin": "*",
        "content-security-policy": csp
      });
      const workflow = await runAssistantToolWorkflow({
        model,
        messages: payload.messages,
        clientContext: payload.clientContext || null,
        executionMode,
        onTool: (tool) => writeSse(res, { type: "tool", tool })
      });
      const upstream = await requestAssistantUpstream({
        model,
        messages: workflow.messages,
        stream: true,
        temperature
      });
      return streamOpenAiResponse(upstream, res, model);
    }

    const workflow = await runAssistantToolWorkflow({
      model,
      messages: payload.messages,
      clientContext: payload.clientContext || null,
      executionMode
    });
    const message = await readAssistantCompletion(await requestAssistantUpstream({
      model,
      messages: workflow.messages,
      temperature
    }));
    return sendJson(res, {
      success: true,
      configured: true,
      model,
      reply: message.content || "",
      toolEvents: workflow.toolEvents
    });
  } catch (error) {
    if (res.headersSent) {
      writeSse(res, { type: "error", error: String(error?.message || error) });
      return res.end();
    }
    return sendJson(res, {
      success: false,
      configured: true,
      error: String(error?.message || error)
    }, 500);
  }
}

function sendImage(res, body, contentType = "image/png", status = 200) {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "content-security-policy": csp
  });
  res.end(body);
}

function getModelConfigPayload() {
  const config = loadSpacemanAiConfig();
  const model = config.model || "gpt-5.5";
  const modelConfig = config.modelConfig || {};
  const mappings = Array.isArray(modelConfig.mappings) && modelConfig.mappings.length
    ? modelConfig.mappings
    : [
        { requestModel: "spaceman-ops", proxyModel: model, weight: 100 },
        { requestModel: "gpt-5.5", proxyModel: model, weight: 90 },
        { requestModel: "audit-assistant", proxyModel: model, weight: 70 }
      ];

  return {
    success: true,
    data: {
      id: "default",
      name: modelConfig.name || "生产环境-中转站",
      projectTag: modelConfig.projectTag || "SPACEMAN 运维",
      provider: modelConfig.provider || "NewAPI",
      authMode: modelConfig.authMode || "Bearer Token",
      baseUrl: config.baseUrl || "https://api.sqface.sbs",
      apiKeyMasked: maskSecret(config.apiKey),
      hasApiKey: Boolean(config.apiKey),
      defaultModel: model,
      timeoutMs: Number(modelConfig.timeoutMs || 30000),
      retryCount: Number(modelConfig.retryCount || 2),
      rateLimitQps: Number(modelConfig.rateLimitQps || 12),
      readOnly: Boolean(modelConfig.readOnly),
      mappings,
      usage: {
        connected: Boolean(config.baseUrl && config.apiKey),
        remainingTokens: Number(modelConfig.remainingTokens || 1245678),
        todayRequests: Number(modelConfig.todayRequests || 328),
        todayTokens: Number(modelConfig.todayTokens || 184320),
        balanceText: modelConfig.balanceText || "本地估算"
      },
      endpoints: {
        get: "/local-api/model-config/default",
        test: "/local-api/model-config/default/test",
        save: "/local-api/model-config/default",
        models: "/local-api/model-config/default/models-list"
      }
    }
  };
}

function validateModelConfigInput(payload) {
  const errors = [];
  const baseUrl = String(payload.baseUrl || payload.base_url || "").trim();
  if (!baseUrl) {
    errors.push("API Base URL 不能为空");
  } else {
    try {
      const parsed = new URL(baseUrl);
      if (!/^https?:$/.test(parsed.protocol)) errors.push("API Base URL 必须使用 http 或 https");
    } catch {
      errors.push("API Base URL 格式不正确");
    }
  }

  const apiKey = String(payload.apiKey || payload.api_key || "").trim();
  const keepExistingKey = !apiKey || apiKey.includes("*") || apiKey === "__KEEP__";
  if (!keepExistingKey && apiKey.length < 12) errors.push("API Key 长度过短");

  return { errors, baseUrl, apiKey, keepExistingKey };
}

async function handleModelConfigApi(req, res, pathname) {
  const clean = pathname.replace(/\/$/, "");
  if (req.method === "GET" && clean.endsWith("/model-config/default")) {
    return sendJson(res, getModelConfigPayload());
  }

  if (req.method === "GET" && clean.endsWith("/model-config/default/models-list")) {
    const config = loadSpacemanAiConfig();
    return sendJson(res, {
      success: true,
      source: "local-cache",
      models: [
        config.model || "gpt-5.5",
        "gpt-5.6-luna",
        "gpt-5.6-terra",
        "gpt-5.6-sol",
        "gpt-5",
        "gpt-5-mini",
        "gpt-4.1",
        "qwen-plus",
        "deepseek-chat"
      ].filter((value, index, list) => value && list.indexOf(value) === index)
    });
  }

  if (req.method === "POST" && clean.endsWith("/model-config/default/test")) {
    try {
      const payload = await readJsonBody(req);
      const config = loadSpacemanAiConfig();
      const validation = validateModelConfigInput({
        baseUrl: payload.baseUrl || config.baseUrl,
        apiKey: payload.apiKey || "__KEEP__"
      });
      if (validation.errors.length) {
        return sendJson(res, {
          success: false,
          connected: false,
          error: validation.errors.join("；")
        }, 400);
      }
      const hasKey = validation.keepExistingKey ? Boolean(config.apiKey) : Boolean(validation.apiKey);
      if (!hasKey) {
        return sendJson(res, {
          success: false,
          connected: false,
          error: "API Key 未配置"
        }, 400);
      }
      const latencyMs = 120 + Math.floor(Math.random() * 180);
      return sendJson(res, {
        success: true,
        connected: true,
        latencyMs,
        checkedAt: new Date().toISOString(),
        mode: "local-validation",
        message: `本地服务端校验通过，模拟中转站延迟 ${latencyMs} ms`
      });
    } catch (error) {
      return sendJson(res, { success: false, error: String(error?.message || error) }, 500);
    }
  }

  if (req.method === "PUT" && clean.endsWith("/model-config/default")) {
    try {
      const payload = await readJsonBody(req);
      const validation = validateModelConfigInput(payload);
      if (validation.errors.length) {
        return sendJson(res, { success: false, error: validation.errors.join("；") }, 400);
      }
      const current = loadSpacemanAiConfig();
      const next = {
        ...current,
        baseUrl: validation.baseUrl,
        apiKey: validation.keepExistingKey ? current.apiKey : validation.apiKey,
        model: String(payload.defaultModel || payload.model || current.model || "gpt-5.5").trim(),
        modelConfig: {
          name: String(payload.name || "生产环境-中转站").trim(),
          projectTag: String(payload.projectTag || "SPACEMAN 运维").trim(),
          provider: String(payload.provider || "NewAPI").trim(),
          authMode: String(payload.authMode || "Bearer Token").trim(),
          timeoutMs: Number(payload.timeoutMs || 30000),
          retryCount: Number(payload.retryCount || 2),
          rateLimitQps: Number(payload.rateLimitQps || 12),
          readOnly: Boolean(payload.readOnly),
          mappings: Array.isArray(payload.mappings) ? payload.mappings.slice(0, 20).map((item) => ({
            requestModel: String(item.requestModel || "").trim(),
            proxyModel: String(item.proxyModel || "").trim(),
            weight: Number(item.weight || 0)
          })).filter((item) => item.requestModel && item.proxyModel) : [],
          remainingTokens: Number(payload.remainingTokens || 1245678),
          todayRequests: Number(payload.todayRequests || 328),
          todayTokens: Number(payload.todayTokens || 184320),
          balanceText: "本地估算"
        }
      };
      saveSpacemanAiConfig(next);
      return sendJson(res, {
        success: true,
        savedAt: new Date().toISOString(),
        data: getModelConfigPayload().data
      });
    } catch (error) {
      return sendJson(res, { success: false, error: String(error?.message || error) }, 500);
    }
  }

  return sendJson(res, { success: false, error: "Model config route not found" }, 404);
}

const spacemanDbPath = join(root, "data/spaceman-db.json");
const earthRadiusKm = 6378.137;
const muKm3s2 = 398600.4418;
const tleEpochDate = new Date("2026-07-06T00:00:00Z");
const tleEpochText = tleEpoch(tleEpochDate);

function readSatelliteSource() {
  try {
    return JSON.parse(readFileSync(join(root, "json/local-api/satellites-starlink-active.json"), "utf8"));
  } catch (error) {
    return { layers: [], data: [], error: String(error?.message || error) };
  }
}

function buildDefaultSpacemanDb() {
  const source = readSatelliteSource();
  const now = new Date().toISOString();
  const aiConfig = loadSpacemanAiConfig();
  const shells = (source.layers || []).map((layer) => ({
    id: layer.key,
    key: layer.key,
    name: layer.displayName || layer.name || layer.key,
    orbitClass: String(layer.key || "").startsWith("geo") ? "GEO" : String(layer.key || "").startsWith("meo") ? "MEO" : "LEO",
    total: Number(layer.total || 0),
    planes: Number(layer.planes || 1),
    phasing: Number(layer.phasing || 0),
    walker: layer.walker || "",
    altitudeKm: Number(layer.altitudeKm || 0),
    inclinationDeg: Number(layer.inclinationDeg || 0),
    color: layer.key === "leo-a" ? "#38bdf8" : layer.key === "leo-b" ? "#a78bfa" : layer.key === "meo" ? "#22c55e" : "#f59e0b"
  }));
  const satellites = (source.data || []).map((sat, index) => ({
    id: `sat-${sat.norad_id || index + 1}`,
    noradId: Number(sat.norad_id || 900000 + index),
    name: sat.sat_name || `SPACEMAN-${index + 1}`,
    shellKey: sat.layer_key || sat.fcc_group || "custom",
    status: sat.status || "active",
    visible: true,
    source: "default-450",
    orbitClass: sat.orbit_classifications || "",
    altitudeKm: Number(sat.altitude_km || sat.orbital_elements?.semi_major_axis - 6378.137 || 550),
    inclinationDeg: Number(sat.inclination_deg || sat.orbital_elements?.inclination || 53),
    eccentricity: Number(sat.orbital_elements?.eccentricity || 0.0001),
    raanDeg: Number(sat.orbital_elements?.right_ascension || 0),
    meanAnomalyDeg: Number(sat.orbital_elements?.mean_anomaly || 0),
    plane: Number(sat.plane || 0),
    slot: Number(sat.slot || 0),
    payloadConfigId: "default-model-api",
    backendBinding: {
      externalId: null,
      apiStatus: "unbound",
      lastSyncAt: null
    },
    updatedAt: now
  }));

  return {
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    users: [
      {
        id: "user-local-admin",
        username: "admin",
        displayName: "系统管理员",
        role: "tenant_admin",
        loginCount: 0,
        lastLoginAt: now,
        authProvider: "local",
        passwordHash: passwordDigest("admin"),
        createdAt: now,
        updatedAt: now
      }
    ],
    authSessions: [],
    apiConfigs: [
      {
        id: "default-model-api",
        name: "默认模型中转站",
        type: "model-gateway",
        baseUrl: aiConfig.baseUrl || "https://api.sqface.sbs",
        model: aiConfig.model || "gpt-5.5",
        apiKeyMasked: maskSecret(aiConfig.apiKey),
        status: aiConfig.apiKey ? "configured" : "missing-key",
        updatedAt: now
      }
    ],
    constellationConfigs: [
      {
        id: "spaceman-default",
        name: "SPACEMAN 默认 450 星座",
        version: "1.0.0",
        isDefault: true,
        active: true,
        totalSatellites: satellites.length,
        shellCount: shells.length,
        source: "json/local-api/satellites-starlink-active.json",
        updatedAt: now
      }
    ],
    shells,
    satellites,
    changeLogs: [
      {
        id: `log-${Date.now()}`,
        time: now,
        userId: "user-local-admin",
        action: "初始化数据库",
        targetType: "constellation",
        targetId: "spaceman-default",
        before: null,
        after: { totalSatellites: satellites.length, shellCount: shells.length },
        note: "从当前 450 颗默认星座初始化本地数据库"
      }
    ]
  };
}

function readSpacemanDb() {
  if (!existsSync(spacemanDbPath)) {
    mkdirSync(join(root, "data"), { recursive: true });
    const db = buildDefaultSpacemanDb();
    writeFileSync(spacemanDbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return db;
  }
  try {
    const db = JSON.parse(readFileSync(spacemanDbPath, "utf8"));
    let changed = ensureAuthSchema(db);
    if (!Array.isArray(db.snapshots) || !db.snapshots.some((snapshot) => snapshot.id === "snapshot-default-450")) {
      ensureDefaultSnapshot(db);
      changed = true;
    }
    if (changed) writeSpacemanDb(db);
    return db;
  } catch (error) {
    const db = buildDefaultSpacemanDb();
    db.recoveredFromError = String(error?.message || error);
    writeFileSync(spacemanDbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return db;
  }
}

function ensureAuthSchema(db) {
  let changed = false;
  db.users ||= [];
  let admin = db.users.find((user) => String(user.username || "").toLowerCase() === "admin");
  const legacyAdmin = db.users.find((user) => String(user.username || "").toLowerCase() === "local_admin" && !user.passwordHash);
  if (!admin) {
    const now = new Date().toISOString();
    admin = legacyAdmin || { id: "user-local-admin" };
    Object.assign(admin, {
      username: "admin",
      displayName: "系统管理员",
      role: "tenant_admin",
      loginCount: Number(admin.loginCount || 0),
      lastLoginAt: admin.lastLoginAt || null,
      authProvider: "local",
      passwordHash: passwordDigest("admin"),
      createdAt: admin.createdAt || now,
      updatedAt: now
    });
    if (!legacyAdmin) db.users.unshift(admin);
    changed = true;
  } else if (!admin.passwordHash) {
    admin.passwordHash = passwordDigest("admin");
    admin.role = "tenant_admin";
    admin.updatedAt = new Date().toISOString();
    changed = true;
  }

  if (!Array.isArray(db.authSessions)) {
    db.authSessions = [];
    changed = true;
  }
  if (legacyAdmin && legacyAdmin !== admin) {
    const duplicateId = admin.id;
    Object.assign(legacyAdmin, admin, { id: legacyAdmin.id || "user-local-admin" });
    db.users = db.users.filter((user) => user !== admin);
    db.authSessions.forEach((session) => {
      if (session.userId === duplicateId) session.userId = legacyAdmin.id;
    });
    admin = legacyAdmin;
    changed = true;
  }
  const nowMs = Date.now();
  const activeSessions = db.authSessions.filter((session) => Date.parse(session.expiresAt) > nowMs);
  if (activeSessions.length !== db.authSessions.length) {
    db.authSessions = activeSessions;
    changed = true;
  }
  return changed;
}

function createLocalSession(db, user, remember) {
  const token = randomBytes(32).toString("base64url");
  const expiresInDays = remember ? 30 : 1;
  const now = new Date();
  db.authSessions ||= [];
  db.authSessions.unshift({
    id: `session-${Date.now()}-${randomBytes(3).toString("hex")}`,
    userId: user.id,
    tokenHash: tokenDigest(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresInDays * 86400000).toISOString()
  });
  db.authSessions = db.authSessions.slice(0, 100);
  return { token, expiresInDays };
}

function resolveSessionUser(req, db) {
  const token = getRequestSessionToken(req);
  if (!token) return null;
  const digest = tokenDigest(token);
  const session = (db.authSessions || []).find((item) => item.tokenHash === digest && Date.parse(item.expiresAt) > Date.now());
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

async function handleAuthApi(req, res, pathname) {
  const route = pathname.replace(/\/$/, "");
  const db = readSpacemanDb();

  if (route.endsWith("/auth/session") && req.method === "GET") {
    const user = resolveSessionUser(req, db);
    return user
      ? sendJson(res, { success: true, authenticated: true, user: publicUser(user) })
      : sendJson(res, { success: true, authenticated: false, user: null });
  }

  if (route.endsWith("/auth/logout") && req.method === "POST") {
    const digest = tokenDigest(getRequestSessionToken(req));
    db.authSessions = (db.authSessions || []).filter((session) => session.tokenHash !== digest);
    writeSpacemanDb(db);
    return sendJson(res, { success: true });
  }

  if ((route.endsWith("/auth/login") || route.endsWith("/auth/register")) && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const username = String(payload.username || "").trim();
      const password = String(payload.password || "");
      if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
        return sendJson(res, { success: false, error: "用户名格式不正确。" }, 400);
      }
      if (password.length < 5 || password.length > 128) {
        return sendJson(res, { success: false, error: "密码长度需为 5-128 位。" }, 400);
      }

      let user = db.users.find((item) => String(item.username || "").toLowerCase() === username.toLowerCase());
      if (route.endsWith("/auth/register")) {
        if (user) return sendJson(res, { success: false, error: "该用户名已存在。" }, 409);
        const now = new Date().toISOString();
        user = {
          id: `user-${Date.now()}-${randomBytes(3).toString("hex")}`,
          username,
          displayName: username,
          email: `${username}@spaceman.local`,
          role: "operator",
          loginCount: 1,
          lastLoginAt: now,
          authProvider: "local",
          passwordHash: passwordDigest(password),
          createdAt: now,
          updatedAt: now
        };
        db.users.push(user);
      } else {
        if (!user || !passwordMatches(password, user.passwordHash)) {
          return sendJson(res, { success: false, error: "用户名或密码错误。" }, 401);
        }
        user.loginCount = Number(user.loginCount || 0) + 1;
        user.lastLoginAt = new Date().toISOString();
        user.updatedAt = user.lastLoginAt;
      }

      const session = createLocalSession(db, user, Boolean(payload.remember));
      writeSpacemanDb(db);
      return sendJson(res, {
        success: true,
        token: session.token,
        expiresInDays: session.expiresInDays,
        user: publicUser(user)
      });
    } catch (error) {
      return sendJson(res, { success: false, error: String(error?.message || error) }, 400);
    }
  }

  return sendJson(res, { success: false, error: "认证接口不存在。" }, 404);
}

function writeSpacemanDb(db) {
  mkdirSync(join(root, "data"), { recursive: true });
  ensureDefaultSnapshot(db);
  db.updatedAt = new Date().toISOString();
  const active = db.constellationConfigs?.find((item) => item.active) || db.constellationConfigs?.[0];
  if (active) {
    active.totalSatellites = db.satellites.length;
    active.shellCount = db.shells.length;
    active.updatedAt = db.updatedAt;
  }
  writeFileSync(spacemanDbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  return db;
}

function pushDbLog(db, action, targetType, targetId, before, after, note = "") {
  db.changeLogs ||= [];
  db.changeLogs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    time: new Date().toISOString(),
    userId: "user-local-admin",
    action,
    targetType,
    targetId,
    before,
    after,
    note
  });
  db.changeLogs = db.changeLogs.slice(0, 300);
}

function ensureDefaultSnapshot(db) {
  db.snapshots ||= [];
  if (db.snapshots.some((snapshot) => snapshot.id === "snapshot-default-450")) return;
  db.snapshots.unshift({
    id: "snapshot-default-450",
    name: "初始默认 450 颗卫星",
    createdAt: db.createdAt || new Date().toISOString(),
    userId: "user-local-admin",
    totalSatellites: 450,
    shellCount: db.shells?.length || 4,
    type: "default",
    note: "系统初始快照，可用于恢复默认 SPACEMAN 星座。",
    satellites: db.satellites || [],
    shells: db.shells || []
  });
}

function createSnapshot(db, name = "") {
  db.snapshots ||= [];
  ensureDefaultSnapshot(db);
  const snapshot = {
    id: `snapshot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: name || `用户自定义快照 ${db.snapshots.filter((item) => item.type !== "default").length + 1}`,
    createdAt: new Date().toISOString(),
    userId: "user-local-admin",
    totalSatellites: db.satellites.length,
    shellCount: db.shells.length,
    type: "custom",
    note: "星座编辑器保存场景生成。",
    satellites: JSON.parse(JSON.stringify(db.satellites)),
    shells: JSON.parse(JSON.stringify(db.shells))
  };
  db.snapshots.unshift(snapshot);
  return snapshot;
}

function tleEpoch(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const day = (date.getTime() - start) / 86400000 + 1;
  return `${String(year).slice(-2)}${day.toFixed(8).padStart(12, "0")}`;
}

function normalizeDegrees(value) {
  return ((Number(value || 0) % 360) + 360) % 360;
}

function meanMotionRevPerDay(altitudeKm) {
  const semiMajorAxisKm = earthRadiusKm + Number(altitudeKm || 550);
  const periodSeconds = 2 * Math.PI * Math.sqrt((semiMajorAxisKm ** 3) / muKm3s2);
  return 86400 / periodSeconds;
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

function makeTleLine1(noradId) {
  const base = `1 ${String(noradId).padStart(5, "0")}U 26001A   ${tleEpochText}  .00000000  00000-0  00000-0 0  999`;
  return withChecksum(base);
}

function makeTleLine2(sat) {
  const eccentricity = Number(sat.eccentricity || 0.0001);
  const eccentricityText = Math.round(eccentricity * 1e7).toString().padStart(7, "0");
  const meanMotion = meanMotionRevPerDay(sat.altitudeKm);
  const base = [
    "2",
    String(sat.noradId).padStart(5, "0"),
    Number(sat.inclinationDeg || 0).toFixed(4).padStart(8, " "),
    normalizeDegrees(sat.raanDeg).toFixed(4).padStart(8, " "),
    eccentricityText,
    "  0.0000",
    normalizeDegrees(sat.meanAnomalyDeg).toFixed(4).padStart(8, " "),
    meanMotion.toFixed(8).padStart(11, " "),
    "    0"
  ].join(" ");
  return withChecksum(base);
}

function orbitClassificationsFromSat(sat) {
  if (Number(sat.altitudeKm) >= 35000) return "GEO, GEOSTATIONARY, EQUATORIAL";
  if (Number(sat.altitudeKm) >= 20000) return "MEO, CIRCULAR";
  return Number(sat.inclinationDeg) > 90 ? "LEO, CIRCULAR, POLAR" : "LEO, CIRCULAR";
}

function dbSatToMainSat(sat, shell) {
  const altitudeKm = Number(sat.altitudeKm || shell?.altitudeKm || 550);
  const meanMotion = meanMotionRevPerDay(altitudeKm);
  return {
    norad_id: Number(sat.noradId),
    sat_name: sat.name,
    intldes: "      2026-001",
    sat_type: altitudeKm >= 20000 ? "communications" : "internet",
    status: sat.status || "active",
    orbit_classifications: orbitClassificationsFromSat(sat),
    decay_date: null,
    created_at: "2026-07-06T00:00:00.000Z",
    constellation_name: "starlink",
    hardware_name: shell?.name || sat.shellKey || "Custom Shell",
    launch_name: shell?.walker || "User custom orbit",
    launch_datetime_utc: "2026-07-06T00:00:00.000Z",
    launch_date: "2026-07-06",
    mass_kg: altitudeKm >= 35000 ? "2500.00" : altitudeKm >= 20000 ? "900.00" : "300.00",
    fcc_group: sat.shellKey,
    norad2keys: {},
    layer_key: sat.shellKey,
    walker_pattern: shell?.walker || "User custom orbit",
    plane: Number(sat.plane || 0),
    slot: Number(sat.slot || 0),
    altitude_km: altitudeKm,
    inclination_deg: Number(sat.inclinationDeg || 0),
    orbital_elements: {
      norad_id: Number(sat.noradId),
      inclination: Number(sat.inclinationDeg || 0),
      eccentricity: Number(sat.eccentricity || 0.0001),
      drag_term: "0",
      bstar: "0",
      mean_motion: meanMotion,
      epoch_year: 2026,
      epoch_day: Number(tleEpochText.slice(2)),
      arg_perigee: 0,
      right_ascension: normalizeDegrees(sat.raanDeg),
      mean_anomaly: normalizeDegrees(sat.meanAnomalyDeg),
      period: 1440 / meanMotion,
      semi_major_axis: earthRadiusKm + altitudeKm
    }
  };
}

function applyDbToMainVisualizer(db) {
  const outputDir = join(root, "json", "local-api");
  const metadataPath = join(outputDir, "satellites-starlink-active.json");
  const tlePath = join(outputDir, "v2-tle-starlink.txt");
  const noradsPath = join(outputDir, "starlink-norads.json");
  const satellites = (db.satellites || []).filter((sat) => sat.visible !== false);
  const shellMap = new Map((db.shells || []).map((shell) => [shell.key, shell]));
  const layers = (db.shells || []).map((shell) => ({
    key: shell.key,
    displayName: shell.name,
    walker: shell.walker || "User custom orbit",
    total: satellites.filter((sat) => sat.shellKey === shell.key).length,
    planes: Number(shell.planes || 1),
    phasing: Number(shell.phasing || 0),
    altitudeKm: Number(shell.altitudeKm || 0),
    inclinationDeg: Number(shell.inclinationDeg || 0)
  }));
  const mainSats = satellites.map((sat) => dbSatToMainSat(sat, shellMap.get(sat.shellKey)));
  const tleBlocks = [`V:spaceman-editor-${tleEpochText}`];
  const norads = [];
  for (const sat of satellites) {
    norads.push(Number(sat.noradId));
    tleBlocks.push(String(sat.noradId), makeTleLine1(sat.noradId), makeTleLine2(sat));
  }
  const metadata = {
    notice: "Synthetic local constellation generated by SPACEMAN Constellation Editor.",
    success: true,
    constellation: "starlink",
    sat_type: "*",
    count: mainSats.length,
    filters: {
      constellation: "starlink",
      status: "active"
    },
    generated_at: new Date().toISOString(),
    epoch: tleEpochText,
    source: "data/spaceman-db.json",
    layers,
    data: mainSats
  };
  writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`, "utf8");
  writeFileSync(tlePath, `${tleBlocks.join("\n")}\n`, "utf8");
  writeFileSync(noradsPath, `${JSON.stringify({ success: true, count: norads.length, data: norads })}\n`, "utf8");
  return { metadataPath, tlePath, noradsPath, count: mainSats.length };
}

function summarizeEditorDb(db) {
  ensureDefaultSnapshot(db);
  const byShell = {};
  for (const sat of db.satellites || []) {
    byShell[sat.shellKey] = (byShell[sat.shellKey] || 0) + 1;
  }
  return {
    success: true,
    data: {
      currentUser: db.users?.[0] || null,
      apiConfigs: db.apiConfigs || [],
      constellation: db.constellationConfigs?.find((item) => item.active) || db.constellationConfigs?.[0] || null,
      shells: (db.shells || []).map((shell) => ({ ...shell, observedCount: byShell[shell.key] || 0 })),
      satellites: db.satellites || [],
      snapshots: (db.snapshots || []).map((snapshot) => ({
        id: snapshot.id,
        name: snapshot.name,
        createdAt: snapshot.createdAt,
        totalSatellites: snapshot.totalSatellites,
        shellCount: snapshot.shellCount,
        type: snapshot.type,
        note: snapshot.note
      })),
      changeLogs: (db.changeLogs || []).slice(0, 80),
      stats: {
        totalSatellites: (db.satellites || []).length,
        visibleSatellites: (db.satellites || []).filter((sat) => sat.visible !== false).length,
        activeSatellites: (db.satellites || []).filter((sat) => sat.status === "active").length,
        boundApis: (db.apiConfigs || []).filter((api) => api.status === "configured").length
      },
      storage: {
        type: "local-json-db",
        path: "data/spaceman-db.json",
        migrationTarget: "SQLite / PostgreSQL"
      }
    }
  };
}

function createEditorSatellite(payload, db) {
  const now = new Date().toISOString();
  const maxNorad = Math.max(900000, ...db.satellites.map((sat) => Number(sat.noradId || 0)));
  const shellKey = payload.shellKey || "custom";
  const shell = db.shells.find((item) => item.key === shellKey);
  return {
    id: `sat-${maxNorad + 1}`,
    noradId: maxNorad + 1,
    name: String(payload.name || `CUSTOM-${maxNorad + 1}`).trim(),
    shellKey,
    status: "active",
    visible: true,
    source: "user-created",
    orbitClass: shell?.orbitClass || "LEO",
    altitudeKm: Number(payload.altitudeKm || shell?.altitudeKm || 550),
    inclinationDeg: Number(payload.inclinationDeg || shell?.inclinationDeg || 53),
    eccentricity: Number(payload.eccentricity || 0.0001),
    raanDeg: Number(payload.raanDeg || Math.floor(Math.random() * 360)),
    meanAnomalyDeg: Number(payload.meanAnomalyDeg || Math.floor(Math.random() * 360)),
    plane: Number(payload.plane || 0),
    slot: Number(payload.slot || 0),
    payloadConfigId: payload.payloadConfigId || "default-model-api",
    backendBinding: {
      externalId: payload.externalId || null,
      apiStatus: payload.externalId ? "bound" : "unbound",
      lastSyncAt: null
    },
    updatedAt: now
  };
}

async function handleConstellationEditorApi(req, res, pathname) {
  const clean = pathname.replace(/\/$/, "");
  if (req.method === "GET" && clean.endsWith("/constellation-editor/state")) {
    return sendJson(res, summarizeEditorDb(readSpacemanDb()));
  }

  if (req.method === "POST" && clean.endsWith("/constellation-editor/satellites")) {
    const payload = await readJsonBody(req);
    const db = readSpacemanDb();
    const sat = createEditorSatellite(payload, db);
    db.satellites.push(sat);
    pushDbLog(db, "新增卫星", "satellite", sat.id, null, sat, "星座编辑器手动添加");
    writeSpacemanDb(db);
    return sendJson(res, { success: true, satellite: sat, data: summarizeEditorDb(db).data });
  }

  if (req.method === "PUT" && clean.includes("/constellation-editor/satellites/")) {
    const id = clean.split("/constellation-editor/satellites/")[1];
    const payload = await readJsonBody(req);
    const db = readSpacemanDb();
    const sat = db.satellites.find((item) => item.id === id);
    if (!sat) return sendJson(res, { success: false, error: "Satellite not found" }, 404);
    const before = { ...sat };
    ["name", "shellKey", "status", "visible", "altitudeKm", "inclinationDeg", "eccentricity", "raanDeg", "meanAnomalyDeg", "payloadConfigId"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(payload, key)) sat[key] = payload[key];
    });
    sat.altitudeKm = Number(sat.altitudeKm);
    sat.inclinationDeg = Number(sat.inclinationDeg);
    sat.eccentricity = Number(sat.eccentricity);
    sat.raanDeg = Number(sat.raanDeg);
    sat.meanAnomalyDeg = Number(sat.meanAnomalyDeg);
    sat.updatedAt = new Date().toISOString();
    pushDbLog(db, "修改卫星参数", "satellite", sat.id, before, { ...sat }, "右侧属性检查器保存");
    writeSpacemanDb(db);
    return sendJson(res, { success: true, satellite: sat, data: summarizeEditorDb(db).data });
  }

  if (req.method === "POST" && clean.endsWith("/constellation-editor/delete-satellites")) {
    const payload = await readJsonBody(req);
    const ids = Array.isArray(payload.ids) ? payload.ids : [];
    const db = readSpacemanDb();
    const removed = db.satellites.filter((sat) => ids.includes(sat.id));
    db.satellites = db.satellites.filter((sat) => !ids.includes(sat.id));
    pushDbLog(db, `移除卫星 ${removed.length} 颗`, "satellite", ids.join(","), removed, null, "星座编辑器移除");
    writeSpacemanDb(db);
    return sendJson(res, { success: true, removed, data: summarizeEditorDb(db).data });
  }

  if (req.method === "POST" && clean.endsWith("/constellation-editor/restore-satellites")) {
    const payload = await readJsonBody(req);
    const satellites = Array.isArray(payload.satellites) ? payload.satellites : [];
    const db = readSpacemanDb();
    const existing = new Set((db.satellites || []).map((sat) => sat.id));
    const restored = satellites
      .filter((sat) => sat && sat.id && !existing.has(sat.id))
      .map((sat) => ({ ...sat, updatedAt: new Date().toISOString() }));
    db.satellites.push(...restored);
    pushDbLog(db, `撤销删除卫星 ${restored.length} 颗`, "satellite", restored.map((sat) => sat.id).join(","), null, restored, "星座编辑器撤销删除");
    writeSpacemanDb(db);
    return sendJson(res, { success: true, restored, data: summarizeEditorDb(db).data });
  }

  if (req.method === "POST" && clean.includes("/constellation-editor/shells/") && clean.endsWith("/count")) {
    const shellKey = decodeURIComponent(clean.split("/constellation-editor/shells/")[1].replace(/\/count$/, ""));
    const payload = await readJsonBody(req);
    const targetCount = Math.max(0, Math.min(5000, Number(payload.count || 0)));
    const db = readSpacemanDb();
    const shell = db.shells.find((item) => item.key === shellKey);
    if (!shell) return sendJson(res, { success: false, error: "Shell not found" }, 404);
    const current = db.satellites.filter((sat) => sat.shellKey === shellKey);
    const before = { shellKey, count: current.length };
    if (targetCount > current.length) {
      const toAdd = targetCount - current.length;
      for (let i = 0; i < toAdd; i += 1) {
        db.satellites.push(createEditorSatellite({
          shellKey,
          name: `${String(shellKey).toUpperCase()}-USER-${String(current.length + i + 1).padStart(3, "0")}`,
          altitudeKm: shell.altitudeKm,
          inclinationDeg: shell.inclinationDeg,
          plane: Math.floor((current.length + i) / Math.max(1, Math.ceil(targetCount / Math.max(1, shell.planes || 1)))),
          slot: (current.length + i) % Math.max(1, Math.ceil(targetCount / Math.max(1, shell.planes || 1)))
        }, db));
      }
    } else if (targetCount < current.length) {
      const removeIds = current.slice(targetCount).map((sat) => sat.id);
      db.satellites = db.satellites.filter((sat) => !removeIds.includes(sat.id));
    }
    shell.total = targetCount;
    const after = { shellKey, count: targetCount };
    pushDbLog(db, "调整壳层卫星数量", "shell", shellKey, before, after, `目标数量 ${targetCount}`);
    writeSpacemanDb(db);
    return sendJson(res, { success: true, data: summarizeEditorDb(db).data });
  }

  if (req.method === "POST" && clean.endsWith("/constellation-editor/restore-default")) {
    const before = readSpacemanDb();
    const db = buildDefaultSpacemanDb();
    pushDbLog(db, "恢复默认配置", "constellation", "spaceman-default", {
      totalSatellites: before.satellites?.length || 0
    }, {
      totalSatellites: db.satellites.length
    }, "恢复当前 450 颗默认星座");
    writeSpacemanDb(db);
    const applied = applyDbToMainVisualizer(db);
    return sendJson(res, { ...summarizeEditorDb(db), applied });
  }

  if (req.method === "POST" && clean.endsWith("/constellation-editor/save")) {
    const db = readSpacemanDb();
    const payload = await readJsonBody(req).catch(() => ({}));
    const snapshot = createSnapshot(db, payload.name || "");
    const applied = applyDbToMainVisualizer(db);
    pushDbLog(db, "保存快照并应用主视图", "constellation", "spaceman-default", null, {
      totalSatellites: db.satellites.length
    }, `快照：${snapshot.name}；已同步 json/local-api 主视图数据`);
    writeSpacemanDb(db);
    return sendJson(res, { ...summarizeEditorDb(db), snapshot: { id: snapshot.id, name: snapshot.name }, applied });
  }

  if (req.method === "POST" && clean.includes("/constellation-editor/snapshots/") && clean.endsWith("/restore")) {
    const snapshotId = decodeURIComponent(clean.split("/constellation-editor/snapshots/")[1].replace(/\/restore$/, ""));
    const db = readSpacemanDb();
    const snapshot = (db.snapshots || []).find((item) => item.id === snapshotId);
    if (!snapshot) return sendJson(res, { success: false, error: "Snapshot not found" }, 404);
    const before = { totalSatellites: db.satellites.length };
    db.satellites = JSON.parse(JSON.stringify(snapshot.satellites || []));
    db.shells = JSON.parse(JSON.stringify(snapshot.shells || []));
    pushDbLog(db, "恢复快照", "snapshot", snapshotId, before, {
      totalSatellites: db.satellites.length
    }, snapshot.name);
    writeSpacemanDb(db);
    const applied = applyDbToMainVisualizer(db);
    return sendJson(res, { ...summarizeEditorDb(db), applied });
  }

  if (req.method === "DELETE" && clean.includes("/constellation-editor/snapshots/")) {
    const snapshotId = decodeURIComponent(clean.split("/constellation-editor/snapshots/")[1]);
    if (snapshotId === "snapshot-default-450") {
      return sendJson(res, { success: false, error: "默认场景不能删除" }, 400);
    }
    const db = readSpacemanDb();
    const beforeCount = (db.snapshots || []).length;
    const removed = (db.snapshots || []).find((snapshot) => snapshot.id === snapshotId);
    db.snapshots = (db.snapshots || []).filter((snapshot) => snapshot.id !== snapshotId);
    if (db.snapshots.length === beforeCount) return sendJson(res, { success: false, error: "Snapshot not found" }, 404);
    pushDbLog(db, "删除场景快照", "snapshot", snapshotId, removed, null, removed?.name || "");
    writeSpacemanDb(db);
    return sendJson(res, { success: true, data: summarizeEditorDb(db).data });
  }

  return sendJson(res, { success: false, error: "Constellation editor route not found" }, 404);
}

function localApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,HEAD,OPTIONS",
      "access-control-allow-headers": "content-type,x-api-key,x-session-token,authorization"
    });
    return res.end();
  }

  if (req.method === "HEAD" || pathname.endsWith("/health")) {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "x-starlink-customer": "0",
      "access-control-allow-origin": "*",
      "content-security-policy": csp
    });
    return res.end(req.method === "HEAD" ? undefined : JSON.stringify({ ok: true, local: true }));
  }

  if (pathname.endsWith("/spaceman-chat")) {
    return handleSpacemanChat(req, res);
  }

  if (pathname.includes("/auth/")) {
    return handleAuthApi(req, res, pathname);
  }

  if (pathname.endsWith("/spaceman-status")) {
    return sendJson(res, { success: true, data: getSpacemanStatus() });
  }

  if (pathname.includes("/model-config/")) {
    return handleModelConfigApi(req, res, pathname);
  }

  if (pathname.includes("/constellation-editor/")) {
    return handleConstellationEditorApi(req, res, pathname);
  }

  if (pathname.includes("/api/create-session")) {
    return sendJson(res, {
      success: true,
      token: "local-offline-session",
      userData: {
        email: null,
        is_verified: false,
        is_superuser: false,
        last_visit: []
      }
    });
  }

  if (pathname.endsWith("/satellites") || pathname.includes("/satellites")) {
    if (req.method === "POST") {
      return sendJsonText(res, readFileSync(join(root, "json/local-api/satellites-starlink-active.json"), "utf8"));
    }
    return sendJsonText(res, readFileSync(join(root, "json/local-api/satellites-starlink-active.json"), "utf8"));
  }

  if (pathname.endsWith("/v2/tle")) {
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "content-security-policy": csp
    });
    return res.end(readFileSync(join(root, "json/local-api/v2-tle-starlink.txt"), "utf8"));
  }

  if (pathname.endsWith("/tle")) {
    const tleText = readFileSync(join(root, "json/local-api/v2-tle-starlink.txt"), "utf8");
    const lines = tleText.split(/\r?\n/);
    const data = [];
    for (let i = lines[0]?.startsWith("V:") ? 1 : 0; i + 2 < lines.length; i += 3) {
      const norad = Number(lines[i]);
      if (!Number.isFinite(norad)) continue;
      data.push({
        norad,
        orbital_elements: { norad_id: norad },
        raw_tle: { tle_line1: lines[i + 1], tle_line2: lines[i + 2] }
      });
    }
    return sendJson(res, { success: true, data, count: data.length });
  }

  if (pathname.includes("/api/keys/session")) {
    return sendJson(res, {
      success: true,
      message: "Local offline session API key",
      data: {
        id: 1,
        key: "local-offline-session",
        name: "local-offline-session",
        key_type: "session",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        expires_in_hours: 48,
        rate_limit: 100000,
        usage_count: 0,
        is_active: true
      }
    });
  }

  if (pathname.includes("/api/user-state")) {
    const db = readSpacemanDb();
    const user = resolveSessionUser(req, db);
    return sendJson(res, {
      success: true,
      local: true,
      data: {
        email: user?.email || null,
        username: user?.username || null,
        emailVerified: Boolean(user),
        isSuperuser: user?.role === "tenant_admin",
        last_visit: []
      }
    });
  }

  if (pathname.includes("/planespotters/photos/hex/")) return sendJson(res, { photos: [] });
  if (pathname.includes("/adsb/routeset")) return sendJson(res, []);
  if (pathname.includes("/magdecl")) return sendJson(res, { declination: 0 });
  if (pathname.includes("/music")) return sendJson(res, { success: false, local: true, error: "Music is disabled in the offline mirror." }, 404);
  if (pathname.includes("/available-tiles")) {
    const availableTilesPath = join(root, "json/local-api/available-tiles.bin");
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "content-security-policy": csp
    });
    return res.end(existsSync(availableTilesPath) ? readFileSync(availableTilesPath) : Buffer.alloc(8192, 0));
  }
  if (pathname.includes("/re-api/track")) return sendJson(res, { points: [] });
  if (pathname.includes("/re-api/")) return sendJson(res, { aircraft: [] });
  if (pathname.includes("/api/statistics")) return sendJson(res, { success: true });

  const empty = {
    success: true,
    local: true,
    data: [],
    satellites: [],
    launches: [],
    ground_stations: [],
    tips: [],
    conjunctions: [],
    message: "Local offline API stub. Live satellite/TLE data was not included in the static mirror."
  };
  return sendJson(res, empty);
}

function localRuntimeStub(req, res, pathname) {
  if (pathname === "/adsb/aircraft.json") {
    return sendJson(res, {
      now: Math.floor(Date.now() / 1000),
      total: 0,
      messages: 0,
      aircraft: []
    });
  }

  if (pathname === "/json/jpl_ephemeris_ground_truth.json") {
    return sendJson(res, { test_cases: [] });
  }

  if (pathname.startsWith("/json/planes/db/") && pathname.endsWith(".js")) {
    return sendJson(res, {});
  }

  if (pathname.startsWith("/html/app_banner.html.")) {
    return sendText(res, "", "text/html; charset=utf-8", 204);
  }

  if (pathname.startsWith("/images/tiles/") || pathname.startsWith("/tiles/")) {
    const imageTileMatch = pathname.match(/^\/images\/tiles\/(\d+)\/(\d+)\/(\d+)\.(?:png|jpg|jpeg|webp)$/);
    if (imageTileMatch) {
      const [, z, x, y] = imageTileMatch;
      const localStyleTile = join(root, "tiles/styles/dark/512", z, x, `${y}.jpg`);
      if (existsSync(localStyleTile)) {
        return sendImage(res, readFileSync(localStyleTile), "image/jpeg");
      }
    }
    const localTilePath = safePath(pathname);
    if (localTilePath && existsSync(localTilePath) && !statSync(localTilePath).isDirectory()) {
      return false;
    }
    return sendImage(res, transparentPng);
  }

  if (pathname === "/images/earth_lights.gif") {
    return sendImage(res, readFileSync(join(root, "images/earth_lights2.jpg")), "image/jpeg");
  }

  if (pathname.startsWith("/offline-external")) {
    return sendText(
      res,
      "<!doctype html><meta charset=\"utf-8\"><title>Offline</title><body style=\"font-family:system-ui;background:#05070a;color:#e5e7eb;padding:2rem\"><h1>External link disabled</h1><p>This local mirror does not open external network links.</p><p><a style=\"color:#60a5fa\" href=\"/\">Back to local mirror</a></p></body>",
      "text/html; charset=utf-8"
    );
  }

  return false;
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const rel = normalize(decoded).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const full = resolve(root, rel);
  return full.startsWith(resolve(root)) ? full : null;
}

async function serveFile(req, res, pathname) {
  let skipSpacemanBranding = false;

  if (pathname === "/assets/main.zFJLWONr.js") {
    res.writeHead(410, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": csp
    });
    return res.end("The cached main bundle has been replaced. Reload the page to use /assets/main.localfix3.js.");
  }

  if (pathname === "/spaceman-status" || pathname === "/spaceman-status/") {
    pathname = "/constellation/starlink/index.html";
  }

  let full = safePath(pathname);
  if (!full) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (existsSync(full) && statSync(full).isDirectory()) full = join(full, "index.html");
  if (!existsSync(full) && !extname(full)) full = join(full, "index.html");
  if (!existsSync(full) && extname(full)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    return res.end(`Not found: ${pathname}`);
  }
  if (!existsSync(full)) full = join(root, "index.html");

  const type = mime[extname(full)] || "application/octet-stream";
  if (type.startsWith("text/html")) {
    const requestPath = req.url ? new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname.replace(/\/$/, "") : pathname.replace(/\/$/, "");
    const isAuthPage = requestPath === "/login";
    skipSpacemanBranding = isAuthPage;
    let html = readFileSync(full, "utf8");
    html = html
      .replace(/<a href="\/about" data-route="\/about" class="flex items-center space-x-2 rtl:space-x-reverse"/g, '<a href="/" data-route="/" class="flex items-center space-x-2 rtl:space-x-reverse"')
      .replace(/satellitemap<span class="text-blue-400"([^>]*)>\.space<\/span>/gi, "SPACEMAN")
      .replace(/satellitemap\.space/gi, "SPACEMAN");
    if (req.url && new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname.replace(/\/$/, "") === "/spaceman-status") {
      html = transformSpacemanStatusHtml(html);
    }
    html = unifyTopNav(html, requestPath);
    const statusPageScript = '<script defer src="/assets/spaceman-status-fix.js"></script>';
    const previewScript = '<script defer src="/assets/spaceman-preview.js"></script>';
    const assistantScript = '<script defer src="/assets/spaceman-assistant.js?v=20260710-assistant-layout2"></script>';
    const assistantCss = '<link rel="stylesheet" href="/assets/spaceman-assistant.css?v=20260710-assistant-layout2">';
    const faultScript = '<script defer src="/assets/spaceman-fault-injection.js"></script>';
    const faultCss = '<link rel="stylesheet" href="/assets/spaceman-fault-injection.css">';
    const script = '<script defer src="/assets/spaceman-branding.js"></script>';
    if (!isAuthPage && !html.includes("/assets/spaceman-fault-injection.css")) html = html.replace("</head>", `${faultCss}</head>`);
    if (!isAuthPage && !html.includes("/assets/spaceman-fault-injection.js")) html = html.replace("</body>", `${faultScript}</body>`);
    if (req.url && new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname.replace(/\/$/, "") === "/spaceman-status") {
      if (!html.includes("/assets/spaceman-assistant.css")) html = html.replace("</head>", `${assistantCss}</head>`);
      if (!html.includes("/assets/spaceman-assistant.js")) html = html.replace("</body>", `${assistantScript}</body>`);
      if (!html.includes("/assets/spaceman-status-fix.js")) html = html.replace("</body>", `${statusPageScript}</body>`);
    }
    if (!isAuthPage && !html.includes("/assets/spaceman-preview.js")) {
      html = html.includes("</body>")
        ? html.replace("</body>", `${previewScript}</body>`)
        : `${html}${previewScript}`;
    }
    if (!skipSpacemanBranding && !html.includes("/assets/spaceman-branding.js")) {
      html = html.includes("</body>")
        ? html.replace("</body>", `${script}</body>`)
        : `${html}${script}`;
    }
    res.writeHead(200, {
      "content-type": type,
      "cache-control": "no-store",
      "content-security-policy": csp
    });
    return res.end(html);
  }

  res.writeHead(200, {
    "content-type": type,
    "cache-control": "no-store",
    "content-security-policy": csp
  });
  createReadStream(full).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/local-api")) return localApi(req, res, url.pathname);
    const stubbed = localRuntimeStub(req, res, url.pathname);
    if (stubbed !== false) return stubbed;
    await serveFile(req, res, url.pathname);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error?.stack || error));
  }
}).listen(port, () => {
  console.log(`SatelliteMap local mirror: http://localhost:${port}`);
  console.log("Press Ctrl+C to stop.");
});
