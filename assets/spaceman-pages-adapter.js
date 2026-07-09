(function () {
  const isPages = location.hostname.endsWith(".github.io");
  if (!isPages) return;

  const base = "/Satellite-Anomaly-Detection-System";
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
    return originalFetch(input, init);
  };
})();
