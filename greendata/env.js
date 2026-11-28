/* Hendy in Green Data · Environmental data page
 * Biodiversity (iNaturalist + GBIF), soil (SoilGrids), air (CAMS) and water (GloFAS) for a chosen place.
 * Every number comes from the source at view time (soil for the listed places is read from data/soil.json,
 * saved from SoilGrids, because soil does not change from day to day and the SoilGrids API is often busy).
 */
(function () {
  'use strict';
  var t = window.t || function (s) { var a = arguments; return String(s).replace(/\{(\d)\}/g, function (_, i) { return a[+i + 1]; }); };
  var LOC = window.GD_LOCALE || 'en-US', LANG = window.GD_LANG || 'en';
  var INAT_LOCALE = { en: 'en', es: 'es', pt: 'pt-BR', fr: 'fr', de: 'de', zh: 'zh-CN' }[LANG] || 'en';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(v, d) { return v == null || isNaN(v) ? '–' : Number(v).toLocaleString(LOC, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function getJSON(url, tries) {
    tries = tries || 2;
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) {
      if (tries <= 1) throw e;
      return new Promise(function (ok) { setTimeout(ok, 2500); }).then(function () { return getJSON(url, tries - 1); });
    });
  }

  var PLACES = [
    { id: 'huascaran', name: 'Huascarán National Park', region: 'Áncash', lat: -9.07, lon: -77.62 },
    { id: 'cusco', name: 'Sacred Valley', region: 'Cusco', lat: -13.33, lon: -72.08 },
    { id: 'huaytapallana', name: 'Huaytapallana', region: 'Junín', lat: -11.93, lon: -75.06 },
    { id: 'lachay', name: 'Lomas de Lachay', region: 'Lima', lat: -11.36, lon: -77.37 },
    { id: 'paracas', name: 'Paracas', region: 'Ica', lat: -13.85, lon: -76.25 },
    { id: 'titicaca', name: 'Lake Titicaca', region: 'Puno', lat: -15.75, lon: -70.1 },
    { id: 'manu', name: 'Manu', region: 'Madre de Dios', lat: -12.6, lon: -71.4 },
    { id: 'tambopata', name: 'Tambopata', region: 'Madre de Dios', lat: -12.85, lon: -69.4 },
    { id: 'iquitos', name: 'Iquitos', region: 'Loreto', lat: -3.85, lon: -73.35 },
    { id: 'pucallpa', name: 'Pucallpa', region: 'Ucayali', lat: -8.40, lon: -74.55 },
    { id: 'tumbes', name: 'Tumbes mangroves', region: 'Tumbes', lat: -3.45, lon: -80.3 },
    { id: 'arequipa', name: 'Arequipa countryside', region: 'Arequipa', lat: -16.35, lon: -71.6 }
  ];
  var RADIUS = 15; // km around the point
  var state = { lat: PLACES[0].lat, lon: PLACES[0].lon, label: PLACES[0].name, placeId: PLACES[0].id, tab: 'biota' };
  var cache = {}, soilFile = null;

  // ------------------------------------------------------------------ plain-language box (same look as the home charts)
  function explain(simple, tips) {
    return '<div class="explainer"><p class="ex-simple"><b>' + esc(t('In simple terms:')) + '</b> ' + simple + '</p>' +
      '<details class="ex-how"><summary>' + esc(t('How to read this?')) + '</summary><ul>' +
      tips.map(function (x) { return '<li>' + esc(t(x)) + '</li>'; }).join('') + '</ul></details></div>';
  }
  function msg(text, retry) {
    return '<div class="msg">' + esc(text) + (retry ? '<br><button type="button" class="env-retry">' + esc(t('Retry')) + '</button>' : '') + '</div>';
  }
  function placeName() { return state.placeId ? t(state.label) : t('the chosen point'); }
  function key(tab) { return tab + ':' + state.lat.toFixed(3) + ',' + state.lon.toFixed(3); }

  // ------------------------------------------------------------------ biodiversity
  var GROUPS = { Plantae: 'Plants', Aves: 'Birds', Insecta: 'Insects', Mammalia: 'Mammals', Fungi: 'Fungi', Arachnida: 'Spiders & relatives',
    Reptilia: 'Reptiles', Amphibia: 'Amphibians', Actinopterygii: 'Fish', Mollusca: 'Molluscs', Animalia: 'Other animals', Chromista: 'Algae & kelp', Protozoa: 'Protozoa' };
  function loadBiota() {
    var q = 'lat=' + state.lat + '&lng=' + state.lon + '&radius=' + RADIUS + '&quality_grade=research&locale=' + INAT_LOCALE;
    var d = 0.135; // about 15 km
    var poly = 'POLYGON((' + [[state.lon - d, state.lat - d], [state.lon + d, state.lat - d], [state.lon + d, state.lat + d], [state.lon - d, state.lat + d], [state.lon - d, state.lat - d]].map(function (p) { return p[0].toFixed(3) + ' ' + p[1].toFixed(3); }).join(',') + '))';
    return Promise.all([
      getJSON('https://api.inaturalist.org/v1/observations/iconic_taxa_species_counts?' + q),
      getJSON('https://api.inaturalist.org/v1/observations/species_counts?' + q + '&per_page=12'),
      getJSON('https://api.gbif.org/v1/occurrence/search?limit=0&geometry=' + encodeURIComponent(poly)).catch(function () { return null; })
    ]).then(function (r) { return { groups: r[0].results, total: r[1].total_results, top: r[1].results, gbif: r[2] && r[2].count }; });
  }
  function renderBiota(b) {
    if (!b.total) return msg(t('No verified observations within {0} km of this point yet. Try a nearby place.', RADIUS));
    var groups = b.groups.slice().sort(function (x, y) { return y.count - x.count; });
    var max = groups[0].count;
    var bars = groups.slice(0, 7).map(function (g) {
      var n = g.taxon.name, w = Math.max(4, g.count / max * 100);
      return '<li><span class="eb-l">' + esc(t(GROUPS[n] || n)) + '</span><span class="eb-bar"><i style="width:' + w.toFixed(1) + '%"></i></span><span class="eb-v">' + fmt(g.count) + '</span></li>';
    }).join('');
    var cards = b.top.map(function (s) {
      var x = s.taxon, ph = x.default_photo, img = ph ? (ph.medium_url || ph.url) : '';
      var common = x.preferred_common_name || x.name;
      return '<a class="sp" href="https://www.inaturalist.org/taxa/' + x.id + '" target="_blank" rel="noopener">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(common) + '" loading="lazy" title="' + esc(ph.attribution || '') + '">' : '<span class="sp-noimg"></span>') +
        '<span class="sp-t"><b>' + esc(common) + '</b><i>' + esc(x.name) + '</i><small>' + esc(t('{0} observations', fmt(s.count))) + '</small></span></a>';
    }).join('');
    var g1 = groups[0], g2 = groups[1];
    var simple = t('Within {0} km of {1}, people have recorded {2} species with verified photos.', RADIUS, esc(placeName()), '<strong>' + fmt(b.total) + '</strong>') + ' ' +
      (g2 ? t('Most are {0} ({1}) and {2} ({3}).', esc(t(GROUPS[g1.taxon.name] || g1.taxon.name)).toLowerCase(), fmt(g1.count), esc(t(GROUPS[g2.taxon.name] || g2.taxon.name)).toLowerCase(), fmt(g2.count)) : '');
    return '<div class="env-kpis">' +
      kpi(t('Species recorded'), fmt(b.total), t('within {0} km · iNaturalist', RADIUS)) +
      kpi(t('Biodiversity records'), b.gbif != null ? fmt(b.gbif) : '–', t('museums, science and citizens · GBIF')) +
      '</div>' +
      '<h3 class="env-h3">' + esc(t('Species by group')) + '</h3><ul class="env-bars">' + bars + '</ul>' +
      '<h3 class="env-h3">' + esc(t('Most observed species')) + '</h3><div class="sp-grid">' + cards + '</div>' +
      explain(simple, ['Each species was identified from a photo and confirmed by at least two people (research grade).',
        'More records do not always mean more biodiversity: they also depend on how many people visit and take photos.',
        'GBIF gathers records from museums, scientific surveys and citizen science from around the world.']) +
      '<p class="env-src">' + esc(t('Photos: iNaturalist users, with their licences. Tap a species to learn more.')) + '</p>';
  }

  // ------------------------------------------------------------------ soil
  function loadSoil() {
    var fromFile = state.placeId && soilFile && soilFile.places && soilFile.places[state.placeId];
    if (fromFile) return Promise.resolve(fromFile);
    var url = 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + state.lon.toFixed(4) + '&lat=' + state.lat.toFixed(4) +
      '&property=phh2o&property=soc&property=clay&property=sand&property=silt&property=nitrogen&depth=0-5cm&value=mean';
    return getJSON(url, 3).then(soilFromApi);
  }
  function soilFromApi(d) {
    var out = {};
    d.properties.layers.forEach(function (L) { var v = L.depths[0].values.mean; out[L.name] = v == null ? null : v / L.unit_measure.d_factor; });
    return out; // ph (pH), soc (g/kg), clay/sand/silt (%), nitrogen (g/kg)
  }
  function phClass(ph) { return ph < 5.5 ? 'strongly acidic' : ph < 6.5 ? 'slightly acidic' : ph <= 7.5 ? 'neutral' : 'alkaline'; }
  function texture(s) {
    if (s.clay >= 40) return 'clayey';
    if (s.sand >= 70) return 'sandy';
    if (s.silt >= 50) return 'silty';
    return 'loamy (balanced)';
  }
  function socClass(v) { return v < 10 ? 'low' : v < 30 ? 'medium' : 'high'; }
  function renderSoil(s) {
    if (!s || s.phh2o == null) return msg(t('No soil estimate here: it may be a city, a lake, rock or ice. Try a point nearby.'));
    var tex = texture(s);
    var bar = '<div class="tex-bar" aria-hidden="true"><i class="tx-sand" style="width:' + s.sand + '%"></i><i class="tx-silt" style="width:' + s.silt + '%"></i><i class="tx-clay" style="width:' + s.clay + '%"></i></div>' +
      '<div class="tex-leg"><span><i class="tx-sand"></i>' + esc(t('Sand')) + ' ' + fmt(s.sand) + '%</span><span><i class="tx-silt"></i>' + esc(t('Silt')) + ' ' + fmt(s.silt) + '%</span><span><i class="tx-clay"></i>' + esc(t('Clay')) + ' ' + fmt(s.clay) + '%</span></div>';
    var simple = t('The topsoil near {0} is {1} (pH {2}) and {3}, with {4} g of organic carbon per kilogram ({5}).',
      esc(placeName()), esc(t(phClass(s.phh2o))), '<strong>' + fmt(s.phh2o, 1) + '</strong>', esc(t(tex)), '<strong>' + fmt(s.soc) + '</strong>', esc(t(socClass(s.soc))));
    return '<div class="env-kpis">' +
      kpi(t('Acidity (pH)'), fmt(s.phh2o, 1), t(phClass(s.phh2o))) +
      kpi(t('Organic carbon'), fmt(s.soc) + '<small>g/kg</small>', t(socClass(s.soc))) +
      kpi(t('Nitrogen'), fmt(s.nitrogen, 1) + '<small>g/kg</small>', t('a key nutrient for plants')) +
      '</div>' +
      '<h3 class="env-h3">' + esc(t('Texture: what the soil is made of')) + ' · ' + esc(t(tex)) + '</h3>' + bar +
      explain(simple, ['pH 7 is neutral; below 7 the soil is acidic and above 7 it is alkaline.',
        'Organic carbon comes from plant and animal remains: it keeps soil fertile and stores carbon that would otherwise be in the air.',
        'These are model estimates for the top 5 cm at 250 m resolution (SoilGrids), not laboratory samples.']);
  }

  // ------------------------------------------------------------------ air
  function loadAir() {
    return getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + state.lat + '&longitude=' + state.lon +
      '&current=pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,uv_index&timezone=America%2FLima');
  }
  function renderAir(a) {
    var c = a.current || {};
    if (c.pm2_5 == null) return msg(t('No air-quality estimate for this point right now.'), true);
    var pmLabel = c.pm2_5 <= 15 ? 'within the WHO guideline' : c.pm2_5 <= 50 ? 'above the WHO guideline' : 'above Peru’s standard';
    var simple = t('Right now the air near {0} has {1} µg/m³ of fine particles (PM2.5), {2}.', esc(placeName()), '<strong>' + fmt(c.pm2_5) + '</strong>', esc(t(pmLabel)));
    return '<div class="env-kpis">' +
      kpi('PM2.5', fmt(c.pm2_5) + '<small>µg/m³</small>', t(pmLabel)) +
      kpi('PM10', fmt(c.pm10) + '<small>µg/m³</small>', t('coarser dust')) +
      kpi(t('Nitrogen dioxide'), fmt(c.nitrogen_dioxide) + '<small>µg/m³</small>', t('mostly from traffic')) +
      kpi(t('Ozone'), fmt(c.ozone) + '<small>µg/m³</small>', t('forms with sunlight')) +
      kpi(t('UV index'), fmt(c.uv_index, 1), c.uv_index >= 8 ? t('Avoid the sun from 10 am to 4 pm') : c.uv_index >= 3 ? t('Wear sunscreen') : t('Minimal protection needed')) +
      '</div>' +
      explain(simple, ['Fine particles are so small they can enter the lungs; the lower the number, the cleaner the air.',
        'The WHO recommends keeping PM2.5 below 15 µg/m³ on average over 24 hours.',
        'These are estimates from the Copernicus CAMS model, not readings from a monitoring station.']);
  }

  // ------------------------------------------------------------------ water
  function loadWater() {
    return Promise.all([
      getJSON('https://flood-api.open-meteo.com/v1/flood?latitude=' + state.lat + '&longitude=' + state.lon + '&daily=river_discharge&past_days=30&forecast_days=30'),
      getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + state.lat + '&longitude=' + state.lon + '&daily=precipitation_sum&forecast_days=7&timezone=America%2FLima')
    ]).then(function (r) { return { flood: r[0].daily, rain: r[1].daily }; });
  }
  function renderWater(w) {
    var q = w.flood.river_discharge, times = w.flood.time, today = new Date().toISOString().slice(0, 10), now = 0;
    times.forEach(function (d, i) { if (d <= today) now = i; });
    var qNow = q[now], qMax = Math.max.apply(null, q.slice(now).filter(function (v) { return v != null; }));
    var rain = (w.rain.precipitation_sum || []).reduce(function (s, v) { return s + (v || 0); }, 0);
    var hasRiver = qNow != null && qMax >= 1;
    var simple = hasRiver
      ? t('The nearest river modelled near {0} carries about {1} m³/s today, and could reach {2} m³/s in the next 30 days. About {3} mm of rain are expected this week.', esc(placeName()), '<strong>' + fmt(qNow) + '</strong>', fmt(qMax), fmt(rain, 1))
      : t('There is little or no modelled river flow near {0}. About {1} mm of rain are expected this week.', esc(placeName()), fmt(rain, 1));
    return '<div class="env-kpis">' +
      kpi(t('River flow today'), hasRiver ? fmt(qNow) + '<small>m³/s</small>' : '–', t('nearest river · GloFAS')) +
      kpi(t('Forecast peak'), hasRiver ? fmt(qMax) + '<small>m³/s</small>' : '–', t('next 30 days')) +
      kpi(t('Rain this week'), fmt(rain, 1) + '<small>mm</small>', t('next 7 days')) +
      '</div>' + (hasRiver ? spark(q, now) : '') +
      explain(simple, ['m³/s means cubic metres of water passing every second: 1 m³ is 1,000 litres.',
        'GloFAS is a global model: it estimates the river closest to the point, roughly every 5 km.',
        'Water quality (metals, pH, oxygen) is measured in the field by the authorities and is not available here as live open data.']);
  }
  function spark(q, now) {
    var W = 640, H = 120, n = q.length, vals = q.filter(function (v) { return v != null; });
    var lo = 0, hi = Math.max.apply(null, vals) * 1.1 || 1;
    function x(i) { return i / (n - 1) * W; } function y(v) { return H - (v - lo) / (hi - lo) * H; }
    var past = '', fut = '';
    q.forEach(function (v, i) { if (v == null) return; var p = x(i).toFixed(1) + ' ' + y(v).toFixed(1); if (i <= now) past += (past ? 'L' : 'M') + p; if (i >= now) fut += (fut ? 'L' : 'M') + p; });
    return '<figure class="env-spark"><svg viewBox="0 0 ' + W + ' ' + (H + 18) + '" role="img" aria-label="' + esc(t('River flow: last 30 days and next 30 days')) + '">' +
      '<path d="' + past + '" fill="none" stroke="var(--series-1)" stroke-width="2.4"/>' +
      '<path d="' + fut + '" fill="none" stroke="var(--series-1)" stroke-width="2.4" stroke-dasharray="5 4" opacity=".8"/>' +
      '<line x1="' + x(now) + '" x2="' + x(now) + '" y1="0" y2="' + H + '" stroke="var(--muted)"/>' +
      '<text x="' + (x(now) + 6) + '" y="12" class="lbl">' + esc(t('Today')) + '</text>' +
      '<text x="0" y="' + (H + 15) + '">' + esc(t('30 days ago')) + '</text><text x="' + W + '" y="' + (H + 15) + '" text-anchor="end">' + esc(t('in 30 days')) + '</text>' +
      '</svg><figcaption>' + esc(t('Solid line: modelled flow. Dotted line: forecast.')) + '</figcaption></figure>';
  }

  function kpi(k, v, s) { return '<div class="env-kpi"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div><div class="s">' + esc(s) + '</div></div>'; }

  // ------------------------------------------------------------------ wiring
  var LOADERS = { biota: [loadBiota, renderBiota], soil: [loadSoil, renderSoil], air: [loadAir, renderAir], water: [loadWater, renderWater] };
  var seq = 0;
  function show() {
    var panel = $('panel-env'), tab = state.tab, k = key(tab), my = ++seq;
    panel.setAttribute('aria-labelledby', 'tab-' + tab);
    var head = '<div class="env-place"><b>' + esc(placeName()) + '</b><span>' + esc(state.placeId ? t(regionOf()) : fmt(state.lat, 3) + ', ' + fmt(state.lon, 3)) + '</span></div>';
    if (cache[k]) { panel.innerHTML = head + LOADERS[tab][1](cache[k]); return; }
    panel.innerHTML = head + '<div class="skeleton tall"></div>';
    LOADERS[tab][0]().then(function (d) {
      cache[k] = d;
      if (my === seq) panel.innerHTML = head + LOADERS[tab][1](d);
    }).catch(function () {
      if (my !== seq) return;
      panel.innerHTML = head + msg(t('This open-data service is busy right now. Please try again in a moment.'), true);
    });
  }
  function regionOf() { var p = PLACES.find(function (x) { return x.id === state.placeId; }); return p ? p.region : ''; }

  var map, marker;
  function setPoint(lat, lon, place) {
    state.lat = lat; state.lon = lon; state.placeId = place ? place.id : null; state.label = place ? place.name : '';
    $('env-place').value = place ? place.id : 'custom';
    if (marker) marker.setLatLng([lat, lon]);
    if (map) map.panTo([lat, lon], { animate: !reduce });
    show();
  }

  function init() {
    var sel = $('env-place');
    sel.innerHTML = PLACES.map(function (p) { return '<option value="' + p.id + '">' + esc(t(p.name)) + ' (' + esc(p.region) + ')</option>'; }).join('') +
      '<option value="custom" hidden>' + esc(t('Point chosen on the map')) + '</option>';
    sel.addEventListener('change', function () { var p = PLACES.find(function (x) { return x.id === sel.value; }); if (p) setPoint(p.lat, p.lon, p); });

    map = L.map('env-map', { zoomControl: true, scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25 }).setView([-9.5, -75.5], 5);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 13, attribution: 'Esri, HERE, Garmin, © OpenStreetMap' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 13 }).addTo(map);
    // department boundaries (INEI via github.com/juaneladio/peru-geojson, MPL-2.0)
    getJSON('../data/peru_departments.geojson', 1).then(function (g) {
      var deps = L.geoJSON(g, {
        style: { color: '#d7f36b', weight: 1.2, opacity: .7, fillColor: '#b6e34f', fillOpacity: .03 },
        onEachFeature: function (f, layer) {
          layer.bindTooltip(f.properties.name, { className: 'gd-tip dep-tip', sticky: true, direction: 'top' });
          layer.on('mouseover', function () { layer.setStyle({ weight: 2.4, opacity: 1, fillOpacity: .12 }); });
          layer.on('mouseout', function () { deps.resetStyle(layer); });
          layer.on('click', function (e) { setPoint(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4), null); });
        }
      }).addTo(map);
      deps.bringToBack();
      map.fitBounds(deps.getBounds(), { padding: [10, 10] });
    }).catch(function () {});
    PLACES.forEach(function (p) {
      L.circleMarker([p.lat, p.lon], { radius: 6, weight: 2, color: '#0b1411', fillColor: '#b6e34f', fillOpacity: 1 })
        .bindTooltip(t(p.name), { className: 'gd-tip', direction: 'top', offset: [0, -6] })
        .on('click', function (e) { L.DomEvent.stopPropagation(e); setPoint(p.lat, p.lon, p); }).addTo(map);
    });
    marker = L.circleMarker([state.lat, state.lon], { radius: 11, weight: 3, color: '#ffffff', fillColor: '#b6e34f', fillOpacity: .35, interactive: false }).addTo(map);
    map.on('click', function (e) { setPoint(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4), null); });
    map.once('focus', function () { map.scrollWheelZoom.enable(); });

    var tabs = [].slice.call(document.querySelectorAll('.env-tabs [role="tab"]'));
    function pick(b, focus) {
      tabs.forEach(function (x) { var on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
      if (focus) b.focus();
      state.tab = b.dataset.tab; show();
      try { history.replaceState(null, '', '#' + state.tab); } catch (e) {}
    }
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { pick(b); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); pick(tabs[(i + 1) % tabs.length], true); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); pick(tabs[(i - 1 + tabs.length) % tabs.length], true); }
      });
    });
    $('panel-env').addEventListener('click', function (e) { if (e.target.closest('.env-retry')) { delete cache[key(state.tab)]; show(); } });

    var h = (location.hash || '').slice(1), start = tabs.find(function (b) { return b.dataset.tab === h; });
    if (start) tabs.forEach(function (x) { var on = x === start; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
    if (start) state.tab = h;
    getJSON('../data/soil.json', 1).then(function (d) { soilFile = d; }).catch(function () {}).then(show);
  }
  init();
})();
