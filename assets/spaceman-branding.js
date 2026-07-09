(function () {
  const STATUS_URL = "/spaceman-status";

  function normalizeText(value) {
    return String(value || "")
      .replace(/View full\s+starlink\s+page(?:\s*[^\w\s]*)?/gi, "View full SPACEMAN status ->")
      .replace(/You're on Starlink!/gi, "SPACEMAN")
      .replace(/\bstarlink\b/gi, "SPACEMAN");
  }

  function patchTextNode(node) {
    const next = normalizeText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function patchLinks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("a[href='/about'], a[data-route='/about']").forEach((link) => {
      const text = (link.textContent || "").trim();
      if (/satellitemap|SPACEMAN/i.test(text)) {
        link.setAttribute("href", "/");
        link.setAttribute("data-route", "/");
        link.onclick = null;
      }
    });
    scope.querySelectorAll("a[href='/constellation/starlink'], a[href='/vis/constellation/starlink'], a[href='/constellation/starlink/live']").forEach((link) => {
      if (/full|瀹屾暣|Starlink|SPACEMAN/i.test(link.textContent || "")) {
        link.setAttribute("href", STATUS_URL);
        link.textContent = "View full SPACEMAN status ->";
      }
    });
  }

  function ensureUnifiedNavCss() {
    if (document.querySelector("link[href='/assets/spaceman-nav-unifier.css']")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/spaceman-nav-unifier.css";
    document.head.appendChild(link);
  }

  function markUnifiedNav(nav) {
    if (!nav) return;
    nav.classList.add("spaceman-unified-nav");
  }

  function closeUnifiedDropdowns(except) {
    document.querySelectorAll(".navbar-dropdown-menu[data-spaceman-open='1']").forEach((menu) => {
      if (menu === except) return;
      menu.dataset.spacemanOpen = "0";
      menu.style.display = "";
    });
  }

  function wireUnifiedNavInteractions(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-dropdown-toggle]").forEach((button) => {
      if (button.__spacemanUnifiedDropdownBound) return;
      button.__spacemanUnifiedDropdownBound = true;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = document.getElementById(button.getAttribute("data-dropdown-toggle"));
        if (!menu) return;
        const open = menu.dataset.spacemanOpen !== "1";
        closeUnifiedDropdowns(menu);
        menu.dataset.spacemanOpen = open ? "1" : "0";
        menu.style.display = open ? "block" : "";
      });
    });

    const assistantLinks = scope.querySelectorAll("[data-spaceman-action='assistant']");
    assistantLinks.forEach((link) => {
      if (link.__spacemanUnifiedAssistantBound) return;
      link.__spacemanUnifiedAssistantBound = true;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeUnifiedDropdowns();
        if (typeof window.openSpacemanAssistant === "function") window.openSpacemanAssistant();
      }, true);
    });
  }

  async function syncUnifiedNav() {
    ensureUnifiedNavCss();
    markUnifiedNav(document.querySelector("nav"));
    wireUnifiedNavInteractions(document);
    if (location.pathname.replace(/\/$/, "") === "") return;
    if (location.pathname.replace(/\/$/, "") === "/") return;
    if (document.documentElement.dataset.spacemanNavSynced === "1") return;
    document.documentElement.dataset.spacemanNavSynced = "1";
    try {
      const response = await fetch("/", { cache: "no-store" });
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const homeNav = doc.querySelector("nav");
      if (!homeNav) return;
      markUnifiedNav(homeNav);
      const currentNav = document.querySelector("nav");
      if (currentNav) {
        currentNav.replaceWith(homeNav);
      } else {
        document.body.prepend(homeNav);
      }
      wireUnifiedNavInteractions(homeNav);
      patch(homeNav);
    } catch (error) {
      console.warn("SPACEMAN nav sync skipped:", error);
    }
  }

  function wireFeatureNavigation(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("a[href='/security-audit'], a[data-spaceman-route='/security-audit']").forEach((link) => {
      if (link.__spacemanSecurityNavBound) return;
      link.__spacemanSecurityNavBound = true;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign(`/security-audit?spaceman_nav=${Date.now()}`);
      }, true);
    });
  }

  function patchSpecificElements(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("a[href='/'], a[data-route='/']").forEach((link) => {
      if (/satellitemap/i.test(link.textContent || "")) {
        const label = link.querySelector(".self-center") || link.querySelector("span");
        if (label) label.textContent = "SPACEMAN";
      }
    });

    scope.querySelectorAll("#lv_info .draggable-title, #starlink-welcome, #starlink-welcome *").forEach((el) => {
      if (el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE) {
        el.textContent = normalizeText(el.textContent);
      }
    });

    scope.querySelectorAll("h3").forEach((el) => {
      if (/^starlink$/i.test((el.textContent || "").trim())) el.textContent = "SPACEMAN";
    });

    const constellationTitle = scope.querySelector(".font-bold.text-xl.text-white");
    if (constellationTitle && /^starlink$/i.test((constellationTitle.textContent || "").trim())) {
      constellationTitle.textContent = "SPACEMAN";
    }
  }

  function patchVisibleText(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, textarea, input")) return NodeFilter.FILTER_REJECT;
        if (!/starlink|View full/i.test(node.nodeValue || "")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(patchTextNode);
  }

  function patch(root) {
    patchSpecificElements(root);
    patchLinks(root);
    wireFeatureNavigation(root);
    patchVisibleText(root);
  }

  function start() {
    syncUnifiedNav();
    patch(document);
    document.addEventListener("click", () => closeUnifiedDropdowns());
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) patch(node);
          if (node.nodeType === Node.TEXT_NODE) patchTextNode(node);
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setInterval(() => patch(document), 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

