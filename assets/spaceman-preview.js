(function () {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("spaceman-preview")) return;

  document.documentElement.classList.add("spaceman-preview-mode");

  const style = document.createElement("style");
  style.textContent = `
    html.spaceman-preview-mode,
    html.spaceman-preview-mode body {
      width: 100%;
      height: 100%;
      margin: 0 !important;
      overflow: hidden !important;
      background: #000 !important;
    }

    html.spaceman-preview-mode body {
      opacity: 1 !important;
    }

    html.spaceman-preview-mode nav,
    html.spaceman-preview-mode #mobile-menu,
    html.spaceman-preview-mode #mobile-menu-overlay,
    html.spaceman-preview-mode #splash-screen,
    html.spaceman-preview-mode #noscript-fallback,
    html.spaceman-preview-mode #starlink-welcome,
    html.spaceman-preview-mode #helpIcon,
    html.spaceman-preview-mode #helpPanels,
    html.spaceman-preview-mode #timeline_chart_modal,
    html.spaceman-preview-mode #api-toggle-footer,
    html.spaceman-preview-mode .spaceman-assistant-panel,
    html.spaceman-preview-mode .spaceman-assistant-launcher,
    html.spaceman-preview-mode .navbar-mobile-menu,
    html.spaceman-preview-mode .navbar-dropdown-menu,
    html.spaceman-preview-mode .draggable-window {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    html.spaceman-preview-mode #glCanvas,
    html.spaceman-preview-mode canvas#glCanvas {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      display: block !important;
      z-index: 1 !important;
      background: #000 !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);

  function applyPreviewMode() {
    document.body?.classList.add("spaceman-preview-mode");
    const canvas = document.getElementById("glCanvas");
    if (canvas) {
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.display = "block";
      canvas.style.pointerEvents = "auto";
      canvas.style.zIndex = "1";
    }
    document.querySelectorAll("nav,#mobile-menu,#mobile-menu-overlay,#splash-screen,#noscript-fallback,#starlink-welcome,#helpIcon,#helpPanels,#timeline_chart_modal,#api-toggle-footer,.spaceman-assistant-panel,.spaceman-assistant-launcher,.draggable-window").forEach((el) => {
      el.style.display = "none";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
    });
  }

  function forwardWheelToScene(event) {
    if (event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.type !== "SPACEMAN_PREVIEW_WHEEL") return;
    const canvas = document.getElementById("glCanvas");
    const target = canvas || document.body || window;
    const rect = canvas?.getBoundingClientRect?.();
    const clientX = rect ? rect.left + rect.width / 2 : Number(data.clientX || 0);
    const clientY = rect ? rect.top + rect.height / 2 : Number(data.clientY || 0);
    const wheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      view: window,
      deltaX: Number(data.deltaX || 0),
      deltaY: Number(data.deltaY || 0),
      deltaZ: Number(data.deltaZ || 0),
      deltaMode: Number(data.deltaMode || 0),
      clientX,
      clientY
    });
    target.dispatchEvent(wheel);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyPreviewMode);
  else applyPreviewMode();
  window.addEventListener("load", applyPreviewMode);
  window.addEventListener("message", forwardWheelToScene);
  window.setInterval(applyPreviewMode, 1000);
})();
