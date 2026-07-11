(function () {
  const API = "/local-api/constellation-editor";
  const state = {
    data: null,
    selectedId: null,
    search: "",
    playing: true,
    phase: 0,
    pendingDeleteIds: [],
    undoStack: [],
    animation: {
      enteringIds: new Set(),
      removingIds: new Set()
    }
  };

  const shellColors = {
    "leo-a": "#38bdf8",
    "leo-b": "#a78bfa",
    meo: "#22c55e",
    geo: "#f59e0b",
    custom: "#f472b6"
  };

  function el(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(message, type = "success") {
    const box = el("editorToast");
    if (!box) return;
    box.textContent = message;
    box.className = `editor-toast ${type}`;
    window.clearTimeout(box._timer);
    box._timer = window.setTimeout(() => box.classList.add("hidden"), 3200);
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {})
      }
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "请求失败");
    return result;
  }

  async function loadState() {
    try {
      const result = await request("/state", { method: "GET" });
      state.data = result.data;
      if (!state.selectedId && result.data.satellites.length) state.selectedId = result.data.satellites[0].id;
      renderAll();
      toast("星座数据库已加载");
    } catch (error) {
      toast(`加载失败：${error.message || error}`, "error");
    }
  }

  function currentSat() {
    return state.data?.satellites.find((sat) => sat.id === state.selectedId) || null;
  }

  function renderAll(animation = {}) {
    if (!state.data) return;
    renderMetrics();
    renderShells();
    renderSatelliteList();
    renderOptions();
    renderInspector();
    renderHistory();
    renderSnapshots();
    renderUndo();
    renderViewport(animation);
  }

  function pushUndo(entry) {
    state.undoStack.unshift({ ...entry, time: Date.now() });
    state.undoStack = state.undoStack.slice(0, 30);
    renderUndo();
  }

  function renderUndo() {
    const button = el("editorUndo");
    if (!button) return;
    const latest = state.undoStack[0];
    button.disabled = !latest;
    button.textContent = latest ? `撤销：${latest.label}` : "撤销";
  }

  function renderMetrics() {
    el("editorTotalSatellites").textContent = state.data.stats.totalSatellites.toLocaleString("zh-CN");
    el("editorPreviewCount").textContent = `${state.data.stats.visibleSatellites.toLocaleString("zh-CN")} 颗卫星`;
    el("editorSceneName").value = state.data.constellation?.name || "SPACEMAN 星座";
    el("editorSavedAt").textContent = `更新时间 ${new Date(state.data.constellation?.updatedAt || Date.now()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function renderShells() {
    const host = el("editorShellList");
    host.innerHTML = state.data.shells.map((shell) => `
      <div class="shell-row">
        <div>
          <strong>${esc(shell.name)}</strong>
          <span>${esc(shell.walker || shell.orbitClass)} · ${shell.altitudeKm} km · ${shell.inclinationDeg}°</span>
        </div>
        <input type="number" min="0" max="5000" value="${shell.observedCount}" data-shell-count="${esc(shell.key)}">
        <button type="button" data-apply-shell="${esc(shell.key)}">应用</button>
      </div>
    `).join("");
  }

  function renderSatelliteList() {
    const host = el("editorSatelliteList");
    const query = state.search.toLowerCase();
    const filtered = state.data.satellites
      .filter((sat) => !query || sat.name.toLowerCase().includes(query) || String(sat.noradId).includes(query))
      .slice(0, 220);
    host.innerHTML = filtered.map((sat) => `
      <div class="sat-row ${sat.id === state.selectedId ? "active" : ""} ${sat.visible === false ? "hidden-sat" : ""}" data-select-sat="${esc(sat.id)}">
        <span class="sat-eye" data-toggle-visible="${esc(sat.id)}"></span>
        <div>
          <strong>${esc(sat.name)}</strong>
          <span>${esc(sat.shellKey)} · ${sat.altitudeKm} km · ${sat.inclinationDeg}°</span>
        </div>
        <div class="sat-actions">
          <button type="button" data-clone-sat="${esc(sat.id)}">复制</button>
          <button type="button" data-remove-sat="${esc(sat.id)}">移除</button>
        </div>
      </div>
    `).join("");
  }

  function renderOptions() {
    const shellOptions = state.data.shells.map((shell) => `<option value="${esc(shell.key)}">${esc(shell.name)}</option>`).join("");
    const apiOptions = state.data.apiConfigs.map((api) => `<option value="${esc(api.id)}">${esc(api.name)} · ${esc(api.model || "")}</option>`).join("");
    ["inspectorShell", "quickShell"].forEach((id) => { if (el(id)) el(id).innerHTML = shellOptions; });
    if (el("inspectorPayloadApi")) el("inspectorPayloadApi").innerHTML = apiOptions;
  }

  function renderInspector() {
    const sat = currentSat();
    const disabled = !sat;
    el("editorInspectorHint").textContent = sat ? `${sat.name} / ${sat.noradId}` : "请选择一颗卫星";
    ["inspectorName", "inspectorShell", "inspectorAltitude", "inspectorInclination", "inspectorInclinationNumber", "inspectorEccentricity", "inspectorRaan", "inspectorPayloadApi", "inspectorVisible", "inspectorLaser", "inspectorClone", "inspectorRemove", "inspectorApply"].forEach((id) => {
      if (el(id)) el(id).disabled = disabled;
    });
    if (!sat) return;
    el("inspectorName").value = sat.name;
    el("inspectorShell").value = sat.shellKey;
    el("inspectorAltitude").value = sat.altitudeKm;
    el("inspectorInclination").value = sat.inclinationDeg;
    el("inspectorInclinationNumber").value = sat.inclinationDeg;
    el("inspectorEccentricity").value = sat.eccentricity;
    el("inspectorRaan").value = sat.raanDeg;
    el("inspectorPayloadApi").value = sat.payloadConfigId || "default-model-api";
    el("inspectorVisible").checked = sat.visible !== false;
    el("inspectorLaser").checked = sat.laserTerminal === true;
  }

  function renderHistory() {
    const host = el("editorHistory");
    host.innerHTML = state.data.changeLogs.slice(0, 20).map((log) => `
      <div class="history-row">
        <strong>${esc(log.action)}</strong>
        <span>${new Date(log.time).toLocaleString("zh-CN")} · ${esc(log.targetType)}</span>
      </div>
    `).join("");
  }

  function renderSnapshots() {
    const host = el("editorSnapshots");
    if (!host) return;
    const snapshots = state.data.snapshots || [];
    const count = el("editorSnapshotCount");
    if (count) count.textContent = `${snapshots.length} 个快照`;
    const snapshotMarkup = snapshots.map((snapshot) => `
      <div class="snapshot-row ${snapshot.type === "default" ? "default" : ""}">
        <div>
          <strong>${esc(snapshot.name)}</strong>
          <span>${snapshot.totalSatellites} 颗 · ${snapshot.type === "default" ? "默认场景" : "用户场景"} · ${new Date(snapshot.createdAt).toLocaleString("zh-CN")}</span>
        </div>
        <div class="snapshot-actions">
          <button type="button" data-restore-snapshot="${esc(snapshot.id)}">恢复</button>
          ${snapshot.type === "default" ? "" : `<button type="button" class="danger" data-delete-snapshot="${esc(snapshot.id)}">删除</button>`}
        </div>
      </div>
    `).join("");
    host.innerHTML = snapshotMarkup;
    const managerList = el("editorSnapshotManagerList");
    if (managerList) managerList.innerHTML = snapshotMarkup || '<p class="editor-empty-state">暂时没有可管理的快照。</p>';
  }

  function renderViewport(animation = {}) {
    const viewport = el("editorViewport");
    if (!viewport || !state.data) return;
    let layer = viewport.querySelector(".editor-live-overlay");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "editor-live-overlay";
      viewport.appendChild(layer);
    }

    const enteringIds = new Set(animation.enteringIds || []);
    const removingIds = new Set(animation.removingIds || []);
    enteringIds.forEach((id) => state.animation.enteringIds.add(id));
    removingIds.forEach((id) => state.animation.removingIds.add(id));

    const visible = state.data.satellites.filter((sat) => sat.visible !== false);
    layer.innerHTML = visible.map((sat, index) => {
      const shell = state.data.shells.find((item) => item.key === sat.shellKey);
      const altitude = Number(sat.altitudeKm || shell?.altitudeKm || 550);
      const radius = Math.max(24, Math.min(46, 18 + Math.log10(altitude + 1000) * 8));
      const angle = ((Number(sat.meanAnomalyDeg || 0) + state.phase + index * 0.37) % 360) * Math.PI / 180;
      const tilt = 0.34 + Math.min(0.34, Number(sat.inclinationDeg || 0) / 260);
      const raan = Number(sat.raanDeg || 0) * Math.PI / 180;
      const x = 50 + Math.cos(angle + raan) * radius;
      const y = 50 + Math.sin(angle) * radius * tilt;
      const color = shellColors[sat.shellKey] || shellColors.custom;
      const classes = [
        "editor-live-sat",
        sat.id === state.selectedId ? "selected" : "",
        state.animation.enteringIds.has(sat.id) ? "entering" : "",
        state.animation.removingIds.has(sat.id) ? "removing" : ""
      ].filter(Boolean).join(" ");
      return `<button class="${classes}" type="button" data-preview-select="${esc(sat.id)}" title="${esc(sat.name)}" style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%;--sat-color:${color}"></button>`;
    }).join("");

    if (enteringIds.size || removingIds.size) {
      const overlay = document.querySelector(".editor-preview-overlay");
      overlay?.animate([
        { transform: "translateY(0)", boxShadow: "0 0 0 rgba(248,113,113,0)" },
        { transform: "translateY(-4px)", boxShadow: "0 0 28px rgba(248,113,113,.55)" },
        { transform: "translateY(0)", boxShadow: "0 0 0 rgba(248,113,113,0)" }
      ], { duration: 760, easing: "ease-out" });
      window.setTimeout(() => {
        enteringIds.forEach((id) => state.animation.enteringIds.delete(id));
        removingIds.forEach((id) => state.animation.removingIds.delete(id));
        if (state.data) renderViewport();
      }, 950);
    }
  }

  function averageAltitude(shellKey) {
    const sats = state.data.satellites.filter((sat) => sat.shellKey === shellKey);
    return sats.reduce((sum, sat) => sum + Number(sat.altitudeKm || 0), 0) / Math.max(1, sats.length);
  }

  function orbitDiameter(altitudeKm, viewportSize) {
    const normalized = Math.log10(Math.max(200, altitudeKm) + 1000) / Math.log10(41000);
    return Math.max(180, Math.min(viewportSize * 0.9, viewportSize * (0.32 + normalized * 0.58)));
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace("#", "");
    const num = parseInt(clean, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  function selectSatellite(id) {
    state.selectedId = id;
    renderSatelliteList();
    renderInspector();
    renderViewport();
  }

  async function addSatellite(payload) {
    try {
      const result = await request("/satellites", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      state.data = result.data;
      state.selectedId = result.satellite.id;
      renderAll([result.satellite.id]);
      toast(`已添加 ${result.satellite.name}`);
    } catch (error) {
      toast(`添加失败：${error.message || error}`, "error");
    }
  }

  async function cloneSatellite(id) {
    const sat = state.data.satellites.find((item) => item.id === id);
    if (!sat) return;
    await addSatellite({
      name: `${sat.name}-COPY`,
      shellKey: sat.shellKey,
      altitudeKm: sat.altitudeKm,
      inclinationDeg: sat.inclinationDeg,
      eccentricity: sat.eccentricity,
      raanDeg: Number(sat.raanDeg || 0) + 8,
      meanAnomalyDeg: Number(sat.meanAnomalyDeg || 0) + 12,
      payloadConfigId: sat.payloadConfigId
    });
  }

  async function removeSatellites(ids) {
    if (!ids.length) return;
    document.querySelector(".editor-preview-overlay")?.animate([
      { opacity: 1, filter: "none" },
      { opacity: 0.45, filter: "hue-rotate(130deg)" },
      { opacity: 1, filter: "none" }
    ], { duration: 450, easing: "ease-in-out" });
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    try {
      const result = await request("/delete-satellites", {
        method: "POST",
        body: JSON.stringify({ ids })
      });
      state.data = result.data;
      state.selectedId = state.data.satellites[0]?.id || null;
      renderAll();
      toast(`已移除 ${result.removed.length} 颗卫星`);
    } catch (error) {
      toast(`移除失败：${error.message || error}`, "error");
    }
  }

  function openDelete(ids) {
    if (ids.length <= 3) {
      removeSatellites(ids);
      return;
    }
    state.pendingDeleteIds = ids;
    const sats = ids.map((id) => state.data.satellites.find((sat) => sat.id === id)).filter(Boolean);
    el("deletePreviewList").innerHTML = sats.map((sat) => `<div>${esc(sat.name)} · ${esc(sat.shellKey)}</div>`).join("");
    el("deleteConfirmInput").value = "";
    el("editorDeleteModal").classList.remove("hidden");
  }

  async function applyInspector(event) {
    event.preventDefault();
    const sat = currentSat();
    if (!sat) return;
    try {
      const result = await request(`/satellites/${encodeURIComponent(sat.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          name: el("inspectorName").value.trim(),
          shellKey: el("inspectorShell").value,
          altitudeKm: Number(el("inspectorAltitude").value),
          inclinationDeg: Number(el("inspectorInclinationNumber").value),
          eccentricity: Number(el("inspectorEccentricity").value),
          raanDeg: Number(el("inspectorRaan").value),
          payloadConfigId: el("inspectorPayloadApi").value,
          visible: el("inspectorVisible").checked,
          laserTerminal: el("inspectorLaser").checked
        })
      });
      state.data = result.data;
      renderAll();
      toast("卫星参数已应用");
    } catch (error) {
      toast(`保存失败：${error.message || error}`, "error");
    }
  }

  async function applyShellCount(shellKey) {
    const input = document.querySelector(`[data-shell-count="${CSS.escape(shellKey)}"]`);
    const count = Number(input?.value || 0);
    try {
      const beforeIds = new Set(state.data.satellites.map((sat) => sat.id));
      const result = await request(`/shells/${encodeURIComponent(shellKey)}/count`, {
        method: "POST",
        body: JSON.stringify({ count })
      });
      state.data = result.data;
      const addedIds = state.data.satellites.filter((sat) => !beforeIds.has(sat.id)).map((sat) => sat.id);
      renderAll(addedIds);
      toast(`${shellKey} 已调整为 ${count} 颗`);
    } catch (error) {
      toast(`调整失败：${error.message || error}`, "error");
    }
  }

  async function restoreDefault() {
    try {
      const result = await request("/restore-default", { method: "POST", body: "{}" });
      state.data = result.data;
      state.selectedId = state.data.satellites[0]?.id || null;
      renderAll();
      refreshMainPreview();
      toast("已恢复默认 450 颗星座");
    } catch (error) {
      toast(`恢复失败：${error.message || error}`, "error");
    }
  }

  async function saveScene() {
    try {
      const result = await request("/save", {
        method: "POST",
        body: JSON.stringify({ name: el("editorSnapshotName").value.trim() })
      });
      state.data = result.data;
      renderAll();
      refreshMainPreview();
      toast(`已保存“${result.snapshot?.name || "当前快照"}”并同步主视图`);
    } catch (error) {
      toast(`保存失败：${error.message || error}`, "error");
    }
  }

  function openSnapshotSave() {
    const now = new Date();
    const time = now.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const sceneName = el("editorSceneName").value.trim() || "SPACEMAN 星座";
    el("editorSnapshotName").value = `${sceneName} ${time}`;
    el("editorSnapshotModal").classList.remove("hidden");
    window.setTimeout(() => el("editorSnapshotName").focus(), 0);
  }

  function openSnapshotManager() {
    renderSnapshots();
    el("editorSnapshotManagerModal").classList.remove("hidden");
  }

  async function restoreSnapshot(snapshotId) {
    try {
      const result = await request(`/snapshots/${encodeURIComponent(snapshotId)}/restore`, { method: "POST", body: "{}" });
      state.data = result.data;
      state.selectedId = state.data.satellites[0]?.id || null;
      renderAll();
      refreshMainPreview();
      toast("快照已恢复并同步主视图");
    } catch (error) {
      toast(`恢复快照失败：${error.message || error}`, "error");
    }
  }

  async function deleteSnapshot(snapshotId) {
    try {
      const result = await request(`/snapshots/${encodeURIComponent(snapshotId)}`, { method: "DELETE" });
      state.data = result.data;
      renderSnapshots();
      toast("快照已删除");
    } catch (error) {
      toast(`删除快照失败：${error.message || error}`, "error");
    }
  }

  function refreshMainPreview() {
    const frame = el("editorMainPreview");
    if (!frame) return;
    frame.src = `/?spaceman-preview=1&editor-preview=1&t=${Date.now()}`;
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "spaceman-constellation-editor.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function openQuickCreate() {
    el("quickName").value = `CUSTOM-SAT-${Date.now().toString().slice(-5)}`;
    el("quickAltitude").value = 550;
    el("quickInclination").value = 53;
    el("editorQuickCreate").classList.remove("hidden");
  }

  function closeModals() {
    document.querySelectorAll(".editor-modal").forEach((modal) => modal.classList.add("hidden"));
  }

  async function addTemplate(type) {
    const shellKey = type === "polar" ? "leo-b" : "leo-a";
    const count = type === "polar" ? 12 : 20;
    const shell = state.data.shells.find((item) => item.key === shellKey);
    for (let i = 0; i < count; i += 1) {
      // Sequential requests keep the local database change log deterministic.
      await request("/satellites", {
        method: "POST",
        body: JSON.stringify({
          name: `${type === "polar" ? "POLAR" : "WALKER"}-${String(i + 1).padStart(3, "0")}`,
          shellKey,
          altitudeKm: shell?.altitudeKm || 550,
          inclinationDeg: type === "polar" ? 97.6 : 53,
          meanAnomalyDeg: (360 / count) * i,
          raanDeg: (i % 5) * 18
        })
      });
    }
    await loadState();
    toast(`已生成 ${count} 颗${type === "polar" ? "极地" : "Walker"}模板卫星`);
  }

  function bindEvents() {
    el("editorSearch").addEventListener("input", (event) => {
      state.search = event.target.value;
      renderSatelliteList();
    });
    el("editorSatelliteList").addEventListener("click", (event) => {
      const visible = event.target.closest("[data-toggle-visible]");
      if (visible) {
        event.stopPropagation();
        const sat = state.data.satellites.find((item) => item.id === visible.dataset.toggleVisible);
        if (sat) {
          request(`/satellites/${encodeURIComponent(sat.id)}`, {
            method: "PUT",
            body: JSON.stringify({ ...sat, visible: sat.visible === false })
          }).then((result) => {
            state.data = result.data;
            renderAll();
          });
        }
        return;
      }
      const clone = event.target.closest("[data-clone-sat]");
      if (clone) return cloneSatellite(clone.dataset.cloneSat);
      const remove = event.target.closest("[data-remove-sat]");
      if (remove) return openDelete([remove.dataset.removeSat]);
      const row = event.target.closest("[data-select-sat]");
      if (row) selectSatellite(row.dataset.selectSat);
    });
    el("editorShellList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-apply-shell]");
      if (button) applyShellCount(button.dataset.applyShell);
    });
    const bindSnapshotActions = (container) => container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-restore-snapshot]");
      if (button) {
        closeModals();
        restoreSnapshot(button.dataset.restoreSnapshot);
      }
      const deleteButton = event.target.closest("[data-delete-snapshot]");
      if (deleteButton) deleteSnapshot(deleteButton.dataset.deleteSnapshot);
    });
    bindSnapshotActions(el("editorSnapshots"));
    bindSnapshotActions(el("editorSnapshotManagerList"));
    el("editorViewport").addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const menu = el("editorContextMenu");
      menu.style.left = `${event.offsetX}px`;
      menu.style.top = `${event.offsetY}px`;
      menu.classList.remove("hidden");
    });
    el("editorContextMenu").addEventListener("click", (event) => {
      const action = event.target.closest("[data-context-action]")?.dataset.contextAction;
      el("editorContextMenu").classList.add("hidden");
      if (action === "add") openQuickCreate();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#editorContextMenu")) el("editorContextMenu")?.classList.add("hidden");
    });
    el("editorAddSatellite").addEventListener("click", openQuickCreate);
    el("quickCreateConfirm").addEventListener("click", () => {
      closeModals();
      addSatellite({
        name: el("quickName").value,
        shellKey: el("quickShell").value,
        altitudeKm: Number(el("quickAltitude").value),
        inclinationDeg: Number(el("quickInclination").value)
      });
    });
    document.querySelectorAll("[data-close-modal], .editor-modal-backdrop").forEach((node) => node.addEventListener("click", closeModals));
    el("deleteConfirmBtn").addEventListener("click", () => {
      if (state.pendingDeleteIds.length > 3 && el("deleteConfirmInput").value !== "DELETE") {
        toast("请输入 DELETE 后再确认", "error");
        return;
      }
      const ids = state.pendingDeleteIds.slice();
      closeModals();
      removeSatellites(ids);
    });
    el("editorInspectorForm").addEventListener("submit", applyInspector);
    el("inspectorClone").addEventListener("click", () => currentSat() && cloneSatellite(currentSat().id));
    el("inspectorRemove").addEventListener("click", () => currentSat() && openDelete([currentSat().id]));
    el("inspectorInclination").addEventListener("input", () => { el("inspectorInclinationNumber").value = el("inspectorInclination").value; });
    el("inspectorInclinationNumber").addEventListener("input", () => { el("inspectorInclination").value = el("inspectorInclinationNumber").value; });
    document.querySelectorAll("[data-editor-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-editor-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
        document.querySelectorAll("[data-editor-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.editorPanel === button.dataset.editorTab));
      });
    });
    document.querySelectorAll("[data-template]").forEach((button) => button.addEventListener("click", () => addTemplate(button.dataset.template)));
    el("editorRestoreDefault").addEventListener("click", restoreDefault);
    el("editorSnapshotManager").addEventListener("click", openSnapshotManager);
    el("editorSave").addEventListener("click", openSnapshotSave);
    el("editorSnapshotConfirm").addEventListener("click", () => {
      closeModals();
      saveScene();
    });
    el("editorSnapshotName").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      closeModals();
      saveScene();
    });
    el("editorExportJson").addEventListener("click", exportJson);
    el("editorBindApi").addEventListener("click", () => { window.location.href = "/model-config"; });
    el("editorPlayToggle").addEventListener("click", () => {
      state.playing = !state.playing;
      el("editorPlayToggle").textContent = state.playing ? "暂停" : "播放";
    });
    ["editorStepBack", "editorStepForward"].forEach((id) => {
      el(id).addEventListener("click", () => {
        const delta = id === "editorStepBack" ? -10 : 10;
        el("editorTimeRange").value = Number(el("editorTimeRange").value) + delta;
        updateSimTime();
      });
    });
    el("editorTimeRange").addEventListener("input", updateSimTime);
    window.addEventListener("resize", () => renderViewport());
  }

  function updateSimTime() {
    const minutes = Number(el("editorTimeRange").value || 0);
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    el("editorSimTime").textContent = `T+${hh}:${mm}`;
    state.phase = minutes / 4;
    renderViewport();
  }

  function tick() {
    if (state.playing && state.data) {
      const speed = Number(el("editorSpeed").value || 1);
      state.phase = (state.phase + speed * 0.04) % 360;
    }
    window.requestAnimationFrame(tick);
  }

  function init() {
    bindEvents();
    loadState();
    tick();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
