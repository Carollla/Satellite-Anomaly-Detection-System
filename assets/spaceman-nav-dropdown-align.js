(function () {
  const buttonId = "dropdownSpacemanFunctionsLink";
  const menuId = "dropdownSpacemanFunctions";

  function isDesktop() {
    return window.matchMedia("(min-width: 1024px)").matches;
  }

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && !element.classList.contains("hidden") && element.getBoundingClientRect().width > 0;
  }

  function alignSpacemanFunctionsDropdown() {
    if (!isDesktop()) return;
    const button = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    const nav = button && button.closest("nav");
    if (!button || !menu || !nav || !isVisible(menu)) return;

    const buttonRect = button.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setStyle(menu, "position", "fixed");
    setStyle(menu, "inset", "auto");
    setStyle(menu, "right", "auto");
    setStyle(menu, "bottom", "auto");
    setStyle(menu, "left", `${buttonRect.left}px`);
    setStyle(menu, "top", `${navRect.bottom}px`);
    setStyle(menu, "margin", "0");
    setStyle(menu, "margin-top", "0");
    setStyle(menu, "transform", "none");
    setStyle(menu, "z-index", "60");
  }

  function setStyle(element, property, value) {
    if (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === "important") {
      return;
    }
    element.style.setProperty(property, value, "important");
  }

  function scheduleAlign() {
    requestAnimationFrame(() => {
      alignSpacemanFunctionsDropdown();
      requestAnimationFrame(alignSpacemanFunctionsDropdown);
    });
    window.setTimeout(alignSpacemanFunctionsDropdown, 60);
    window.setTimeout(alignSpacemanFunctionsDropdown, 180);
  }

  function bind() {
    const button = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    if (!button || !menu || button.dataset.spacemanDropdownAlignBound === "1") return false;
    button.dataset.spacemanDropdownAlignBound = "1";
    button.addEventListener("click", scheduleAlign, true);
    button.addEventListener("click", scheduleAlign);
    button.addEventListener("pointerup", scheduleAlign, true);
    menu.addEventListener("mouseenter", alignSpacemanFunctionsDropdown);
    new MutationObserver(scheduleAlign).observe(menu, {
      attributes: true,
      attributeFilter: ["class", "style", "data-spaceman-open", "aria-hidden"]
    });
    scheduleAlign();
    return true;
  }

  function init() {
    bind();
    new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleAlign);
    window.addEventListener("scroll", scheduleAlign, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
