(function () {
  const ASSISTANT_SELECTOR = "#spaceman-assistant-panel";

  const translations = {
    people: "人员",
    news: "新闻",
    currentNews: "最新新闻",
    liveVideo: "直播视频",
    load: "加载",
    functions: "功能",
    constellationData: "星座数据",
    growth: "增长",
    launches: "发射",
    decays: "再入",
    orbits: "轨道壳层",
    activity: "活动",
    groundStations: "地面站",
    sim: "模拟",
    simLoad: "加载...",
    simWatchThese: "监视这些...",
    clear: "清除",
    clearReset: "清除/重置",
    exportCSV: "导出 CSV",
    tour: "自动播放",
    calculators: "计算工具",
    reEntries: "再入大气层",
    transitFinder: "过境查找",
    tleCalculator: "TLE 分析",
    photoBombSim: "照片模拟器",
    closeApproaches: "近距离接近",
    more: "更多",
    settings: "设置",
    info: "信息 / 更新",
    feedback: "反馈",
    credits: "致谢",
    spaceTrackStatus: "Space-Track 状态",
    share: "分享",
    welcomeTo: "欢迎来到",
    splashSubtitle: "实时卫星追踪 + 互联网星座",
    "help.desktop": "桌面",
    "help.touch": "触摸",
    "help.rotateGlobe": "旋转地球",
    "help.zoom": "缩放",
    "help.fullscreen": "全屏",
    "help.search": "搜索",
    "help.clickDrag": "点击并拖动",
    "help.mouseWheel": "鼠标滚轮",
    "help.rightDrag": "右键上下拖动",
    "help.longClick": "长按点击",
    "help.spacebar": "空格键",
    "help.touchDrag": "触摸拖动",
    "help.pinch": "双指缩放",
    "help.longTouch": "长按触摸",
    "help.dragExplanation": "窗口可以通过点击或触摸拖动"
  };

  const textReplacements = new Map([
    ["People", "人员"],
    ["News", "新闻"],
    ["Load", "加载"],
    ["Functions", "功能"],
    ["More", "更多"],
    ["Share", "分享"],
    ["Current News", "最新新闻"],
    ["Live Video", "直播视频"],
    ["Constellation Data", "星座数据"],
    ["Growth", "增长"],
    ["Launches", "发射"],
    ["Decays", "再入"],
    ["Orbits", "轨道壳层"],
    ["Activity", "活动"],
    ["Ground Stations", "地面站"],
    ["Sim", "模拟"],
    ["Load...", "加载..."],
    ["Watch These..", "监视这些..."],
    ["Clear", "清除"],
    ["Clear/Reset", "清除/重置"],
    ["Export CSV", "导出 CSV"],
    ["Auto Play", "自动播放"],
    ["Calculators", "计算工具"],
    ["Re-Entries", "再入大气层"],
    ["Transit Finder", "过境查找"],
    ["TLE Analysis", "TLE 分析"],
    ["Photo Simulator", "照片模拟器"],
    ["Close Approaches", "近距离接近"],
    ["Settings", "设置"],
    ["Info / Updates", "信息 / 更新"],
    ["Feedback", "反馈"],
    ["Credits", "致谢"],
    ["Space-track status", "Space-Track 状态"],
    ["Type to search · Enter to select · Escape to close", "输入搜索 · Enter 选择 · Esc 关闭"],
    ["No results found", "未找到结果"],
    ["Close search", "关闭搜索"],
    ["Search...", "搜索卫星、NORAD 编号、星座或天体..."],
    ["View full SPACEMAN status ->", "查看完整 SPACEMAN 状态 →"],
    ["View full Starlink page ->", "查看完整 SPACEMAN 状态 →"],
    ["satellites tracking", "颗卫星正在追踪"],
    ["launched", "已发射"],
    ["in orbit", "在轨"]
  ]);

  function inAssistant(event) {
    const target = event.target;
    return !!(target && target.closest && target.closest(ASSISTANT_SELECTOR));
  }

  function isolateAssistantPanel(panel) {
    if (!panel || panel.__spacemanShortcutIsolation) return;
    panel.__spacemanShortcutIsolation = true;
    const stop = (event) => {
      if (inAssistant(event)) event.stopPropagation();
    };
    ["keydown", "keyup", "keypress", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend"].forEach((type) => {
      panel.addEventListener(type, stop);
    });
  }

  function replaceTextNode(node) {
    let value = node.nodeValue;
    if (!value || !value.trim()) return;
    for (const [from, to] of textReplacements) {
      if (value.includes(from)) value = value.split(from).join(to);
    }
    if (node.nodeValue !== value) node.nodeValue = value;
  }

  function applyTranslateAttributes(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-translate]").forEach((el) => {
      const key = el.getAttribute("data-translate");
      if (translations[key] && el.textContent !== translations[key]) el.textContent = translations[key];
    });
  }

  function replaceVisibleText(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, textarea, input, option, pre, code")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);
  }

  function localizeSpacemanMenu(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const pairs = [
      ["#spaceman-functions-label", "功能"],
      ["#spaceman-mobile-functions-label", "功能"],
      ["#spaceman-assistant-menu-label", "智能助手"],
      ["#spaceman-editor-menu-label", "星座编辑器"],
      ["#spaceman-fault-menu-label", "故障注入"],
      ["#spaceman-audit-menu-label", "安全审计"],
      ["#spaceman-model-menu-label", "模型配置"]
    ];
    pairs.forEach(([selector, text]) => scope.querySelectorAll(selector).forEach((el) => { el.textContent = text; }));
    scope.querySelectorAll("[data-spaceman-action='assistant']").forEach((el) => { el.textContent = "智能助手"; });
    scope.querySelectorAll("[data-spaceman-route='/fault-injection']").forEach((el) => { el.textContent = "故障注入"; });
    scope.querySelectorAll("[data-spaceman-route='/security-audit']").forEach((el) => { el.textContent = "安全审计"; });
    scope.querySelectorAll("[data-spaceman-route='/model-config']").forEach((el) => { el.textContent = "模型配置"; });
  }

  function localizeSearch() {
    const input = document.getElementById("incremental-search-input");
    if (input) input.placeholder = "搜索卫星、NORAD 编号、星座或天体...";
    const instructions = document.getElementById("incremental-search-instructions");
    if (instructions) instructions.textContent = "输入搜索 · Enter 选择 · Esc 关闭";
    const close = document.getElementById("incremental-search-close");
    if (close) {
      close.title = "关闭搜索";
      close.setAttribute("aria-label", "关闭搜索");
    }
  }

  function localize(root) {
    document.documentElement.lang = "zh-CN";
    applyTranslateAttributes(root);
    localizeSpacemanMenu(root);
    localizeSearch();
    replaceVisibleText(root);
  }

  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            localize(node);
            isolateAssistantPanel(node.matches && node.matches(ASSISTANT_SELECTOR) ? node : node.querySelector && node.querySelector(ASSISTANT_SELECTOR));
          }
          if (node.nodeType === Node.TEXT_NODE) replaceTextNode(node);
        });
      }
      localizeSearch();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    isolateAssistantPanel(document.querySelector(ASSISTANT_SELECTOR));
    localize(document);
    startObserver();
    setTimeout(() => localize(document), 300);
    setTimeout(() => localize(document), 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
