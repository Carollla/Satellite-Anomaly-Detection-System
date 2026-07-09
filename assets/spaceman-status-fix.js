(function () {
  const status = {
    total: 450,
    active: 450,
    planned: 450,
    decayed: 0,
    layers: [
      ["LEO \u58f3\u5c42 A", "Walker Delta 300/20/1", 300, "550 km", "53\u00b0", "#38bdf8"],
      ["LEO \u58f3\u5c42 B", "Walker Star 120/10/0", 120, "530 km", "97.6\u00b0", "#34d399"],
      ["MEO \u9aa8\u5e72\u5c42", "Walker Delta 24/3/1", 24, "21500 km", "55\u00b0", "#a78bfa"],
      ["GEO \u7b97\u529b\u5c42", "\u8d64\u9053\u9759\u6b62\u8f68\u9053 6/1/0", 6, "35786 km", "0\u00b0", "#fbbf24"]
    ]
  };

  const replacements = [
    [/\bstarlink\b/gi, "SPACEMAN"],
    [/\bSpaceX\b/g, "SPACEMAN"],
    [/satellitemap\.space/gi, "SPACEMAN"],
    [/Current View/g, "\u5f53\u524d\u89c6\u56fe"],
    [/Current Status/g, "\u5f53\u524d\u72b6\u6001"],
    [/First Launched/g, "\u9996\u6b21\u751f\u6210"],
    [/Planned Size/g, "\u89c4\u5212\u89c4\u6a21"],
    [/Total Launched/g, "\u536b\u661f\u603b\u6570"],
    [/Active Satellites/g, "\u6d3b\u8dc3\u536b\u661f"],
    [/Decayed/g, "\u5df2\u8870\u51cf"],
    [/Hardware Types/g, "\u8f68\u9053\u5c42"],
    [/Last Launch/g, "\u6700\u540e\u66f4\u65b0"],
    [/View in visualizer\s*.*/g, "\u67e5\u770b\u4e3b\u89c6\u56fe"],
    [/Orbital Occupancy/g, "\u8f68\u9053\u58f3\u5c42\u5360\u7528"],
    [/Orbital maneuvers\s*.*/g, "\u8f68\u9053\u673a\u52a8"],
    [/Frequently Asked Questions/g, "\u5e38\u89c1\u95ee\u9898"],
    [/Largest Constellations/g, "\u661f\u5ea7\u6570\u636e"],
    [/Pictures/g, "\u56fe\u7247"],
    [/Loading 3D Globe\.\.\./g, "\u6b63\u5728\u52a0\u8f7d 3D \u5730\u7403..."],
    [/People/g, "\u4eba\u5458"],
    [/Satellite News/g, "\u536b\u661f\u65b0\u95fb"],
    [/News/g, "\u65b0\u95fb"],
    [/Visualizer/g, "\u53ef\u89c6\u5316"],
    [/Load/g, "\u52a0\u8f7d"],
    [/Functions/g, "\u529f\u80fd"],
    [/More/g, "\u66f4\u591a"],
    [/Share/g, "\u5206\u4eab"],
    [/Settings/g, "\u8bbe\u7f6e"],
    [/Info/g, "\u4fe1\u606f"],
    [/Feedback/g, "\u53cd\u9988"],
    [/Credits/g, "\u81f4\u8c22"],
    [/Operator:/g, "\u8fd0\u8425\u65b9:"],
    [/Country:/g, "\u56fd\u5bb6/\u5730\u533a:"],
    [/deploying/g, "\u8fd0\u884c\u4e2d"]
  ];

  function normalize(value) {
    let text = String(value || "")
      .replace(/\b10,?763\b/g, "450")
      .replace(/\b12,?397\b/g, "450")
      .replace(/\b42,?000\b/g, "450")
      .replace(/\b1,?634\b/g, "0")
      .replace(/\u9234\?/g, "\u2192")
      .replace(/\u9234/g, "\u2192")
      .replace(/\ufffd/g, "");
    for (const [pattern, replacement] of replacements) {
      text = text.replace(pattern, replacement);
    }
    return text;
  }

  function patchText(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script, style, textarea, input, iframe")) return NodeFilter.FILTER_REJECT;
        return normalize(node.nodeValue) !== node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) node.nodeValue = normalize(node.nodeValue);
  }

  function findCard(titlePattern) {
    return [...document.querySelectorAll(".sat-card")].find((card) => {
      const heading = card.querySelector("h1,h2,h3,.sat-section-title");
      return heading && titlePattern.test(heading.textContent || "");
    });
  }

  function setRow(card, match, label, value, className) {
    const row = [...card.querySelectorAll(".sat-data-row")].find((item) => match.test(item.textContent || ""));
    if (!row) return;
    const spans = row.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = label;
    if (spans[1]) {
      spans[1].textContent = value;
      spans[1].className = className || "text-white";
    }
  }

  function patchStatusCard() {
    const card = findCard(/Current Status|\u5f53\u524d\u72b6\u6001/i);
    if (!card) return;
    const heading = card.querySelector("h2,h3,.sat-section-title");
    if (heading) heading.textContent = "\u5f53\u524d\u72b6\u6001";
    setRow(card, /First Launched|\u9996\u6b21\u751f\u6210/i, "\u9996\u6b21\u751f\u6210", "\u672c\u5730\u5408\u6210\u6570\u636e");
    setRow(card, /Planned Size|\u89c4\u5212\u89c4\u6a21/i, "\u89c4\u5212\u89c4\u6a21", String(status.planned));
    setRow(card, /Total Launched|\u536b\u661f\u603b\u6570/i, "\u536b\u661f\u603b\u6570", String(status.total));
    setRow(card, /Active Satellites|\u6d3b\u8dc3\u536b\u661f/i, "\u6d3b\u8dc3\u536b\u661f", String(status.active), "text-green-400");
    setRow(card, /Decayed|\u5df2\u8870\u51cf/i, "\u5df2\u8870\u51cf", String(status.decayed), "text-red-400");
    setRow(card, /Hardware Types|\u8f68\u9053\u5c42/i, "\u8f68\u9053\u5c42", status.layers.map((layer) => layer[0]).join(", "), "text-white text-sm");
    setRow(card, /Last Launch|\u6700\u540e\u66f4\u65b0/i, "\u6700\u540e\u66f4\u65b0", "2026-07-08");

    let layerPanel = card.querySelector("[data-spaceman-layer-panel]");
    if (!layerPanel) {
      layerPanel = document.createElement("div");
      layerPanel.dataset.spacemanLayerPanel = "1";
      layerPanel.className = "mt-4 pt-4 border-t border-gray-700 space-y-3";
      card.appendChild(layerPanel);
    }
    layerPanel.innerHTML = status.layers.map((layer) => {
      const width = Math.max(2, Math.round((layer[2] / status.total) * 100));
      return `
        <div class="space-y-1">
          <div class="flex items-center justify-between gap-3 text-sm">
            <span class="text-gray-200">${layer[0]}</span>
            <span class="font-mono text-white">${layer[2]}</span>
          </div>
          <div class="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div class="h-full rounded-full" style="width:${width}%;background:${layer[5]};opacity:.86"></div>
          </div>
          <div class="text-xs text-gray-500">${layer[1]} · ${layer[3]} · ${layer[4]}</div>
        </div>`;
    }).join("");
  }

  function patchConstellationCard() {
    const card = findCard(/Largest Constellations|\u661f\u5ea7\u6570\u636e/i);
    if (!card) return;
    const heading = card.querySelector("h2,h3,.sat-section-title");
    if (heading) heading.textContent = "\u661f\u5ea7\u6570\u636e";
    const list = card.querySelector("#constellations-list") || card.querySelector(".space-y-0");
    if (!list || list.dataset.spacemanReady === "1") return;
    list.dataset.spacemanReady = "1";
    list.innerHTML = `
      <div class="flex items-center justify-between py-2 border-b border-gray-800">
        <span class="text-gray-200">SPACEMAN</span>
        <span class="font-mono text-white">${status.total}</span>
      </div>
      ${status.layers.map((layer) => `
        <div class="flex items-center justify-between py-2 border-b border-gray-800/70">
          <span class="text-gray-400">${layer[0]}</span>
          <span class="font-mono text-gray-200">${layer[2]}</span>
        </div>
      `).join("")}`;
  }

  function patchShellChart() {
    const container = document.getElementById("orbital-shells-mini");
    if (!container || container.dataset.spacemanReady === "1") return;
    container.dataset.spacemanReady = "1";
    container.innerHTML = "";
    const max = Math.max(...status.layers.map((layer) => layer[2]));
    for (const layer of status.layers) {
      const outer = document.createElement("div");
      outer.style.cssText = "flex:1;min-width:0;height:100%;display:flex;align-items:flex-end";
      outer.title = `${layer[0]} · ${layer[1]} · ${layer[3]} · ${layer[4]}`;
      const bar = document.createElement("div");
      bar.style.cssText = `width:100%;height:${Math.max(6, (layer[2] / max) * 100)}%;border-radius:3px 3px 0 0;background:${layer[5]};opacity:.82`;
      outer.appendChild(bar);
      container.appendChild(outer);
    }
    const title = document.getElementById("orbital-shells-title");
    if (title) title.textContent = "\u8f68\u9053\u58f3\u5c42\u5360\u7528";
    const label = document.getElementById("orbital-shells-label");
    if (label) label.textContent = status.layers.map((layer) => `${layer[0]} ${layer[2]} \u9897`).join(" · ");
  }

  function patchMainVisualizer() {
    const container = document.getElementById("blueglobe-container");
    if (!container || container.dataset.spacemanPreviewReady === "1") return;
    container.dataset.spacemanPreviewReady = "1";
    container.classList.remove("aspect-video");
    container.style.height = "min(58vh, 640px)";
    container.style.minHeight = "420px";
    container.style.position = "relative";
    container.style.overflow = "hidden";
    container.style.background = "#000";
    container.innerHTML = `
      <iframe
        id="spaceman-current-view-frame"
        title="SPACEMAN \u4e09\u7ef4\u661f\u5ea7\u9884\u89c8"
        src="/?spaceman-preview=1"
        tabindex="0"
        style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;display:block;pointer-events:auto"
        loading="eager"
      ></iframe>`;

    const titleLink = document.querySelector("a.sat-section-link[href*='/constellation/starlink/live']");
    if (titleLink) {
      const h2 = titleLink.closest("h2");
      if (h2) h2.textContent = "\u5f53\u524d\u89c6\u56fe";
    }

    const frame = container.querySelector("#spaceman-current-view-frame");
    const focusFrame = () => {
      try {
        frame?.focus();
        frame?.contentWindow?.focus();
      } catch (_) {
        // Same-origin focus can fail while the iframe is still loading.
      }
    };
    container.addEventListener("mouseenter", focusFrame);
    container.addEventListener("pointerdown", focusFrame);
    container.addEventListener("wheel", (event) => {
      focusFrame();
      try {
        frame?.contentWindow?.postMessage({
          type: "SPACEMAN_PREVIEW_WHEEL",
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY
        }, window.location.origin);
        event.preventDefault();
      } catch (_) {
        // If forwarding fails, keep the native iframe wheel behavior.
      }
    }, { passive: false });

    patchMainViewLink();
  }

  function patchMainViewLink() {
    const currentCard = document.getElementById("blueglobe-container")?.closest(".sat-card");
    const links = currentCard ? [...currentCard.querySelectorAll("a")] : [];
    const mainLink = links.find((link) => /View in visualizer|\u67e5\u770b\u4e3b\u89c6\u56fe/i.test(link.textContent || ""))
      || [...document.querySelectorAll("a[href*='/vis/constellation/starlink']")].find((link) => /View in visualizer|\u67e5\u770b\u4e3b\u89c6\u56fe/i.test(link.textContent || ""));
    if (!mainLink || mainLink.dataset.spacemanMainViewReady === "1") return;
    mainLink.dataset.spacemanMainViewReady = "1";
    mainLink.href = "/";
    mainLink.textContent = "\u67e5\u770b\u4e3b\u89c6\u56fe";
    mainLink.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.assign("/");
    });
  }

  function patchHeader() {
    document.title = "SPACEMAN \u661f\u5ea7\u72b6\u6001";
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = "SPACEMAN";
    if (h1) {
      const identityBlock = h1.closest(".space-y-2");
      const metaLine = identityBlock?.querySelector(".flex.flex-wrap.items-center");
      if (metaLine) {
        metaLine.innerHTML = "";
        metaLine.style.display = "none";
      }
    }
    const summary = [...document.querySelectorAll("p")].find((p) => /currently|SPACEMAN|\u5f53\u524d/.test(p.textContent || ""));
    if (summary) {
      summary.innerHTML = `\u5f53\u524d SPACEMAN \u661f\u5ea7\u5171\u6709 <strong class="text-gray-200">${status.active} \u9897\u6d3b\u8dc3\u536b\u661f</strong>\uff0c\u7531 LEO \u58f3\u5c42 A\u3001LEO \u58f3\u5c42 B\u3001MEO \u9aa8\u5e72\u5c42\u548c GEO \u7b97\u529b\u5c42\u7ec4\u6210\u3002`;
    }
  }

  function run() {
    patchHeader();
    patchMainVisualizer();
    patchStatusCard();
    patchConstellationCard();
    patchShellChart();
    patchMainViewLink();
    patchText(document.body);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  window.setInterval(run, 1200);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) patchText(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
