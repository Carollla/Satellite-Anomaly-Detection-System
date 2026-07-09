(function () {
  const isPages = location.hostname.endsWith(".github.io");
  if (!isPages) return;

  const base = "/Satellite-Anomaly-Detection-System";
  const withBase = (url) => {
    if (typeof url !== "string") return url;
    if (!url.startsWith("/") || url.startsWith("//") || url.startsWith(base + "/")) return url;
    return base + url;
  };
  const originalFetch = window.fetch.bind(window);

  window.fetch = function spacemanPagesFetch(input, init) {
    const raw = typeof input === "string" ? input : input && input.url;
    if (raw && raw.startsWith("/local-api/")) {
      if (raw.includes("/satellites")) {
        return originalFetch(`${base}/json/local-api/satellites-starlink-active.json`, init);
      }
      if (raw.includes("/v2/tle") || raw.endsWith("/tle")) {
        return originalFetch(`${base}/json/local-api/v2-tle-starlink.txt`, init);
      }
      if (raw.includes("/spaceman-status")) {
        return originalFetch(`${base}/json/local-api/satellites-starlink-active.json`, init)
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
        success: false,
        staticPages: true,
        error: "GitHub Pages is static. Run npm start locally for this API."
      }), { status: 501, headers: { "content-type": "application/json" } }));
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
})();
