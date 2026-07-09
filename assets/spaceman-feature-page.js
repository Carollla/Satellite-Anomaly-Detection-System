(function () {
  const chineseLabels = {
    people: "\u4eba\u5458",
    news: "\u65b0\u95fb",
    currentNews: "\u6700\u65b0\u65b0\u95fb",
    liveVideo: "\u76f4\u64ad\u89c6\u9891",
    load: "\u52a0\u8f7d",
    functions: "\u529f\u80fd",
    constellationData: "\u661f\u5ea7\u6570\u636e",
    growth: "\u589e\u957f",
    launches: "\u53d1\u5c04",
    decays: "\u518d\u5165",
    orbits: "\u8f68\u9053\u58f3\u5c42",
    activity: "\u6d3b\u52a8",
    groundStations: "\u5730\u9762\u7ad9",
    sim: "\u6a21\u62df",
    clear: "\u6e05\u9664",
    clearReset: "\u6e05\u9664/\u91cd\u7f6e",
    exportCSV: "\u5bfc\u51fa CSV",
    calculators: "\u8ba1\u7b97\u5de5\u5177",
    reEntries: "\u518d\u5165\u5927\u6c14\u5c42",
    transitFinder: "\u8fc7\u5883\u67e5\u627e",
    tleCalculator: "TLE \u5206\u6790",
    photoBombSim: "\u7167\u7247\u6a21\u62df\u5668",
    closeApproaches: "\u8fd1\u8ddd\u79bb\u63a5\u8fd1",
    more: "\u66f4\u591a",
    settings: "\u8bbe\u7f6e",
    info: "\u4fe1\u606f / \u66f4\u65b0",
    feedback: "\u53cd\u9988",
    credits: "\u81f4\u8c22",
    spaceTrackStatus: "Space-Track \u72b6\u6001",
    share: "\u5206\u4eab"
  };

  function setText(selector, text) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  }

  function applyChineseNav() {
    document.querySelectorAll("[data-translate]").forEach((el) => {
      const key = el.getAttribute("data-translate");
      if (chineseLabels[key]) el.textContent = chineseLabels[key];
    });
    setText("#spaceman-functions-label", "\u529f\u80fd");
    setText("#spaceman-mobile-functions-label", "\u529f\u80fd");
    setText("#spaceman-assistant-menu-label", "\u667a\u80fd\u52a9\u624b");
    setText("#spaceman-editor-menu-label", "\u661f\u5ea7\u7f16\u8f91\u5668");
    setText("#spaceman-fault-menu-label", "\u6545\u969c\u6ce8\u5165");
    setText("#spaceman-audit-menu-label", "\u5b89\u5168\u5ba1\u8ba1");
    setText("#spaceman-model-menu-label", "\u6a21\u578b\u914d\u7f6e");
  }

  function closeDropdowns(except) {
    document.querySelectorAll(".navbar-dropdown-menu[data-spaceman-open='1']").forEach((menu) => {
      if (menu !== except) {
        menu.dataset.spacemanOpen = "0";
        menu.style.display = "";
      }
    });
  }

  function wireDropdowns() {
    document.querySelectorAll("[data-dropdown-toggle]").forEach((button) => {
      if (button.dataset.spacemanFeatureBound) return;
      button.dataset.spacemanFeatureBound = "1";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = document.getElementById(button.getAttribute("data-dropdown-toggle"));
        if (!target) return;
        const shouldOpen = target.dataset.spacemanOpen !== "1";
        closeDropdowns(target);
        target.dataset.spacemanOpen = shouldOpen ? "1" : "0";
        target.style.display = shouldOpen ? "block" : "";
      });
    });
    document.addEventListener("click", () => closeDropdowns());
  }

  function toggleSection(id) {
    const section = document.getElementById(id);
    if (section) section.classList.toggle("hidden");
  }

  function wireMobileMenu() {
    const toggle = document.getElementById("mobile-menu-toggle");
    const menu = document.getElementById("mobile-menu");
    const overlay = document.getElementById("mobile-menu-overlay");
    window.closeMobileMenu = function closeMobileMenu() {
      if (menu) menu.classList.add("-translate-x-full");
      if (overlay) overlay.classList.add("opacity-0", "pointer-events-none");
      document.body.style.overflow = "";
    };
    if (toggle && menu && overlay && !toggle.dataset.spacemanFeatureBound) {
      toggle.dataset.spacemanFeatureBound = "1";
      toggle.addEventListener("click", () => {
        menu.classList.remove("-translate-x-full");
        overlay.classList.remove("opacity-0", "pointer-events-none");
        document.body.style.overflow = "hidden";
      });
      overlay.addEventListener("click", window.closeMobileMenu);
    }

    [
      ["mobile-news-toggle", "mobile-news-menu"],
      ["mobile-constellations-toggle", "mobile-constellations-menu"],
      ["mobile-functions-toggle", "mobile-functions-menu"],
      ["mobile-constellation-data-toggle", "mobile-constellation-data-menu"],
      ["mobile-sim-toggle", "mobile-sim-menu"],
      ["mobile-calculators-toggle", "mobile-calculators-menu"],
      ["mobile-apps-toggle", "mobile-apps-menu"],
      ["mobile-spaceman-functions-toggle", "mobile-spaceman-functions-menu"],
      ["mobile-more-toggle", "mobile-more-menu"]
    ].forEach(([buttonId, sectionId]) => {
      const button = document.getElementById(buttonId);
      if (!button || button.dataset.spacemanFeatureBound) return;
      button.dataset.spacemanFeatureBound = "1";
      button.addEventListener("click", () => toggleSection(sectionId));
    });
  }

  function installSafeGlobals() {
    window.menuAction = window.menuAction || function menuAction(action) {
      if (typeof action === "function") action();
      return false;
    };
    window.openTimelineChart = window.openTimelineChart || function openTimelineChart() {
      return false;
    };
    window.triggerShare = window.triggerShare || function triggerShare() {
      window.location.href = "/";
      return false;
    };
  }

  function wireAssistantLinks() {
    document.querySelectorAll("[data-spaceman-action='assistant']").forEach((link) => {
      if (link.dataset.spacemanFeatureAssistantBound) return;
      link.dataset.spacemanFeatureAssistantBound = "1";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        closeDropdowns();
        if (typeof window.closeMobileMenu === "function") window.closeMobileMenu();
        if (typeof window.openSpacemanAssistant === "function") window.openSpacemanAssistant();
      });
    });
  }

  async function loadHomeNav() {
    document.body.style.opacity = "1";
    const host = document.getElementById("spaceman-nav-host");
    if (!host) return;
    if (host.querySelector("nav")) {
      applyChineseNav();
      installSafeGlobals();
      wireDropdowns();
      wireMobileMenu();
      wireAssistantLinks();
      window.setInterval(applyChineseNav, 500);
      return;
    }
    const response = await fetch("/", { cache: "no-store" });
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nav = doc.querySelector("nav");
    const overlay = doc.getElementById("mobile-menu-overlay");
    const mobileMenu = doc.getElementById("mobile-menu");
    host.replaceChildren();
    if (nav) host.appendChild(nav);
    if (overlay) host.appendChild(overlay);
    if (mobileMenu) host.appendChild(mobileMenu);
    applyChineseNav();
    installSafeGlobals();
    wireDropdowns();
    wireMobileMenu();
    wireAssistantLinks();
    window.setInterval(applyChineseNav, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadHomeNav);
  } else {
    loadHomeNav();
  }
})();
