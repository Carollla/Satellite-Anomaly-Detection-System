(function () {
  const status = {
    total: 450,
    active: 450,
    layers: [
      ["LEO 壳层 A", "Walker Delta 300/20/1", "300", "550 km", "53°"],
      ["LEO 壳层 B", "Walker Star 120/10/0", "120", "530 km", "97.6°"],
      ["MEO 骨干层", "Walker Delta 24/3/1", "24", "21500 km", "55°"],
      ["GEO 算力层", "赤道静止轨道 6/1/0", "6", "35786 km", "0°"]
    ]
  };

  const replacements = new Map([
    ["satellitemap.space", "SPACEMAN"],
    ["People", "人员"],
    ["Satellite News", "卫星新闻"],
    ["News", "新闻"],
    ["Visualizer", "可视化"],
    ["Load", "加载"],
    ["Functions", "功能"],
    ["More", "更多"],
    ["Share", "分享"],
    ["Types", "类型"],
    ["Finder", "星座列表"],
    ["Internet", "卫星任务"],
    ["Communications", "通信"],
    ["Global Positioning", "全球定位"],
    ["Earth Observation", "地球观测"],
    ["Geostationary", "地球静止轨道"],
    ["Geosynchronous", "地球同步轨道"],
    ["All Functional", "全部在轨"],
    ["Debris", "碎片"],
    ["All", "全部"],
    ["Constellation Data", "星座数据"],
    ["To Visualizer", "进入可视化"],
    ["Calculators", "计算工具"],
    ["Apps", "应用"],
    ["Re-Entries", "再入"],
    ["Transit Finder", "过境查询"],
    ["TLE Analysis", "TLE 分析"],
    ["Photo Simulator", "拍摄模拟"],
    ["Close Approaches", "近距离接近"],
    ["Constellations", "星座"],
    ["Historical", "历史"],
    ["Settings", "设置"],
    ["Info & Updates", "信息与更新"],
    ["Feedback", "反馈"],
    ["Credits", "致谢"],
    ["Space-track Status", "Space-Track 状态"],
    ["Find SPACEMAN", "SPACEMAN"],
    ["Operator:", "运营方："],
    ["Country:", "国家/地区："],
    ["LOCAL", "本地"],
    ["active", "运行中"],
    ["Current View", "当前视图"],
    ["Loading 3D Globe...", "正在加载 3D 地球..."],
    ["View in visualizer", "进入三维可视化"],
    ["Orbital Occupancy", "轨道占用"],
    ["Orbital maneuvers", "轨道机动"],
    ["Frequently Asked Questions", "常见问题"],
    ["Largest Constellations", "主要星座"],
    ["Pictures", "图片"],
    ["Launches", "发射"],
    ["Launch History", "发射历史"],
    ["Recent News", "最新消息"],
    ["Active Satellites", "活跃卫星"],
    ["Total Launched", "卫星总数"],
    ["Target Count", "目标数量"],
    ["Decayed", "已衰减"],
    ["Hardware", "轨道层"],
    ["Sample Satellites", "样例卫星"],
    ["Status", "状态"],
    ["Purpose", "用途"],
    ["Satellite Mission / Digital Twin", "卫星任务 / 数字孪生"],
    ["SPACEMAN constellation", "SPACEMAN 星座"]
  ]);

  function normalize(value) {
    let text = String(value || "");
    text = text
      .replace(/鈥\?/g, "·")
      .replace(/鈫\?/g, "→")
      .replace(/â†’/g, "→")
      .replace(/掳/g, "°")
      .replace(/\bstarlink\b/gi, "SPACEMAN")
      .replace(/\bSpaceX\b/g, "SPACEMAN");
    for (const [from, to] of replacements) text = text.split(from).join(to);
    text = text
      .replace(/There are currently\s*[\d,]+\s*active SPACEMAN satellites[^.]*\./i, "当前 SPACEMAN 星座共有 450 颗活跃卫星，由 4 个轨道层组成。")
      .replace(/Operated by SPACEMAN\. First launched[^.]*\./i, "由本地 SPACEMAN 卫星任务平台管理。")
      .replace(/How many SPACEMAN satellites are there\?/i, "SPACEMAN 当前有多少颗卫星？")
      .replace(/How often can you see SPACEMAN satellites\?/i, "SPACEMAN 卫星如何用于仿真展示？")
      .replace(/Can you track SPACEMAN satellites\?/i, "可以跟踪 SPACEMAN 卫星吗？")
      .replace(/Who owns SPACEMAN\?/i, "SPACEMAN 由谁管理？")
      .replace(/There are currently\s*[\d,]+\s*active SPACEMAN satellites in orbit[^.]*\./i, "当前共有 450 颗 SPACEMAN 卫星参与本地轨道可视化。")
      .replace(/SPACEMAN satellites are visible[^.]*\./i, "SPACEMAN 卫星用于展示 LEO、MEO、GEO 多层星座运行效果。")
      .replace(/Yes\. The 3D visualiser tracks every SPACEMAN satellite[^.]*\./i, "可以。三维可视化读取本地 TLE 和星座元数据进行轨道展示。")
      .replace(/SPACEMAN is operated by SPACEMAN[^.]*\./i, "SPACEMAN 由本地卫星任务平台管理，用于星座配置、轨道展示和智能运维。");
    return text;
  }

  function patchText(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script, style, textarea, input")) return NodeFilter.FILTER_REJECT;
        const next = normalize(node.nodeValue);
        return next !== node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      node.nodeValue = normalize(node.nodeValue);
    });
  }

  function setNav() {
    const brand = document.querySelector("nav a[href='/about'] span");
    if (brand) brand.textContent = "SPACEMAN";
    document.querySelectorAll("nav a, nav button, #mobile-menu a, #mobile-menu button").forEach((el) => {
      if (el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE) {
        el.textContent = normalize(el.textContent);
      }
    });

    const desktop = document.querySelector("#navbar-desktop ul");
    if (desktop && !document.getElementById("spaceman-status-functions-item")) {
      const li = document.createElement("li");
      li.id = "spaceman-status-functions-item";
      li.className = "relative flex items-center";
      li.innerHTML = `
        <button class="navbar-dropdown-button" type="button" data-spaceman-status-menu>
          <span>功能</span>
          <svg class="w-2.5 h-2.5 ms-1 text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4"/></svg>
        </button>
        <div class="navbar-dropdown-menu" style="display:none">
          <ul class="navbar-dropdown-list">
            <li><a href="#" data-spaceman-action="assistant" class="navbar-desktop-dropdown-item">智能助手</a></li>
            <li><a href="/fault-injection" class="navbar-desktop-dropdown-item">故障注入</a></li>
            <li><a href="/security-audit" class="navbar-desktop-dropdown-item">安全审计</a></li>
            <li><a href="/model-config" class="navbar-desktop-dropdown-item">模型配置</a></li>
          </ul>
        </div>`;
      desktop.appendChild(li);
      const button = li.querySelector("button");
      const menu = li.querySelector(".navbar-dropdown-menu");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        menu.style.display = menu.style.display === "block" ? "none" : "block";
      });
    }
  }

  function patchContent() {
    document.title = "SPACEMAN 星座状态";
    const h1 = document.querySelector("h1");
    if (h1 && /Find|SPACEMAN/i.test(h1.textContent || "")) h1.textContent = "SPACEMAN";

    const summary = [...document.querySelectorAll("p")].find((p) => /currently|当前 SPACEMAN 星座/.test(p.textContent || ""));
    if (summary) summary.innerHTML = `当前共有 <strong class="text-gray-200">${status.active} 颗活跃 SPACEMAN 卫星</strong>，包含 LEO 壳层 A、LEO 壳层 B、MEO 骨干层和 GEO 算力层。`;

    const title = document.getElementById("orbital-shells-title");
    if (title) title.textContent = "轨道壳层占用";
    const label = document.getElementById("orbital-shells-label");
    if (label) label.textContent = status.layers.map((layer) => `${layer[0]} ${layer[2]} 颗`).join(" · ");

    document.querySelectorAll("a[href*='/vis/constellation/'], a[href*='/constellation/starlink/live']").forEach((a) => {
      if ((a.textContent || "").includes("进入三维可视化") || (a.textContent || "").includes("当前视图")) return;
      if ((a.textContent || "").trim()) a.setAttribute("href", "/");
    });
  }

  function injectShellPanel() {
    const container = document.getElementById("orbital-shells-mini");
    if (!container || container.dataset.spacemanReady) return;
    container.dataset.spacemanReady = "1";
    const max = Math.max(...status.layers.map((layer) => Number(layer[2])));
    container.innerHTML = "";
    status.layers.forEach((layer, index) => {
      const bar = document.createElement("div");
      bar.title = `${layer[0]} · ${layer[1]} · ${layer[3]} · ${layer[4]}`;
      bar.style.cssText = [
        "flex:1",
        `height:${Math.max(8, Number(layer[2]) / max * 100)}%`,
        "align-self:flex-end",
        "border-radius:3px 3px 0 0",
        `background:${["#38bdf8", "#34d399", "#a78bfa", "#fbbf24"][index]}`,
        "opacity:.86"
      ].join(";");
      container.appendChild(bar);
    });
  }

  function injectMainVisualizer() {
    const container = document.getElementById("blueglobe-container");
    if (!container || container.dataset.spacemanVisualizerReady) return;
    container.dataset.spacemanVisualizerReady = "1";
    container.innerHTML = `
      <a
        href="/"
        title="返回 SPACEMAN 三维可视化主页"
        style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;border-radius:.5rem;overflow:hidden"
      >
        <iframe
          title="SPACEMAN 三维可视化"
          src="/"
          tabindex="-1"
          style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;display:block;pointer-events:none;transform:scale(.72);transform-origin:center center"
          loading="eager"
        ></iframe>
        <span style="position:absolute;right:12px;bottom:10px;padding:6px 10px;border-radius:6px;background:rgba(15,23,42,.86);border:1px solid rgba(148,163,184,.35);color:#dbeafe;font-size:12px">打开主视图 →</span>
      </a>
    `;

    document.querySelectorAll("a[href*='/constellation/spaceman/live'], a[href*='/constellation/starlink/live']").forEach((link) => {
      link.setAttribute("href", "/");
    });
  }

  function run() {
    setNav();
    patchContent();
    injectShellPanel();
    injectMainVisualizer();
    patchText(document.body);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          patchText(node);
        }
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(run, 1500);
})();
