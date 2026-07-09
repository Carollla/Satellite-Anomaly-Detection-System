(function () {
  const API = "/local-api/model-config/default";
  const state = {
    config: null,
    mappings: [],
    dirty: false,
    secretDirty: false,
    originalBaseUrl: ""
  };

  function el(id) {
    return document.getElementById(id);
  }

  function fmtNumber(value) {
    return Number(value || 0).toLocaleString("zh-CN");
  }

  function toast(message, type = "success") {
    const box = el("modelToast");
    if (!box) return;
    box.textContent = message;
    box.className = `model-toast ${type}`;
    window.clearTimeout(box._timer);
    box._timer = window.setTimeout(() => box.classList.add("hidden"), 3200);
  }

  function setDirty(next = true) {
    state.dirty = next;
    const saveState = el("modelSaveState");
    if (saveState) saveState.textContent = next ? "有未保存更改" : "已保存";
  }

  function setLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = text || "处理中...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function setConnection(connected, text, meta) {
    const target = el("modelConnectionText");
    const detail = el("modelConnectionMeta");
    if (target) {
      target.innerHTML = `<i class="model-status-dot ${connected ? "connected" : "failed"}"></i>${text}`;
    }
    if (detail) detail.textContent = meta || "";
  }

  function applyReadOnly(readOnly) {
    document.body.classList.toggle("model-readonly", Boolean(readOnly));
    const toggle = el("modelReadOnlyToggle");
    if (toggle) toggle.checked = Boolean(readOnly);
  }

  function setRangePair(rangeId, numberId, value) {
    const range = el(rangeId);
    const number = el(numberId);
    if (range) range.value = value;
    if (number) number.value = value;
  }

  function readRangePair(rangeId, numberId) {
    return Number(el(numberId)?.value || el(rangeId)?.value || 0);
  }

  function populate(config) {
    state.config = config;
    state.mappings = Array.isArray(config.mappings) ? config.mappings.slice() : [];
    state.originalBaseUrl = config.baseUrl || "";

    el("modelConfigName").value = config.name || "";
    el("modelProjectTag").value = config.projectTag || "";
    el("modelProvider").value = config.provider || "NewAPI";
    el("modelDefaultModel").value = config.defaultModel || "";
    el("modelBaseUrl").value = config.baseUrl || "";
    el("modelAuthMode").value = config.authMode || "Bearer Token";
    el("modelApiKey").value = config.apiKeyMasked || "";
    el("modelRemainingTokens").textContent = fmtNumber(config.usage?.remainingTokens);
    el("modelBalanceMeta").textContent = config.usage?.balanceText || "本地估算";
    el("modelTodayRequests").textContent = fmtNumber(config.usage?.todayRequests);
    el("modelTodayTokens").textContent = `${fmtNumber(config.usage?.todayTokens)} Tokens`;
    el("modelDefaultBadge").textContent = config.defaultModel || "-";
    setConnection(Boolean(config.usage?.connected), config.usage?.connected ? "已连接" : "未配置", config.baseUrl || "-");
    setRangePair("modelTimeout", "modelTimeoutNumber", config.timeoutMs || 30000);
    setRangePair("modelRetry", "modelRetryNumber", config.retryCount || 2);
    setRangePair("modelRateLimit", "modelRateLimitNumber", config.rateLimitQps || 12);
    applyReadOnly(config.readOnly);
    renderMappings();
    setDirty(false);
    state.secretDirty = false;
  }

  function renderMappings() {
    const body = el("modelMappingBody");
    if (!body) return;
    body.innerHTML = state.mappings.map((item, index) => `
      <tr>
        <td><input data-map-index="${index}" data-map-field="requestModel" value="${escapeAttr(item.requestModel || "")}" placeholder="spaceman-ops"></td>
        <td><input data-map-index="${index}" data-map-field="proxyModel" value="${escapeAttr(item.proxyModel || "")}" placeholder="gpt-5.5"></td>
        <td><input data-map-index="${index}" data-map-field="weight" type="number" min="0" max="100" value="${Number(item.weight || 0)}"></td>
        <td><button type="button" class="model-remove-row" data-remove-map="${index}">删除</button></td>
      </tr>
    `).join("");
  }

  function escapeAttr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function collectPayload() {
    return {
      name: el("modelConfigName").value.trim(),
      projectTag: el("modelProjectTag").value.trim(),
      provider: el("modelProvider").value,
      defaultModel: el("modelDefaultModel").value.trim(),
      baseUrl: el("modelBaseUrl").value.trim(),
      authMode: el("modelAuthMode").value,
      apiKey: state.secretDirty ? el("modelApiKey").value.trim() : "__KEEP__",
      timeoutMs: readRangePair("modelTimeout", "modelTimeoutNumber"),
      retryCount: readRangePair("modelRetry", "modelRetryNumber"),
      rateLimitQps: readRangePair("modelRateLimit", "modelRateLimitNumber"),
      readOnly: el("modelReadOnlyToggle").checked,
      mappings: state.mappings
    };
  }

  async function loadConfig() {
    const button = el("modelRefreshBtn");
    setLoading(button, true, "刷新中...");
    try {
      const response = await fetch(API, { cache: "no-store" });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "加载失败");
      populate(result.data);
      toast("模型配置已刷新");
    } catch (error) {
      setConnection(false, "加载失败", String(error.message || error));
      toast(`加载失败：${error.message || error}`, "error");
    } finally {
      setLoading(button, false);
    }
  }

  async function testConnection(button) {
    const payload = collectPayload();
    setLoading(button, true, "测试中...");
    try {
      const response = await fetch(`${API}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "连接失败");
      setConnection(true, "已连接", `${payload.baseUrl} · ${result.latencyMs} ms`);
      toast(`测试成功：${result.latencyMs} ms`);
    } catch (error) {
      setConnection(false, "连接异常", String(error.message || error));
      toast(`测试失败：${error.message || error}`, "error");
    } finally {
      setLoading(button, false);
    }
  }

  async function loadModels() {
    const button = el("modelLoadModelsBtn");
    setLoading(button, true, "拉取中...");
    try {
      const response = await fetch(`${API}/models-list`, { cache: "no-store" });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "拉取失败");
      const existing = new Set(state.mappings.map((item) => item.proxyModel));
      result.models.forEach((model) => {
        if (!existing.has(model)) {
          state.mappings.push({ requestModel: model, proxyModel: model, weight: 50 });
          existing.add(model);
        }
      });
      renderMappings();
      setDirty(true);
      toast(`已拉取 ${result.models.length} 个模型`);
    } catch (error) {
      toast(`拉取失败：${error.message || error}`, "error");
    } finally {
      setLoading(button, false);
    }
  }

  function openConfirm() {
    const modal = el("modelConfirmModal");
    modal?.classList.remove("hidden");
    modal?.setAttribute("aria-hidden", "false");
  }

  function closeConfirm() {
    const modal = el("modelConfirmModal");
    modal?.classList.add("hidden");
    modal?.setAttribute("aria-hidden", "true");
  }

  function saveNeedsConfirm() {
    const payload = collectPayload();
    return state.secretDirty || payload.baseUrl !== state.originalBaseUrl;
  }

  async function saveConfig() {
    const button = el("modelSaveBtn");
    setLoading(button, true, "保存中...");
    try {
      const response = await fetch(API, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(collectPayload())
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "保存失败");
      populate(result.data);
      closeConfirm();
      toast("配置已保存并生效");
    } catch (error) {
      toast(`保存失败：${error.message || error}`, "error");
    } finally {
      setLoading(button, false);
    }
  }

  function bindInputDirty() {
    document.querySelectorAll(".model-config-shell input, .model-config-shell select").forEach((input) => {
      input.addEventListener("input", () => setDirty(true));
      input.addEventListener("change", () => setDirty(true));
    });
    el("modelApiKey")?.addEventListener("input", () => {
      state.secretDirty = true;
      setDirty(true);
    });
  }

  function bindRangePairs() {
    [
      ["modelTimeout", "modelTimeoutNumber"],
      ["modelRetry", "modelRetryNumber"],
      ["modelRateLimit", "modelRateLimitNumber"]
    ].forEach(([rangeId, numberId]) => {
      const range = el(rangeId);
      const number = el(numberId);
      range?.addEventListener("input", () => {
        number.value = range.value;
        setDirty(true);
      });
      number?.addEventListener("input", () => {
        range.value = number.value;
        setDirty(true);
      });
    });
  }

  function bindMappingTable() {
    el("modelMappingBody")?.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-map-index]");
      if (!input) return;
      const index = Number(input.dataset.mapIndex);
      const field = input.dataset.mapField;
      if (!state.mappings[index]) return;
      state.mappings[index][field] = field === "weight" ? Number(input.value || 0) : input.value;
      setDirty(true);
    });
    el("modelMappingBody")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-map]");
      if (!button) return;
      state.mappings.splice(Number(button.dataset.removeMap), 1);
      renderMappings();
      setDirty(true);
    });
  }

  function bindActions() {
    el("modelRefreshBtn")?.addEventListener("click", loadConfig);
    el("modelTestBtn")?.addEventListener("click", (event) => testConnection(event.currentTarget));
    el("modelTestTopBtn")?.addEventListener("click", (event) => testConnection(event.currentTarget));
    el("modelLoadModelsBtn")?.addEventListener("click", loadModels);
    el("modelAddMappingBtn")?.addEventListener("click", () => {
      state.mappings.push({ requestModel: "", proxyModel: "", weight: 50 });
      renderMappings();
      setDirty(true);
    });
    el("modelSaveBtn")?.addEventListener("click", () => {
      if (el("modelReadOnlyToggle")?.checked) {
        toast("当前是只读模式，不能保存配置", "error");
        return;
      }
      if (saveNeedsConfirm()) openConfirm();
      else saveConfig();
    });
    el("modelCancelSave")?.addEventListener("click", closeConfirm);
    el("modelConfirmSave")?.addEventListener("click", saveConfig);
    document.querySelector(".model-modal-backdrop")?.addEventListener("click", closeConfirm);
    el("modelToggleSecret")?.addEventListener("click", () => {
      const input = el("modelApiKey");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      el("modelToggleSecret").textContent = show ? "隐藏" : "显示";
    });
    el("modelReadOnlyToggle")?.addEventListener("change", (event) => {
      applyReadOnly(event.target.checked);
      setDirty(true);
    });
    el("modelLogsBtn")?.addEventListener("click", () => {
      window.location.href = "/security-audit";
    });
  }

  function init() {
    bindInputDirty();
    bindRangePairs();
    bindMappingTable();
    bindActions();
    loadConfig();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
