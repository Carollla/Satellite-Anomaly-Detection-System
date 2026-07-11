const form = document.querySelector("#auth-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const confirmInput = document.querySelector("#confirm-password");
const confirmField = document.querySelector("#confirm-field");
const loginOptions = document.querySelector("#login-options");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const submitLabel = submitButton.querySelector(".submit-label");
const modeSwitch = document.querySelector("#mode-switch-button");
const switchPrefix = document.querySelector("#switch-prefix");
const title = document.querySelector("#auth-title");
const subtitle = document.querySelector("#auth-subtitle");
const passwordToggle = document.querySelector(".password-toggle");
const canvas = document.querySelector("#orbit-canvas");
const mobileToggle = document.querySelector("#mobile-menu-toggle");
const navMenu = document.querySelector("#auth-nav-menu");
const brandHomeLink = document.querySelector('nav a[data-route="/"]');

let mode = new URLSearchParams(location.search).get("mode") === "register" ? "register" : "login";
let orbitAnimationId = 0;

function setCookie(name, value, days) {
  const maxAge = Math.max(1, Math.round(days * 24 * 60 * 60));
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function showMessage(text = "", kind = "error") {
  message.textContent = text;
  message.dataset.kind = kind;
}

function setLoading(loading) {
  submitButton.disabled = loading;
  submitButton.classList.toggle("is-loading", loading);
  form.setAttribute("aria-busy", String(loading));
}

function setMode(nextMode, updateUrl = true) {
  mode = nextMode;
  const registering = mode === "register";
  usernameInput.value = registering ? "" : "admin";
  passwordInput.value = registering ? "" : "admin";
  confirmInput.value = "";
  title.textContent = registering ? "创建账户" : "登录SPACEMAN";
  subtitle.textContent = registering ? "加入SPACEMAN卫星智能运维平台" : "卫星智能运维平台";
  submitLabel.textContent = registering ? "立即注册" : "登录";
  switchPrefix.textContent = registering ? "已有账户？" : "还没有账户？";
  modeSwitch.textContent = registering ? "返回登录" : "创建账户";
  confirmField.hidden = !registering;
  confirmInput.required = registering;
  passwordInput.autocomplete = registering ? "new-password" : "off";
  loginOptions.hidden = registering;
  showMessage();
  document.title = `${registering ? "注册" : "登录"} | SPACEMAN`;
  if (updateUrl) {
    const url = new URL(location.href);
    registering ? url.searchParams.set("mode", "register") : url.searchParams.delete("mode");
    history.replaceState(null, "", url);
  }
}

async function submitAuth(event) {
  event.preventDefault();
  showMessage();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    showMessage("用户名需要 3-32 位字母、数字、点、下划线或短横线。");
    usernameInput.focus();
    return;
  }
  if (password.length < 5) {
    showMessage("密码至少需要 5 位字符。");
    passwordInput.focus();
    return;
  }
  if (mode === "register" && password !== confirmInput.value) {
    showMessage("两次输入的密码不一致。");
    confirmInput.focus();
    return;
  }

  setLoading(true);
  try {
    const response = await fetch(`/local-api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        remember: document.querySelector("#remember").checked
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || "请求失败，请稍后重试。");

    showMessage(mode === "register" ? "账户创建成功，正在登录..." : "验证通过，正在进入平台...", "success");
    setCookie("user", result.token, result.expiresInDays || 1);
    localStorage.setItem("spaceman.auth.user", JSON.stringify(result.user));
    localStorage.setItem("spaceman.auth.token", result.token);
    setTimeout(() => location.assign("/"), 360);
  } catch (error) {
    showMessage(error.message || "无法连接到本地认证服务。");
    setLoading(false);
  }
}

function setupPasswordToggle() {
  passwordToggle.addEventListener("click", () => {
    const visible = passwordInput.type === "text";
    passwordInput.type = visible ? "password" : "text";
    passwordToggle.setAttribute("aria-pressed", String(!visible));
    passwordToggle.setAttribute("aria-label", visible ? "显示密码" : "隐藏密码");
    passwordInput.focus({ preventScroll: true });
  });
}

function setupMobileNav() {
  if (!mobileToggle || !navMenu) return;
  mobileToggle.addEventListener("click", () => {
    const open = navMenu.classList.toggle("is-open");
    mobileToggle.setAttribute("aria-expanded", String(open));
  });
}

function setupBrandNavigation() {
  if (!brandHomeLink) return;
  brandHomeLink.setAttribute("href", "/");
  brandHomeLink.addEventListener("click", (event) => {
    event.preventDefault();
    location.assign("/");
  });
}

function setupOrbitAnimation() {
  if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const planetWrap = document.querySelector(".planet-wrap");
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ringMetrics() {
    const rect = planetWrap?.getBoundingClientRect();
    const planetSize = rect?.width || Math.min(width, height) * 0.34;
    const centerX = rect ? rect.left + rect.width / 2 : width * 0.34;
    const centerY = rect ? rect.top + rect.height / 2 : height * 0.54;
    const rotation = -0.22;
    const padding = Math.max(18, Math.min(width, height) * 0.018);
    const desiredRx = Math.max(planetSize * 2.05, Math.min(width * 0.39, 760));
    const desiredRy = Math.max(planetSize * 0.64, Math.min(height * 0.27, 230));
    const cos = Math.abs(Math.cos(rotation));
    const sin = Math.abs(Math.sin(rotation));
    const maxHorizontalRadius = Math.max(260, Math.min(centerX - padding, width - centerX - padding));
    const maxVerticalRadius = Math.max(120, Math.min(centerY - 48, height - centerY - padding));
    const scale = Math.min(
      1,
      maxHorizontalRadius / (desiredRx * cos + desiredRy * sin),
      maxVerticalRadius / (desiredRx * sin + desiredRy * cos)
    );
    const rx = desiredRx * scale;
    const ry = desiredRy * scale;
    const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    return {
      centerX,
      centerY,
      rx,
      ry,
      circumference,
      rotation
    };
  }

  function pointOnRing(angle, metrics) {
    const localX = Math.cos(angle) * metrics.rx;
    const localY = Math.sin(angle) * metrics.ry;
    const cos = Math.cos(metrics.rotation);
    const sin = Math.sin(metrics.rotation);
    return {
      x: metrics.centerX + localX * cos - localY * sin,
      y: metrics.centerY + localX * sin + localY * cos
    };
  }

  function strokeEllipse(metrics, style = {}) {
    context.save();
    context.beginPath();
    Object.assign(context, style);
    context.ellipse(metrics.centerX, metrics.centerY, metrics.rx, metrics.ry, metrics.rotation, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawBaseRing(metrics) {
    context.lineCap = "round";
    context.lineJoin = "round";

    strokeEllipse(metrics, {
      strokeStyle: "rgba(255,255,255,0.045)",
      lineWidth: 8,
      shadowBlur: 0
    });
    strokeEllipse(metrics, {
      strokeStyle: "rgba(228,231,234,0.28)",
      lineWidth: 1.35,
      shadowColor: "rgba(255,255,255,0.34)",
      shadowBlur: 8
    });
    strokeEllipse(metrics, {
      strokeStyle: "rgba(255,255,255,0.16)",
      lineWidth: 0.58,
      shadowBlur: 0
    });
  }

  function drawMetalFlow(time, metrics) {
    const speed = 0.19;
    const dash = metrics.circumference * 0.34;
    const gap = metrics.circumference * 0.66;
    const offset = -(time * speed) % metrics.circumference;
    const gradient = context.createLinearGradient(
      metrics.centerX - metrics.rx,
      metrics.centerY - metrics.ry * 0.25,
      metrics.centerX + metrics.rx,
      metrics.centerY + metrics.ry * 0.25
    );
    gradient.addColorStop(0, "rgba(160,164,168,0.02)");
    gradient.addColorStop(0.36, "rgba(214,218,221,0.38)");
    gradient.addColorStop(0.52, "rgba(255,255,255,0.92)");
    gradient.addColorStop(0.68, "rgba(214,218,221,0.36)");
    gradient.addColorStop(1, "rgba(160,164,168,0.02)");

    context.save();
    context.globalCompositeOperation = "lighter";
    context.setLineDash([dash, gap]);
    context.lineDashOffset = offset;
    context.lineCap = "round";
    context.lineJoin = "round";
    strokeEllipse(metrics, {
      strokeStyle: "rgba(255,255,255,0.22)",
      lineWidth: 7,
      shadowColor: "rgba(255,255,255,0.26)",
      shadowBlur: 16
    });
    context.restore();

    context.save();
    context.globalCompositeOperation = "lighter";
    context.setLineDash([dash, gap]);
    context.lineDashOffset = offset;
    context.lineCap = "round";
    context.lineJoin = "round";
    strokeEllipse(metrics, {
      strokeStyle: gradient,
      lineWidth: 2.4,
      shadowColor: "rgba(255,255,255,0.72)",
      shadowBlur: 12
    });
    context.restore();

    context.save();
    context.globalCompositeOperation = "lighter";
    context.setLineDash([metrics.circumference * 0.08, metrics.circumference * 0.92]);
    context.lineDashOffset = offset - dash * 0.48;
    context.lineCap = "round";
    strokeEllipse(metrics, {
      strokeStyle: "rgba(255,255,255,0.88)",
      lineWidth: 1.15,
      shadowColor: "rgba(255,255,255,0.86)",
      shadowBlur: 18
    });
    context.restore();
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    const metrics = ringMetrics();
    drawBaseRing(metrics);
    drawMetalFlow(time, metrics);
    if (running) orbitAnimationId = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    orbitAnimationId = requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(orbitAnimationId);
  }

  resize();
  addEventListener("resize", resize, { passive: true });
  start();
  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });
}

form.addEventListener("submit", submitAuth);
modeSwitch.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));
setupPasswordToggle();
setupMobileNav();
setupBrandNavigation();
setMode(mode, false);
setupOrbitAnimation();
