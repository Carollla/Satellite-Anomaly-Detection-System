// C4 Constellation Injector
// Shell A (LEO): 300 sats, 550km, 53 deg, 20 planes x 15 sats
// Shell B (LEO): 120 sats, 530km, 97.6 deg, 10 planes x 12 sats
// MEO:           24 sats, 21500km, 55 deg, 3 planes x 8 sats
// GEO:           6 sats, 35786km, 0 deg, equatorial at 0/60/120/180/240/300 deg
(function() {
  'use strict';

  function mapAssetUrl(url) {
    if (typeof url !== 'string') return url;
    if (url.indexOf('/images/') === 0) return '/satellitemap' + url;
    if (url.indexOf('images/') === 0) return './' + url;
    return url;
  }

  function installAssetPathPatch() {
    try {
      var srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (srcDescriptor && srcDescriptor.set && !HTMLImageElement.prototype._c4AssetPathPatched) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          configurable: true,
          enumerable: srcDescriptor.enumerable,
          get: srcDescriptor.get,
          set: function(value) {
            return srcDescriptor.set.call(this, mapAssetUrl(value));
          }
        });
        HTMLImageElement.prototype._c4AssetPathPatched = true;
      }
    } catch (e) {}

    try {
      var originalSetAttribute = Element.prototype.setAttribute;
      if (!Element.prototype._c4AssetSetAttributePatched) {
        Element.prototype.setAttribute = function(name, value) {
          if (this instanceof HTMLImageElement && String(name).toLowerCase() === 'src') {
            return originalSetAttribute.call(this, name, mapAssetUrl(value));
          }
          return originalSetAttribute.call(this, name, value);
        };
        Element.prototype._c4AssetSetAttributePatched = true;
      }
    } catch (e) {}

    try {
      var originalOpen = XMLHttpRequest.prototype.open;
      if (!XMLHttpRequest.prototype._c4AssetOpenPatched) {
        XMLHttpRequest.prototype.open = function(method, url) {
          arguments[1] = mapAssetUrl(url);
          return originalOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype._c4AssetOpenPatched = true;
      }
    } catch (e) {}

    try {
      var originalFetch = window.fetch.bind(window);
      if (!window._c4AssetFetchPatched) {
        window.fetch = function(input, init) {
          if (typeof input === 'string') return originalFetch(mapAssetUrl(input), init);
          if (input instanceof Request) {
            var mapped = mapAssetUrl(input.url);
            if (mapped !== input.url) return originalFetch(new Request(mapped, input), init);
          }
          return originalFetch(input, init);
        };
        window._c4AssetFetchPatched = true;
      }
    } catch (e) {}
  }

  installAssetPathPatch();

  var statusBox;
  var statusLines = [];
  var linkCanvas;
  var linkCtx;
  var linkAnimId = 0;
  var c4Color = [0.10, 0.48, 0.31, 1.0];
  var peHelper = null;
  var peHelperLoading = false;
  var diagnosticsTimer = 0;
  var selectedOrbitSatIds = Object.create(null);
  var selectedSatId = null;
  var currentGlobe = null;
  var lastToggleSatId = null;
  var lastToggleAt = 0;
  var groundStations = [
    { id: 'gs-miyun', lat: 40.3764, lon: 116.8434 },
    { id: 'gs-kashi', lat: 39.4704, lon: 75.9898 },
    { id: 'gs-sanya', lat: 18.2528, lon: 109.5036 },
    { id: 'gs-lijiang', lat: 26.8721, lon: 100.2290 },
    { id: 'gs-mohe', lat: 52.9721, lon: 122.5384 }
  ];
  var staticGroundLinkPlan = [
    { gs: 'gs-miyun', links: [{ shell: 'A', plane: 0, slot: 2 }, { shell: 'A', plane: 2, slot: 8 }, { shell: 'B', plane: 0, slot: 3 }] },
    { gs: 'gs-kashi', links: [{ shell: 'A', plane: 4, slot: 4 }, { shell: 'A', plane: 6, slot: 10 }, { shell: 'B', plane: 2, slot: 2 }] },
    { gs: 'gs-sanya', links: [{ shell: 'A', plane: 8, slot: 1 }, { shell: 'A', plane: 10, slot: 7 }, { shell: 'B', plane: 4, slot: 6 }] },
    { gs: 'gs-lijiang', links: [{ shell: 'A', plane: 12, slot: 5 }, { shell: 'A', plane: 14, slot: 11 }, { shell: 'B', plane: 6, slot: 1 }] },
    { gs: 'gs-mohe', links: [{ shell: 'A', plane: 16, slot: 0 }, { shell: 'A', plane: 18, slot: 6 }, { shell: 'B', plane: 8, slot: 5 }] }
  ];

  function forceEarthVisuals(globe) {
    if (!globe) return;
    try { globe.show_borders = 1; } catch(e) {}
    try { globe.show_texstyle = 1; } catch(e) {}
    try { globe.show_dotlighting = 1; } catch(e) {}
    try { globe.show_clouds = 0; } catch(e) {}
    try { globe.show_skybox = 1; } catch(e) {}
    try { globe.show_sun = 1; } catch(e) {}
    try { globe.show_rotating = 1; } catch(e) {}
    try { globe.show_labels = 1; } catch(e) {}
  }

  function ensureStatusBox() {
    return null;
  }

  // Hide unwanted UI panels injected by the globe library
  function hideGlobeUI() {
    var ids = [
      'lv_info',
      'pov_info',
      'pov_reentry_info',
      'search-trigger-icon',
      'vis_help_icon',
      'helpModal',
      'bgtitle',
      'navbar-desktop',
      'mobile-menu-overlay',
      'mobile-menu',
      'timeline_chart_modal',
      'credits_modal',
      'about_modal',
      'starlink-welcome',
      'splash-screen',
      'about-get-started',
      'dropdownNews',
      'dropdownNavbar',
      'dropdownTypes',
      'dropdownFunctions',
      'dropdownMore',
      'desktop-constellation-data-item',
      'timeline-tab-list',
      'timeline-tab-content',
      'growth-panel',
      'launches-panel',
      'decays-panel',
      'orbits-panel',
      'ground-stations-panel',
      'events-panel',
      'sat-info',
      'info-panel',
      'bottom-bar',
      'right-panel',
      'sidebar',
      'controls',
      'control-panel',
      'toolbar'
    ];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    var nav = document.querySelector('nav');
    if (nav) nav.remove();
    // Hide any draggable windows and info panels
    var selectors = [
      '.draggable-window',
      '.lv-info-window',
      '.sat-info-panel',
      '.info-panel',
      '.navbar-dropdown-menu',
      '.navbar-dropdown-list',
      '.navbar-desktop-dropdown-item',
      '.navbar-mobile-dropdown-item',
      '.navbar-mobile-submenu-item',
      '.navbar-mobile-menu',
      '.navbar-mobile-toggle',
      '.navbar-mobile-submenu-toggle',
      '.navbar-dropdown-button',
      '.navbar-desktop-dropdown-item',
      '.bottom-panel',
      '.right-panel',
      '.side-panel',
      '.overlay-panel',
      '#toolbar',
      '[id^="btn"]',
      'button',
      'a',
      '[role="button"]',
      '[class*="bottom-bar"]',
      '[class*="right-bar"]',
      '[class*="bottom"]',
      '[class*="Bottom"]',
      '[id*="time"]',
      '[class*="time"]',
      '[id*="fps"]',
      '[class*="fps"]',
      '[class*="sat-panel"]',
      '[class*="info-window"]',
      '[id*="inclination"]',
      '[class*="inclination"]',
      '[id*="Inclination"]',
      '[class*="Inclination"]'
    ];
    selectors.forEach(function(sel) {
      var els = document.querySelectorAll(sel);
      els.forEach(function(el) { el.remove(); });
    });
    var links = document.querySelectorAll('a, button');
    links.forEach(function(el) {
      var text = (el.textContent || '').trim().toUpperCase();
      var href = (el.getAttribute && (el.getAttribute('href') || '')) || '';
      if (
        text === 'HELP' ||
        text === 'DEV DIARY' ||
        text === 'FEEDBACK' ||
        href.indexOf('howtouse') !== -1 ||
        href.indexOf('dev.to') !== -1
      ) {
        var row = el.closest('.flex');
        if (row && row.textContent && /HELP|DEV DIARY|FEEDBACK/i.test(row.textContent)) {
          row.remove();
          return;
        }
        el.remove();
      }
    });
    var maybeInfoBoxes = document.querySelectorAll('div, section, aside');
    maybeInfoBoxes.forEach(function(el) {
      var text = (el.textContent || '').toUpperCase();
      if (text.indexOf('INCLINATION') !== -1 || text.indexOf('轨道倾角') !== -1 || text.indexOf('倾角') !== -1) {
        el.remove();
      }
    });
  }

  // Run immediately and observe for dynamically added elements
  document.addEventListener('DOMContentLoaded', hideGlobeUI);
  if (document.readyState !== 'loading') hideGlobeUI();
  var _uiObserver = new MutationObserver(hideGlobeUI);
  _uiObserver.observe(document.documentElement, { childList: true, subtree: true });

  function logStatus(msg) {
    var line = '[C4] ' + msg;
    statusLines.push(line);
    if (statusLines.length > 18) statusLines.shift();
    console.log(line);
  }

  function ensurePeHelper() {
    if (peHelper || peHelperLoading) return;
    peHelperLoading = true;
    import('./assets/main.CETTShQh.js').then(function(mod) {
      peHelper = mod && mod.l ? mod.l : null;
      logStatus(peHelper ? 'Loaded globe coordinate helper' : 'Coordinate helper missing');
    }).catch(function(err) {
      logStatus('Coordinate helper load failed: ' + (err && err.message ? err.message : err));
    });
  }

  function ensureLinkCanvas() {
    if (linkCanvas) return linkCanvas;
    linkCanvas = document.createElement('canvas');
    linkCanvas.id = 'c4-link-overlay';
    linkCanvas.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:12;';
    document.addEventListener('DOMContentLoaded', function() {
      if (document.body && !document.getElementById('c4-link-overlay')) {
        document.body.appendChild(linkCanvas);
      }
    });
    if (document.body) {
      document.body.appendChild(linkCanvas);
    }
    linkCtx = linkCanvas.getContext('2d');
    resizeLinkCanvas();
    window.addEventListener('resize', resizeLinkCanvas);
    return linkCanvas;
  }

  function getGlRect() {
    var glCanvas = document.getElementById('glCanvas');
    if (glCanvas) return glCanvas.getBoundingClientRect();
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }

  function resizeLinkCanvas() {
    if (!linkCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    var rect = getGlRect();
    var w = Math.max(1, rect.width);
    var h = Math.max(1, rect.height);
    // Position overlay exactly over glCanvas
    linkCanvas.style.left = rect.left + 'px';
    linkCanvas.style.top = rect.top + 'px';
    linkCanvas.style.width = w + 'px';
    linkCanvas.style.height = h + 'px';
    if (linkCanvas.width !== Math.round(w * dpr) || linkCanvas.height !== Math.round(h * dpr)) {
      linkCanvas.width = Math.round(w * dpr);
      linkCanvas.height = Math.round(h * dpr);
      if (linkCtx) {
        linkCtx.setTransform(1, 0, 0, 1, 0, 0);
        linkCtx.scale(dpr, dpr);
      }
    }
  }

  function latLonToPoint(latDeg, lonDeg, radius) {
    if (peHelper) {
      return peHelper(degToRad(latDeg), degToRad(lonDeg), radius);
    }
    var lat = degToRad(latDeg);
    var lon = degToRad(lonDeg);
    var cosLat = Math.cos(lat);
    var x = radius * cosLat * Math.cos(lon);
    var y = radius * Math.sin(lat);
    var z = radius * cosLat * Math.sin(lon);
    return [z, y, -x];
  }

  function cksum(line) {
    var s = 0;
    for (var i = 0; i < 68; i++) {
      var c = line[i];
      if (c >= '0' && c <= '9') s += +c;
      else if (c === '-') s += 1;
    }
    return s % 10;
  }

  function padLeft(value, width, ch) {
    return String(value).padStart(width, ch || ' ');
  }

  function makeTLE(id, inc, raan, ecc, ap, ma, mmVal, ep) {
    var id5 = String(id).padStart(5, '0');
    var epoch = '26' + padLeft(ep.toFixed(8), 12, '0');
    var ecc7 = padLeft(Math.round(ecc * 1e7), 7, '0');
    var l1 = '1 ' + id5 + 'U 25001A   ' + epoch + '  .00000000  00000-0  00000-0 0  999';
    l1 = l1 + cksum(l1);
    var l2 = '2 ' + id5
      + ' ' + padLeft(inc.toFixed(4), 8, ' ')
      + ' ' + padLeft(raan.toFixed(4), 8, ' ')
      + ' ' + ecc7
      + ' ' + padLeft(ap.toFixed(4), 8, ' ')
      + ' ' + padLeft(ma.toFixed(4), 8, ' ')
      + ' ' + padLeft(mmVal.toFixed(8), 11, ' ')
      + '00001';
    l2 = l2 + cksum(l2);
    return { tle_line1: l1, tle_line2: l2 };
  }

  function calcMM(alt) {
    var a = 6371 + alt;
    return Math.sqrt(398600.4418 / (a * a * a)) * 86400 / (2 * Math.PI);
  }

  function calcOrbitalSpeedDegPerSec(altKm) {
    return calcMM(altKm) * 360 / 86400;
  }

  function makeOrbitalElements(s) {
    return {
      norad_id: s.norad_id,
      sat_name: s.name,
      inclination: parseFloat(s.tle.tle_line2.substring(8, 16)),
      raan: parseFloat(s.tle.tle_line2.substring(17, 25)),
      eccentricity: parseFloat('0.' + s.tle.tle_line2.substring(26, 33)),
      arg_perigee: parseFloat(s.tle.tle_line2.substring(34, 42)),
      mean_anomaly: parseFloat(s.tle.tle_line2.substring(43, 51)),
      mean_motion: parseFloat(s.tle.tle_line2.substring(52, 63)),
      epoch: s.tle.tle_line1.substring(18, 32).trim()
    };
  }

  function makeDetail(s) {
    var state = satStateById[s.norad_id] || {};
    return {
      norad_id: s.norad_id,
      sat_name: state.name || s.name,
      name: state.name || s.name,
      norad: s.norad_id,
      noradId: s.norad_id,
      sat_type: 'internet',
      constellation_name: 'c4',
      constellation: 'c4',
      status: state.enabled === false ? 'inactive' : (state.status || 'active'),
      country: 'CN',
      launch_date: '2025-01-01',
      decay_date: null,
      metadata: {
        norad_id: s.norad_id,
        sat_name: state.name || s.name,
        name: state.name || s.name,
        shell: state.shell,
        plane: state.plane,
        slot: state.slot,
        layer: state.layer,
        enabled: state.enabled !== false
      },
      orbital_elements: makeOrbitalElements(s),
      raw_tle: {
        tle_line1: s.tle.tle_line1,
        tle_line2: s.tle.tle_line2
      }
    };
  }

  var sats = [];
  var seq = 1;
  var ep = 100 + Math.random() * 10;
  var mmA = calcMM(550);
  var mmB = calcMM(530);
  var mmMEO = calcMM(21500);
  var mmGEO = calcMM(35786);
  var p;
  var s;
  var ma;

  // Shell A: 20 planes x 15 sats, 550km, 53 deg
  for (p = 0; p < 20; p++) {
    for (s = 0; s < 15; s++) {
      ma = (s / 15) * 360 + (p / 20) * (360 / 15);
      sats.push({
        norad_id: seq,
        name: 'LEO ' + seq,
        tle: makeTLE(seq, 53.0, (p / 20) * 360, 0.0001, 0, ma % 360, mmA, ep)
      });
      seq++;
    }
  }

  // Shell B: 10 planes x 12 sats, 530km, 97.6 deg
  for (p = 0; p < 10; p++) {
    for (s = 0; s < 12; s++) {
      ma = (s / 12) * 360 + (p / 10) * (360 / 12);
      sats.push({
        norad_id: seq,
        name: 'LEO ' + seq,
        tle: makeTLE(seq, 97.6, (p / 10) * 360, 0.0001, 0, ma % 360, mmB, ep)
      });
      seq++;
    }
  }

  // MEO: 3 planes x 8 sats, 21500km, 55 deg
  for (p = 0; p < 3; p++) {
    for (s = 0; s < 8; s++) {
      ma = (s / 8) * 360 + (p / 3) * (360 / 8);
      sats.push({
        norad_id: seq,
        name: 'MEO ' + seq,
        tle: makeTLE(seq, 55.0, (p / 3) * 360, 0.0001, 0, ma % 360, mmMEO, ep)
      });
      seq++;
    }
  }

  // GEO: 6 sats, 35786km, equatorial, at 0/60/120/180/240/300 deg longitude
  for (s = 0; s < 6; s++) {
    var geoLon = s * 60; // 0,60,120,180,240,300
    sats.push({
      norad_id: seq,
      name: 'GEO ' + seq,
      tle: makeTLE(seq, 0.0, geoLon, 0.0001, 0, 0, mmGEO, ep)
    });
    seq++;
  }

  function findSatById(id) {
    var n = parseInt(id, 10);
    for (var i = 0; i < sats.length; i++) {
      if (sats[i].norad_id === n) return sats[i];
    }
    return null;
  }

  function shellMetaForIndex(index) {
    if (index < 300) {
      return {
        layer: 'LEO',
        shell: 'A',
        plane: Math.floor(index / 15) + 1,
        slot: (index % 15) + 1,
        altitudeKm: 550,
        inclination: 53,
        defaultName: 'LEO-A P' + padLeft(Math.floor(index / 15) + 1, 2, '0') + '-S' + padLeft((index % 15) + 1, 2, '0')
      };
    }
    if (index < 420) {
      var localIndex = index - 300;
      return {
        layer: 'LEO',
        shell: 'B',
        plane: Math.floor(localIndex / 12) + 1,
        slot: (localIndex % 12) + 1,
        altitudeKm: 530,
        inclination: 97.6,
        defaultName: 'LEO-B P' + padLeft(Math.floor(localIndex / 12) + 1, 2, '0') + '-S' + padLeft((localIndex % 12) + 1, 2, '0')
      };
    }
    if (index < 444) {
      var meoIndex = index - 420;
      return {
        layer: 'MEO',
        shell: 'M',
        plane: Math.floor(meoIndex / 8) + 1,
        slot: (meoIndex % 8) + 1,
        altitudeKm: 21500,
        inclination: 55,
        defaultName: 'MEO P' + padLeft(Math.floor(meoIndex / 8) + 1, 2, '0') + '-S' + padLeft((meoIndex % 8) + 1, 2, '0')
      };
    }
    var geoIndex = index - 444;
    return {
      layer: 'GEO',
      shell: 'G',
      plane: 1,
      slot: geoIndex + 1,
      altitudeKm: 35786,
      inclination: 0,
      defaultName: 'GEO-' + padLeft(geoIndex + 1, 2, '0') + ' (' + (geoIndex * 60) + '\u00b0E)'
    };
  }

  var satStateById = {};

  function buildStateForSat(sat, index) {
    var meta = shellMetaForIndex(index);
    return {
      id: sat.norad_id,
      norad_id: sat.norad_id,
      name: meta.defaultName,
      originalName: sat.name,
      status: 'active',
      enabled: true,
      layer: meta.layer,
      shell: meta.shell,
      plane: meta.plane,
      slot: meta.slot,
      altitudeKm: meta.altitudeKm,
      inclination: meta.inclination,
      cpu: 32 + ((index * 7) % 51),
      temp: 28 + ((index * 5) % 37),
      notes: ''
    };
  }

  function listSatelliteStates() {
    return sats.map(function(sat, index) {
      return satStateById[sat.norad_id] || buildStateForSat(sat, index);
    });
  }

  function rebuildApiResponses() {
    satResp = {
      success: true,
      data: sats.map(function(sat, index) {
        var state = satStateById[sat.norad_id] || buildStateForSat(sat, index);
        return {
          norad_id: sat.norad_id,
          sat_name: state.name,
          sat_type: 'internet',
          constellation_name: 'c4',
          status: state.enabled === false ? 'inactive' : state.status,
          country: 'CN',
          launch_date: '2025-01-01',
          decay_date: null
        };
      })
    };

    tleResp = {
      success: true,
      data: sats.map(function(sat) {
        return {
          norad: sat.norad_id,
          orbital_elements: makeOrbitalElements(sat),
          raw_tle: {
            tle_line1: sat.tle.tle_line1,
            tle_line2: sat.tle.tle_line2
          },
          timestamp: new Date().toISOString()
        };
      })
    };
  }

  sats.forEach(function(sat, index) {
    satStateById[sat.norad_id] = buildStateForSat(sat, index);
  });
  logStatus(sats.length + ' satellites ready (LEO-A:300 LEO-B:120 MEO:24 GEO:6)');

  var satResp;
  var tleResp;
  rebuildApiResponses();

  function jsonResponse(obj) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  function broadcast(type, payload) {
    try {
      window.parent && window.parent.postMessage({
        source: 'c4-satellitemap',
        type: type,
        payload: payload
      }, '*');
    } catch (e) {}
  }

  function emitState() {
    broadcast('c4-state', {
      satellites: listSatelliteStates(),
      selectedId: selectedSatId
    });
  }

  function emitSelection(id) {
    selectedSatId = id == null ? null : parseInt(id, 10);
    broadcast('c4-selection', {
      selectedId: selectedSatId,
      satellite: selectedSatId ? (satStateById[selectedSatId] || null) : null
    });
  }

  function syncSatellitePresentation(sat, state) {
    if (!sat || !state) return;
    sat.name = state.name;
    if (!sat.metadata) sat.metadata = {};
    sat.metadata.sat_name = state.name;
    sat.metadata.name = state.name;
    sat.metadata.norad_id = sat.norad_id;
    sat.metadata.status = state.status;
    sat.metadata.enabled = state.enabled !== false;
    sat.metadata.shell = state.shell;
    sat.metadata.plane = state.plane;
    sat.metadata.slot = state.slot;
    if (sat.tleData && sat.tleData.orbital_elements) {
      sat.tleData.orbital_elements.sat_name = state.name;
    }
  }

  function refreshGlobeState() {
    rebuildApiResponses();
    if (currentGlobe && currentGlobe.dots && currentGlobe.dots.movingPoints) {
      applyC4Positions(currentGlobe);
      drawOverlay(currentGlobe);
    }
    emitState();
  }

  var _orig = window.fetch.bind(window);

  function c4Fetch(input, init) {
    var url = typeof input === 'string' ? input
      : (input instanceof Request ? input.url : String(input));
    var method = (init && init.method) ? init.method.toUpperCase() : 'GET';
    var isApi = url.indexOf('api.satellitemap.space') !== -1 ||
      url.indexOf('api2.satellitemap.space') !== -1;

    if (isApi) {
      if ((method === 'GET' || method === 'POST') &&
          url.indexOf('/satellites') !== -1 &&
          url.indexOf('/satellite/') === -1) {
        logStatus('Intercepted ' + method + ' /satellites');
        return jsonResponse(satResp);
      }
      if (method === 'POST' && url.indexOf('/tle') !== -1) {
        logStatus('Intercepted POST /tle');
        return jsonResponse(tleResp);
      }
      if (method === 'GET' && /\/satellite\/\d+/.test(url)) {
        var satIdMatch = url.match(/\/satellite\/(\d+)/);
        var satA = satIdMatch ? findSatById(satIdMatch[1]) : null;
        if (satA) {
          logStatus('Intercepted GET /satellite/' + satA.norad_id);
          return jsonResponse({ success: true, data: makeDetail(satA) });
        }
      }
      if (method === 'GET' && /\/astro\/satellite\/\d+/.test(url)) {
        var astroMatch = url.match(/\/astro\/satellite\/(\d+)/);
        var satB = astroMatch ? findSatById(astroMatch[1]) : null;
        if (satB) {
          logStatus('Intercepted GET /astro/satellite/' + satB.norad_id);
          return jsonResponse({ success: true, data: makeDetail(satB) });
        }
      }
      if (method === 'GET' && /\/satellite\/name\/[^/?#]+/.test(url)) {
        var nameMatch = url.match(/\/satellite\/name\/([^/?#]+)/);
        var decodedName = nameMatch ? decodeURIComponent(nameMatch[1]) : '';
        for (var j = 0; j < sats.length; j++) {
          if (sats[j].name === decodedName) {
            logStatus('Intercepted GET /satellite/name/' + sats[j].name);
            return jsonResponse({ success: true, data: makeDetail(sats[j]) });
          }
        }
      }
    }

    // Redirect combined_borders.bin to the correct local path
    if (url.indexOf('combined_borders.bin') !== -1) {
      return _orig('json/combined_borders.bin', init);
    }

    return _orig(input, init);
  }

  try {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      get: function() {
        return c4Fetch;
      },
      set: function(v) {
        if (typeof v === 'function' && v !== c4Fetch) {
          _orig = v.bind ? v.bind(window) : v;
          logStatus('Wrapped reassigned window.fetch');
        }
      }
    });
  } catch (e) {
    window.fetch = c4Fetch;
  }

  function clearStore(db, store) {
    try {
      var tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = function() {
        logStatus('Cleared IDB store: ' + store);
      };
    } catch (e) {}
  }

  function wipeDB(dbName) {
    var req = indexedDB.open(dbName);
    req.onsuccess = function(e) {
      var db = e.target.result;
      var names = Array.from(db.objectStoreNames);
      var satStores = names.filter(function(n) {
        return /sat|tle|constellation|orbit/i.test(n);
      });
      var targets = satStores.length > 0 ? satStores : names;
      targets.forEach(function(store) {
        clearStore(db, store);
      });
      db.close();
    };
    req.onupgradeneeded = function(e) {
      e.target.transaction.abort();
    };
  }

  if (typeof indexedDB !== 'undefined') {
    if (typeof indexedDB.databases === 'function') {
      indexedDB.databases().then(function(dbs) {
        var names = dbs.map(function(d) { return d.name; }).filter(Boolean);
        names.forEach(wipeDB);
      }).catch(function() {});
    } else {
      ['satellitemap', 'satellite-map', 'satellite_map', 'satellites', 'localforage', 'idb-keyval-store']
        .forEach(wipeDB);
    }
  }

  var done = false;
  var forceAttempts = 0;

  window.addEventListener('message', function(event) {
    var data = event && event.data;
    if (!data || data.source !== 'c4-parent') return;

    if (data.type === 'focus-satellite') {
      var satId = parseInt(data.norad_id, 10);
      if (!satId) return;
      if (currentGlobe && typeof currentGlobe.focusSatellite === 'function') {
        currentGlobe.focusSatellite(satId, 'c4-parent');
      } else if (currentGlobe) {
        toggleSatelliteSelection(currentGlobe, satId);
      }
      return;
    }

    if (data.type === 'clear-orbit') {
      if (currentGlobe && typeof currentGlobe._clearAllOrbits === 'function') {
        currentGlobe._clearAllOrbits();
      } else if (currentGlobe) {
        clearSelectedSatellite(currentGlobe);
      }
    }
  });

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function shellConfig(index) {
    if (index < 300) {
      return {
        altitude: 550,
        inclination: 53,
        planeCount: 20,
        satsPerPlane: 15,
        localIndex: index
      };
    }
    if (index < 420) {
      return {
        altitude: 530,
        inclination: 97.6,
        planeCount: 10,
        satsPerPlane: 12,
        localIndex: index - 300
      };
    }
    if (index < 444) {
      return {
        altitude: 21500,
        inclination: 55,
        planeCount: 3,
        satsPerPlane: 8,
        localIndex: index - 420
      };
    }
    return {
      altitude: 35786,
      inclination: 0,
      planeCount: 1,
      satsPerPlane: 6,
      localIndex: index - 444
    };
  }

  function getVisualOrbitRadius(cfg) {
    if (!cfg) return 1.2;
    return 1.18 + cfg.altitude / 6371;
  }

  function getSatelliteVisualProfile(cfg) {
    return {
      color: c4Color.slice(),
      size: 3.4
    };
  }

  function getStatusVisualProfile(state, cfg) {
    return getSatelliteVisualProfile(cfg);
  }

  function getSelectedSatelliteVisualProfile(cfg) {
    return getSatelliteVisualProfile(cfg);
  }

  function orbitPoint(radius, inclinationDeg, raanDeg, anomalyDeg) {
    var i = degToRad(inclinationDeg);
    var o = degToRad(raanDeg);
    var u = degToRad(anomalyDeg);
    var cosO = Math.cos(o);
    var sinO = Math.sin(o);
    var cosI = Math.cos(i);
    var sinI = Math.sin(i);
    var cosU = Math.cos(u);
    var sinU = Math.sin(u);
    var x = radius * (cosO * cosU - sinO * sinU * cosI);
    var y = radius * (sinO * cosU + cosO * sinU * cosI);
    var z = radius * (sinU * sinI);
    return [-y, z, -x];
  }

  function projectToScreen(mat, point, width, height) {
    var x = point[0];
    var y = point[1];
    var z = point[2];
    var w = mat[3] * x + mat[7] * y + mat[11] * z + mat[15];
    if (!w || w <= 0) return null;
    var clipX = mat[0] * x + mat[4] * y + mat[8] * z + mat[12];
    var clipY = mat[1] * x + mat[5] * y + mat[9] * z + mat[13];
    var clipZ = mat[2] * x + mat[6] * y + mat[10] * z + mat[14];
    var ndcX = clipX / w;
    var ndcY = clipY / w;
    var ndcZ = clipZ / w;
    if (ndcX < -1.2 || ndcX > 1.2 || ndcY < -1.2 || ndcY > 1.2 || ndcZ < -1.2 || ndcZ > 1.2) return null;
    return {
      x: (ndcX * 0.5 + 0.5) * width,
      y: (-ndcY * 0.5 + 0.5) * height
    };
  }

  function isFrontSide(globe, point) {
    if (!globe || !globe.eye) return true;
    var eye = globe.eye;
    var dot = point[0] * eye[0] + point[1] * eye[1] + point[2] * eye[2];
    return dot > 0;
  }

  function stationLinkTargets(globe, stationPoint, limit) {
    var sats = [];
    var i;
    if (!globe || !globe.dots || !globe.dots.movingPoints) return sats;
    for (i = 0; i < globe.dots.movingPoints.length; i++) {
      var sat = globe.dots.movingPoints[i];
      if (!sat || !sat.pos) continue;
      if (!isFrontSide(globe, sat.pos)) continue;
      var dx = sat.pos[0] - stationPoint[0];
      var dy = sat.pos[1] - stationPoint[1];
      var dz = sat.pos[2] - stationPoint[2];
      sats.push({ sat: sat, dist2: dx * dx + dy * dy + dz * dz });
    }
    sats.sort(function(a, b) { return a.dist2 - b.dist2; });
    return sats.slice(0, limit);
  }

  function pointDistance2(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    var dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
  }

  function bestStationForSat(sat) {
    if (!sat || !sat.pos) return null;
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < groundStations.length; i++) {
      var gs = groundStations[i];
      var stationPoint = latLonToPoint(gs.lat, gs.lon, 1.0018);
      var d2 = pointDistance2(sat.pos, stationPoint);
      if (d2 < bestDist) {
        bestDist = d2;
        best = {
          station: gs,
          point: stationPoint
        };
      }
    }
    return best;
  }

  function findGroundStation(id) {
    for (var i = 0; i < groundStations.length; i++) {
      if (groundStations[i].id === id) return groundStations[i];
    }
    return null;
  }

  function findSatByTopo(globe, shell, plane, slot) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return null;
    for (var i = 0; i < globe.dots.movingPoints.length; i++) {
      var sat = globe.dots.movingPoints[i];
      if (!sat || !sat._c4) continue;
      if (sat._c4.shell === shell && sat._c4.plane === plane && sat._c4.slot === slot) return sat;
    }
    return null;
  }

  function drawOverlay(globe) {
    ensureLinkCanvas();
    resizeLinkCanvas();
    if (!linkCtx) return;
    drawOverlay._lastDrawn = 0;

    // Allow drawing whenever we have a valid projection matrix
    if (!globe || !globe.worldViewProjection) return;
    // Only draw ISL/GSL for C4 constellation OR when we have C4 dots
    var isC4 = globe.show_constellation === 'c4' ||
               (globe.dots && globe.dots.movingPoints && globe.dots.movingPoints.length === 420 &&
                globe.dots.movingPoints[0] && globe.dots.movingPoints[0]._c4);
    if (!isC4) return;

    var rect = getGlRect();
    var width = rect.width;
    var height = rect.height;
    var mat = globe.worldViewProjection;
    var i;

    linkCtx.clearRect(0, 0, width, height);

    linkCtx.save();
    linkCtx.lineCap = 'round';

    // ISL 鈥?intra-plane chains (higher opacity)
    drawOrbitPlaneLinks(globe, mat, width, height);

    // ISL 鈥?inter-plane mesh (lower opacity, with polar cutoff)

    // GSL 鈥?ground-to-satellite curves
    drawStationLinks(globe, mat, width, height);

    // Ground station dots (always on top)
    for (i = 0; i < groundStations.length; i++) {
      var gs = groundStations[i];
      var point = latLonToPoint(gs.lat, gs.lon, 1.0018);
      if (!isFrontSide(globe, point)) continue;
      var screen = projectToScreen(mat, point, width, height);
      if (!screen) continue;

      linkCtx.beginPath();
      linkCtx.shadowColor = 'rgba(255,255,255,0.7)';
      linkCtx.shadowBlur = 10;
      linkCtx.fillStyle = 'rgba(255,255,255,0.98)';
      linkCtx.arc(screen.x, screen.y, 4.5, 0, Math.PI * 2);
      linkCtx.fill();
    }

    drawSatelliteMarkers(globe, mat, width, height);
    drawSelectedOrbit(globe, mat, width, height);
    drawSatelliteLabels(globe, mat, width, height);

    linkCtx.restore();
  }

  function satScreenPoint(globe, mat, width, height, sat) {
    if (!sat || !sat.pos || !isFrontSide(globe, sat.pos)) return null;
    return projectToScreen(mat, sat.pos, width, height);
  }

  function drawLine(a, b, color, width) {
    if (!a || !b) return false;
    linkCtx.beginPath();
    linkCtx.strokeStyle = color;
    linkCtx.lineWidth = width;
    linkCtx.moveTo(a.x, a.y);
    linkCtx.lineTo(b.x, b.y);
    linkCtx.stroke();
    return true;
  }

  function satelliteDisplayName(sat) {
    if (!sat) return '';
    return sat.name ||
      (sat.metadata && (sat.metadata.name || sat.metadata.sat_name)) ||
      (sat.tleData && sat.tleData.orbital_elements && sat.tleData.orbital_elements.sat_name) ||
      ('SAT ' + sat.norad_id);
  }

  function drawLabelBox(screen, text, selected) {
    if (!screen || !text) return;
    linkCtx.save();
    linkCtx.font = selected ? '600 12px Inter, Arial, sans-serif' : '500 11px Inter, Arial, sans-serif';
    linkCtx.textBaseline = 'middle';
    var metrics = linkCtx.measureText(text);
    var padX = selected ? 8 : 6;
    var boxW = Math.min(metrics.width + padX * 2, 180);
    var boxH = selected ? 24 : 20;
    var x = Math.min(Math.max(screen.x + 10, 6), Math.max(6, window.innerWidth - boxW - 6));
    var y = Math.min(Math.max(screen.y - boxH - 8, 6), Math.max(6, window.innerHeight - boxH - 6));

    linkCtx.shadowColor = selected ? 'rgba(66, 255, 175, 0.42)' : 'rgba(34, 211, 238, 0.24)';
    linkCtx.shadowBlur = selected ? 12 : 8;
    linkCtx.fillStyle = selected ? 'rgba(6, 20, 18, 0.82)' : 'rgba(3, 14, 24, 0.66)';
    linkCtx.strokeStyle = selected ? 'rgba(126, 255, 190, 0.74)' : 'rgba(116, 210, 255, 0.38)';
    linkCtx.lineWidth = selected ? 1.2 : 0.8;
    if (typeof linkCtx.roundRect === 'function') {
      linkCtx.beginPath();
      linkCtx.roundRect(x, y, boxW, boxH, selected ? 7 : 6);
      linkCtx.fill();
      linkCtx.stroke();
    } else {
      linkCtx.fillRect(x, y, boxW, boxH);
      linkCtx.strokeRect(x, y, boxW, boxH);
    }
    linkCtx.shadowBlur = 0;
    linkCtx.fillStyle = selected ? '#d9fff0' : '#dff7ff';
    linkCtx.fillText(text, x + padX, y + boxH * 0.5, boxW - padX * 2);

    linkCtx.beginPath();
    linkCtx.strokeStyle = selected ? 'rgba(126, 255, 190, 0.68)' : 'rgba(116, 210, 255, 0.34)';
    linkCtx.lineWidth = 0.8;
    linkCtx.moveTo(screen.x, screen.y);
    linkCtx.lineTo(x, y + boxH * 0.5);
    linkCtx.stroke();
    linkCtx.restore();
  }

  function drawSatelliteLabels(globe, mat, width, height) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return;
    var selectedIds = Object.keys(selectedOrbitSatIds);
    var drawn = Object.create(null);
    var i;

    for (i = 0; i < selectedIds.length; i++) {
      var satId = parseInt(selectedIds[i], 10);
      var selectedSat = findMovingSatellite(globe, satId);
      var selectedScreen = satScreenPoint(globe, mat, width, height, selectedSat);
      if (selectedScreen) {
        drawLabelBox(selectedScreen, satelliteDisplayName(selectedSat), true);
        drawn[satId] = true;
      }
    }

    var zoom = typeof globe.eyeDistance === 'number' ? globe.eyeDistance : 99;
    if (zoom > 2.25) return;

    var candidates = [];
    for (i = 0; i < globe.dots.movingPoints.length; i++) {
      var sat = globe.dots.movingPoints[i];
      if (!sat || drawn[sat.norad_id]) continue;
      var screen = satScreenPoint(globe, mat, width, height, sat);
      if (!screen) continue;
      var dx = screen.x - width * 0.5;
      var dy = screen.y - height * 0.5;
      candidates.push({ sat: sat, screen: screen, score: dx * dx + dy * dy });
    }
    candidates.sort(function(a, b) { return a.score - b.score; });

    var limit = zoom < 1.45 ? 32 : 14;
    for (i = 0; i < candidates.length && i < limit; i++) {
      drawLabelBox(candidates[i].screen, satelliteDisplayName(candidates[i].sat), false);
    }
  }

  function drawSatelliteMarker(screen, sat, cfg, selected, state) {
    if (!screen || !cfg || !linkCtx) return;

    var profile = selected
      ? getSelectedSatelliteVisualProfile(cfg)
      : getStatusVisualProfile(state, cfg);
    var size = Math.max(8, profile.size * 3.2);
    var centerX = window.innerWidth * 0.5;
    var centerY = window.innerHeight * 0.5;
    var angle = Math.atan2(screen.y - centerY, screen.x - centerX) + Math.PI * 0.5;
    var bodyW = size * 0.28;
    var bodyH = size * 0.56;
    var panelW = size * 0.54;
    var panelH = size * 0.34;

    linkCtx.save();
    linkCtx.translate(screen.x, screen.y);
    linkCtx.rotate(angle);
    linkCtx.globalAlpha = state && state.enabled === false ? 0.18 : 1;
    linkCtx.shadowColor = selected ? 'rgba(130, 255, 240, 0.58)' : 'rgba(86, 220, 255, 0.34)';
    linkCtx.shadowBlur = selected ? 18 : 11;

    var leftPanel = linkCtx.createLinearGradient(-panelW, -panelH * 0.5, -bodyW, panelH * 0.5);
    leftPanel.addColorStop(0, 'rgba(8, 28, 48, 0.94)');
    leftPanel.addColorStop(0.5, 'rgba(34, 103, 150, 0.86)');
    leftPanel.addColorStop(1, 'rgba(8, 16, 30, 0.96)');
    var rightPanel = linkCtx.createLinearGradient(bodyW, -panelH * 0.5, panelW, panelH * 0.5);
    rightPanel.addColorStop(0, 'rgba(8, 16, 30, 0.96)');
    rightPanel.addColorStop(0.5, 'rgba(34, 103, 150, 0.86)');
    rightPanel.addColorStop(1, 'rgba(8, 28, 48, 0.94)');

    linkCtx.strokeStyle = selected ? 'rgba(190, 255, 244, 0.62)' : 'rgba(124, 218, 255, 0.38)';
    linkCtx.lineWidth = 1;

    linkCtx.fillStyle = leftPanel;
    linkCtx.beginPath();
    if (typeof linkCtx.roundRect === 'function') {
      linkCtx.roundRect(-panelW - 1, -panelH * 0.5, panelW, panelH, panelH * 0.28);
    } else {
      linkCtx.rect(-panelW - 1, -panelH * 0.5, panelW, panelH);
    }
    linkCtx.fill();
    linkCtx.stroke();

    linkCtx.fillStyle = rightPanel;
    linkCtx.beginPath();
    if (typeof linkCtx.roundRect === 'function') {
      linkCtx.roundRect(bodyW + 1, -panelH * 0.5, panelW, panelH, panelH * 0.28);
    } else {
      linkCtx.rect(bodyW + 1, -panelH * 0.5, panelW, panelH);
    }
    linkCtx.fill();
    linkCtx.stroke();

    linkCtx.fillStyle = 'rgba(18, 28, 40, 0.98)';
    linkCtx.beginPath();
    if (typeof linkCtx.roundRect === 'function') {
      linkCtx.roundRect(-bodyW * 0.5, -bodyH * 0.5, bodyW, bodyH, bodyW * 0.45);
    } else {
      linkCtx.rect(-bodyW * 0.5, -bodyH * 0.5, bodyW, bodyH);
    }
    linkCtx.fill();

    var coreGlow = linkCtx.createRadialGradient(0, 0, 1, 0, 0, size * 0.18);
    coreGlow.addColorStop(0, selected ? 'rgba(208, 255, 248, 0.95)' : 'rgba(114, 233, 255, 0.92)');
    coreGlow.addColorStop(1, 'rgba(114, 233, 255, 0)');
    linkCtx.fillStyle = coreGlow;
    linkCtx.beginPath();
    linkCtx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
    linkCtx.fill();

    linkCtx.shadowBlur = 0;
    linkCtx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    linkCtx.lineWidth = 1;
    linkCtx.beginPath();
    linkCtx.moveTo(-bodyW * 0.42, -bodyH * 0.08);
    linkCtx.lineTo(bodyW * 0.42, -bodyH * 0.08);
    linkCtx.moveTo(-bodyW * 0.42, bodyH * 0.18);
    linkCtx.lineTo(bodyW * 0.42, bodyH * 0.18);
    linkCtx.stroke();

    linkCtx.fillStyle = selected ? 'rgba(216, 255, 250, 0.72)' : 'rgba(197, 244, 255, 0.5)';
    linkCtx.fillRect(-bodyW * 0.14, -bodyH * 0.08, bodyW * 0.28, bodyH * 0.16);
    linkCtx.restore();
  }

  function drawSatelliteMarkers(globe, mat, width, height) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return;
    for (var i = 0; i < globe.dots.movingPoints.length; i++) {
      var sat = globe.dots.movingPoints[i];
      if (!sat || !sat._c4 || !sat.pos || !isFrontSide(globe, sat.pos)) continue;
      var screen = projectToScreen(mat, sat.pos, width, height);
      if (!screen) continue;
      drawSatelliteMarker(
        screen,
        sat,
        shellConfig(i),
        !!selectedOrbitSatIds[sat.norad_id],
        satStateById[i + 1] || null
      );
    }
  }

  function drawCurve(a, b, color, width, bend) {
    if (!a || !b) return false;
    var mx = (a.x + b.x) * 0.5;
    var my = (a.y + b.y) * 0.5;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (!len) return false;
    var curve = typeof bend === 'number' ? bend : Math.min(72, Math.max(20, len * 0.12));
    var glCanvas = document.getElementById('glCanvas');
    var centerX = glCanvas ? glCanvas.getBoundingClientRect().width * 0.5 : window.innerWidth * 0.5;
    var centerY = glCanvas ? glCanvas.getBoundingClientRect().height * 0.5 : window.innerHeight * 0.5;
    var rx = mx - centerX;
    var ry = my - centerY;
    var rLen = Math.sqrt(rx * rx + ry * ry);
    var ux;
    var uy;

    if (rLen > 1) {
      ux = rx / rLen;
      uy = ry / rLen;
    } else {
      ux = -dy / len;
      uy = dx / len;
    }

    var cx = mx + ux * curve;
    var cy = my + uy * curve;

    linkCtx.beginPath();
    linkCtx.strokeStyle = color;
    linkCtx.lineWidth = width;
    linkCtx.moveTo(a.x, a.y);
    linkCtx.quadraticCurveTo(cx, cy, b.x, b.y);
    linkCtx.stroke();
    return true;
  }

  // Elevation angle check (degrees) between a satellite pos and ground station point
  // Both are unit-sphere vectors (radius ~1). Returns elevation in degrees.
  function elevationDeg(satPos, stationPoint) {
    // vector from station to sat
    var dx = satPos[0] - stationPoint[0];
    var dy = satPos[1] - stationPoint[1];
    var dz = satPos[2] - stationPoint[2];
    var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (!dist) return -90;
    // dot with station normal (station point IS its own surface normal on unit sphere)
    var dot = (dx * stationPoint[0] + dy * stationPoint[1] + dz * stationPoint[2]) / dist;
    return Math.asin(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
  }

  // lat of a 3D globe-unit point (y is up)
  function pointLat(p) {
    var r = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]);
    return r ? Math.asin(p[1] / r) * 180 / Math.PI : 0;
  }

  // Inter-plane ISL: adjacent orbital planes, zigzag for Shell A, polar cutoff for Shell B
  function drawInterPlaneLinks(globe, mat, width, height) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return;
    var mps = globe.dots.movingPoints;
    var drawn = 0;

    // Shell A: 20 planes 脳 15 sats, zigzag inter-plane
    var planeA = [];
    var pa, i;
    for (pa = 0; pa < 20; pa++) {
      var arr = [];
      for (i = 0; i < 15; i++) {
        var sat = mps[pa * 15 + i];
        if (sat && sat._c4 && sat.pos) arr.push(sat);
      }
      planeA.push(arr);
    }
    for (pa = 0; pa < 20; pa++) {
      var nextP = (pa + 1) % 20;
      var plA = planeA[pa];
      var plB = planeA[nextP];
      for (i = 0; i < 15; i++) {
        var sA = plA[i];
        // Zigzag: even slots connect to slot i, odd slots connect to slot i+1
        var jB = (pa % 2 === 0) ? i : (i + 1) % 15;
        var sB = plB[jB];
        if (!sA || !sB || !sA.pos || !sB.pos) continue;
        if (!isFrontSide(globe, sA.pos) && !isFrontSide(globe, sB.pos)) continue;
        var scA = projectToScreen(mat, sA.pos, width, height);
        var scB = projectToScreen(mat, sB.pos, width, height);
        if (drawLine(scA, scB, 'rgba(0,200,160,0.18)', 0.7)) drawn++;
      }
    }

    // Shell B: 10 planes 脳 12 sats, cut at |lat| > 70掳
    var planeB = [];
    var pb;
    for (pb = 0; pb < 10; pb++) {
      var arrB = [];
      for (i = 0; i < 12; i++) {
        var satB = mps[300 + pb * 12 + i];
        if (satB && satB._c4 && satB.pos) arrB.push(satB);
      }
      planeB.push(arrB);
    }
    for (pb = 0; pb < 10; pb++) {
      var nextPB = (pb + 1) % 10;
      var plAB = planeB[pb];
      var plBB = planeB[nextPB];
      for (i = 0; i < 12; i++) {
        var sAB = plAB[i];
        var sBB = plBB[i];
        if (!sAB || !sBB || !sAB.pos || !sBB.pos) continue;
        // Polar cutoff: skip if either sat is above 70掳 latitude
        if (Math.abs(pointLat(sAB.pos)) > 70 || Math.abs(pointLat(sBB.pos)) > 70) continue;
        if (!isFrontSide(globe, sAB.pos) && !isFrontSide(globe, sBB.pos)) continue;
        var scAB = projectToScreen(mat, sAB.pos, width, height);
        var scBB = projectToScreen(mat, sBB.pos, width, height);
        if (drawLine(scAB, scBB, 'rgba(0,180,220,0.18)', 0.7)) drawn++;
      }
    }
    drawOverlay._lastDrawn = (drawOverlay._lastDrawn || 0) + drawn;
  }

  function drawStationLinks(globe, mat, width, height) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return;
    var drawn = 0;
    for (var gi = 0; gi < staticGroundLinkPlan.length; gi++) {
      var plan = staticGroundLinkPlan[gi];
      var gs = findGroundStation(plan.gs);
      if (!gs) continue;
      var gsPoint = latLonToPoint(gs.lat, gs.lon, 1.0018);
      if (!isFrontSide(globe, gsPoint)) continue;
      var gsScreen = projectToScreen(mat, gsPoint, width, height);
      if (!gsScreen) continue;

      for (var li = 0; li < plan.links.length; li++) {
        var topo = plan.links[li];
        var sat = findSatByTopo(globe, topo.shell, topo.plane, topo.slot);
        var satScreen = satScreenPoint(globe, mat, width, height, sat);
        if (!satScreen) continue;
        if (drawCurve(gsScreen, satScreen, 'rgba(40,170,110,0.5)', 0.9, 22)) drawn++;
      }
    }
    drawOverlay._lastDrawn = (drawOverlay._lastDrawn || 0) + drawn;
  }

  function drawPlaneCurve(points, color, width, bend) {
    var drew = 0;
    for (var i = 0; i < points.length - 1; i++) {
      if (drawCurve(points[i], points[i + 1], color, width, bend)) drew++;
    }
    return drew;
  }

  function buildVisiblePlaneScreens(globe, mat, width, height, satsInPlane) {
    var screens = [];
    for (var i = 0; i < satsInPlane.length; i++) {
      var sat = satsInPlane[i];
      var screen = satScreenPoint(globe, mat, width, height, sat);
      if (!screen) continue;
      screens.push({
        sat: sat,
        screen: screen,
        slot: sat._c4.slot
      });
    }
    screens.sort(function(a, b) { return a.slot - b.slot; });
    return screens;
  }

  function drawOrbitChains(globe, mat, width, height, satsInPlane, color, widthPx, bend) {
    var screens = buildVisiblePlaneScreens(globe, mat, width, height, satsInPlane);
    if (screens.length < 2) return 0;
    var pts = [];
    var step = screens.length >= 12 ? 2 : 1;
    for (var i = 0; i < screens.length; i += step) {
      pts.push(screens[i].screen);
    }
    if (pts.length < 2 && screens.length >= 2) {
      pts = [screens[0].screen, screens[screens.length - 1].screen];
    }
    return drawPlaneCurve(pts, color, widthPx, bend);
  }

  function drawOrbitPlaneLinks(globe, mat, width, height) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return;
    var byPlane = {};
    var i;
    for (i = 0; i < globe.dots.movingPoints.length; i++) {
      var sat = globe.dots.movingPoints[i];
      if (!sat || !sat._c4) continue;
      var key = sat._c4.shell + '-' + sat._c4.plane;
      if (!byPlane[key]) byPlane[key] = [];
      byPlane[key].push(sat);
    }
    var keys = Object.keys(byPlane);
    var drawn = 0;
    for (i = 0; i < keys.length; i++) {
      var satsInPlane = byPlane[keys[i]];
      drawn += drawOrbitChains(globe, mat, width, height, satsInPlane, 'rgba(40,170,110,0.38)', 0.8, 14);
    }
    drawOverlay._lastDrawn = (drawOverlay._lastDrawn || 0) + drawn;
  }

  function drawSelectedOrbit(globe, mat, width, height) {
    var selectedIds = Object.keys(selectedOrbitSatIds);
    if (!selectedIds.length || !globe || !globe.dots || !globe.dots.movingPoints) return;
    var drawn = 0;
    for (var i = 0; i < selectedIds.length; i++) {
      var satId = parseInt(selectedIds[i], 10);
      var sat = null;
      for (var j = 0; j < globe.dots.movingPoints.length; j++) {
        if (globe.dots.movingPoints[j] && globe.dots.movingPoints[j].norad_id === satId) {
          sat = globe.dots.movingPoints[j];
          break;
        }
      }
      if (!sat || !sat._c4) continue;
      var samples = 160;
      var prev = null;
      for (var s = 0; s <= samples; s++) {
        var point = orbitPoint(sat._c4.radius, sat._c4.inclination, sat._c4.raan, (s / samples) * 360);
        if (!isFrontSide(globe, point)) {
          prev = null;
          continue;
        }
        var screen = projectToScreen(mat, point, width, height);
        if (prev && screen && drawLine(prev, screen, 'rgba(100, 255, 160, 0.72)', 1.15)) drawn++;
        prev = screen;
      }
    }
    drawOverlay._lastDrawn = (drawOverlay._lastDrawn || 0) + drawn;
  }

  function startLinkOverlay(globe) {
    if (linkAnimId) cancelAnimationFrame(linkAnimId);
    ensurePeHelper();
    ensureLinkCanvas();
    if (linkCanvas) {
      linkCanvas.style.display = 'block';
    }
    function frame() {
      drawOverlay(globe);
      linkAnimId = requestAnimationFrame(frame);
    }
    frame();
    logStatus('Ground stations + sparse links enabled');
  }

  function buildConstellationState(count, timeMs) {
    var earthRadiusKm = 6371;
    var dpA = new Float32Array(count * 3);
    var dpB = new Float32Array(count * 3);
    var vA = new Float32Array(count * 3);
    var dotSizes = new Float32Array(count);
    var phase = (timeMs || Date.now()) / 1000;
    var idx;

    for (idx = 0; idx < count; idx++) {
      var cfg = shellConfig(idx);
      var plane = Math.floor(cfg.localIndex / cfg.satsPerPlane);
      var slot = cfg.localIndex % cfg.satsPerPlane;
      var radius = getVisualOrbitRadius(cfg);
      var raan = (plane / cfg.planeCount) * 360;
      var baseAnomaly = (slot / cfg.satsPerPlane) * 360 + (plane / cfg.planeCount) * (360 / cfg.satsPerPlane);
      var speedDegPerSec = cfg.altitude === 550 ? 0.06 : 0.058;
      var anomalyA = (baseAnomaly + phase * speedDegPerSec) % 360;
      var anomalyB = (anomalyA + speedDegPerSec * 8) % 360;

      var a = orbitPoint(radius, cfg.inclination, raan, anomalyA);
      var b = orbitPoint(radius, cfg.inclination, raan, anomalyB);
      var off = idx * 3;
      dpA[off] = a[0];
      dpA[off + 1] = a[1];
      dpA[off + 2] = a[2];
      dpB[off] = b[0];
      dpB[off + 1] = b[1];
      dpB[off + 2] = b[2];
      vA[off] = b[0] - a[0];
      vA[off + 1] = b[1] - a[1];
      vA[off + 2] = b[2] - a[2];
      dotSizes[idx] = 3.4;
    }

    return {
      dpA: dpA,
      dpB: dpB,
      vA: vA,
      dotSizes: dotSizes
    };
  }

  function uploadAttrib(globe, name, data) {
    try {
      var gl = globe && globe.gl;
      var info = globe && globe.dotsBufferInfo && globe.dotsBufferInfo.attribs && globe.dotsBufferInfo.attribs[name];
      if (!gl || !info || !info.buffer) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, info.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    } catch (e) {}
  }

  function uploadPickAttrib(globe, name, data) {
    try {
      var gl = globe && globe.gl;
      var info = globe && globe.pickBufferInfo && globe.pickBufferInfo.attribs && globe.pickBufferInfo.attribs[name];
      if (!gl || !info || !info.buffer) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, info.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    } catch (e) {}
  }

  function countNonZeroPositions(arr, count) {
    var nonZero = 0;
    var i;
    if (!arr) return 0;
    for (i = 0; i < count; i++) {
      if (arr[i * 3] || arr[i * 3 + 1] || arr[i * 3 + 2]) nonZero++;
    }
    return nonZero;
  }

  function startDiagnostics(globe) {
    if (diagnosticsTimer) clearInterval(diagnosticsTimer);
    diagnosticsTimer = setInterval(function() {
      if (!globe || !globe.dots || !globe.dots.movingPoints) return;
      var count = globe.dots.movingPoints.length;
      var nonZeroDpA = countNonZeroPositions(globe.dots.dpA, count);
      var nonZeroPos = 0;
      var i;
      for (i = 0; i < count; i++) {
        var sat = globe.dots.movingPoints[i];
        if (sat && sat.pos && (sat.pos[0] || sat.pos[1] || sat.pos[2])) nonZeroPos++;
      }
      var drawnLinks = typeof drawOverlay._lastDrawn === 'number' ? drawOverlay._lastDrawn : 0;
      logStatus('diag dots=' + count + ' dpA=' + nonZeroDpA + ' pos=' + nonZeroPos + ' links=' + drawnLinks);
    }, 2500);
  }

  function setSelectedSatellite(globe, satId) {
    var numericId = satId == null ? null : parseInt(satId, 10);
    if (!numericId) return null;
    selectedOrbitSatIds = Object.create(null);
    selectedOrbitSatIds[numericId] = true;
    selectedSatId = numericId;
    if (globe) applyC4Positions(globe);
    emitSelection(numericId);
    if (globe) drawOverlay(globe);
    return numericId;
  }

  function clearSelectedSatellite(globe, satId) {
    var numericId = satId == null ? null : parseInt(satId, 10);
    selectedOrbitSatIds = Object.create(null);
    selectedSatId = null;
    if (globe) applyC4Positions(globe);
    emitSelection(selectedSatId);
    if (globe) drawOverlay(globe);
  }

  function toggleSatelliteSelection(globe, satId) {
    var numericId = satId == null ? null : parseInt(satId, 10);
    var now = Date.now();
    if (numericId && lastToggleSatId === numericId && (now - lastToggleAt) < 220) {
      return selectedSatId;
    }
    lastToggleSatId = numericId;
    lastToggleAt = now;
    if (!numericId) {
      clearSelectedSatellite(globe);
      if (globe && typeof globe._c4OrigClearAllOrbits === 'function') {
        globe._c4OrigClearAllOrbits();
      }
      return null;
    }
    if (selectedSatId === numericId) {
      clearSelectedSatellite(globe, numericId);
      return null;
    }
    setSelectedSatellite(globe, numericId);
    return numericId;
  }

  function applyC4Positions(globe) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return false;
    currentGlobe = globe;
    var count = globe.dots.movingPoints.length;
    if (count !== 420) return false;
    var i;
    var state = buildConstellationState(count, globe && globe.wallclock ? globe.wallclock.now() : Date.now());
    var progress = typeof globe.segment_progress === 'number' ? globe.segment_progress : 0;

    for (i = 0; i < count; i++) {
      var sat = globe.dots.movingPoints[i];
      var cfg = shellConfig(i);
      var satState = satStateById[i + 1] || buildStateForSat(sats[i], i);
      var off = i * 3;
      var px = state.dpA[off] + (state.dpB[off] - state.dpA[off]) * progress;
      var py = state.dpA[off + 1] + (state.dpB[off + 1] - state.dpA[off + 1]) * progress;
      var pz = state.dpA[off + 2] + (state.dpB[off + 2] - state.dpA[off + 2]) * progress;
      sat.ndx = i;
      sat.name = 'LEO ' + (i + 1);
      sat.norad_id = i + 1;
      sat.pos = [px, py, pz];
      sat._lastCalc = Date.now();
      sat._c4 = {
        shell: cfg.altitude === 550 ? 'A' : 'B',
        plane: Math.floor(cfg.localIndex / cfg.satsPerPlane),
        slot: cfg.localIndex % cfg.satsPerPlane,
        altitude: cfg.altitude,
        inclination: cfg.inclination,
        radius: 1 + cfg.altitude / 6371,
        raan: (Math.floor(cfg.localIndex / cfg.satsPerPlane) / cfg.planeCount) * 360
      };
      if (!sat.metadata) sat.metadata = {};
      sat.metadata.sat_name = 'LEO ' + (i + 1);
      sat.metadata.name = 'LEO ' + (i + 1);
      sat.metadata.norad_id = i + 1;
      sat.color = c4Color.slice();
      if (sat.tleData) {
        sat.tleData.norad = i + 1;
        if (sat.tleData.orbital_elements) {
          sat.tleData.orbital_elements.norad_id = i + 1;
          sat.tleData.orbital_elements.sat_name = 'LEO ' + (i + 1);
        }
      }
    }

    globe.dots.dpA = state.dpA;
    globe.dots.dpB = state.dpB;
    globe.dots.vA = state.vA;
    uploadAttrib(globe, 'positionA', globe.dots.dpA);
    uploadAttrib(globe, 'positionB', globe.dots.dpB);
    uploadAttrib(globe, 'vectorA', globe.dots.vA);
    uploadPickAttrib(globe, 'positionA', globe.dots.dpA);
    uploadPickAttrib(globe, 'positionB', globe.dots.dpB);

    if (globe.dots.dotSizes && globe.dots.dotSizes.length === count) {
      for (i = 0; i < count; i++) globe.dots.dotSizes[i] = 3.6;
      uploadAttrib(globe, 'size', globe.dots.dotSizes);
      uploadPickAttrib(globe, 'size', globe.dots.dotSizes);
    }
    globe.sat_size_multiple = 1.9;
    if (typeof globe._setBgTitle === 'function') globe._setBgTitle();
    if (globe.footprintRenderer && typeof globe.footprintRenderer.newDataBinding === 'function') {
      globe.footprintRenderer.newDataBinding(globe.dotsBufferInfo, count);
    }

    var nonZero = countNonZeroPositions(globe.dots.dpA, count);
    logStatus('Applied C4 positions, visibleCandidates=' + nonZero + ', size=3.6');
    return true;
  }

  function findMovingSatellite(globe, satId) {
    if (!globe || !globe.dots || !globe.dots.movingPoints) return null;
    var numericId = satId == null ? null : parseInt(satId, 10);
    if (!numericId) return null;
    for (var i = 0; i < globe.dots.movingPoints.length; i++) {
      var sat = globe.dots.movingPoints[i];
      if (sat && sat.norad_id === numericId) return sat;
    }
    return null;
  }

  function tryLoadC4(globe, reason) {
    forceAttempts++;
    if (!globe || typeof globe.setSatellites !== 'function') {
      logStatus('Skip load attempt ' + forceAttempts + ' (' + reason + '): no setSatellites');
      return;
    }
    logStatus('Load attempt ' + forceAttempts + ' via ' + reason);
    globe.setSatellites('c4').then(function() {
      var count = globe.dots && globe.dots.movingPoints ? globe.dots.movingPoints.length : 0;
      logStatus('setSatellites("c4") resolved, dots=' + count);
      applyC4Positions(globe);
      startLinkOverlay(globe);
      startDiagnostics(globe);
    }).catch(function(err) {
      logStatus('setSatellites("c4") error: ' + (err && err.message ? err.message : err));
    });
  }

  function patch(globe, key) {
    if (done) return;
    done = true;
    logStatus('Globe set at window.' + key + ', patching visuals');

    globe._colorAndSize = function() {
      return { color: c4Color.slice(), sz: 3.6 };
    };
    globe.sat_size_multiple = 1.9;
    setTimeout(function() {
      try {
        var cv = document.getElementById('glCanvas');
        if (cv) cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:block;';
      } catch(e) {}
    }, 300);
    ensureLinkCanvas();

    if (typeof globe._clearAllOrbits === 'function') {
      globe._c4OrigClearAllOrbits = globe._clearAllOrbits.bind(globe);
      globe._clearAllOrbits = function() {
        clearSelectedSatellite(this);
        return this._c4OrigClearAllOrbits();
      };
    }

    if (typeof globe._calculateSatelliteOrbit === 'function') {
      globe._c4OrigCalculateSatelliteOrbit = globe._calculateSatelliteOrbit.bind(globe);
      globe._calculateSatelliteOrbit = function(sat) {
        if (this.show_constellation === 'c4' && sat && sat.norad_id) {
          return toggleSatelliteSelection(this, sat.norad_id);
        }
        return this._c4OrigCalculateSatelliteOrbit(sat);
      };
    }

    if (typeof globe.focusSatellite === 'function') {
      globe._c4OrigFocusSatellite = globe.focusSatellite.bind(globe);
      globe.focusSatellite = function(id, mode) {
        var satId = parseInt(id, 10);
        if (this.show_constellation === 'c4') {
          if (mode === 'c4-parent') {
            if (!satId) {
              clearSelectedSatellite(this);
              if (typeof this._c4OrigClearAllOrbits === 'function') {
                this._c4OrigClearAllOrbits();
              }
              return null;
            }
            if (selectedSatId === satId) {
              clearSelectedSatellite(this, satId);
              return null;
            }
            setSelectedSatellite(this, satId);
            return satId;
          }
          return this._c4OrigFocusSatellite(id, mode);
        }
        return this._c4OrigFocusSatellite(id, mode);
      };
    }

    if (typeof globe._positionRecalc === 'function') {
      globe._c4OrigPositionRecalc = globe._positionRecalc.bind(globe);
      globe._positionRecalc = function(t, e, o) {
        if (this.show_constellation === 'c4' && this.dots && this.dots.movingPoints && this.dots.movingPoints.length === 420) {
          var recalced = this._c4OrigPositionRecalc(t, e, o);
          applyC4Positions(this);
          drawOverlay(this);
          return recalced;
        }
        return this._c4OrigPositionRecalc(t, e, o);
      };
    }

    setTimeout(function() {
      forceEarthVisuals(globe);
      tryLoadC4(globe, 't+1s');
    }, 1000);
    setTimeout(function() {
      forceEarthVisuals(globe);
      tryLoadC4(globe, 't+3s');
    }, 3000);
    setTimeout(function() {
      forceEarthVisuals(globe);
      tryLoadC4(globe, 't+6s');
    }, 6000);
    setTimeout(function() {
      forceEarthVisuals(globe);
      tryLoadC4(globe, 't+10s');
    }, 10000);
    emitState();
    broadcast('c4-ready', { ready: true });
  }

  var _globeVal;
  var _blueVal;

  try {
    Object.defineProperty(window, 'globe', {
      configurable: true,
      enumerable: true,
      get: function() { return _globeVal; },
      set: function(v) {
        _globeVal = v;
        if (v && typeof v === 'object') patch(v, 'globe');
      }
    });
  } catch (e) {}

  try {
    Object.defineProperty(window, 'blueGlobe', {
      configurable: true,
      enumerable: true,
      get: function() { return _blueVal; },
      set: function(v) {
        _blueVal = v;
        if (v && typeof v === 'object' && !done) patch(v, 'blueGlobe');
      }
    });
  } catch (e) {}

  var elapsed = 0;
  var t = setInterval(function() {
    elapsed += 500;
    if (done) { clearInterval(t); return; }

    // Check globe/blueGlobe directly 鈥?covers both assignment and defineProperty cases
    var gv = window.globe;
    function isGlobe(o) {
      return o && typeof o === 'object' && (typeof o.setSatellites === 'function' || typeof o._calculateSatelliteOrbit === 'function');
    }
    if (isGlobe(gv)) { clearInterval(t); patch(gv, 'globe'); return; }
    var bv = window.blueGlobe;
    if (isGlobe(bv)) { clearInterval(t); patch(bv, 'blueGlobe'); return; }

    var keys = Object.keys(window);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'globe' || k === 'blueGlobe') continue;
      try {
        var v = window[k];
        if (isGlobe(v)) { clearInterval(t); patch(v, k); return; }
      } catch (e) {}
    }
  }, 500);

  setTimeout(function() {
    clearInterval(t);
    if (!done) {
      logStatus('Globe never found after 60s');
    }
  }, 60000);

  window.__c4Manager = {
    listSatellites: function() {
      return listSatelliteStates();
    },
    getSelectedSatellite: function() {
      return selectedSatId ? (satStateById[selectedSatId] || null) : null;
    },
    selectSatellite: function(id) {
      var satId = parseInt(id, 10);
      if (currentGlobe && typeof currentGlobe.focusSatellite === 'function') {
        currentGlobe.focusSatellite(satId, 'c4-parent');
      } else if (currentGlobe) {
        toggleSatelliteSelection(currentGlobe, satId);
      }
      return this.getSelectedSatellite();
    },
    updateSatellite: function(payload) {
      if (!payload || payload.id == null) throw new Error('Satellite id is required');
      var satId = parseInt(payload.id, 10);
      var state = satStateById[satId];
      if (!state) throw new Error('Satellite not found');
      if (payload.name != null && String(payload.name).trim()) state.name = String(payload.name).trim();
      if (payload.status != null && String(payload.status).trim()) state.status = String(payload.status).trim();
      if (payload.enabled != null) state.enabled = !!payload.enabled;
      if (payload.cpu != null && isFinite(payload.cpu)) state.cpu = Number(payload.cpu);
      if (payload.temp != null && isFinite(payload.temp)) state.temp = Number(payload.temp);
      if (payload.notes != null) state.notes = String(payload.notes);
      satStateById[satId] = state;
      refreshGlobeState();
      return state;
    },
    deleteSatellite: function(id) {
      var satId = parseInt(id, 10);
      var state = satStateById[satId];
      if (!state) throw new Error('Satellite not found');
      state.enabled = false;
      state.status = 'inactive';
      satStateById[satId] = state;
      if (selectedSatId === satId) {
        clearSelectedSatellite(currentGlobe, satId);
      }
      refreshGlobeState();
      return state;
    },
    addSatellite: function(payload) {
      var freeState = null;
      var i;
      for (i = 0; i < sats.length; i++) {
        if (satStateById[sats[i].norad_id] && satStateById[sats[i].norad_id].enabled === false) {
          freeState = satStateById[sats[i].norad_id];
          break;
        }
      }
      if (!freeState) throw new Error('No deleted satellite slot available. Delete one first.');
      freeState.enabled = true;
      freeState.status = payload && payload.status ? String(payload.status) : 'active';
      freeState.name = payload && payload.name ? String(payload.name).trim() : freeState.originalName;
      freeState.cpu = payload && payload.cpu != null ? Number(payload.cpu) : freeState.cpu;
      freeState.temp = payload && payload.temp != null ? Number(payload.temp) : freeState.temp;
      freeState.notes = payload && payload.notes != null ? String(payload.notes) : '';
      satStateById[freeState.id] = freeState;
      refreshGlobeState();
      return freeState;
    }
  };

  logStatus('Injector ready');
})();
