(function () {
  const isPages = location.hostname.endsWith(".github.io");
  if (!isPages) return;

  const base = "/Satellite-Anomaly-Detection-System";
  window.__SPACEMAN_ROUTE_BASE = base;
  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const minFrameMs = 1000 / 30;
  let lastFrameTime = 0;
  let frameHandle = 1;
  const pendingFrames = new Map();

  window.requestAnimationFrame = function spacemanPagesRequestAnimationFrame(callback) {
    const handle = frameHandle++;
    const nativeHandle = originalRequestAnimationFrame((timestamp) => {
      const delay = Math.max(0, minFrameMs - (timestamp - lastFrameTime));
      if (delay > 1) {
        const timer = window.setTimeout(() => {
          pendingFrames.delete(handle);
          const now = performance.now();
          lastFrameTime = now;
          callback(now);
        }, delay);
        pendingFrames.set(handle, { timer });
        return;
      }
      pendingFrames.delete(handle);
      lastFrameTime = timestamp;
      callback(timestamp);
    });
    pendingFrames.set(handle, { nativeHandle });
    return handle;
  };

  window.cancelAnimationFrame = function spacemanPagesCancelAnimationFrame(handle) {
    const pending = pendingFrames.get(handle);
    if (!pending) return;
    pendingFrames.delete(handle);
    if (pending.nativeHandle) originalCancelAnimationFrame(pending.nativeHandle);
    if (pending.timer) window.clearTimeout(pending.timer);
  };

  const jsonResponse = (body, init = {}) => Promise.resolve(new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "content-type": "application/json", ...(init.headers || {}) }
  }));
  const textResponse = (body = "", init = {}) => Promise.resolve(new Response(body, {
    status: init.status || 200,
    headers: { "content-type": init.contentType || "text/plain; charset=utf-8", ...(init.headers || {}) }
  }));
  const withBase = (url) => {
    if (typeof url !== "string") return url;
    if (!url.startsWith("/") || url.startsWith("//") || url.startsWith(base + "/")) return url;
    return base + url;
  };
  const stripBasePath = (path) => {
    if (typeof path !== "string") return path;
    if (path === base) return "/";
    if (path.startsWith(base + "/")) return path.slice(base.length) || "/";
    return path;
  };
  const addBasePath = (path) => {
    if (typeof path !== "string") return path;
    if (!path.startsWith("/") || path.startsWith(base + "/")) return path;
    return base + path;
  };
  const requestPath = (url) => {
    if (typeof url !== "string") return "";
    try {
      const parsed = new URL(url, location.origin);
      if (parsed.origin !== location.origin) return "";
      return stripBasePath(parsed.pathname) + parsed.search;
    } catch {
      return stripBasePath(url);
    }
  };
  const staticFetch = (url) => originalFetch(url, { method: "GET" });

  try {
    const locationPrototype = Object.getPrototypeOf(window.location);
    const pathnameDescriptor = Object.getOwnPropertyDescriptor(locationPrototype, "pathname");
    if (pathnameDescriptor && pathnameDescriptor.get) {
      Object.defineProperty(locationPrototype, "pathname", {
        configurable: true,
        enumerable: pathnameDescriptor.enumerable,
        get() {
          return stripBasePath(pathnameDescriptor.get.call(this));
        },
        set(value) {
          if (pathnameDescriptor.set) pathnameDescriptor.set.call(this, addBasePath(value));
        }
      });
    }
  } catch (error) {
    console.debug("SPACEMAN Pages path shim skipped:", error);
  }

  const originalPushState = history.pushState.bind(history);
  history.pushState = function spacemanPagesPushState(state, title, url) {
    return originalPushState(state, title, typeof url === "string" ? addBasePath(url) : url);
  };
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function spacemanPagesReplaceState(state, title, url) {
    return originalReplaceState(state, title, typeof url === "string" ? addBasePath(url) : url);
  };

  const originalFetch = window.fetch.bind(window);

  window.fetch = function spacemanPagesFetch(input, init) {
    const raw = typeof input === "string" ? input : input && input.url;
    const path = requestPath(raw);
    if (path && path.startsWith("/local-api/")) {
      if (path.includes("/api/keys/session")) {
        return jsonResponse({
          success: true,
          message: "GitHub Pages static session API key",
          data: {
            id: 1,
            key: "github-pages-static-session",
            name: "github-pages-static-session",
            key_type: "session",
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            expires_in_hours: 48,
            rate_limit: 100000,
            usage_count: 0,
            is_active: true
          }
        });
      }
      if (path.includes("/api/create-session")) {
        return jsonResponse({
          success: true,
          token: "github-pages-static-session",
          userData: {
            email: null,
            is_verified: false,
            is_superuser: false,
            last_visit: []
          }
        });
      }
      if (path.includes("/api/user-state")) {
        return jsonResponse({
          success: true,
          local: true,
          data: {
            email: null,
            emailVerified: false,
            isSuperuser: false,
            last_visit: [],
            preferences: {},
            ui_preferences: {}
          }
        });
      }
      if (path.includes("/api/statistics")) {
        return jsonResponse({ success: true, staticPages: true });
      }
      if (path.includes("/health")) {
        return jsonResponse({ status: "ok", staticPages: true, timestamp: new Date().toISOString() });
      }
      if (path.includes("/available-tiles")) {
        return Promise.resolve(new Response(new Uint8Array(8192), {
          headers: { "content-type": "application/octet-stream" }
        }));
      }
      if (path.includes("/satellites")) {
        return staticFetch(`${base}/json/local-api/satellites-starlink-active.json`);
      }
      if (path.includes("/v2/tle") || path.endsWith("/tle")) {
        return staticFetch(`${base}/json/local-api/v2-tle-starlink.txt`);
      }
      if (path.includes("/spaceman-status")) {
        return staticFetch(`${base}/json/local-api/satellites-starlink-active.json`)
          .then((response) => response.json())
          .then((metadata) => new Response(JSON.stringify({
            success: true,
            data: {
              platform: "SPACEMAN",
              dataSource: {
                metadataFile: "json/local-api/satellites-starlink-active.json",
                tleFile: "json/local-api/v2-tle-starlink.txt",
                synthetic: true
              },
              constellation: {
                name: "spaceman",
                totalSatellites: metadata.count || metadata.data?.length || 0,
                activeSatellites: metadata.count || metadata.data?.length || 0,
                shellCount: metadata.layers?.length || 0,
                layers: metadata.layers || []
              }
            }
          }), { headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        local: true,
        staticPages: true,
        data: [],
        satellites: [],
        launches: [],
        ground_stations: [],
        tips: [],
        conjunctions: [],
        message: "GitHub Pages static API stub. Run npm start locally for full backend features."
      }), { status: 200, headers: { "content-type": "application/json" } }));
    }
    if (path && path.startsWith("/html/app_banner.html.")) {
      return textResponse("", { status: 204, contentType: "text/html; charset=utf-8" });
    }
    if (path && path.startsWith("/json/planes/db/") && path.endsWith(".js")) {
      return jsonResponse({});
    }
    if (path && (path === "/json/jpl_ephemeris_ground_truth.json" || path.includes("/json/jpl_ephemeris_ground_truth.json"))) {
      return jsonResponse({ test_cases: [] });
    }
    if (typeof input === "string") {
      return originalFetch(withBase(input), init);
    }
    if (input instanceof Request && input.url && new URL(input.url).origin === location.origin) {
      const path = new URL(input.url).pathname;
      if (path.startsWith("/") && !path.startsWith(base + "/")) {
        return originalFetch(new Request(withBase(path) + new URL(input.url).search, input), init);
      }
    }
    return originalFetch(input, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function spacemanPagesOpen(method, url, ...rest) {
    return originalOpen.call(this, method, withBase(url), ...rest);
  };

  const patchUrlProperty = (proto, property) => {
    const descriptor = Object.getOwnPropertyDescriptor(proto, property);
    if (!descriptor || !descriptor.set) return;
    Object.defineProperty(proto, property, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        descriptor.set.call(this, withBase(value));
      }
    });
  };

  patchUrlProperty(HTMLImageElement.prototype, "src");
  patchUrlProperty(HTMLLinkElement.prototype, "href");

  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function spacemanPagesSetAttribute(name, value) {
    const lower = String(name).toLowerCase();
    if ((lower === "src" || lower === "href") && typeof value === "string") {
      return originalSetAttribute.call(this, name, withBase(value));
    }
    return originalSetAttribute.call(this, name, value);
  };

  const applyPerformanceProfile = () => {
    const globe = window.globe || window.blueGlobe;
    if (!globe || globe.__spacemanPagesPerformanceProfile) return false;
    if (typeof globe.setFrameRate === "function") {
      globe.setFrameRate(30);
    }
    globe.render_decimation = Math.max(globe.render_decimation || 1, 2);
    globe.desired_dpr = 1;
    globe.autoPause = true;
    globe.__spacemanPagesPerformanceProfile = true;
    return true;
  };

  let performanceAttempts = 0;
  const performanceTimer = window.setInterval(() => {
    performanceAttempts += 1;
    const globe = window.globe || window.blueGlobe;
    if (globe) globe.__spacemanPagesPerformanceProfile = false;
    applyPerformanceProfile();
    if (performanceAttempts > 160) {
      window.clearInterval(performanceTimer);
    }
  }, 250);
})();
