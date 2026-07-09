(function () {
  const actionTypes = ["登录", "指令下发", "参数修改", "权限变更", "故障注入", "模型配置", "安全告警", "数据导出"];
  const operators = ["tenant_admin", "ops_lead", "orbit_engineer", "security_auditor", "model_admin", "guest_console"];
  const objects = [
    "LEO-A-021", "LEO-A-144", "LEO-B-077", "MEO-011", "MEO-018", "GEO-003",
    "地面站-US-WEST", "星间链路 MEO-011 ⇄ MEO-012", "轨道参数模板", "GPT-5.5 运维模型", "RBAC 策略"
  ];

  const state = {
    logs: [],
    filtered: [],
    page: 1,
    realtime: true,
    timer: null
  };

  const typeColors = {
    "登录": "#60a5fa",
    "指令下发": "#ef4444",
    "参数修改": "#f59e0b",
    "权限变更": "#a78bfa",
    "故障注入": "#fb7185",
    "模型配置": "#22c55e",
    "安全告警": "#f87171",
    "数据导出": "#38bdf8"
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function generateSeedLogs() {
    const now = new Date();
    const items = [
      createLog(-0.18, "security_auditor", "安全告警", "guest_console", "10.32.8.19", "失败", "高", "同一来源 IP 在 10 分钟内连续 6 次登录失败，已触发登录限速。"),
      createLog(-0.4, "ops_lead", "指令下发", "GEO-003", "10.12.0.21", "成功", "高", "向 GEO 算力层下发载荷隔离检查指令。", { payloadMode: "active" }, { payloadMode: "isolated-check" }),
      createLog(-0.8, "orbit_engineer", "参数修改", "MEO-011", "10.12.4.88", "成功", "中", "调整 MEO 骨干层轨道维持阈值。", { stationKeepingThreshold: "0.20deg" }, { stationKeepingThreshold: "0.16deg" }),
      createLog(-1.2, "model_admin", "模型配置", "GPT-5.5 运维模型", "10.16.2.31", "成功", "中", "更新智能助手系统技能提示词版本。", { skillVersion: "ops-2026.07.07" }, { skillVersion: "ops-2026.07.08" }),
      createLog(-1.8, "tenant_admin", "权限变更", "RBAC 策略", "10.0.2.8", "成功", "高", "为 security_auditor 授予审计导出权限。", { exportAudit: false }, { exportAudit: true }),
      createLog(-2.4, "ops_lead", "故障注入", "星间链路 MEO-011 ⇄ MEO-012", "10.12.0.21", "成功", "中", "演练链路高误码故障并记录恢复流程。"),
      createLog(-3.5, "guest_console", "登录", "运维控制台", "203.0.113.44", "失败", "高", "非白名单 IP 尝试访问运维控制台。"),
      createLog(-4.8, "orbit_engineer", "指令下发", "LEO-A-144", "10.12.4.88", "成功", "中", "下发姿态遥测采集指令。"),
      createLog(-6.5, "tenant_admin", "数据导出", "审计日志", "10.0.2.8", "成功", "低", "导出最近 7 天审计记录。"),
      createLog(-8.2, "ops_lead", "参数修改", "LEO Shell A", "10.12.0.21", "成功", "中", "修改 LEO A 层覆盖分析刷新周期。", { refreshSeconds: 30 }, { refreshSeconds: 20 }),
      createLog(-10.1, "security_auditor", "登录", "审计后台", "10.32.8.19", "成功", "低", "管理员通过多因素认证登录。"),
      createLog(-14.5, "model_admin", "模型配置", "中转 API 配置", "10.16.2.31", "失败", "中", "模型配置保存失败，密钥校验未通过。"),
      createLog(-18.8, "orbit_engineer", "参数修改", "MEO Backbone", "10.12.4.88", "成功", "中", "更新 MEO 骨干层链路路由权重。", { routeWeight: 70 }, { routeWeight: 82 }),
      createLog(-22.2, "guest_console", "登录", "运维控制台", "198.51.100.77", "失败", "高", "账号密码错误，触发可疑登录计数。")
    ];

    for (let i = 0; i < 38; i += 1) {
      const hoursAgo = 24 + Math.random() * 24 * 6;
      const type = randomItem(actionTypes);
      const result = Math.random() > 0.16 ? "成功" : "失败";
      const risk = type === "权限变更" || type === "指令下发" ? (Math.random() > 0.45 ? "高" : "中") : (result === "失败" ? "中" : "低");
      items.push(createLog(
        -hoursAgo,
        randomItem(operators),
        type,
        randomItem(objects),
        `10.${Math.floor(Math.random() * 24)}.${Math.floor(Math.random() * 240)}.${Math.floor(Math.random() * 240)}`,
        result,
        risk,
        `${type}事件已记录，可在详情中查看完整元数据。`
      ));
    }

    return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    function createLog(hoursOffset, operator, actionType, object, ip, result, risk, detail, before = null, after = null) {
      const time = new Date(now.getTime() + hoursOffset * 60 * 60 * 1000);
      return {
        id: `AUD-${time.getTime()}-${Math.random().toString(16).slice(2, 6)}`,
        timestamp: time.toISOString(),
        operator,
        actionType,
        object,
        ip,
        result,
        risk,
        detail,
        before,
        after,
        userAgent: "SPACEMAN-OPS/1.0 Chrome Local Console",
        requestId: `req_${Math.random().toString(16).slice(2, 10)}`,
        traceId: `trace_${Math.random().toString(16).slice(2, 14)}`,
        metadata: {
          tenant: "spaceman-local",
          role: operator === "guest_console" ? "anonymous" : "tenant_admin",
          source: "local-audit-stream",
          mfa: operator !== "guest_console",
          retainedDays: 180
        }
      };
    }
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function currentFilters() {
    return {
      range: getEl("auditRange").value,
      start: getEl("auditStartDate").value,
      end: getEl("auditEndDate").value,
      operator: getEl("auditOperator").value,
      actionType: getEl("auditActionType").value,
      result: getEl("auditResult").value,
      risk: getEl("auditRisk").value,
      search: getEl("auditSearch").value.trim(),
      pageSize: Number(getEl("auditPageSize").value || 20)
    };
  }

  function applyUrlFilters() {
    const params = new URLSearchParams(window.location.search);
    const ids = {
      range: "auditRange",
      start: "auditStartDate",
      end: "auditEndDate",
      operator: "auditOperator",
      type: "auditActionType",
      result: "auditResult",
      risk: "auditRisk",
      q: "auditSearch",
      size: "auditPageSize"
    };
    Object.entries(ids).forEach(([param, id]) => {
      const value = params.get(param);
      const el = getEl(id);
      if (value && el) el.value = value;
    });
  }

  function syncUrl(filters) {
    const params = new URLSearchParams();
    if (filters.range !== "today") params.set("range", filters.range);
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);
    if (filters.operator) params.set("operator", filters.operator);
    if (filters.actionType) params.set("type", filters.actionType);
    if (filters.result) params.set("result", filters.result);
    if (filters.risk) params.set("risk", filters.risk);
    if (filters.search) params.set("q", filters.search);
    if (filters.pageSize !== 20) params.set("size", String(filters.pageSize));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  function populateFilterOptions() {
    const operatorSelect = getEl("auditOperator");
    const typeSelect = getEl("auditActionType");
    const selectedOperator = operatorSelect.value;
    const selectedType = typeSelect.value;
    const uniqueOperators = Array.from(new Set(state.logs.map((log) => log.operator))).sort();
    operatorSelect.innerHTML = `<option value="">全部</option>${uniqueOperators.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
    typeSelect.innerHTML = `<option value="">全部</option>${actionTypes.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
    operatorSelect.value = selectedOperator;
    typeSelect.value = selectedType;
  }

  function getRangeBounds(filters) {
    const now = new Date();
    if (filters.range === "7d") {
      return [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now];
    }
    if (filters.range === "custom") {
      const start = filters.start ? new Date(`${filters.start}T00:00:00`) : new Date(0);
      const end = filters.end ? new Date(`${filters.end}T23:59:59`) : now;
      return [start, end];
    }
    return [new Date(now.getFullYear(), now.getMonth(), now.getDate()), now];
  }

  function filterLogs() {
    const filters = currentFilters();
    const [start, end] = getRangeBounds(filters);
    const query = filters.search.toLowerCase();
    state.filtered = state.logs.filter((log) => {
      const time = new Date(log.timestamp);
      if (time < start || time > end) return false;
      if (filters.operator && log.operator !== filters.operator) return false;
      if (filters.actionType && log.actionType !== filters.actionType) return false;
      if (filters.result && log.result !== filters.result) return false;
      if (filters.risk && log.risk !== filters.risk) return false;
      if (query) {
        const haystack = `${log.operator} ${log.actionType} ${log.object} ${log.ip} ${log.result} ${log.risk} ${log.detail}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    syncUrl(filters);
    return filters;
  }

  function renderMetrics() {
    const total = state.filtered.length;
    getEl("auditMetricTotal").textContent = total;
    getEl("auditMetricHighRisk").textContent = state.filtered.filter((log) => log.risk === "高").length;
    getEl("auditMetricLoginFail").textContent = state.filtered.filter((log) => log.actionType === "登录" && log.result === "失败").length;
    getEl("auditMetricConfig").textContent = state.filtered.filter((log) => log.actionType === "参数修改" || log.actionType === "模型配置").length;
  }

  function renderTrend(filters) {
    const chart = getEl("auditTrendChart");
    const buckets = [];
    const now = new Date();
    if (filters.range === "today") {
      for (let hour = 0; hour < 24; hour += 3) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour + 3);
        buckets.push({ label: `${pad(hour)}:00`, start, end, count: 0, high: 0 });
      }
    } else {
      for (let i = 6; i >= 0; i -= 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
        buckets.push({ label: `${pad(day.getMonth() + 1)}/${pad(day.getDate())}`, start: day, end, count: 0, high: 0 });
      }
    }

    state.filtered.forEach((log) => {
      const time = new Date(log.timestamp);
      const bucket = buckets.find((item) => time >= item.start && time < item.end);
      if (bucket) {
        bucket.count += 1;
        if (log.risk === "高") bucket.high += 1;
      }
    });

    const max = Math.max(1, ...buckets.map((item) => item.count));
    chart.innerHTML = buckets.map((item) => {
      const height = Math.max(8, Math.round((item.count / max) * 145));
      return `<div class="audit-bar ${item.high ? "high" : ""}" style="height:${height}px" title="${escapeHtml(item.label)}：${item.count} 条"><span>${escapeHtml(item.label)}</span></div>`;
    }).join("");
  }

  function renderDistribution() {
    const counts = new Map();
    state.filtered.forEach((log) => counts.set(log.actionType, (counts.get(log.actionType) || 0) + 1));
    const entries = Array.from(counts.entries()).filter(([, count]) => count > 0);
    const total = Math.max(1, entries.reduce((sum, [, count]) => sum + count, 0));
    let cursor = 0;
    const segments = entries.map(([type, count]) => {
      const start = cursor;
      cursor += (count / total) * 100;
      return `${typeColors[type] || "#9ca3af"} ${start}% ${cursor}%`;
    });
    getEl("auditDonut").style.background = segments.length ? `conic-gradient(${segments.join(",")})` : "#1f2937";
    getEl("auditDistributionLegend").innerHTML = entries.map(([type, count]) => {
      const percent = Math.round((count / total) * 100);
      return `
        <div class="audit-legend-item">
          <span><i style="background:${typeColors[type] || "#9ca3af"}"></i>${escapeHtml(type)}</span>
          <strong>${count} / ${percent}%</strong>
        </div>
      `;
    }).join("") || `<div class="audit-legend-item"><span>暂无数据</span><strong>0</strong></div>`;
  }

  function renderAlerts() {
    const high = state.filtered.filter((log) => log.risk === "高").slice(0, 3);
    const strip = getEl("auditAlertStrip");
    if (!high.length) {
      strip.classList.remove("visible");
      strip.innerHTML = "";
      return;
    }
    strip.classList.add("visible");
    strip.innerHTML = `高风险事件：${high.map((log) => `${escapeHtml(log.actionType)} / ${escapeHtml(log.object)} / ${escapeHtml(log.ip)}`).join("　|　")}`;
  }

  function riskClass(risk) {
    if (risk === "高") return "high";
    if (risk === "中") return "mid";
    return "";
  }

  function renderTable(filters) {
    const pageSize = filters.pageSize;
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * pageSize;
    const pageRows = state.filtered.slice(start, start + pageSize);

    getEl("auditTableBody").innerHTML = pageRows.map((log) => `
      <tr class="${log.risk === "高" ? "high-risk" : ""}">
        <td>${formatDateTime(log.timestamp)}</td>
        <td>${escapeHtml(log.operator)}</td>
        <td>${escapeHtml(log.actionType)}</td>
        <td class="audit-object-cell" title="${escapeHtml(log.object)}">${escapeHtml(log.object)}</td>
        <td>${escapeHtml(log.ip)}</td>
        <td><span class="audit-badge ${log.result === "成功" ? "success" : "fail"}">${escapeHtml(log.result)}</span></td>
        <td><span class="audit-badge ${riskClass(log.risk)}">${escapeHtml(log.risk)}</span></td>
        <td><button type="button" class="audit-detail-link" data-audit-detail="${escapeHtml(log.id)}">查看详情</button></td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="8" style="text-align:center;color:#9ca3af;padding:26px;">没有匹配的审计日志</td>
      </tr>
    `;

    getEl("auditPageInfo").textContent = `${state.filtered.length} 条记录 / 第 ${state.page} 页，共 ${totalPages} 页`;
    getEl("auditPrevPage").disabled = state.page <= 1;
    getEl("auditNextPage").disabled = state.page >= totalPages;
    document.querySelectorAll("[data-audit-detail]").forEach((button) => {
      button.addEventListener("click", () => showDetail(button.getAttribute("data-audit-detail")));
    });
  }

  function renderAll(keepPage) {
    getEl("auditFilters").classList.toggle("custom-range", getEl("auditRange").value === "custom");
    if (!keepPage) state.page = 1;
    const filters = filterLogs();
    renderMetrics();
    renderTrend(filters);
    renderDistribution();
    renderAlerts();
    renderTable(filters);
  }

  function showDetail(id) {
    const log = state.logs.find((item) => item.id === id);
    if (!log) return;
    getEl("auditDetailTitle").textContent = `${log.actionType} / ${log.object}`;
    const raw = {
      id: log.id,
      timestamp: log.timestamp,
      operator: log.operator,
      action_type: log.actionType,
      object: log.object,
      source_ip: log.ip,
      result: log.result,
      risk: log.risk,
      request_id: log.requestId,
      trace_id: log.traceId,
      user_agent: log.userAgent,
      metadata: log.metadata,
      before: log.before,
      after: log.after
    };
    getEl("auditDetailBody").innerHTML = `
      <div class="audit-detail-grid">
        ${detailItem("时间戳", formatDateTime(log.timestamp))}
        ${detailItem("操作者", log.operator)}
        ${detailItem("操作类型", log.actionType)}
        ${detailItem("操作对象", log.object)}
        ${detailItem("来源 IP", log.ip)}
        ${detailItem("操作结果", log.result)}
        ${detailItem("风险等级", log.risk)}
        ${detailItem("请求 ID", log.requestId)}
      </div>
      <div class="audit-detail-item">
        <span>事件说明</span>
        <strong>${escapeHtml(log.detail)}</strong>
      </div>
      ${log.before || log.after ? `
        <div class="audit-diff">
          <div class="audit-diff-box">
            <h4>变更前</h4>
            <pre class="audit-json-box">${escapeHtml(JSON.stringify(log.before || {}, null, 2))}</pre>
          </div>
          <div class="audit-diff-box">
            <h4>变更后</h4>
            <pre class="audit-json-box">${escapeHtml(JSON.stringify(log.after || {}, null, 2))}</pre>
          </div>
        </div>
      ` : ""}
      <pre class="audit-json-box">${escapeHtml(JSON.stringify(raw, null, 2))}</pre>
    `;
    const modal = getEl("auditDetailModal");
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function detailItem(label, value) {
    return `<div class="audit-detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function closeDetail() {
    const modal = getEl("auditDetailModal");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function exportCsv() {
    const headers = ["时间戳", "操作者", "操作类型", "操作对象", "来源IP", "结果", "风险", "详情"];
    const rows = state.filtered.map((log) => [
      formatDateTime(log.timestamp),
      log.operator,
      log.actionType,
      log.object,
      log.ip,
      log.result,
      log.risk,
      log.detail
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spaceman-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addAuditSelfLog("数据导出", "审计日志 CSV", "导出当前筛选结果。");
  }

  function addAuditSelfLog(actionType, object, detail) {
    state.logs.unshift({
      id: `AUD-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      operator: "security_auditor",
      actionType,
      object,
      ip: "127.0.0.1",
      result: "成功",
      risk: "低",
      detail,
      before: null,
      after: null,
      userAgent: navigator.userAgent,
      requestId: `req_${Math.random().toString(16).slice(2, 10)}`,
      traceId: `trace_${Math.random().toString(16).slice(2, 14)}`,
      metadata: {
        tenant: "spaceman-local",
        role: "audit_reader",
        source: "audit-page-self-trace",
        mfa: true,
        retainedDays: 180
      }
    });
    populateFilterOptions();
    renderAll(true);
  }

  function addRealtimeLog() {
    if (!state.realtime) return;
    const high = Math.random() > 0.55;
    const log = {
      id: `AUD-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      operator: high ? "guest_console" : randomItem(operators),
      actionType: high ? randomItem(["登录", "安全告警", "指令下发"]) : randomItem(actionTypes),
      object: high ? randomItem(["运维控制台", "GEO-003", "RBAC 策略"]) : randomItem(objects),
      ip: high ? `203.0.113.${Math.floor(Math.random() * 99)}` : `10.12.${Math.floor(Math.random() * 99)}.${Math.floor(Math.random() * 220)}`,
      result: high && Math.random() > 0.35 ? "失败" : "成功",
      risk: high ? "高" : randomItem(["低", "中"]),
      detail: high ? "实时监控捕获高风险行为，已进入审计事件流。" : "实时监控接入普通运维事件。",
      before: null,
      after: null,
      userAgent: "SPACEMAN-OPS/1.0 Realtime Stream",
      requestId: `req_${Math.random().toString(16).slice(2, 10)}`,
      traceId: `trace_${Math.random().toString(16).slice(2, 14)}`,
      metadata: {
        tenant: "spaceman-local",
        role: "tenant_admin",
        source: "local-realtime-stream",
        mfa: !high,
        retainedDays: 180
      }
    };
    state.logs.unshift(log);
    renderAll(true);
  }

  function wireEvents() {
    getEl("auditFilters").addEventListener("input", () => renderAll(false));
    getEl("auditFilters").addEventListener("change", () => renderAll(false));
    getEl("auditPageSize").addEventListener("change", () => renderAll(false));
    getEl("auditPrevPage").addEventListener("click", () => {
      state.page -= 1;
      renderAll(true);
    });
    getEl("auditNextPage").addEventListener("click", () => {
      state.page += 1;
      renderAll(true);
    });
    getEl("auditExportCsv").addEventListener("click", exportCsv);
    getEl("auditRealtimeToggle").addEventListener("click", () => {
      state.realtime = !state.realtime;
      getEl("auditRealtimeToggle").textContent = state.realtime ? "暂停实时" : "开启实时";
      getEl("auditRealtimeBadge").textContent = state.realtime ? "实时监控：开" : "实时监控：暂停";
    });
    document.querySelectorAll("[data-audit-close]").forEach((el) => el.addEventListener("click", closeDetail));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDetail();
    });
  }

  function init() {
    state.logs = generateSeedLogs();
    populateFilterOptions();
    applyUrlFilters();
    wireEvents();
    renderAll(false);
    state.timer = window.setInterval(addRealtimeLog, 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
