(function () {
  const STORAGE_KEY = "spaceman_fault_history_v1";
  const PANEL_ID = "spaceman_fault_panel";
  const CANVAS_ID = "spaceman_fault_overlay_canvas";

  const satelliteFaultTypes = [
    ["attitude_loss", "姿态失稳"],
    ["power_drop", "供电异常"],
    ["battery_overheat", "电池过温"],
    ["solar_array_fault", "太阳翼展开/输出故障"],
    ["payload_shutdown", "载荷关断"],
    ["star_tracker_fault", "星敏感器失效"],
    ["gyro_drift", "陀螺漂移"],
    ["reaction_wheel_fault", "反作用轮故障"],
    ["thruster_fault", "推进器故障"],
    ["propellant_leak", "推进剂泄漏"],
    ["thermal_control_fault", "热控异常"],
    ["obc_reboot", "星载计算机重启"],
    ["memory_error", "存储器错误"],
    ["clock_sync_loss", "时钟同步丢失"],
    ["gnss_fault", "GNSS 接收异常"],
    ["uplink_loss", "上行链路中断"],
    ["downlink_loss", "下行链路中断"],
    ["telemetry_loss", "遥测丢失"],
    ["command_reject", "指令拒收"],
    ["software_deadlock", "软件死锁"],
    ["single_event_upset", "单粒子翻转"],
    ["orbit_deviation", "轨道偏差"],
    ["collision_avoidance_fail", "碰撞规避失败"],
    ["safe_mode", "进入安全模式"],
    ["deorbit_fault", "离轨/退役异常"]
  ];

  const linkFaultTypes = [
    ["link_down", "链路中断"],
    ["high_ber", "误码率过高"],
    ["high_latency", "链路高时延"],
    ["jitter", "抖动异常"],
    ["bandwidth_congestion", "带宽拥塞"],
    ["packet_loss", "拥塞丢包"],
    ["laser_unlock", "激光终端失锁"],
    ["antenna_mispoint", "天线指向偏差"],
    ["snr_drop", "信噪比下降"],
    ["frequency_interference", "频率干扰"],
    ["crosslink_handover_fail", "跨星/跨层切换失败"],
    ["gateway_unreachable", "网关不可达"],
    ["route_blackhole", "路由黑洞"],
    ["route_loop", "路由环路"],
    ["auth_fail", "认证失败"],
    ["key_expired", "密钥过期"],
    ["qos_degrade", "服务质量降级"],
    ["ddos_traffic", "DDoS 异常流量"],
    ["intermittent_drop", "链路间歇闪断"],
    ["congestion_control_fail", "拥塞控制失效"],
    ["protocol_mismatch", "协议协商失败"]
  ];

  const state = {
    satellites: [],
    satelliteByNorad: new Map(),
    links: [],
    linksById: new Map(),
    dataLoaded: false,
    history: [],
    rafStarted: false,
    canvas: null,
    ctx: null,
    dpr: 1
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  }

  function formatTime(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return value;
    }
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function loadData() {
    if (state.dataLoaded) return;
    const response = await fetch("/local-api/satellites", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.data || [];
    state.satellites = rows
      .filter((sat) => sat && sat.norad_id)
      .map((sat) => ({
        ...sat,
        _label: `${sat.sat_name || "SAT"} | NORAD ${sat.norad_id} | ${sat.hardware_name || sat.layer_key || ""}`
      }));
    state.satelliteByNorad = new Map(state.satellites.map((sat) => [String(sat.norad_id), sat]));
    state.links = buildLinks(state.satellites);
    state.linksById = new Map(state.links.map((link) => [link.id, link]));
    state.dataLoaded = true;
  }

  function buildLinks(satellites) {
    const groups = new Map();
    for (const sat of satellites) {
      const layer = sat.layer_key || sat.fcc_group || "unknown";
      const plane = sat.plane ?? 0;
      const key = `${layer}::${plane}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sat);
    }

    const links = [];
    for (const [key, sats] of groups) {
      sats.sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
      if (sats.length < 2) continue;
      const [layerKey, plane] = key.split("::");
      for (let i = 0; i < sats.length; i += 1) {
        const a = sats[i];
        const b = sats[(i + 1) % sats.length];
        const id = `${a.norad_id}-${b.norad_id}`;
        const layerName = a.hardware_name || layerKey;
        links.push({
          id,
          aNorad: String(a.norad_id),
          bNorad: String(b.norad_id),
          layerKey,
          plane,
          label: `${a.sat_name} ⇄ ${b.sat_name} | ${layerName} | P${plane}`
        });
      }
    }
    return links;
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div id="spaceman_fault_header">
        <div class="spaceman-fault-tabs">
          <div id="spaceman_fault_inject_tab" class="spaceman-fault-tab active">故障注入</div>
          <div id="spaceman_fault_history_tab" class="spaceman-fault-tab">历史</div>
        </div>
        <button type="button" id="spaceman_fault_close" aria-label="关闭">✕</button>
      </div>
      <div class="spaceman-fault-body">
        <div id="spaceman_fault_inject_view" class="spaceman-fault-panel-section active">
          <div class="spaceman-fault-field">
            <label for="spaceman_fault_target_kind">目标类型:</label>
            <select id="spaceman_fault_target_kind" class="spaceman-fault-select">
              <option value="satellite">卫星</option>
              <option value="link">链路</option>
            </select>
          </div>
          <div class="spaceman-fault-field">
            <label for="spaceman_fault_target_input">注入目标:</label>
            <input id="spaceman_fault_target_input" class="spaceman-fault-input" list="spaceman_fault_satellite_list" placeholder="输入或下拉选择卫星" autocomplete="off">
          </div>
          <div class="spaceman-fault-help" id="spaceman_fault_target_help">下拉包含当前 450 颗卫星，也可以直接输入 NORAD ID 或卫星名称。</div>
          <div class="spaceman-fault-field">
            <label for="spaceman_fault_type_select">故障类型:</label>
            <select id="spaceman_fault_type_select" class="spaceman-fault-select"></select>
          </div>
          <div class="spaceman-fault-actions">
            <div class="spaceman-fault-statusline" id="spaceman_fault_status">请选择目标和故障类型</div>
            <button type="button" id="spaceman_fault_focus_btn" class="spaceman-fault-button secondary">定位目标</button>
            <button type="button" id="spaceman_fault_inject_btn" class="spaceman-fault-button danger">注入故障</button>
          </div>
          <datalist id="spaceman_fault_satellite_list"></datalist>
          <datalist id="spaceman_fault_link_list"></datalist>
        </div>
        <div id="spaceman_fault_history_view" class="spaceman-fault-panel-section"></div>
      </div>
    `;
    document.body.appendChild(panel);
    wirePanelEvents();
  }

  function wirePanelEvents() {
    const panel = document.getElementById(PANEL_ID);
    const injectTab = document.getElementById("spaceman_fault_inject_tab");
    const historyTab = document.getElementById("spaceman_fault_history_tab");
    const injectView = document.getElementById("spaceman_fault_inject_view");
    const historyView = document.getElementById("spaceman_fault_history_view");
    const kind = document.getElementById("spaceman_fault_target_kind");

    document.getElementById("spaceman_fault_close")?.addEventListener("click", closePanel);
    injectTab?.addEventListener("click", () => {
      injectTab.classList.add("active");
      historyTab.classList.remove("active");
      injectView.classList.add("active");
      historyView.classList.remove("active");
    });
    historyTab?.addEventListener("click", () => {
      historyTab.classList.add("active");
      injectTab.classList.remove("active");
      historyView.classList.add("active");
      injectView.classList.remove("active");
      renderHistory();
    });
    kind?.addEventListener("change", syncTargetMode);
    document.getElementById("spaceman_fault_inject_btn")?.addEventListener("click", injectFault);
    document.getElementById("spaceman_fault_focus_btn")?.addEventListener("click", focusCurrentTarget);
    panel?.addEventListener("mousedown", (event) => event.stopPropagation());
    panel?.addEventListener("click", (event) => event.stopPropagation());
  }

  function fillOptions() {
    const satList = document.getElementById("spaceman_fault_satellite_list");
    const linkList = document.getElementById("spaceman_fault_link_list");
    if (satList) {
      satList.innerHTML = state.satellites.map((sat) => `<option value="${escapeHtml(sat._label)}"></option>`).join("");
    }
    if (linkList) {
      linkList.innerHTML = state.links.map((link) => `<option value="${escapeHtml(link.label)}"></option>`).join("");
    }
    syncTargetMode();
  }

  function syncTargetMode() {
    const kind = document.getElementById("spaceman_fault_target_kind")?.value || "satellite";
    const input = document.getElementById("spaceman_fault_target_input");
    const help = document.getElementById("spaceman_fault_target_help");
    const select = document.getElementById("spaceman_fault_type_select");
    const types = kind === "satellite" ? satelliteFaultTypes : linkFaultTypes;
    if (input) {
      input.value = "";
      input.setAttribute("list", kind === "satellite" ? "spaceman_fault_satellite_list" : "spaceman_fault_link_list");
      input.placeholder = kind === "satellite" ? "输入或下拉选择卫星" : "输入或下拉选择链路";
    }
    if (help) {
      help.textContent = kind === "satellite"
        ? `下拉包含当前 ${state.satellites.length || 0} 颗卫星，也可以直接输入 NORAD ID 或卫星名称。`
        : `下拉包含 ${state.links.length || 0} 条相邻星间链路，也可以输入链路两端卫星名称。`;
    }
    if (select) {
      select.innerHTML = types.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
    }
  }

  function resolveSatellite(inputValue) {
    const raw = String(inputValue || "").trim();
    const exactNorad = raw.match(/\b(\d{5,})\b/)?.[1];
    if (exactNorad && state.satelliteByNorad.has(exactNorad)) return state.satelliteByNorad.get(exactNorad);
    const normalized = normalizeText(raw);
    return state.satellites.find((sat) =>
      normalizeText(sat._label) === normalized ||
      normalizeText(sat.sat_name) === normalized ||
      String(sat.norad_id) === raw
    ) || state.satellites.find((sat) => normalizeText(sat._label).includes(normalized));
  }

  function resolveLink(inputValue) {
    const raw = String(inputValue || "").trim();
    const normalized = normalizeText(raw);
    const numbers = raw.match(/\d{5,}/g);
    if (numbers && numbers.length >= 2) {
      const keyA = `${numbers[0]}-${numbers[1]}`;
      const keyB = `${numbers[1]}-${numbers[0]}`;
      return state.linksById.get(keyA) || state.linksById.get(keyB) || null;
    }
    return state.links.find((link) =>
      normalizeText(link.label) === normalized ||
      normalizeText(link.id) === normalized
    ) || state.links.find((link) => normalizeText(link.label).includes(normalized));
  }

  function selectedFaultLabel(kind, value) {
    const source = kind === "satellite" ? satelliteFaultTypes : linkFaultTypes;
    return source.find(([key]) => key === value)?.[1] || value;
  }

  function setStatus(message, isError) {
    const status = document.getElementById("spaceman_fault_status");
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? "#fca5a5" : "#9ca3af";
  }

  function injectFault() {
    const kind = document.getElementById("spaceman_fault_target_kind")?.value || "satellite";
    const inputValue = document.getElementById("spaceman_fault_target_input")?.value || "";
    const faultType = document.getElementById("spaceman_fault_type_select")?.value || "";
    const target = kind === "satellite" ? resolveSatellite(inputValue) : resolveLink(inputValue);

    if (!target) {
      setStatus(kind === "satellite" ? "没有找到这个卫星，请从下拉栏选择。" : "没有找到这条链路，请从下拉栏选择。", true);
      return;
    }

    const record = {
      id: `fault-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      targetKind: kind,
      targetId: kind === "satellite" ? String(target.norad_id) : target.id,
      targetLabel: kind === "satellite" ? `${target.sat_name} / NORAD ${target.norad_id}` : target.label,
      faultType,
      faultLabel: selectedFaultLabel(kind, faultType),
      status: "active",
      createdAt: new Date().toISOString(),
      recoveredAt: null,
      link: kind === "link" ? { aNorad: target.aNorad, bNorad: target.bNorad } : null
    };

    state.history.unshift(record);
    saveHistory();
    setStatus(`已注入：${record.faultLabel}`, false);
    focusRecord(record);
    renderHistory();
    renderAlarmStack();
    startOverlayLoop();
    window.dispatchEvent(new CustomEvent("spaceman:fault-change", { detail: { action: "inject", record } }));
  }

  function focusCurrentTarget() {
    const kind = document.getElementById("spaceman_fault_target_kind")?.value || "satellite";
    const inputValue = document.getElementById("spaceman_fault_target_input")?.value || "";
    const target = kind === "satellite" ? resolveSatellite(inputValue) : resolveLink(inputValue);
    if (!target) {
      setStatus("请先选择一个有效目标。", true);
      return;
    }
    if (kind === "satellite") {
      window.globe?.focusSatellite?.(target.norad_id);
    } else {
      window.globe?.focusSatellite?.(target.aNorad);
    }
  }

  function focusRecord(record) {
    if (record.targetKind === "satellite") {
      window.globe?.focusSatellite?.(record.targetId);
    } else if (record.link?.aNorad) {
      window.globe?.focusSatellite?.(record.link.aNorad);
    }
  }

  function recoverFault(id) {
    const record = state.history.find((item) => item.id === id);
    if (!record || record.status === "recovered") return;
    record.status = "recovered";
    record.recoveredAt = new Date().toISOString();
    saveHistory();
    renderHistory();
    renderAlarmStack();
    window.dispatchEvent(new CustomEvent("spaceman:fault-change", { detail: { action: "recover", record } }));
  }

  function renderHistory() {
    const view = document.getElementById("spaceman_fault_history_view");
    if (!view) return;
    if (!state.history.length) {
      view.innerHTML = `<div class="spaceman-fault-history-empty">暂无故障注入记录</div>`;
      return;
    }

    view.innerHTML = `
      <div class="spaceman-fault-history-list">
        ${state.history.map((record) => `
          <div class="spaceman-fault-record">
            <div class="spaceman-fault-record-head">
              <div class="spaceman-fault-record-title">${escapeHtml(record.targetLabel)}</div>
              <span class="spaceman-fault-tag ${record.status === "active" ? "active" : "recovered"}">
                ${record.status === "active" ? "故障中" : "已恢复正常"}
              </span>
            </div>
            <div class="spaceman-fault-record-meta">
              类型：${record.targetKind === "satellite" ? "卫星故障" : "链路故障"} / ${escapeHtml(record.faultLabel)}<br>
              注入：${formatTime(record.createdAt)}${record.recoveredAt ? `　恢复：${formatTime(record.recoveredAt)}` : ""}
            </div>
            <div class="spaceman-fault-record-actions">
              ${record.status === "active" ? `<button type="button" class="spaceman-fault-restore" data-fault-restore="${escapeHtml(record.id)}">恢复</button>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    `;

    view.querySelectorAll("[data-fault-restore]").forEach((button) => {
      button.addEventListener("click", () => recoverFault(button.getAttribute("data-fault-restore")));
    });
  }

  function activeRecords() {
    return state.history.filter((record) => record.status === "active");
  }

  function renderAlarmStack() {
    let stack = document.getElementById("spaceman_fault_alarm_stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "spaceman_fault_alarm_stack";
      document.body.appendChild(stack);
    }
    const active = activeRecords();
    if (!active.length) {
      stack.style.display = "none";
      stack.innerHTML = "";
      return;
    }
    stack.style.display = "flex";
    stack.innerHTML = active.slice(0, 4).map((record) => `
      <div class="spaceman-fault-alarm">
        <strong>${escapeHtml(record.faultLabel)}</strong>
        ${escapeHtml(record.targetLabel)}
      </div>
    `).join("");
  }

  function ensureCanvas() {
    if (state.canvas) return;
    const canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    document.body.appendChild(canvas);
    state.canvas = canvas;
    state.ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  }

  function resizeCanvas() {
    if (!state.canvas || !state.ctx) return;
    state.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    state.canvas.width = Math.floor(window.innerWidth * state.dpr);
    state.canvas.height = Math.floor(window.innerHeight * state.dpr);
    state.canvas.style.width = `${window.innerWidth}px`;
    state.canvas.style.height = `${window.innerHeight}px`;
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function getMovingSatellite(norad) {
    const points = window.globe?.dots?.movingPoints || [];
    return points.find((point) => String(point.norad_id) === String(norad)) || null;
  }

  function getSatelliteWorldPosition(norad) {
    const globe = window.globe;
    const sat = getMovingSatellite(norad);
    if (!globe || !sat) return null;
    if (typeof globe._getTruePosition === "function") {
      const pos = globe._getTruePosition(sat);
      if (pos && Number.isFinite(pos[0])) return pos;
    }
    if (sat.pos && Number.isFinite(sat.pos[0])) return sat.pos;
    if (sat.ndx != null && globe.dots?.dpA) {
      const i = sat.ndx * 3;
      return [globe.dots.dpA[i], globe.dots.dpA[i + 1], globe.dots.dpA[i + 2]];
    }
    return null;
  }

  function projectPosition(pos) {
    const matrix = window.globe?.worldViewProjection;
    if (!matrix || !pos) return null;
    const [x, y, z] = pos;
    const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (!Number.isFinite(clipW) || clipW <= 0.00001) return null;
    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;
    if (ndcX < -1.25 || ndcX > 1.25 || ndcY < -1.25 || ndcY > 1.25) return null;
    return {
      x: (ndcX * 0.5 + 0.5) * window.innerWidth,
      y: (-ndcY * 0.5 + 0.5) * window.innerHeight
    };
  }

  function drawFaultOverlay() {
    if (!state.ctx || !state.canvas) return;
    const ctx = state.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const active = activeRecords();
    if (!active.length) {
      requestAnimationFrame(drawFaultOverlay);
      return;
    }

    const time = performance.now() / 1000;
    const pulse = 0.55 + 0.45 * Math.sin(time * 6.2);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const record of active) {
      if (record.targetKind === "satellite") {
        const point = projectPosition(getSatelliteWorldPosition(record.targetId));
        if (point) drawSatelliteFault(ctx, point, pulse, record);
      } else if (record.link) {
        const a = projectPosition(getSatelliteWorldPosition(record.link.aNorad));
        const b = projectPosition(getSatelliteWorldPosition(record.link.bNorad));
        if (a && b) drawLinkFault(ctx, a, b, pulse, record);
      }
    }

    ctx.restore();
    requestAnimationFrame(drawFaultOverlay);
  }

  function drawSatelliteFault(ctx, point, pulse, record) {
    const radius = 9 + pulse * 8;
    ctx.shadowBlur = 24 + pulse * 18;
    ctx.shadowColor = "rgba(255, 35, 35, 0.95)";
    ctx.strokeStyle = `rgba(255, 34, 34, ${0.55 + pulse * 0.4})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 28, 28, ${0.2 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255, 220, 220, ${0.35 + pulse * 0.35})`;
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText(record.faultLabel, point.x + 12, point.y - 10);
  }

  function drawLinkFault(ctx, a, b, pulse, record) {
    ctx.save();
    ctx.shadowBlur = 20 + pulse * 18;
    ctx.shadowColor = "rgba(255, 35, 35, 0.9)";
    ctx.strokeStyle = `rgba(255, 35, 35, ${0.45 + pulse * 0.45})`;
    ctx.lineWidth = 3.4;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -performance.now() / 45;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 40, 40, ${0.35 + pulse * 0.45})`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 4 + pulse * 3, 0, Math.PI * 2);
    ctx.arc(b.x, b.y, 4 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    ctx.fillStyle = `rgba(255, 220, 220, ${0.35 + pulse * 0.35})`;
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText(record.faultLabel, midX + 8, midY - 8);
    ctx.restore();
  }

  function startOverlayLoop() {
    ensureCanvas();
    if (state.rafStarted) return;
    state.rafStarted = true;
    requestAnimationFrame(drawFaultOverlay);
  }

  async function openPanel() {
    createPanel();
    const panel = document.getElementById(PANEL_ID);
    try {
      await loadData();
      fillOptions();
      setStatus("请选择目标和故障类型", false);
    } catch (error) {
      setStatus(`卫星数据加载失败：${error.message || error}`, true);
    }
    panel.style.display = "flex";
    panel.offsetHeight;
    panel.classList.add("slide-in");
    renderHistory();
    startOverlayLoop();
  }

  function closePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.style.display = "none";
  }

  function closeMenus() {
    try {
      window.FlowbiteInstances?._instances?.Dropdown?.dropdownSpacemanFunctions?.hide?.();
      window.FlowbiteInstances?._instances?.Dropdown?.dropdownNavbar?.hide?.();
    } catch {}
    try {
      if (typeof window.closeMobileMenu === "function") window.closeMobileMenu();
    } catch {}
  }

  function interceptMenuClick(event) {
    const link = event.target.closest?.('[data-spaceman-route="/fault-injection"], a[href="/fault-injection"]');
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    closeMenus();
    openPanel();
  }

  function init() {
    state.history = readHistory();
    document.addEventListener("click", interceptMenuClick, true);
    renderAlarmStack();
    startOverlayLoop();
    window.spacemanFaultInjection = {
      open: openPanel,
      close: closePanel,
      recover: recoverFault,
      getHistory: () => state.history.slice(),
      getActiveFaults: () => activeRecords().slice()
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
