(function () {
  const STORAGE_KEY = "spaceman.assistant.conversations.v1";
  const MODEL_SETTINGS_KEY = "spaceman.assistant.modelSettings.v1";
  const MAX_HISTORY = 50;

  const routes = {
    "/fault-injection": "\u6545\u969c\u6ce8\u5165",
    "/security-audit": "\u5b89\u5168\u5ba1\u8ba1",
    "/model-config": "\u6a21\u578b\u914d\u7f6e"
  };

  function hideDropdown(id) {
    const inst = window.FlowbiteInstances?._instances?.Dropdown?.[id];
    if (inst && typeof inst.hide === "function") inst.hide();
  }

  function navigatePlaceholder(path) {
    hideDropdown("dropdownSpacemanFunctions");
    if (!routes[path]) return false;
    if (window.location.pathname !== path) {
      window.history.pushState({ spacemanFeature: path }, "", path);
    }
    ensurePlaceholder(path);
    keepChineseNav();
    return false;
  }

  function ensurePlaceholder(path) {
    const title = routes[path];
    let el = document.getElementById("spaceman-feature-shell");
    if (!title) {
      if (el) el.remove();
      document.body.classList.remove("spaceman-feature-active");
      return;
    }
    document.body.classList.add("spaceman-feature-active");
    ensureFeatureShellStyle();
    if (!el) {
      el = document.createElement("div");
      el.id = "spaceman-feature-shell";
      el.style.cssText = [
        "position:fixed",
        "top:44px",
        "left:0",
        "right:0",
        "bottom:0",
        "z-index:19",
        "background:#000"
      ].join(";");
      document.body.appendChild(el);
    }
    el.setAttribute("aria-label", title);
    el.innerHTML = "";
  }

  function ensureFeatureShellStyle() {
    if (document.getElementById("spaceman-feature-shell-style")) return;
    const style = document.createElement("style");
    style.id = "spaceman-feature-shell-style";
    style.textContent = [
      "body.spaceman-feature-active #search-trigger-icon",
      "body.spaceman-feature-active #ios-app-icon",
      "body.spaceman-feature-active #vis_help_icon",
      "body.spaceman-feature-active #bgtitle",
      "body.spaceman-feature-active #logo-overlay{display:none!important}"
    ].join(",");
    document.head.appendChild(style);
  }
  function keepChineseNav() {
    const pairs = [
      ["spaceman-functions-label", "\u529f\u80fd"],
      ["spaceman-mobile-functions-label", "\u529f\u80fd"],
      ["spaceman-assistant-menu-label", "\u667a\u80fd\u52a9\u624b"],
      ["spaceman-fault-menu-label", "\u6545\u969c\u6ce8\u5165"],
      ["spaceman-audit-menu-label", "\u5b89\u5168\u5ba1\u8ba1"],
      ["spaceman-model-menu-label", "\u6a21\u578b\u914d\u7f6e"]
    ];
    for (const [id, text] of pairs) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
    document.querySelectorAll("[data-spaceman-action='assistant']").forEach((el) => {
      if (!el.querySelector("#spaceman-assistant-menu-label")) el.textContent = "\u667a\u80fd\u52a9\u624b";
    });
    document.querySelectorAll("[data-spaceman-route='/fault-injection']").forEach((el) => {
      if (!el.querySelector("#spaceman-fault-menu-label")) el.textContent = "\u6545\u969c\u6ce8\u5165";
    });
    document.querySelectorAll("[data-spaceman-route='/security-audit']").forEach((el) => {
      if (!el.querySelector("#spaceman-audit-menu-label")) el.textContent = "\u5b89\u5168\u5ba1\u8ba1";
    });
    document.querySelectorAll("[data-spaceman-route='/model-config']").forEach((el) => {
      if (!el.querySelector("#spaceman-model-menu-label")) el.textContent = "\u6a21\u578b\u914d\u7f6e";
    });
  }

  function buildPanel() {
    let panel = document.getElementById("spaceman-assistant-panel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "spaceman-assistant-panel";
    renderEnhancedPanel(panel);
    document.body.appendChild(panel);
    wirePanel(panel);
    return panel;
  }

  function renderEnhancedPanel(panel) {
    panel.innerHTML = `
      <div class="spaceman-assistant-header" id="spaceman-assistant-drag">
        <button class="spaceman-assistant-back" id="spaceman-assistant-back" type="button" title="\u8fd4\u56de\u4efb\u52a1\u5217\u8868" aria-label="\u8fd4\u56de\u4efb\u52a1\u5217\u8868">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>
        </button>
        <div class="spaceman-assistant-top-tabs" id="spaceman-assistant-tabs">
          <button class="spaceman-assistant-top-tab" type="button" data-spaceman-mode="chat">\u804a\u5929</button>
          <button class="spaceman-assistant-top-tab active" type="button" data-spaceman-mode="codex">CODEX</button>
        </div>
        <div class="spaceman-assistant-chat-title" id="spaceman-assistant-chat-title">\u65b0\u5bf9\u8bdd</div>
        <div class="spaceman-assistant-actions">
          <button class="spaceman-assistant-icon" id="spaceman-assistant-more" type="button" title="\u66f4\u591a" aria-label="\u66f4\u591a">${ellipsisIconSvg()}</button>
          <button class="spaceman-assistant-icon" id="spaceman-assistant-refresh" type="button" title="\u5386\u53f2\u8bb0\u5f55" aria-label="\u5386\u53f2\u8bb0\u5f55">${historyIconSvg()}</button>
          <button class="spaceman-assistant-icon" id="spaceman-assistant-settings-btn" title="\u8bbe\u7f6e" aria-label="\u8bbe\u7f6e">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2.05 2.05 0 0 1-2.9 2.9l-.04-.04a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21a2.05 2.05 0 0 1-4.1 0v-.06a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.88.34l-.04.04a2.05 2.05 0 0 1-2.9-2.9l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2.05 2.05 0 0 1 0-4.1h.06a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2.05 2.05 0 0 1 2.9-2.9l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2.05 2.05 0 0 1 4.1 0v.06a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.04-.04a2.05 2.05 0 0 1 2.9 2.9l-.04.04A1.7 1.7 0 0 0 19.4 9c.23.61.82 1 1.56 1H21a2.05 2.05 0 0 1 0 4.1h-.06A1.7 1.7 0 0 0 19.4 15Z"/></svg>
          </button>
          <button class="spaceman-assistant-icon" id="spaceman-assistant-new" type="button" title="\u65b0\u5efa\u5bf9\u8bdd" aria-label="\u65b0\u5efa\u5bf9\u8bdd">${composeIconSvg()}</button>
          <button class="spaceman-assistant-icon spaceman-assistant-close-btn" id="spaceman-assistant-close" type="button" title="\u5173\u95ed" aria-label="\u5173\u95ed">${closeIconSvg()}</button>
        </div>
      </div>
      <div class="spaceman-more-menu" id="spaceman-more-menu">
        <button type="button" data-more-action="rename">${pencilSmallIconSvg()}<span>Rename chat</span></button>
        <button type="button" data-more-action="archive">${archiveIconSvg()}<span>Archive chat</span></button>
        <div class="spaceman-more-divider"></div>
        <button class="has-submenu" type="button" data-more-action="copy">${copySmallIconSvg()}<span>Copy</span>${chevronRightIconSvg()}</button>
        <div class="spaceman-more-submenu">
          <button type="button" data-more-action="copy-last">Copy last response</button>
          <button type="button" data-more-action="copy-chat">Copy transcript</button>
          <button type="button" data-more-action="copy-title">Copy title</button>
        </div>
      </div>
      <div class="spaceman-assistant-settings" id="spaceman-assistant-settings">
        <label>\u900f\u660e\u5ea6 <input id="spaceman-assistant-opacity" type="range" min="0" max="100" value="6"></label>
        <div class="spaceman-assistant-setting">
          <span>\u989c\u8272</span>
          <button class="spaceman-assistant-color-button" id="spaceman-assistant-color-btn" type="button" title="\u9009\u62e9\u989c\u8272" aria-label="\u9009\u62e9\u989c\u8272">
            <span class="spaceman-assistant-color-swatch" id="spaceman-assistant-color-swatch"></span>
          </button>
          <div class="spaceman-assistant-color-popover" id="spaceman-assistant-color-popover">
            <div class="spaceman-assistant-color-field" id="spaceman-assistant-color-field">
              <canvas id="spaceman-assistant-color-canvas" width="170" height="104"></canvas>
              <span class="spaceman-assistant-color-thumb" id="spaceman-assistant-color-thumb"></span>
            </div>
            <button class="spaceman-assistant-color-reset" id="spaceman-assistant-color-reset" type="button">\u6062\u590d\u9ed8\u8ba4</button>
          </div>
        </div>
      </div>
      <div class="spaceman-assistant-main">
        <div class="spaceman-assistant-history">
          <div class="spaceman-assistant-section-title">Tasks</div>
          <label class="spaceman-assistant-task-search">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
            <input id="spaceman-task-search" type="text" placeholder="Search recent tasks" autocomplete="off">
          </label>
          <div class="spaceman-assistant-history-list" id="spaceman-assistant-history-list"></div>
          <button class="spaceman-assistant-view-all" id="spaceman-assistant-view-all" type="button"></button>
        </div>
        <div class="spaceman-assistant-chat-stage" id="spaceman-assistant-body">
          <div class="spaceman-assistant-empty-state">\u8f93\u5165\u6d88\u606f\u5f00\u59cb\u65b0\u7684 Codex \u4f1a\u8bdd</div>
        </div>
      </div>
      <div class="spaceman-assistant-footer">
        <div class="spaceman-assistant-composer">
          <div class="spaceman-attachment-list" id="spaceman-attachment-list"></div>
          <textarea id="spaceman-assistant-input" autocomplete="off" rows="2" placeholder="Do anything"></textarea>
          <div class="spaceman-assistant-composer-bar">
            <div class="spaceman-assistant-composer-left">
              <button class="spaceman-assistant-mini-btn" id="spaceman-add-btn" type="button" title="Add files and more">+</button>
              <button class="spaceman-assistant-approval has-chevron" id="spaceman-approval-btn" type="button"><span>Ask for approval</span><svg viewBox="0 0 10 6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg></button>
            </div>
            <div class="spaceman-assistant-composer-right">
              <button class="spaceman-assistant-chip has-chevron" id="spaceman-model-btn" type="button"><span>5.5 High</span><svg viewBox="0 0 10 6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg></button>
              <button class="spaceman-assistant-chip active" id="spaceman-context-btn" type="button">IDE context</button>
              <button class="spaceman-assistant-send" id="spaceman-assistant-send" title="\u53d1\u9001" aria-label="\u53d1\u9001">${sendArrowIconSvg()}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="spaceman-command-menu" id="spaceman-add-menu">
        <div class="spaceman-command-title">Add</div>
        <button type="button" data-file-picker>Files and folders</button>
        <button type="button" data-command="goal">Goal<span>Set a persistent objective</span></button>
        <button type="button" data-command="plan">Plan mode<span>Turn planning on</span></button>
        <div class="spaceman-command-muted">Files and chats</div>
        <input type="text" placeholder="Type to search files or chats" id="spaceman-file-search">
      </div>
      <div class="spaceman-command-menu" id="spaceman-slash-menu">
        <button type="button" data-command="review">Code review<span>Review unstaged changes or compare against a branch</span></button>
        <button type="button" data-command="feedback">Feedback<span>Send feedback about this chat</span></button>
        <button type="button" data-command="goal">Goal<span>Set a goal that Codex will keep working towards</span></button>
        <button type="button" data-command="context">IDE context<span>Include current selection, open files, and other context</span></button>
        <button type="button" data-command="auto-context">Auto context<span>Toggle IDE context collection</span></button>
        <button type="button" data-command="cloud">Cloud<span>Move work to Codex cloud</span></button>
        <button type="button" data-command="cloud-environment">Cloud environment<span>Show cloud environment settings</span></button>
        <button type="button" data-command="local">Local<span>Run in this local workspace</span></button>
        <button type="button" data-command="model">Model<span>GPT-5.5</span></button>
        <button type="button" data-command="plan">Plan mode<span>Turn plan mode on</span></button>
        <button type="button" data-command="reasoning">Reasoning<span>High</span></button>
        <button type="button" data-command="status">Status<span>Show chat id, context usage, and rate limits</span></button>
        <div class="spaceman-command-muted">Skills</div>
        <button type="button" data-command="imagegen">Image Gen<span>Generate or edit images</span></button>
        <button type="button" data-command="openaidocs">OpenAI Docs<span>Reference OpenAI docs and Codex guidance</span></button>
      </div>
      <input id="spaceman-file-input" type="file" multiple hidden>
      <div class="spaceman-command-menu compact" id="spaceman-approval-menu">
        <div class="spaceman-command-title">How should Codex actions be approved?</div>
        <button type="button" data-approval="Ask for approval">Ask for approval<span>*</span></button>
        <button type="button" data-approval="Full access">Full access</button>
      </div>
      <div class="spaceman-command-menu compact spaceman-model-menu" id="spaceman-model-menu">
        <div class="spaceman-command-title">Reasoning</div>
        <button type="button" data-reasoning="Light">Light<span class="spaceman-model-check"></span></button>
        <button type="button" data-reasoning="Medium">Medium<span class="spaceman-model-check"></span></button>
        <button type="button" data-reasoning="High">High<span class="spaceman-model-check">*</span></button>
        <button type="button" data-reasoning="Extra High">Extra High<span class="spaceman-model-check"></span></button>
        <div class="spaceman-command-divider"></div>
        <button class="spaceman-model-group-toggle" type="button" data-model-group="gpt">
          <span>GPT-5.5</span>
          <svg viewBox="0 0 10 6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg>
        </button>
        <div class="spaceman-model-group open" id="spaceman-model-group-gpt">
          <div class="spaceman-command-title spaceman-model-section">Model</div>
          <button type="button" data-model="GPT-5.5">GPT-5.5<span class="spaceman-model-check">*</span></button>
          <button type="button" data-model="GPT-5.4">GPT-5.4<span class="spaceman-model-check"></span></button>
          <button type="button" data-model="GPT-5.4-Mini">GPT-5.4-Mini<span class="spaceman-model-check"></span></button>
          <button type="button" data-model="GPT-5.3-Codex">GPT-5.3-Codex<span class="spaceman-model-check"></span></button>
          <button type="button" data-model="GPT-5.2">GPT-5.2<span class="spaceman-model-check"></span></button>
        </div>
      </div>
      <div class="spaceman-assistant-resize-hint">/</div>
    `;
  }
  function wirePanel(panel) {
    isolateAssistantEvents(panel);

    const header = panel.querySelector("#spaceman-assistant-drag");
    const backBtn = panel.querySelector("#spaceman-assistant-back");
    const tabs = panel.querySelector("#spaceman-assistant-tabs");
    const chatTitle = panel.querySelector("#spaceman-assistant-chat-title");
    const moreBtn = panel.querySelector("#spaceman-assistant-more");
    const moreMenu = panel.querySelector("#spaceman-more-menu");
    const refreshBtn = panel.querySelector("#spaceman-assistant-refresh");
    const newBtn = panel.querySelector("#spaceman-assistant-new");
    const settingsBtn = panel.querySelector("#spaceman-assistant-settings-btn");
    const settings = panel.querySelector("#spaceman-assistant-settings");
    const close = panel.querySelector("#spaceman-assistant-close");
    const opacity = panel.querySelector("#spaceman-assistant-opacity");
    const colorButton = panel.querySelector("#spaceman-assistant-color-btn");
    const colorPopover = panel.querySelector("#spaceman-assistant-color-popover");
    const colorField = panel.querySelector("#spaceman-assistant-color-field");
    const colorCanvas = panel.querySelector("#spaceman-assistant-color-canvas");
    const colorThumb = panel.querySelector("#spaceman-assistant-color-thumb");
    const colorReset = panel.querySelector("#spaceman-assistant-color-reset");
    const input = panel.querySelector("#spaceman-assistant-input");
    const send = panel.querySelector("#spaceman-assistant-send");
    const attachmentList = panel.querySelector("#spaceman-attachment-list");
    const fileInput = panel.querySelector("#spaceman-file-input");
    const historyList = panel.querySelector("#spaceman-assistant-history-list");
    const taskSearch = panel.querySelector("#spaceman-task-search");
    const viewAllBtn = panel.querySelector("#spaceman-assistant-view-all");
    const addBtn = panel.querySelector("#spaceman-add-btn");
    const approvalBtn = panel.querySelector("#spaceman-approval-btn");
    const modelBtn = panel.querySelector("#spaceman-model-btn");
    const contextBtn = panel.querySelector("#spaceman-context-btn");
    const addMenu = panel.querySelector("#spaceman-add-menu");
    const slashMenu = panel.querySelector("#spaceman-slash-menu");
    const approvalMenu = panel.querySelector("#spaceman-approval-menu");
    const modelMenu = panel.querySelector("#spaceman-model-menu");
    const defaultColor = { r: 24, g: 24, b: 24 };
    const defaultOpacity = 6;
    let selectedColor = { r: 24, g: 24, b: 24 };
    let modelSettings = loadModelSettings();
    let activeConversationId = null;
    let pendingAttachments = [];
    document.body.appendChild(colorPopover);

    const setConversationView = (conversation = null) => {
      const title = conversation ? conversation.title : "New chat";
      panel.classList.add("chat-open");
      panel.classList.remove("history-expanded");
      if (chatTitle) chatTitle.textContent = title || "New chat";
      if (tabs) tabs.setAttribute("aria-hidden", "true");
    };

    const setTaskView = (expanded = false) => {
      panel.classList.remove("chat-open");
      panel.classList.toggle("history-expanded", Boolean(expanded));
      activeConversationId = null;
      if (tabs) tabs.removeAttribute("aria-hidden");
      renderConversation(null);
      renderHistory();
      if (expanded && taskSearch) taskSearch.focus();
    };

    let drag = null;
    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = panel.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      panel.classList.add("dragging");
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    header.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, drag.left + event.clientX - drag.x));
      const top = Math.max(48, Math.min(window.innerHeight - panel.offsetHeight, drag.top + event.clientY - drag.y));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });

    header.addEventListener("pointerup", () => {
      drag = null;
      panel.classList.remove("dragging");
    });

    settingsBtn.addEventListener("click", () => {
      settings.classList.toggle("open");
      drawColorField(colorCanvas);
      positionColorThumb(colorThumb, colorCanvas.width * .12, colorCanvas.height * .86);
      if (colorPopover.classList.contains("open")) positionColorPopover(colorButton, colorPopover);
    });
    if (close) close.addEventListener("click", () => panel.classList.remove("open"));
    backBtn.addEventListener("click", () => setTaskView(false));
    moreBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      positionPopoverMenu(moreBtn, moreMenu);
      moreMenu.classList.toggle("open");
      closeMenus(moreMenu);
    });
    refreshBtn.addEventListener("click", () => {
      setTaskView(true);
      if (taskSearch) taskSearch.select();
    });
    newBtn.addEventListener("click", () => {
      activeConversationId = null;
      if (taskSearch) taskSearch.value = "";
      setConversationView(null);
      renderConversation(null);
      input.focus();
    });
    opacity.addEventListener("input", () => applyPanelColor(panel, selectedColor, transparencyToAlpha(opacity.value)));
    colorButton.addEventListener("click", (event) => {
      event.stopPropagation();
      colorPopover.classList.toggle("open");
      drawColorField(colorCanvas);
      positionColorPopover(colorButton, colorPopover);
    });
    colorField.addEventListener("pointerdown", (event) => {
      colorField.setPointerCapture(event.pointerId);
      pickPanelColor(event, panel, colorField, colorCanvas, colorThumb, () => transparencyToAlpha(opacity.value), (rgb) => {
        selectedColor = rgb;
      });
      event.preventDefault();
    });
    colorField.addEventListener("pointermove", (event) => {
      if (event.buttons !== 1) return;
      pickPanelColor(event, panel, colorField, colorCanvas, colorThumb, () => transparencyToAlpha(opacity.value), (rgb) => {
        selectedColor = rgb;
      });
    });
    document.addEventListener("pointerdown", (event) => {
      if (!panel.contains(event.target) && !colorPopover.contains(event.target)) colorPopover.classList.remove("open");
    });
    colorReset.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedColor = { ...defaultColor };
      opacity.value = String(defaultOpacity);
      positionColorThumb(colorThumb, colorCanvas.width * .12, colorCanvas.height * .86);
      applyPanelColor(panel, selectedColor, transparencyToAlpha(defaultOpacity));
    });
    window.addEventListener("resize", () => {
      if (colorPopover.classList.contains("open")) positionColorPopover(colorButton, colorPopover);
    });
    applyPanelColor(panel, selectedColor, transparencyToAlpha(opacity.value));

    const renderHistory = () => {
      const query = (taskSearch && taskSearch.value || "").trim().toLowerCase();
      const expanded = panel.classList.contains("history-expanded");
      const conversations = loadConversations().filter((conversation) => {
        if (conversation.archivedAt) return false;
        if (!query) return true;
        const haystack = [
          conversation.title,
          ...(conversation.messages || []).map((message) => message.text)
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      });
      const visibleConversations = expanded ? conversations : conversations.slice(0, 3);
      historyList.innerHTML = "";
      if (!visibleConversations.length) {
        historyList.innerHTML = `<div class="spaceman-assistant-no-history">${query ? "No matching tasks" : "No tasks yet"}</div>`;
        renderConversation(null);
      }
      visibleConversations.forEach((conversation) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "spaceman-assistant-history-row";
        row.classList.toggle("active", conversation.id === activeConversationId);
        row.innerHTML = `<span></span><time></time>`;
        row.children[0].textContent = conversation.title;
        row.children[1].textContent = formatRelativeTime(conversation.updatedAt);
        row.addEventListener("click", () => {
          activeConversationId = conversation.id;
          setConversationView(conversation);
          renderHistory();
          renderConversation(conversation);
        });
        historyList.appendChild(row);
      });
      if (viewAllBtn) {
        viewAllBtn.hidden = expanded || conversations.length <= 3;
        viewAllBtn.textContent = `View all (${conversations.length})`;
      }
    };

    function handleMoreAction(action) {
      const conversation = loadConversations().find((item) => item.id === activeConversationId);
      if (!conversation && action !== "copy") {
        if (action === "copy-last" || action === "copy-chat" || action === "copy-title") {
          copyText("");
          closeMenus();
        }
        return;
      }

      if (action === "rename") {
        const next = window.prompt("Rename chat", conversation.title || "New chat");
        if (next && next.trim()) {
          renameConversation(conversation.id, next.trim());
          const updated = loadConversations().find((item) => item.id === conversation.id);
          if (updated) {
            setConversationView(updated);
            renderHistory();
            renderConversation(updated);
          }
        }
        closeMenus();
        return;
      }

      if (action === "archive") {
        archiveConversation(conversation.id);
        setTaskView(false);
        closeMenus();
        return;
      }

      if (action === "copy-last") {
        copyText(lastAssistantText(conversation), moreBtn);
        closeMenus();
        return;
      }

      if (action === "copy-chat") {
        copyText(conversationToText(conversation), moreBtn);
        closeMenus();
        return;
      }

      if (action === "copy-title") {
        copyText(conversation.title || "", moreBtn);
        closeMenus();
      }
    }

    taskSearch.addEventListener("input", renderHistory);
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", () => setTaskView(true));
    }

    const closeMenus = (except = null) => {
      [addMenu, slashMenu, approvalMenu, modelMenu, moreMenu].forEach((menu) => {
        if (menu !== except) menu.classList.remove("open");
      });
    };

    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCommandMenu(addBtn, addMenu);
      closeMenus(addMenu);
    });
    approvalBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCommandMenu(approvalBtn, approvalMenu);
      closeMenus(approvalMenu);
    });
    modelBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCommandMenu(modelBtn, modelMenu);
      closeMenus(modelMenu);
    });
    contextBtn.addEventListener("click", () => {
      contextBtn.classList.toggle("active");
      contextBtn.textContent = contextBtn.classList.contains("active") ? "IDE context" : "No context";
    });
    panel.querySelectorAll("[data-file-picker]").forEach((button) => {
      button.addEventListener("click", () => {
        fileInput.click();
        closeMenus();
      });
    });
    fileInput.addEventListener("change", () => {
      pendingAttachments = Array.from(fileInput.files || []).map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || "file",
      }));
      renderAttachments(attachmentList, pendingAttachments);
      fileInput.value = "";
    });
    panel.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("click", () => {
        runCommand(button.dataset.command, { input, contextBtn, modelBtn, approvalBtn });
        closeMenus();
      });
    });
    panel.querySelectorAll("[data-approval]").forEach((button) => {
      button.addEventListener("click", () => {
        approvalBtn.querySelector("span").textContent = button.dataset.approval;
        closeMenus();
      });
    });
    panel.querySelectorAll("[data-reasoning]").forEach((button) => {
      button.addEventListener("click", () => {
        modelSettings = { ...modelSettings, reasoning: button.dataset.reasoning };
        saveModelSettings(modelSettings);
        applyModelSettings(panel, modelBtn, modelSettings);
      });
    });
    panel.querySelectorAll("[data-model]").forEach((button) => {
      button.addEventListener("click", () => {
        modelSettings = { ...modelSettings, model: button.dataset.model };
        saveModelSettings(modelSettings);
        applyModelSettings(panel, modelBtn, modelSettings);
      });
    });
    panel.querySelectorAll("[data-model-group]").forEach((button) => {
      button.addEventListener("click", () => {
        const group = panel.querySelector("#spaceman-model-group-gpt");
        if (!group) return;
        group.classList.toggle("open");
        button.classList.toggle("open", group.classList.contains("open"));
      });
    });
    document.addEventListener("pointerdown", (event) => {
      if (!panel.contains(event.target)) closeMenus();
    });
    moreMenu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-more-action]");
      if (!button) return;
      handleMoreAction(button.dataset.moreAction);
    });
    applyModelSettings(panel, modelBtn, modelSettings);
    renderHistory();

    const submit = async () => {
      const text = input.value.trim();
      if (!text && pendingAttachments.length === 0) return;
      input.value = "";
      const conversation = upsertConversation(activeConversationId, text || "Attachment", pendingAttachments);
      pendingAttachments = [];
      renderAttachments(attachmentList, pendingAttachments);
      activeConversationId = conversation.id;
      setConversationView(conversation);
      renderHistory();
      renderConversation(conversation);
      const streamRun = appendStreamingRun();
      try {
        let streamedText = "";
        const response = await requestAssistantReply(conversation.id, modelSettings, (delta) => {
          streamedText += delta;
          streamRun.update(streamedText);
        });
        const reply = streamedText || response.reply || "\u6a21\u578b\u6ca1\u6709\u8fd4\u56de\u5185\u5bb9\u3002";
        streamRun.update(reply);
        saveAssistantReply(activeConversationId, reply, {
          model: response.model || modelSettings.model
        });
      } catch (error) {
        const message = String(error.message || error);
        streamRun.update(message, true);
        saveAssistantReply(activeConversationId, message, {
          status: "\u8bf7\u6c42\u5931\u8d25",
          error: true
        });
      }
      const updated = loadConversations().find((item) => item.id === activeConversationId);
      renderConversation(updated || conversation);
      renderHistory();
    };
    send.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (input.value === "/" && event.key !== "Backspace") {
        toggleCommandMenu(input, slashMenu);
        closeMenus(slashMenu);
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });
    input.addEventListener("input", () => {
      if (input.value.trim() === "/") {
        toggleCommandMenu(input, slashMenu);
        closeMenus(slashMenu);
      } else if (!input.value.trim().startsWith("/")) {
        slashMenu.classList.remove("open");
      }
    });
  }

  function applyPanelColor(panel, rgb, alpha) {
    const color = rgb || { r: 24, g: 24, b: 24 };
    panel.style.setProperty("--spaceman-assistant-rgb", `${color.r}, ${color.g}, ${color.b}`);
    panel.style.setProperty("--spaceman-assistant-alpha", alpha.toFixed(2));
    panel.style.background = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }

  function isolateAssistantEvents(panel) {
    const stop = (event) => {
      if (panel.contains(event.target)) event.stopPropagation();
    };
    [
      "keydown",
      "keyup",
      "keypress",
      "beforeinput",
      "input",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "wheel",
      "pointerdown",
      "pointerup",
      "pointermove",
      "mousedown",
      "mouseup",
      "click",
    ].forEach((type) => {
      panel.addEventListener(type, stop);
    });
  }

  function transparencyToAlpha(value) {
    const transparency = Math.max(0, Math.min(100, Number(value) || 0));
    return Math.max(0, Math.min(1, 1 - transparency / 100));
  }

  function positionColorPopover(button, popover) {
    if (!button || !popover) return;
    const rect = button.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth || 190;
    const popoverHeight = popover.offsetHeight || 150;
    const margin = 8;
    const left = Math.max(margin, Math.min(window.innerWidth - popoverWidth - margin, rect.right - popoverWidth));
    let top = rect.top - popoverHeight - margin;
    if (top < margin) top = rect.bottom + margin;
    popover.style.left = `${left}px`;
    popover.style.top = `${Math.max(margin, Math.min(window.innerHeight - popoverHeight - margin, top))}px`;
  }

  function toggleCommandMenu(button, menu) {
    const willOpen = !menu.classList.contains("open");
    menu.classList.toggle("open", willOpen);
    if (!willOpen) return;
    const rect = button.getBoundingClientRect();
    const panel = button.closest("#spaceman-assistant-panel");
    const panelRect = panel.getBoundingClientRect();
    const width = menu.offsetWidth || 320;
    const left = Math.max(12, Math.min(panelRect.width - width - 12, rect.left - panelRect.left));
    menu.style.left = `${left}px`;
    menu.style.bottom = `${panelRect.height - (rect.top - panelRect.top) + 8}px`;
  }

  function positionPopoverMenu(button, menu) {
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const panel = button.closest("#spaceman-assistant-panel");
    const panelRect = panel.getBoundingClientRect();
    const width = menu.offsetWidth || 300;
    const left = Math.max(10, Math.min(panelRect.width - width - 10, rect.right - panelRect.left - width));
    menu.style.left = `${left}px`;
    menu.style.top = `${rect.bottom - panelRect.top + 8}px`;
  }

  function loadConversations() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      const clean = parsed.filter((conversation) => !hasCorruptText(conversation));
      if (clean.length !== parsed.length) saveConversations(clean);
      return clean.slice(0, MAX_HISTORY);
    } catch {
      return [];
    }
  }

  function hasCorruptText(value) {
    if (typeof value === "string") return /(\?\?\?|鈥|鉁|鏂|鍔|鏅|妯|瀹|娌|杩|脳|锛|鎭|棰|閫|璁|鍙|妫)/.test(value);
    if (!value || typeof value !== "object") return false;
    return Object.values(value).some(hasCorruptText);
  }

  function saveConversations(conversations) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, MAX_HISTORY)));
  }

  function loadModelSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MODEL_SETTINGS_KEY) || "{}");
      return {
        model: parsed.model || "GPT-5.5",
        reasoning: parsed.reasoning || "High",
      };
    } catch {
      return { model: "GPT-5.5", reasoning: "High" };
    }
  }

  function saveModelSettings(settings) {
    localStorage.setItem(MODEL_SETTINGS_KEY, JSON.stringify(settings));
  }

  function modelButtonLabel(settings) {
    return `${settings.model.replace(/^GPT-/, "")} ${settings.reasoning}`;
  }

  function applyModelSettings(panel, modelBtn, settings) {
    const label = modelBtn && modelBtn.querySelector("span");
    if (label) label.textContent = modelButtonLabel(settings);

    panel.querySelectorAll("[data-reasoning]").forEach((button) => {
      const selected = button.dataset.reasoning === settings.reasoning;
      const check = button.querySelector(".spaceman-model-check");
      button.classList.toggle("selected", selected);
      if (check) check.textContent = selected ? "*" : "";
    });

    panel.querySelectorAll("[data-model]").forEach((button) => {
      const selected = button.dataset.model === settings.model;
      const check = button.querySelector(".spaceman-model-check");
      button.classList.toggle("selected", selected);
      if (check) check.textContent = selected ? "*" : "";
    });
  }

  function upsertConversation(id, userText, attachments = []) {
    const conversations = loadConversations();
    let conversation = conversations.find((item) => item.id === id);
    const now = Date.now();
    if (!conversation) {
      conversation = {
        id: `chat-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: userText.slice(0, 48),
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      conversations.unshift(conversation);
    }
    conversation.updatedAt = now;
    conversation.title = conversation.title || userText.slice(0, 48);
    conversation.messages.push({ role: "user", text: userText, attachments, time: now });
    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    saveConversations(conversations);
    return conversation;
  }

  function saveAssistantReply(id, text, meta = {}) {
    const conversations = loadConversations();
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    conversation.messages.push({ role: "assistant", text, time: Date.now(), meta });
    conversation.updatedAt = Date.now();
    saveConversations(conversations);
  }

  function renameConversation(id, title) {
    const conversations = loadConversations();
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    conversation.title = title;
    conversation.updatedAt = Date.now();
    saveConversations(conversations);
  }

  function archiveConversation(id) {
    const conversations = loadConversations();
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    conversation.archivedAt = Date.now();
    conversation.updatedAt = Date.now();
    saveConversations(conversations);
  }

  function lastAssistantText(conversation) {
    const message = [...(conversation?.messages || [])].reverse().find((item) => item.role === "assistant");
    return message?.text || "";
  }

  function conversationToText(conversation) {
    if (!conversation) return "";
    const lines = [`# ${conversation.title || "New chat"}`];
    for (const message of conversation.messages || []) {
      const role = message.role === "assistant" ? "Assistant" : "User";
      lines.push("", `## ${role}`, message.text || "");
    }
    return lines.join("\n");
  }

  function renderConversation(conversation) {
    const body = document.getElementById("spaceman-assistant-body");
    if (!body) return;
    if (!conversation) {
      body.innerHTML = '<div class="spaceman-assistant-empty-state">\u8f93\u5165\u6d88\u606f\u5f00\u59cb\u65b0\u7684 Codex \u4f1a\u8bdd</div>';
      return;
    }
    body.innerHTML = "";
    for (const message of conversation.messages || []) {
      if (message.role === "user") {
        const el = document.createElement("div");
        el.className = "spaceman-assistant-message user";
        el.innerHTML = `<div class="spaceman-user-bubble"></div><button class="spaceman-copy-btn" type="button" title="\u590d\u5236" aria-label="\u590d\u5236">${copyIconSvg()}</button><div class="spaceman-message-attachments"></div>`;
        el.children[0].textContent = message.text;
        el.children[1].addEventListener("click", () => copyText(message.text, el.children[1]));
        renderAttachments(el.children[2], message.attachments || []);
        body.appendChild(el);
        continue;
      }

      const el = document.createElement("div");
      el.className = "spaceman-assistant-run";
      let status = message.meta && message.meta.status ? message.meta.status : "";
      if (/^Working for \d+s$/i.test(status)) status = "";
      const commands = Array.isArray(message.meta && message.meta.commands)
        ? message.meta.commands.filter((command) => isUsefulCommand(command))
        : [];
      el.innerHTML = `
        <div class="spaceman-run-status" hidden></div>
        <div class="spaceman-run-divider" hidden></div>
        <div class="spaceman-run-content"></div>
        <div class="spaceman-run-actions">
          <button class="spaceman-copy-btn" type="button" title="\u590d\u5236" aria-label="\u590d\u5236">${copyIconSvg()}</button>
        </div>
      `;
      const statusNode = el.querySelector(".spaceman-run-status");
      const dividerNode = el.querySelector(".spaceman-run-divider");
      if (status) {
        statusNode.hidden = false;
        dividerNode.hidden = false;
        statusNode.textContent = status;
      }
      const content = el.querySelector(".spaceman-run-content");
      if (commands.length) {
        const summary = document.createElement("div");
        summary.className = "spaceman-command-summary";
        summary.textContent = `Ran ${commands.length} commands`;
        content.appendChild(summary);
        commands.forEach((command) => {
          const row = document.createElement("div");
          row.className = "spaceman-command-row";
          row.textContent = command;
          content.appendChild(row);
        });
      }
      const text = document.createElement("div");
      text.className = "spaceman-assistant-answer";
      text.innerHTML = renderMarkdown(message.text);
      content.appendChild(text);
      el.querySelector(".spaceman-run-actions button").addEventListener("click", (event) => copyText(message.text, event.currentTarget));
      body.appendChild(el);
    }
    body.scrollTop = body.scrollHeight;
  }

  function copyText(text, button = null) {
    const done = () => markCopied(button);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text || "").then(done).catch(() => fallbackCopyText(text, done));
      return;
    }
    fallbackCopyText(text, done);
  }

  function fallbackCopyText(text, done) {
    const area = document.createElement("textarea");
    area.value = text || "";
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      done();
    } catch {
      // Clipboard access can be blocked by the browser outside user gestures.
    } finally {
      area.remove();
    }
  }

  function markCopied(button) {
    if (!button) return;
    const original = button.innerHTML;
    button.classList.add("copied");
    button.innerHTML = checkIconSvg();
    window.setTimeout(() => {
      button.classList.remove("copied");
      button.innerHTML = original;
    }, 1100);
  }

  function appendStreamingRun() {
    const body = document.getElementById("spaceman-assistant-body");
    if (!body) return { update() {} };
    const el = document.createElement("div");
    el.className = "spaceman-assistant-run transient streaming";
    el.innerHTML = `
      <div class="spaceman-run-content">
        <div class="spaceman-assistant-answer spaceman-stream-answer"><span class="spaceman-stream-cursor"></span></div>
      </div>
    `;
    const answer = el.querySelector(".spaceman-assistant-answer");
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return {
      update(text, isError = false) {
        el.classList.toggle("error", Boolean(isError));
        answer.innerHTML = text ? renderMarkdown(text) : `<span class="spaceman-stream-cursor"></span>`;
        body.scrollTop = body.scrollHeight;
      }
    };
  }

  function copyIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5h6v6h-6z"/><path d="M3.5 9.5h-1v-7h7v1"/></svg>`;
  }

  function checkIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>`;
  }

  function ellipsisIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12.5" cy="8" r="1"/></svg>`;
  }

  function historyIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 5.2H1.8V2.8"/><path d="M3.2 4.1A5.2 5.2 0 1 1 2.8 9"/><path d="M8 4.8v3.4l2.2 1.3"/></svg>`;
  }

  function composeIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.8 2.7 13.3 6l-7.1 7.1-3.4.7.7-3.4z"/><path d="m8.7 3.8 3.5 3.4"/></svg>`;
  }

  function closeIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 4.2 11.8 11.8"/><path d="M11.8 4.2 4.2 11.8"/></svg>`;
  }

  function sendArrowIconSvg() {
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15.5V4.5"/><path d="M5.5 9 10 4.5 14.5 9"/></svg>`;
  }

  function pencilSmallIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.8 2.9 3.3 3.3-6.8 6.8-3.1.7.7-3.1z"/></svg>`;
  }

  function archiveIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h10v7H3z"/><path d="M2.5 3.5h11v2h-11z"/><path d="M6.2 8h3.6"/></svg>`;
  }

  function copySmallIconSvg() {
    return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5h6v6h-6z"/><path d="M3.5 9.5h-1v-7h7v1"/></svg>`;
  }

  function chevronRightIconSvg() {
    return `<svg class="spaceman-more-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>`;
  }

  function isUsefulCommand(command) {
    const text = String(command || "").trim();
    if (!text) return false;
    return !(
      text === "POST /local-api/spaceman-chat" ||
      text === "Saved assistant reply" ||
      /^Model\s+/i.test(text)
    );
  }

  function selectedModelForApi(settings) {
    return (settings.model || "GPT-5.5").toLowerCase();
  }

  function collectSpacemanClientContext() {
    const bgtitle = document.getElementById("bgtitle");
    const logo = document.getElementById("logo-overlay");
    const visibleText = [
      bgtitle?.innerText,
      logo?.innerText,
      document.querySelector(".bgtitle-count")?.innerText,
      document.querySelector("[data-spaceman-route]")?.innerText
    ].filter(Boolean).join(" | ");

    const satelliteCountText = visibleText.match(/([\d,]+)\s*satellites?/i)?.[1] || null;
    const featureShell = document.getElementById("spaceman-feature-shell");
    const globe = window.globe || window.blueglobe || window.satmap || null;
    let movingPointCount = null;
    try {
      movingPointCount = globe?.dots?.movingPoints?.length ?? null;
    } catch {
      movingPointCount = null;
    }

    return {
      url: window.location.href,
      pathname: window.location.pathname,
      documentTitle: document.title,
      visibleBrandText: visibleText,
      visibleSatelliteCount: satelliteCountText ? Number(satelliteCountText.replace(/,/g, "")) : null,
      featurePage: featureShell ? featureShell.getAttribute("aria-label") || window.location.pathname : null,
      assistantPanelOpen: Boolean(document.getElementById("spaceman-assistant-panel")?.classList.contains("open")),
      runtimeMovingPointCount: movingPointCount,
      timestamp: new Date().toISOString()
    };
  }

  async function requestAssistantReply(conversationId, modelSettings, onDelta = null) {
    const conversation = loadConversations().find((item) => item.id === conversationId);
    const messages = (conversation?.messages || []).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.text || ""
    }));

    const response = await fetch("/local-api/spaceman-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: selectedModelForApi(modelSettings),
        messages,
        clientContext: collectSpacemanClientContext(),
        stream: Boolean(onDelta)
      })
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return readAssistantStream(response, onDelta);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      if (data && data.configured === false) {
        throw new Error("Model service is not configured. Set SPACEMAN_AI_API_KEY on the local server.");
      }
      throw new Error(data?.error || `Model request failed HTTP ${response.status}`);
    }
    return data;
  }

  async function readAssistantStream(response, onDelta) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    let model = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const lines = part.split("\n").filter((line) => line.startsWith("data:"));
        for (const line of lines) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          const event = JSON.parse(raw);
          if (event.type === "delta") {
            reply += event.delta || "";
            if (onDelta) onDelta(event.delta || "");
          } else if (event.type === "done") {
            model = event.model || model;
          } else if (event.type === "error") {
            throw new Error(event.error || "Model stream failed");
          }
        }
      }
    }

    return { success: true, reply, model };
  }

  function renderMarkdown(markdown) {
    const source = String(markdown || "");
    const blocks = [];
    let html = escapeHTML(source).replace(/```([\s\S]*?)```/g, (_, code) => {
      const id = blocks.length;
      blocks.push(`<pre><code>${code.replace(/^\n|\n$/g, "")}</code></pre>`);
      return `\u0000CODE${id}\u0000`;
    });

    html = html
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n][\s\S]*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, `<a href="$2" target="_blank" rel="noreferrer">$1</a>`);

    const lines = html.split(/\n/);
    const out = [];
    let listOpen = false;
    for (const line of lines) {
      if (/^\u0000CODE\d+\u0000$/.test(line)) {
        if (listOpen) {
          out.push("</ul>");
          listOpen = false;
        }
        out.push(line);
        continue;
      }
      const item = line.match(/^\s*[-*]\s+(.+)$/);
      if (item) {
        if (!listOpen) {
          out.push("<ul>");
          listOpen = true;
        }
        out.push(`<li>${item[1]}</li>`);
        continue;
      }
      if (listOpen) {
        out.push("</ul>");
        listOpen = false;
      }
      if (!line.trim()) {
        out.push("");
      } else if (/^#{1,3}\s+/.test(line)) {
        const level = Math.min(3, line.match(/^#+/)[0].length);
        out.push(`<h${level}>${line.replace(/^#{1,3}\s+/, "")}</h${level}>`);
      } else {
        out.push(`<p>${line}</p>`);
      }
    }
    if (listOpen) out.push("</ul>");

    return out.join("").replace(/\u0000CODE(\d+)\u0000/g, (_, id) => blocks[Number(id)] || "");
  }

  function formatRelativeTime(timestamp) {
    const diff = Math.max(0, Date.now() - Number(timestamp || 0));
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return "now";
    if (diff < hour) return `${Math.floor(diff / minute)}m`;
    if (diff < day) return `${Math.floor(diff / hour)}h`;
    return `${Math.floor(diff / day)}d`;
  }

  function renderAttachments(container, attachments) {
    if (!container) return;
    container.innerHTML = "";
    if (!attachments.length) {
      container.style.display = "none";
      return;
    }
    container.style.display = "";
    for (const file of attachments) {
      const chip = document.createElement("span");
      chip.className = "spaceman-attachment-chip";
      chip.textContent = `${file.name} ${formatBytes(file.size)}`;
      container.appendChild(chip);
    }
  }

  function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  function runCommand(command, refs) {
    const { input, contextBtn, modelBtn, approvalBtn } = refs;
    const commandText = {
      review: "/review ",
      feedback: "/feedback ",
      goal: "/goal ",
      status: "/status",
      imagegen: "/imagegen ",
      openaidocs: "/docs ",
    };
    if (command === "context" || command === "auto-context") {
      contextBtn.click();
      appendSystemMessage(`IDE context ${contextBtn.classList.contains("active") ? "enabled" : "disabled"}.`);
      return;
    }
    if (command === "cloud") {
      appendSystemMessage("Cloud mode selected. This web prototype cannot start a real Codex cloud task without a backend API.");
      return;
    }
    if (command === "cloud-environment") {
      appendStatusCard("Cloud environment", [
        ["Mode", "Browser prototype"],
        ["Workspace", "D:\\Courses\\Competition\\C4\\starlink-local"],
        ["Backend", "Not connected"],
      ]);
      return;
    }
    if (command === "local") {
      appendStatusCard("Local mode", [
        ["Access", approvalBtn.querySelector("span").textContent],
        ["Files", "User-selected attachments only"],
        ["Commands", "Requires local backend bridge"],
      ]);
      return;
    }
    if (command === "model" || command === "reasoning") {
      modelBtn.click();
      return;
    }
    if (command === "review") {
      appendSystemMessage("Code review mode is ready. Attach a diff/file or connect a local backend to review unstaged changes.");
      input.value = "/review ";
      input.focus();
      return;
    }
    if (command === "feedback") {
      appendSystemMessage("Feedback mode is ready. Type feedback and press Enter to save it in this local chat history.");
      input.value = "/feedback ";
      input.focus();
      return;
    }
    if (command === "status") {
      appendLiveStatusCard({
        contextEnabled: contextBtn.classList.contains("active"),
        model: modelBtn.querySelector("span").textContent,
        approval: approvalBtn.querySelector("span").textContent,
      });
      return;
    }
    if (command === "plan") {
      input.value = "/plan ";
      input.focus();
      return;
    }
    input.value = commandText[command] || `/${command} `;
    input.focus();
  }

  function appendSystemMessage(text) {
    appendMessage("assistant", "Codex", text);
  }

  function appendStatusCard(title, rows) {
    const body = document.getElementById("spaceman-assistant-body");
    if (!body) return;
    const card = document.createElement("div");
    card.className = "spaceman-status-card";
    card.innerHTML = `<div class="spaceman-status-title"></div><div class="spaceman-status-rows"></div>`;
    card.children[0].textContent = title;
    const rowHost = card.children[1];
    rows.forEach(([key, value]) => {
      const row = document.createElement("div");
      row.innerHTML = "<span></span><strong></strong>";
      row.children[0].textContent = key;
      row.children[1].textContent = value;
      rowHost.appendChild(row);
    });
    body.appendChild(card);
    body.scrollTop = body.scrollHeight;
  }

  async function appendLiveStatusCard(options = {}) {
    try {
      const response = await fetch("/local-api/spaceman-status", { cache: "no-store" });
      const payload = await response.json();
      const status = payload.data || {};
      const constellation = status.constellation || {};
      const layers = Array.isArray(constellation.layers) ? constellation.layers : [];
      appendStatusCard("SPACEMAN status", [
        ["Satellites", String(constellation.totalSatellites ?? "Unknown")],
        ["Shells", layers.map((layer) => `${layer.name}: ${layer.total}`).join(" / ") || "Unknown"],
        ["Data", status.dataSource?.metadataFile || "Unknown"],
        ["TLE", status.dataSource?.tleFile || "Unknown"],
        ["Model", options.model || "Unknown"],
        ["Context", options.contextEnabled ? "On" : "Off"],
        ["Approval", options.approval || "Unknown"],
      ]);
    } catch (error) {
      appendStatusCard("SPACEMAN status", [
        ["Error", String(error?.message || error)],
        ["Model", options.model || "Unknown"],
        ["Context", options.contextEnabled ? "On" : "Off"],
      ]);
    }
  }

  function drawColorField(canvas) {
    if (!canvas || canvas.dataset.drawn === "1") return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const hue = ctx.createLinearGradient(0, 0, width, 0);
    hue.addColorStop(0, "#000000");
    hue.addColorStop(.14, "#4c1d95");
    hue.addColorStop(.28, "#2563eb");
    hue.addColorStop(.42, "#0891b2");
    hue.addColorStop(.56, "#10a37f");
    hue.addColorStop(.70, "#eab308");
    hue.addColorStop(.84, "#dc2626");
    hue.addColorStop(1, "#ffffff");
    ctx.fillStyle = hue;
    ctx.fillRect(0, 0, width, height);

    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, "rgba(255,255,255,.62)");
    shade.addColorStop(.48, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,.78)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    canvas.dataset.drawn = "1";
  }

  function pickPanelColor(event, panel, field, canvas, thumb, getAlpha, setColor) {
    drawColorField(canvas);
    const rect = field.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height - 1, event.clientY - rect.top));
    const canvasX = Math.max(0, Math.min(canvas.width - 1, Math.floor(x / rect.width * canvas.width)));
    const canvasY = Math.max(0, Math.min(canvas.height - 1, Math.floor(y / rect.height * canvas.height)));
    const pixel = canvas.getContext("2d").getImageData(canvasX, canvasY, 1, 1).data;
    const rgb = { r: pixel[0], g: pixel[1], b: pixel[2] };
    setColor(rgb);
    positionColorThumb(thumb, x, y);
    applyPanelColor(panel, rgb, getAlpha());
  }

  function positionColorThumb(thumb, x, y) {
    if (!thumb) return;
    thumb.style.left = `${x}px`;
    thumb.style.top = `${y}px`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function appendMessage(kind, role, text) {
    const body = document.getElementById("spaceman-assistant-body");
    if (!body) return;
    const el = document.createElement("div");
    el.className = `spaceman-assistant-message ${kind}`;
    el.innerHTML = `<span class="spaceman-assistant-role"></span><span></span>`;
    el.children[0].textContent = role;
    el.children[1].textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  function openAssistant() {
    hideDropdown("dropdownSpacemanFunctions");
    const panel = buildPanel();
    panel.classList.add("open");
    const placeholder = document.getElementById("spaceman-placeholder-page");
    if (placeholder) placeholder.remove();
    keepChineseNav();
    return false;
  }

  function wireMenu() {
    keepChineseNav();
    const assistantLinks = document.querySelectorAll("[data-spaceman-action='assistant']");
    assistantLinks.forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = "1";
      el.addEventListener("click", (event) => {
        event.preventDefault();
        if (typeof window.closeMobileMenu === "function") window.closeMobileMenu();
        openAssistant();
      });
    });

    document.querySelectorAll("[data-spaceman-route]").forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = "1";
      el.addEventListener("click", (event) => {
        event.preventDefault();
        if (typeof window.closeMobileMenu === "function") window.closeMobileMenu();
        navigatePlaceholder(el.getAttribute("data-spaceman-route"));
      });
    });
  }

  window.openSpacemanAssistant = openAssistant;
  window.navigateSpacemanFeature = navigatePlaceholder;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireMenu);
  } else {
    wireMenu();
  }
  window.addEventListener("popstate", () => {
    keepChineseNav();
    ensurePlaceholder(window.location.pathname);
  });
  setInterval(keepChineseNav, 1500);
})();


