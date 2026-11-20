/* hendy.greendata · Observatorio ambiental del Perú
 * Datos abiertos: NASA GIBS, NOAA CPC, Copernicus GloFAS y CAMS (vía Open-Meteo).
 */
(function () {
  'use strict';

  var TZ = 'America/Lima';
  var DAY = 864e5;

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(v, d) {
    if (v == null || isNaN(v)) return '–';
    return v.toLocaleString('es-PE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function signed(v, d) { return v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function utcToday() { var n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); }
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  var DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  function dShort(s) { var d = new Date(s + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
  function dLong(s) { var d = new Date(s + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function fetchJSON(url, retried) {
    return fetch(url).then(function (r) {
      if (r.status === 429 && !retried) return new Promise(function (ok) { setTimeout(ok, 4000); }).then(function () { return fetchJSON(url, true); });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.json();
    });
  }
  function limaHour() {
    var p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour;
  }
  function limaDate() { return limaHour().slice(0, 10); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- chart kit
  var uid = 0;
  var charts = []; // re-render on resize
  function tipFor(box) {
    var t = box.querySelector('.tip');
    if (!t) { t = document.createElement('div'); t.className = 'tip'; t.setAttribute('role', 'status'); box.appendChild(t); }
    return t;
  }
  function niceStep(span, target) {
    var raw = span / Math.max(1, target), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p;
  }

  /**
   * Line chart over an evenly spaced x index.
   * o: { n, series:[{values, color, width, dash, diverging}], band:{lo,hi,color}, refs:[{v,label}],
   *      now, nowLabel, xTicks:[{i,label}], ann:[{i,v,label}], tip:(i)=>html, yMin, yMax, height, unit }
   */
  function lineChart(box, o) {
    var W = Math.max(300, box.clientWidth || 600), H = o.height || (W < 520 ? 230 : 280);
    var m = { t: 18, r: 14, b: 26, l: 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.n;
    var lo = o.yMin, hi = o.yMax;
    if (lo == null || hi == null) {
      var all = [];
      o.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
      if (o.band) { o.band.hi.forEach(function (v) { if (v != null) all.push(v); }); o.band.lo.forEach(function (v) { if (v != null) all.push(v); }); }
      (o.refs || []).forEach(function (r) { all.push(r.v); });
      if (lo == null) lo = Math.min.apply(null, all.concat([0]));
      if (hi == null) hi = Math.max.apply(null, all);
    }
    var step = niceStep(hi - lo || 1, H < 250 ? 4 : 5);
    lo = Math.floor(lo / step) * step; hi = Math.ceil((hi * 1.04) / step) * step;
    if (hi === lo) hi = lo + step;
    function x(i) { return m.l + (n <= 1 ? 0 : i / (n - 1) * iw); }
    function y(v) { return m.t + ih - (v - lo) / (hi - lo) * ih; }
    var id = 'c' + (++uid);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || '') + '">';
    s += '<defs><clipPath id="' + id + 'a"><rect x="0" y="0" width="' + W + '" height="' + y(0) + '"/></clipPath>' +
         '<clipPath id="' + id + 'b"><rect x="0" y="' + y(0) + '" width="' + W + '" height="' + (H - y(0)) + '"/></clipPath></defs>';
    var decimals = step < 1 ? 1 : 0;
    for (var g = lo; g <= hi + step / 2; g += step) {
      var gy = y(g).toFixed(1);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--grid)"/>' +
           '<text x="' + (m.l - 7) + '" y="' + (+gy + 4) + '" text-anchor="end">' + fmt(g, decimals) + '</text>';
    }
    if (lo < 0 && hi > 0) s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--ink-2)" stroke-width="1"/>';
    (o.xTicks || []).forEach(function (t) {
      s += '<text x="' + x(t.i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(t.label) + '</text>';
    });
    if (o.band) {
      var top = '', bot = '';
      for (var i = 0; i < n; i++) if (o.band.hi[i] != null && o.band.lo[i] != null) top += (top ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(o.band.hi[i]).toFixed(1);
      for (var k = n - 1; k >= 0; k--) if (o.band.hi[k] != null && o.band.lo[k] != null) bot += 'L' + x(k).toFixed(1) + ' ' + y(o.band.lo[k]).toFixed(1);
      if (top) s += '<path d="' + top + bot + 'Z" fill="' + (o.band.color || 'var(--series-1)') + '" opacity=".2"/>';
    }
    (o.refs || []).forEach(function (r) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(r.v) + '" y2="' + y(r.v) + '" stroke="var(--ref)" stroke-width="1.5" stroke-dasharray="4 4"/>' +
           '<text x="' + (W - m.r) + '" y="' + (y(r.v) - 5) + '" text-anchor="end">' + esc(r.label) + '</text>';
    });
    function pathOf(vals, from, to) {
      var d = '', pen = false;
      for (var i = from; i <= to; i++) {
        if (vals[i] == null) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(vals[i]).toFixed(1); pen = true;
      }
      return d;
    }
    o.series.forEach(function (sr) {
      if (sr.diverging) {
        var a = '', first = null, last = null;
        sr.values.forEach(function (v, i) { if (v == null) return; if (first == null) first = i; last = i; a += (a ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
        if (a) {
          var area = a + 'L' + x(last).toFixed(1) + ' ' + y(0) + 'L' + x(first).toFixed(1) + ' ' + y(0) + 'Z';
          s += '<path d="' + area + '" fill="var(--warm)" opacity=".28" clip-path="url(#' + id + 'a)"/>';
          s += '<path d="' + area + '" fill="var(--cool)" opacity=".28" clip-path="url(#' + id + 'b)"/>';
        }
      }
      var attrs = ' fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.width || 2) + '" stroke-linejoin="round" stroke-linecap="round"';
      if (o.now != null && sr.forecastDash) {
        s += '<path d="' + pathOf(sr.values, 0, o.now) + '"' + attrs + '/>';
        s += '<path d="' + pathOf(sr.values, o.now, n - 1) + '"' + attrs + ' stroke-dasharray="2 4"/>';
      } else {
        s += '<path d="' + pathOf(sr.values, 0, n - 1) + '"' + attrs + (sr.dash ? ' stroke-dasharray="' + sr.dash + '"' : '') + '/>';
      }
    });
    if (o.now != null) {
      var nx = x(o.now).toFixed(1);
      s += '<line x1="' + nx + '" x2="' + nx + '" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="var(--muted)"/>' +
           '<text x="' + (+nx + 5) + '" y="' + (m.t + 4) + '" class="lbl">' + esc(o.nowLabel || 'Hoy') + '</text>';
    }
    (o.ann || []).forEach(function (a) {
      var ax = x(a.i), ay = y(a.v);
      var anchor = ax > W - 90 ? 'end' : ax < m.l + 50 ? 'start' : 'middle';
      s += '<circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="4" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>' +
           '<text class="ann" x="' + ax.toFixed(1) + '" y="' + (ay - 9).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(a.label) + '</text>';
    });
    s += '<line class="xh" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="var(--ink-2)" opacity="0"/>';
    o.series.forEach(function (sr, j) { s += '<circle class="dot" data-j="' + j + '" r="4.5" fill="' + sr.color + '" stroke="var(--surface)" stroke-width="2" opacity="0"/>'; });
    s += '<rect x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/></svg>';
    box.innerHTML = s;
    var svg = box.querySelector('svg'), tip = tipFor(box), xh = svg.querySelector('.xh'), dots = svg.querySelectorAll('.dot');
    function move(ev) {
      var r = svg.getBoundingClientRect(), sx = (ev.clientX - r.left) / r.width * W;
      var i = Math.max(0, Math.min(n - 1, Math.round((sx - m.l) / iw * (n - 1))));
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('opacity', 1);
      var topY = m.t + ih;
      dots.forEach(function (d) {
        var v = o.series[+d.getAttribute('data-j')].values[i];
        if (v == null) { d.setAttribute('opacity', 0); return; }
        d.setAttribute('cx', x(i)); d.setAttribute('cy', y(v)); d.setAttribute('opacity', 1); topY = Math.min(topY, y(v));
      });
      tip.innerHTML = o.tip(i);
      var px = x(i) / W * r.width;
      tip.style.left = Math.max(70, Math.min(r.width - 70, px)) + 'px';
      tip.style.top = (topY / H * r.height) + 'px';
      tip.style.opacity = 1;
    }
    function leave() { tip.style.opacity = 0; xh.setAttribute('opacity', 0); dots.forEach(function (d) { d.setAttribute('opacity', 0); }); }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', leave);
  }

  function barChart(box, o) {
    var W = Math.max(300, box.clientWidth || 560), H = 210, m = { t: 24, r: 8, b: 26, l: 36 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.values.length;
    var maxRaw = Math.max.apply(null, o.values.map(function (v) { return v || 0; }));
    var step = niceStep(Math.max(maxRaw, 2), 4), maxV = Math.max(step * 2, Math.ceil(maxRaw * 1.1 / step) * step);
    var bw = iw / n, barW = Math.min(36, bw - 4);
    function y(v) { return m.t + ih - v / maxV * ih; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label) + '">';
    for (var g = 0; g <= maxV + step / 2; g += step) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="var(--grid)"/>' +
           '<text x="' + (m.l - 7) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + fmt(g, step < 1 ? 1 : 0) + '</text>';
    }
    var maxI = 0; o.values.forEach(function (v, i) { if ((v || 0) > (o.values[maxI] || 0)) maxI = i; });
    o.values.forEach(function (v, i) {
      var cx = m.l + bw * i + bw / 2, h = (v || 0) / maxV * ih, x0 = cx - barW / 2, yb = m.t + ih;
      if (h > 0.5) {
        var r = Math.min(4, h, barW / 2);
        s += '<path d="M' + x0 + ' ' + yb + 'V' + (yb - h + r) + 'Q' + x0 + ' ' + (yb - h) + ' ' + (x0 + r) + ' ' + (yb - h) +
             'H' + (x0 + barW - r) + 'Q' + (x0 + barW) + ' ' + (yb - h) + ' ' + (x0 + barW) + ' ' + (yb - h + r) + 'V' + yb + 'Z" fill="var(--series-1)"/>';
      }
      if (i === maxI && v >= 0.1) s += '<text x="' + cx + '" y="' + (yb - h - 7) + '" text-anchor="middle" class="lbl">' + fmt(v, 1) + ' mm</text>';
      s += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(o.labels[i]) + '</text>';
      s += '<rect class="hit" data-i="' + i + '" x="' + (m.l + bw * i) + '" y="' + m.t + '" width="' + bw + '" height="' + ih + '" fill="transparent"/>';
    });
    s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (m.t + ih) + '" y2="' + (m.t + ih) + '" stroke="var(--line)"/></svg>';
    if (maxRaw < 0.1) s += '<p class="card-sub" style="margin:6px 0 0">No se espera lluvia esta semana.</p>';
    box.innerHTML = s;
    var svg = box.querySelector('svg'), tip = tipFor(box);
    svg.querySelectorAll('.hit').forEach(function (el) {
      function show() {
        var i = +el.getAttribute('data-i'), r = svg.getBoundingClientRect(), cx = m.l + bw * i + bw / 2;
        tip.innerHTML = o.tip(i);
        tip.style.left = Math.max(70, Math.min(r.width - 70, cx / W * r.width)) + 'px';
        tip.style.top = (y(o.values[i] || 0) / H * r.height) + 'px';
        tip.style.opacity = 1;
      }
      el.addEventListener('pointerenter', show); el.addEventListener('pointerdown', show);
      el.addEventListener('pointerleave', function () { tip.style.opacity = 0; });
    });
  }

  function sparkline(values, color) {
    var W = 200, H = 30, v = values.filter(function (x) { return x != null; });
    if (v.length < 2) return '';
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), d = '', n = values.length;
    values.forEach(function (val, i) {
      if (val == null) return;
      d += (d ? 'L' : 'M') + (i / (n - 1) * W).toFixed(1) + ' ' + (H - 3 - (hi > lo ? (val - lo) / (hi - lo) : .5) * (H - 6)).toFixed(1);
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }

  // ---------------------------------------------------------------- satellite layers (NASA GIBS)
  var GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
  var GROUPS = [
    { name: 'Mar', layers: ['sst_anom', 'sst', 'chl'] },
    { name: 'Agua', layers: ['rain', 'soil', 'snow'] },
    { name: 'Tierra', layers: ['true', 'ndvi', 'lst'] },
    { name: 'Aire', layers: ['aod'] }
  ];
  var LAYERS = {
    sst_anom: { label: 'El Niño (anomalía del mar)', id: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies', z: 7, ext: 'png', lag: 2,
      legend: 'GHRSST_Sea_Surface_Temperature_Anomalies_H.svg',
      info: '<b>Cuánto más caliente o frío está el mar que lo normal.</b> Rojo intenso = mar más caliente: la huella de El Niño frente a la costa. Azul = más frío.',
      meta: 'GHRSST MUR L4 · NASA JPL · ~1 km · diario' },
    sst: { label: 'Temperatura del mar', id: 'GHRSST_L4_MUR_Sea_Surface_Temperature', z: 7, ext: 'png', lag: 2,
      legend: 'GHRSST_Sea_Surface_Temperature_H.svg',
      info: '<b>Temperatura de la superficie del océano.</b> La Corriente de Humboldt mantiene el mar peruano frío y rico en nutrientes; El Niño lo calienta.',
      meta: 'GHRSST MUR L4 · NASA JPL · ~1 km · diario' },
    chl: { label: 'Clorofila (fitoplancton)', id: 'VIIRS_NOAA20_Chlorophyll_a', z: 7, ext: 'png', lag: 1,
      legend: 'VIIRS_Chlorophyll_H.svg',
      info: '<b>Fitoplancton en el mar, base de la cadena alimenticia de la anchoveta.</b> El afloramiento peruano es uno de los más productivos del mundo. Las nubes dejan huecos.',
      meta: 'VIIRS NOAA-20 · NASA Ocean Biology · ~750 m · diario' },
    rain: { label: 'Lluvia (GPM IMERG)', id: 'IMERG_Precipitation_Rate', z: 6, ext: 'png', lag: 2,
      legend: 'GPM_Precipitation_Rate_H.svg',
      info: '<b>Lluvia estimada por la constelación de satélites GPM.</b> Útil para vigilar lluvias intensas en la costa norte y la sierra.',
      meta: 'GPM IMERG · NASA / JAXA · ~10 km · diario' },
    soil: { label: 'Humedad del suelo', id: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', z: 6, ext: 'png', lag: 4,
      legend: 'SMAP_Analyzed_Soil_Moisture_H.svg',
      info: '<b>Agua en el suelo hasta 1 m de profundidad.</b> Suelos saturados aumentan el riesgo de huaicos y deslizamientos cuando llueve.',
      meta: 'SMAP L4 · NASA · ~9 km · diario' },
    snow: { label: 'Nieve y glaciares', id: 'MODIS_Terra_NDSI_Snow_Cover', z: 8, ext: 'png', lag: 1,
      legend: 'MODIS_NDSI_Snow_Cover_H.svg',
      info: '<b>Cobertura de nieve en los Andes.</b> Perú tiene la mayor parte de los glaciares tropicales del mundo, y se están reduciendo. Acércate a la Cordillera Blanca.',
      meta: 'MODIS Terra · NASA · 500 m · diario' },
    true: { label: 'Color real', id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', z: 9, ext: 'jpeg', lag: 1, legend: null,
      info: '<b>El Perú como lo vería un astronauta.</b> Nubes, desiertos, la selva y, a veces, el humo de incendios. Acerca el mapa para ver detalle.',
      meta: 'VIIRS NOAA-20 · NASA · 375 m · diario' },
    ndvi: { label: 'Vegetación (NDVI)', id: 'MODIS_Terra_NDVI_8Day', z: 9, ext: 'png', lag: 2,
      legend: 'MODIS_NDVI_H.svg',
      info: '<b>Qué tan verde y vigorosa está la vegetación.</b> Contrasta la Amazonía con la costa desértica y los valles agrícolas.',
      meta: 'MODIS Terra · NASA · 250 m · compuesto de 8 días' },
    lst: { label: 'Temperatura del suelo', id: 'MODIS_Terra_Land_Surface_Temp_Day', z: 7, ext: 'png', lag: 1,
      legend: 'MODIS_Land_Surface_Temp_H.svg',
      info: '<b>Qué tan caliente está la superficie del terreno de día</b>, no el aire. Las ciudades y los desiertos se calientan mucho más que la vegetación.',
      meta: 'MODIS Terra · NASA · 1 km · diario' },
    aod: { label: 'Aerosoles (humo y polvo)', id: 'MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth', z: 7, ext: 'png', lag: 2,
      legend: 'MODIS_VIIRS_AOD_H.svg',
      info: '<b>Partículas en la atmósfera: humo de incendios, polvo y contaminación.</b> En la temporada seca, el humo de la Amazonía puede cubrir el oriente.',
      meta: 'MODIS MAIAC · NASA · 1 km · diario' }
  };
  var MAX_BACK = 60;

  var map, satNow, satCmp, labelsLayer, cmpPane;
  var sat = { key: 'sst_anom', back: 0, compare: true, ratio: 0.5, playing: null };

  function layerDate(key, back) { return iso(new Date(utcToday().getTime() - (LAYERS[key].lag + back) * DAY)); }
  function yearAgo(d) { var t = new Date(d + 'T00:00:00Z'); t.setUTCFullYear(t.getUTCFullYear() - 1); return iso(t); }
  function gibsUrl(key, date) {
    var L = LAYERS[key];
    return GIBS + L.id + '/default/' + date + '/GoogleMapsCompatible_Level' + L.z + '/{z}/{y}/{x}.' + L.ext;
  }
  function makeSat(key, date, pane) {
    return L.tileLayer(gibsUrl(key, date), {
      pane: pane, maxNativeZoom: LAYERS[key].z, maxZoom: 12, bounds: [[-85, -180], [85, 180]], keepBuffer: 4,
      attribution: '<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>'
    });
  }

  function initMap() {
    map = L.map('map', { zoomControl: false, scrollWheelZoom: false, worldCopyJump: true, minZoom: 3, attributionControl: true });
    L.control.zoom({ position: window.innerWidth > 980 ? 'bottomleft' : 'topright' }).addTo(map);
    var wide = window.innerWidth > 980, W = map.getSize().x;
    var padL = wide ? Math.min(W * 0.45, document.querySelector('.copy-col').getBoundingClientRect().right + 10) : 10;
    var padR = wide ? 370 : 10;
    map.fitBounds([[-18.6, -84], [0, -68.5]], { paddingTopLeft: [padL, 30], paddingBottomRight: [padR, 20] });
    // put the compare line over the sea just off the northern coast, where El Niño shows
    var coastX = map.latLngToContainerPoint([-7, -82.2]).x;
    sat.ratio = Math.max(wide ? 0.15 : 0.4, Math.min(0.85, coastX / W));
    map.getContainer().appendChild($('swipe'));
    map.createPane('satNow').style.zIndex = 250;
    cmpPane = map.createPane('satCmp'); cmpPane.style.zIndex = 260;
    map.createPane('labels').style.zIndex = 420; map.getPane('labels').style.pointerEvents = 'none';
    var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, maxNativeZoom: 16, attribution: 'Base: Esri, HERE, Garmin, © OpenStreetMap'
    }).addTo(map);
    labelsLayer = L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 12, pane: 'labels' }).addTo(map);
    fetchJSON('data/peru.geojson').then(function (g) {
      L.geoJSON(g, { interactive: false, style: { color: '#ffffff', weight: 1.4, opacity: .85, fill: false } }).addTo(map);
    }).catch(function () {});
    map.on('move zoom resize', clipCompare);
    // allow wheel zoom after the user clicks the map
    map.once('focus', function () { map.scrollWheelZoom.enable(); });
    buildLayerUI();
    setLayer(sat.key, true);
  }

  function buildLayerUI() {
    $('layers').innerHTML = GROUPS.map(function (g) {
      return '<div><p class="lg-name">' + g.name + '</p><div class="chips">' + g.layers.map(function (k) {
        return '<button class="chip" role="radio" data-k="' + k + '" aria-checked="' + (k === sat.key) + '">' + esc(LAYERS[k].label) + '</button>';
      }).join('') + '</div></div>';
    }).join('');
    $('layers').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      setLayer(b.getAttribute('data-k'));
    });
    var dr = $('date-range'); dr.max = MAX_BACK; dr.value = MAX_BACK;
    dr.addEventListener('input', function () { stopPlay(); sat.back = MAX_BACK - (+dr.value); updateDates(); });
    $('compare').addEventListener('change', function (e) { sat.compare = e.target.checked; updateDates(); });
    $('play').addEventListener('click', function () { sat.playing ? stopPlay() : startPlay(); });
    var knob = $('swipe-knob'), dragging = false;
    L.DomEvent.disableClickPropagation(knob); L.DomEvent.disableScrollPropagation(knob);
    knob.addEventListener('pointerdown', function (e) { dragging = true; knob.setPointerCapture(e.pointerId); e.preventDefault(); });
    knob.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var r = map.getContainer().getBoundingClientRect();
      sat.ratio = Math.max(0.02, Math.min(0.98, (e.clientX - r.left) / r.width)); clipCompare();
    });
    knob.addEventListener('pointerup', function () { dragging = false; });
    knob.addEventListener('pointercancel', function () { dragging = false; });
    knob.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowLeft' ? -0.03 : e.key === 'ArrowRight' ? 0.03 : 0;
      if (!d) return; e.preventDefault(); sat.ratio = Math.max(0.02, Math.min(0.98, sat.ratio + d)); clipCompare();
    });
    $('panel-toggle').addEventListener('click', function () {
      var open = this.getAttribute('aria-expanded') !== 'true';
      this.setAttribute('aria-expanded', open); $('panel-body').hidden = !open;
    });
  }

  function setLayer(key, first) {
    sat.key = key;
    document.querySelectorAll('#layers .chip').forEach(function (c) { c.setAttribute('aria-checked', c.getAttribute('data-k') === key); });
    var L0 = LAYERS[key];
    $('layer-info').innerHTML = L0.info + '<span class="meta">' + esc(L0.meta) + '</span>';
    var lg = $('legend');
    if (L0.legend) { lg.src = 'https://gibs.earthdata.nasa.gov/legends/' + L0.legend; lg.alt = 'Leyenda de ' + L0.label; lg.hidden = false; }
    else { lg.hidden = true; lg.removeAttribute('src'); }
    if (satNow) map.removeLayer(satNow);
    if (satCmp) map.removeLayer(satCmp);
    satNow = null; satCmp = null;
    updateDates();
    if (!first) try { localStorage.setItem('gd-layer', key); } catch (e) {}
  }

  function updateDates() {
    var d = layerDate(sat.key, sat.back);
    $('date-label').textContent = dLong(d);
    if (!satNow) { satNow = makeSat(sat.key, d, 'satNow').addTo(map); } else satNow.setUrl(gibsUrl(sat.key, d));
    var showCmp = sat.compare && !sat.playing;
    $('swipe').hidden = !showCmp;
    if (showCmp) {
      var d2 = yearAgo(d);
      if (!satCmp) satCmp = makeSat(sat.key, d2, 'satCmp').addTo(map); else satCmp.setUrl(gibsUrl(sat.key, d2));
      $('swipe-left').textContent = dLong(d2);
      $('swipe-right').textContent = dLong(d);
    } else if (satCmp) { map.removeLayer(satCmp); satCmp = null; }
    clipCompare();
  }

  function clipCompare() {
    if (!map) return;
    var size = map.getSize();
    var line = document.querySelector('.swipe-line'), tl = $('swipe-left'), tr = $('swipe-right');
    var px = size.x * sat.ratio;
    line.style.left = px + 'px'; tl.style.left = px + 'px'; tr.style.left = px + 'px';
    $('swipe-knob').setAttribute('aria-valuenow', Math.round(sat.ratio * 100));
    if (!satCmp) { cmpPane.style.clip = ''; return; }
    var nw = map.containerPointToLayerPoint([0, 0]), se = map.containerPointToLayerPoint(size);
    var clipX = nw.x + px;
    cmpPane.style.clip = 'rect(' + [nw.y, clipX, se.y, nw.x].join('px,') + 'px)';
  }

  function startPlay() {
    var frames = 14, i = frames;
    sat.playing = true; $('compare').disabled = true;
    $('play-icon').setAttribute('d', 'M7 5h4v14H7zM13 5h4v14h-4z');
    $('play').setAttribute('aria-label', 'Detener animación');
    function tick() {
      if (!sat.playing) return;
      i = i <= 0 ? frames : i - 1;
      sat.back = i; $('date-range').value = MAX_BACK - i; updateDates();
      sat.playing = setTimeout(tick, reduceMotion ? 2500 : 1300);
    }
    tick();
  }
  function stopPlay() {
    if (!sat.playing) return;
    clearTimeout(sat.playing); sat.playing = null; $('compare').disabled = false;
    $('play-icon').setAttribute('d', 'M8 5v14l11-7z');
    $('play').setAttribute('aria-label', 'Animar últimos 14 días');
    updateDates();
  }

  // ---------------------------------------------------------------- El Niño (NOAA CPC, updated weekly by GitHub Actions)
  var enso = null, ensoRange = 'all';
  var ONI_CLASS = [
    { min: 2.0, label: 'El Niño muy fuerte' }, { min: 1.5, label: 'El Niño fuerte' }, { min: 1.0, label: 'El Niño moderado' },
    { min: 0.5, label: 'El Niño débil' }, { min: -0.5, label: 'Neutral' }, { min: -1.0, label: 'La Niña débil' },
    { min: -1.5, label: 'La Niña moderada' }, { min: -Infinity, label: 'La Niña fuerte' }
  ];
  function oniClass(v) { for (var i = 0; i < ONI_CLASS.length; i++) if (v >= ONI_CLASS[i].min) return ONI_CLASS[i].label; }
  var SEASON_ES = { DJF: 'dic–feb', JFM: 'ene–mar', FMA: 'feb–abr', MAM: 'mar–may', AMJ: 'abr–jun', MJJ: 'may–jul', JJA: 'jun–ago', JAS: 'jul–set', ASO: 'ago–oct', SON: 'set–nov', OND: 'oct–dic', NDJ: 'nov–ene' };

  function loadEnso() {
    return fetchJSON('data/enso.json').then(function (d) {
      enso = d;
      var w = d.weekly.rows, last = w[w.length - 1];
      var prev = w.slice(0, -26).reduce(function (b, r) { return r[1] > b[1] ? r : b; }, w[0]);
      var recentMax = w.slice(-26).reduce(function (b, r) { return r[1] > b[1] ? r : b; }, w[w.length - 26]);
      var record = recentMax[1] > prev[1];
      var oni = d.oni.rows[d.oni.rows.length - 1];
      $('kpi-n12').innerHTML = '<div class="k">Mar frente a la costa norte · Niño 1+2</div>' +
        '<div class="v">' + signed(last[1], 1) + '<small>°C</small></div>' +
        '<div class="s">sobre lo normal · semana del ' + dShort(last[0]) + '</div>' +
        (record ? '<span class="badge">▲ Récord desde 1981 (' + signed(recentMax[1], 1) + ' °C)</span>' : '');
      $('kpi-oni').innerHTML = '<div class="k">Índice oficial de El Niño · ONI</div>' +
        '<div class="v">' + signed(oni[3], 2) + '<small>°C</small></div>' +
        '<div class="s">Pacífico central · ' + SEASON_ES[oni[0]] + ' ' + oni[1] + '</div>' +
        '<span class="badge">' + oniClass(oni[3]) + '</span>';
      if (record) {
        $('hero-lede').innerHTML = 'El mar frente al norte del Perú está <strong>' + signed(last[1], 1) + ' °C</strong> más caliente de lo normal, el valor más alto desde que hay registro satelital (1981). Mueve la línea blanca y compáralo con hace un año.';
        $('nino-lede').innerHTML = 'El Niño 1+2 llegó a <strong>' + signed(recentMax[1], 1) + ' °C</strong> la semana del ' + dLong(recentMax[0]) + ', por encima del máximo de 1982-83 (' + signed(prev[1], 1) + ' °C). Anomalía semanal de la temperatura del mar respecto a lo normal.';
      }
      renderEnso();
    }).catch(function (e) {
      console.error(e);
      ['kpi-n12', 'kpi-oni'].forEach(function (id) { $(id).innerHTML = '<div class="k">El Niño</div><div class="s">No se pudieron cargar los índices.</div>'; });
      $('enso-chart').innerHTML = '<div class="msg">No se pudieron cargar los índices de El Niño.</div>';
    });
  }

  function renderEnso() {
    if (!enso) return;
    var rows = enso.weekly.rows;
    if (ensoRange !== 'all') {
      var cut = new Date(utcToday().getTime() - (+ensoRange) * 365.25 * DAY).toISOString().slice(0, 10);
      rows = rows.filter(function (r) { return r[0] >= cut; });
    }
    var n = rows.length, years = n / 52;
    var ticks = [], lastY = null, every = years > 20 ? 5 : years > 6 ? 1 : 0;
    rows.forEach(function (r, i) {
      var yv = +r[0].slice(0, 4), mo = +r[0].slice(5, 7);
      if (every) { if (yv !== lastY && yv % every === 0 && mo === 1) { ticks.push({ i: i, label: String(yv) }); lastY = yv; } }
      else if (r[0].slice(8, 10) <= '07' && (mo - 1) % 3 === 0) { ticks.push({ i: i, label: MONTHS[mo - 1] + (mo === 1 ? ' ' + yv : '') }); }
    });
    var events = [['1982-09', '1983-09', '1983'], ['1997-03', '1998-09', '1997-98'], ['2017-01', '2017-06', 'Costero 2017'], ['2023-01', '2024-03', '2023'], ['2025-06', '2027-12', 'Hoy']];
    var ann = [];
    events.forEach(function (ev) {
      var best = -1;
      rows.forEach(function (r, i) { if (r[0].slice(0, 7) >= ev[0] && r[0].slice(0, 7) <= ev[1] && (best < 0 || r[1] > rows[best][1])) best = i; });
      if (best >= 0 && rows[best][1] >= 2) ann.push({ i: best, v: rows[best][1], label: ev[2] + ': ' + signed(rows[best][1], 1) + '°' });
    });
    lineChart($('enso-chart'), {
      n: n, label: 'Anomalía semanal de temperatura del mar en las regiones Niño 1+2 y Niño 3.4',
      series: [
        { values: rows.map(function (r) { return r[1]; }), color: 'var(--warm)', width: n > 600 ? 1.4 : 2, diverging: true },
        { values: rows.map(function (r) { return r[2]; }), color: 'var(--ref)', width: 1.5, dash: '4 3' }
      ],
      xTicks: ticks, ann: ann, height: 300,
      tip: function (i) {
        var r = rows[i];
        return '<b>Semana del ' + dLong(r[0]) + '</b><br><i class="sw" style="background:var(--warm)"></i>Niño 1+2: ' + signed(r[1], 1) + ' °C<br>' +
          '<i class="sw" style="background:var(--ref)"></i>Niño 3.4: ' + signed(r[2], 1) + ' °C';
      }
    });
    $('enso-table').innerHTML = '<table><thead><tr><th>Semana</th><th class="n">Niño 1+2 (°C)</th><th class="n">Niño 3.4 (°C)</th></tr></thead><tbody>' +
      enso.weekly.rows.slice(-12).reverse().map(function (r) { return '<tr><td>' + dLong(r[0]) + '</td><td class="n">' + signed(r[1], 1) + '</td><td class="n">' + signed(r[2], 1) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="card-sub" style="margin-top:8px">Fuente: ' + esc(enso.source) + '. Actualizado: ' + dLong(enso.updated) + '.</p>';
  }

  document.querySelectorAll('#nino .seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      ensoRange = b.getAttribute('data-range');
      document.querySelectorAll('#nino .seg button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      renderEnso();
    });
  });

  // ---------------------------------------------------------------- Rivers (GloFAS via Open-Meteo)
  var RIVERS = [
    { name: 'Amazonas', place: 'Iquitos, Loreto', lat: -3.57, lon: -73.2 },
    { name: 'Marañón', place: 'Nauta, Loreto', lat: -4.5, lon: -73.58 },
    { name: 'Ucayali', place: 'Pucallpa, Ucayali', lat: -8.38, lon: -74.52 },
    { name: 'Huallaga', place: 'Yurimaguas, Loreto', lat: -5.9, lon: -76.1 },
    { name: 'Madre de Dios', place: 'Puerto Maldonado', lat: -12.53, lon: -69.03 },
    { name: 'Urubamba', place: 'Machu Picchu, Cusco', lat: -13.16, lon: -72.53 },
    { name: 'Mantaro', place: 'Junín', lat: -11.52, lon: -75.9 },
    { name: 'Rímac', place: 'Chosica, Lima', lat: -11.93, lon: -76.7 },
    { name: 'Santa', place: 'Áncash', lat: -8.92, lon: -78.6 },
    { name: 'Piura', place: 'Piura', lat: -5.03, lon: -80.68 },
    { name: 'Tumbes', place: 'Tumbes', lat: -3.52, lon: -80.5 }
  ];
  var rivers = null, riverIdx = 0, riverMarkers = L.layerGroup();

  function loadRivers() {
    var url = 'https://flood-api.open-meteo.com/v1/flood?latitude=' + RIVERS.map(function (r) { return r.lat; }).join(',') +
      '&longitude=' + RIVERS.map(function (r) { return r.lon; }).join(',') +
      '&daily=river_discharge,river_discharge_p25,river_discharge_p75&past_days=90&forecast_days=30';
    return fetchJSON(url).then(function (res) {
      res = Array.isArray(res) ? res : [res];
      var today = limaDate();
      rivers = res.map(function (r) {
        var d = r.daily, now = 0;
        d.time.forEach(function (t, i) { if (t <= today) now = i; });
        var q = d.river_discharge, past = q.slice(0, now + 1).filter(function (v) { return v != null; });
        var mean90 = past.reduce(function (s, v) { return s + v; }, 0) / Math.max(1, past.length);
        var wk = q[now - 7], chg = wk ? (q[now] - wk) / wk * 100 : null;
        var fmax = Math.max.apply(null, q.slice(now).filter(function (v) { return v != null; }));
        return { t: d.time, q: q, p25: d.river_discharge_p25, p75: d.river_discharge_p75, now: now, mean90: mean90, chg: chg, fmax: fmax };
      });
      renderRiverCards(); renderRiver(); paintRiverMarkers();
      var rising = rivers.filter(function (r) { return r.chg != null && r.chg > 10; }).length;
      $('kpi-rivers').innerHTML = '<div class="k">Ríos con caudal en aumento</div>' +
        '<div class="v">' + rising + '<small>de ' + rivers.length + '</small></div>' +
        '<div class="s">Suben más de 10 % respecto a hace 7 días · GloFAS</div>';
    }).catch(function (e) {
      console.error(e);
      $('river-cards').innerHTML = '<div class="msg">No se pudieron cargar los caudales. <button type="button" id="river-retry">Reintentar</button></div>';
      $('river-retry').addEventListener('click', loadRivers);
      $('river-chart').innerHTML = '';
      $('kpi-rivers').innerHTML = '<div class="k">Ríos</div><div class="s">Sin conexión con GloFAS.</div>';
    });
  }
  function trend(chg) {
    if (chg == null) return '';
    if (chg > 10) return '<span aria-hidden="true">▲</span> Sube ' + fmt(chg) + ' % en 7 días';
    if (chg < -10) return '<span aria-hidden="true">▼</span> Baja ' + fmt(-chg) + ' % en 7 días';
    return '<span aria-hidden="true">▬</span> Estable en 7 días';
  }
  function qfmt(v) { return v >= 100 ? fmt(v) : fmt(v, 1); }
  function renderRiverCards() {
    $('river-cards').innerHTML = rivers.map(function (r, i) {
      return '<button class="rcard" data-i="' + i + '" aria-pressed="' + (i === riverIdx) + '">' +
        '<div class="rn">' + esc(RIVERS[i].name) + '</div><div class="rp">' + esc(RIVERS[i].place) + '</div>' +
        '<div class="rv">' + qfmt(r.q[r.now]) + ' <small>m³/s</small></div><div class="rt">' + trend(r.chg) + '</div>' +
        sparkline(r.q.slice(Math.max(0, r.now - 60), r.now + 1), css('--series-1')) + '</button>';
    }).join('');
    $('river-cards').onclick = function (e) {
      var b = e.target.closest('.rcard'); if (!b) return;
      selectRiver(+b.getAttribute('data-i'));
    };
  }
  function selectRiver(i, scroll) {
    riverIdx = i;
    document.querySelectorAll('.rcard').forEach(function (c) { c.setAttribute('aria-pressed', +c.getAttribute('data-i') === i); });
    renderRiver(); paintRiverMarkers();
    if (scroll) $('rios').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function renderRiver() {
    if (!rivers) return;
    var r = rivers[riverIdx], R = RIVERS[riverIdx];
    $('river-title').textContent = 'Río ' + R.name + ' · ' + R.place;
    $('river-sub').textContent = 'Hoy: ' + qfmt(r.q[r.now]) + ' m³/s · promedio de los últimos 90 días: ' + qfmt(r.mean90) + ' m³/s · máximo pronosticado: ' + qfmt(r.fmax) + ' m³/s';
    var ticks = [];
    r.t.forEach(function (t, i) { if (t.slice(8, 10) === '01') ticks.push({ i: i, label: MONTHS[+t.slice(5, 7) - 1] }); });
    var lo = r.p25.map(function (v, i) { return i >= r.now ? v : null; }), hi = r.p75.map(function (v, i) { return i >= r.now ? v : null; });
    lineChart($('river-chart'), {
      n: r.t.length, label: 'Caudal diario del río ' + R.name, now: r.now, nowLabel: 'Hoy',
      series: [{ values: r.q, color: 'var(--series-1)', forecastDash: true }],
      band: { lo: lo, hi: hi }, xTicks: ticks, yMin: 0,
      tip: function (i) {
        var s = '<b>' + dLong(r.t[i]) + (i > r.now ? ' · pronóstico' : '') + '</b><br>' + qfmt(r.q[i]) + ' m³/s';
        if (i >= r.now && r.p25[i] != null) s += '<br>Rango probable: ' + qfmt(r.p25[i]) + '–' + qfmt(r.p75[i]);
        return s;
      }
    });
    var rowsH = '';
    for (var i = r.t.length - 1; i >= 0; i -= 1) {
      rowsH += '<tr><td>' + dLong(r.t[i]) + '</td><td class="n">' + qfmt(r.q[i]) + '</td><td>' + (i > r.now ? 'Pronóstico' : 'Modelado') + '</td></tr>';
    }
    $('river-table').innerHTML = '<div class="table-scroll"><table><thead><tr><th>Fecha</th><th class="n">Caudal (m³/s)</th><th>Tipo</th></tr></thead><tbody>' + rowsH + '</tbody></table></div>';
  }
  function paintRiverMarkers() {
    riverMarkers.clearLayers();
    RIVERS.forEach(function (R, i) {
      var r = rivers && rivers[i];
      var m = L.circleMarker([R.lat, R.lon], { radius: i === riverIdx ? 9 : 7, weight: 2, color: '#ffffff', fillColor: '#3987e5', fillOpacity: 1 })
        .bindTooltip('Río ' + R.name + (r ? ': ' + qfmt(r.q[r.now]) + ' m³/s' : ''), { className: 'gd-tip', direction: 'top', offset: [0, -8] })
        .on('click', function () { selectRiver(i, true); });
      riverMarkers.addLayer(m);
    });
  }

  // ---------------------------------------------------------------- Cities (Open-Meteo forecast + CAMS air quality)
  var CITIES = [
    { name: 'Tumbes', region: 'Tumbes', lat: -3.567, lon: -80.451 },
    { name: 'Piura', region: 'Piura', lat: -5.194, lon: -80.632 },
    { name: 'Chiclayo', region: 'Lambayeque', lat: -6.771, lon: -79.841 },
    { name: 'Cajamarca', region: 'Cajamarca', lat: -7.164, lon: -78.510 },
    { name: 'Trujillo', region: 'La Libertad', lat: -8.112, lon: -79.029 },
    { name: 'Chimbote', region: 'Áncash', lat: -9.074, lon: -78.594 },
    { name: 'Huaraz', region: 'Áncash', lat: -9.527, lon: -77.528 },
    { name: 'Iquitos', region: 'Loreto', lat: -3.749, lon: -73.253 },
    { name: 'Moyobamba', region: 'San Martín', lat: -6.034, lon: -76.972 },
    { name: 'Pucallpa', region: 'Ucayali', lat: -8.379, lon: -74.554 },
    { name: 'Huánuco', region: 'Huánuco', lat: -9.930, lon: -76.242 },
    { name: 'Cerro de Pasco', region: 'Pasco', lat: -10.686, lon: -76.256 },
    { name: 'La Oroya', region: 'Junín', lat: -11.519, lon: -75.900 },
    { name: 'Lima', region: 'Lima', lat: -12.046, lon: -77.043 },
    { name: 'Huancayo', region: 'Junín', lat: -12.065, lon: -75.205 },
    { name: 'Ayacucho', region: 'Ayacucho', lat: -13.158, lon: -74.224 },
    { name: 'Ica', region: 'Ica', lat: -14.068, lon: -75.729 },
    { name: 'Cusco', region: 'Cusco', lat: -13.532, lon: -71.967 },
    { name: 'Puerto Maldonado', region: 'Madre de Dios', lat: -12.593, lon: -69.189 },
    { name: 'Arequipa', region: 'Arequipa', lat: -16.409, lon: -71.537 },
    { name: 'Puno', region: 'Puno', lat: -15.840, lon: -70.022 },
    { name: 'Moquegua', region: 'Moquegua', lat: -17.194, lon: -70.935 },
    { name: 'Tacna', region: 'Tacna', lat: -18.006, lon: -70.246 }
  ];
  var WHO_PM25 = 15, ECA_PM25 = 50;
  var PM_STATUS = [
    { max: WHO_PM25, key: 'good', label: 'Buena', long: 'dentro de la guía OMS', shape: 'circle' },
    { max: ECA_PM25, key: 'warning', label: 'Moderada', long: 'sobre la guía OMS, bajo el ECA', shape: 'tri' },
    { max: Infinity, key: 'critical', label: 'Mala', long: 'sobre el ECA Perú', shape: 'sq' }
  ];
  var UV_STATUS = [
    { max: 2.99, key: 'good', label: 'Bajo' }, { max: 5.99, key: 'warning', label: 'Moderado' },
    { max: 7.99, key: 'serious', label: 'Alto' }, { max: 10.99, key: 'critical', label: 'Muy alto' }, { max: Infinity, key: 'critical', label: 'Extremo' }
  ];
  function pmStatus(v) { for (var i = 0; i < PM_STATUS.length; i++) if (v <= PM_STATUS[i].max) return PM_STATUS[i]; }
  function uvStatus(v) { for (var i = 0; i < UV_STATUS.length; i++) if (v <= UV_STATUS[i].max) return UV_STATUS[i]; }
  function swatch(st) {
    var cls = st.shape === 'tri' ? 'sw tri' : st.shape === 'sq' ? 'sw sq' : 'sw';
    var style = st.shape === 'tri' ? 'color:var(--' + st.key + ')' : 'background:var(--' + st.key + ')';
    return '<i class="' + cls + '" style="' + style + '" aria-hidden="true"></i>';
  }
  var city = { air: null, wx: null, idx: 13 }, cityMarkers = L.layerGroup();

  function summarizeAir(h, now) {
    var i = -1;
    for (var k = 0; k < h.time.length; k++) if (h.time[k].slice(0, 13) <= now) i = k;
    function mean24(arr) {
      var vals = arr.slice(Math.max(0, i - 23), i + 1).filter(function (v) { return v != null; });
      return vals.length >= 18 ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length : null;
    }
    var from = Math.max(0, i - 23), to = Math.min(h.time.length, i + 25);
    return {
      pm25: mean24(h.pm2_5), pm10: mean24(h.pm10),
      series: h.time.slice(from, to).map(function (t, j) { return { t: t, v: h.pm2_5[from + j] }; }),
      nowIndex: i - from
    };
  }
  function loadCities() {
    var lat = CITIES.map(function (c) { return c.lat; }).join(','), lon = CITIES.map(function (c) { return c.lon; }).join(',');
    var airUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon +
      '&hourly=pm2_5,pm10&past_days=1&forecast_days=2&timezone=' + encodeURIComponent(TZ);
    var wxUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&daily=precipitation_sum,precipitation_probability_max,uv_index_max,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=' + encodeURIComponent(TZ);
    return Promise.all([fetchJSON(airUrl), fetchJSON(wxUrl)]).then(function (res) {
      var now = limaHour();
      city.air = (Array.isArray(res[0]) ? res[0] : [res[0]]).map(function (a) { return summarizeAir(a.hourly, now); });
      city.wx = (Array.isArray(res[1]) ? res[1] : [res[1]]).map(function (w) { return w.daily; });
      $('updated').textContent = 'Actualizado: ' + new Date().toLocaleString('es-PE', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' (hora de Lima)';
      var over = city.air.filter(function (a) { return a.pm25 != null && a.pm25 > WHO_PM25; }).length;
      var valid = city.air.filter(function (a) { return a.pm25 != null; }).length;
      $('kpi-air').innerHTML = '<div class="k">Ciudades sobre la guía de aire de la OMS</div>' +
        '<div class="v">' + over + '<small>de ' + valid + '</small></div><div class="s">PM2.5 promedio de 24 h mayor a 15 µg/m³ · CAMS</div>';
      selectCity(city.idx);
    }).catch(function (e) {
      console.error(e);
      var html = '<div class="msg">No se pudieron cargar los datos de aire y tiempo.<br><button type="button" class="retry">Reintentar</button></div>';
      ['tiles', 'pm-chart', 'rain-chart'].forEach(function (id) { $(id).innerHTML = html; });
      $('city-title').textContent = 'Sin conexión';
      $('kpi-air').innerHTML = '<div class="k">Calidad del aire</div><div class="s">Sin conexión con CAMS.</div>';
      document.querySelectorAll('.retry').forEach(function (b) { b.addEventListener('click', loadCities); });
    });
  }
  function selectCity(i, scroll) {
    city.idx = i;
    $('city').value = String(i);
    try { localStorage.setItem('gd-city', CITIES[i].name); } catch (e) {}
    paintCityMarkers();
    if (!city.air) return;
    renderNow(); renderPM(); renderRain();
    if (scroll) $('ciudades').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function paintCityMarkers() {
    cityMarkers.clearLayers();
    CITIES.forEach(function (c, i) {
      var a = city.air && city.air[i], st = a && a.pm25 != null ? pmStatus(a.pm25) : null;
      var m = L.circleMarker([c.lat, c.lon], {
        radius: i === city.idx ? 8 : 6, weight: 2, color: i === city.idx ? '#ffffff' : '#0b1411',
        fillColor: st ? css('--' + st.key) : '#8a958f', fillOpacity: 1
      }).bindTooltip(c.name + (a && a.pm25 != null ? ' · PM2.5 ' + fmt(a.pm25) + ' µg/m³ (' + st.label.toLowerCase() + ')' : ''), { className: 'gd-tip', direction: 'top', offset: [0, -6] })
        .on('click', function () { selectCity(i, true); });
      cityMarkers.addLayer(m);
    });
  }
  function tile(k, v, unit, status, note) {
    return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v + (unit ? '<small>' + unit + '</small>' : '') + '</div>' + status + (note ? '<div class="note">' + note + '</div>' : '') + '</div>';
  }
  function renderNow() {
    var c = CITIES[city.idx], a = city.air[city.idx], w = city.wx[city.idx];
    $('city-title').textContent = c.name;
    $('city-sub').textContent = 'Región ' + c.region + ' · ahora y hoy';
    var pmSt = a.pm25 != null ? pmStatus(a.pm25) : null, uv = w.uv_index_max[0], uvSt = uv != null ? uvStatus(uv) : null;
    $('tiles').innerHTML = '<div class="tiles">' +
      tile('PM2.5 · promedio 24 h', fmt(a.pm25), 'µg/m³',
        pmSt ? '<span class="status">' + swatch(pmSt) + 'Aire ' + pmSt.label.toLowerCase() + ' · ' + pmSt.long + '</span>' : '<span class="note">Sin datos suficientes</span>',
        'PM10: ' + fmt(a.pm10) + ' µg/m³') +
      tile('Índice UV máximo hoy', fmt(uv, 1), '', uvSt ? '<span class="status">' + swatch({ key: uvSt.key }) + uvSt.label + '</span>' : '',
        uv >= 8 ? 'Evita el sol de 10 a 16 h' : uv >= 3 ? 'Usa protector solar' : 'Protección mínima') +
      tile('Lluvia hoy', fmt(w.precipitation_sum[0], 1), 'mm', '',
        'Probabilidad máx.: ' + fmt(w.precipitation_probability_max[0]) + ' % · ' + fmt(w.temperature_2m_min[0]) + '° a ' + fmt(w.temperature_2m_max[0]) + ' °C') +
      '</div>';
  }
  function renderPM() {
    var a = city.air[city.idx], box = $('pm-chart');
    if (a.series.filter(function (p) { return p.v != null; }).length < 2) { box.innerHTML = '<div class="msg">No hay datos horarios de PM2.5 para esta ciudad.</div>'; $('pm-table').innerHTML = ''; return; }
    var narrow = (box.clientWidth || 600) < 420;
    var ticks = [];
    a.series.forEach(function (p, i) { if (+p.t.slice(11, 13) % (narrow ? 12 : 6) === 0) ticks.push({ i: i, label: p.t.slice(11, 13) + 'h' }); });
    lineChart(box, {
      n: a.series.length, label: 'PM2.5 por hora en ' + CITIES[city.idx].name, now: a.nowIndex, nowLabel: 'Ahora', height: 220,
      series: [{ values: a.series.map(function (p) { return p.v; }), color: 'var(--series-1)', forecastDash: true }],
      refs: [{ v: WHO_PM25, label: 'OMS 15' }, { v: ECA_PM25, label: 'ECA 50' }], xTicks: ticks, yMin: 0,
      tip: function (i) { var p = a.series[i]; return '<b>' + fmt(p.v, 1) + ' µg/m³</b><br>' + p.t.slice(8, 10) + '/' + p.t.slice(5, 7) + ' ' + p.t.slice(11, 16) + (i > a.nowIndex ? ' · pronóstico' : ''); }
    });
    $('pm-table').innerHTML = '<div class="table-scroll"><table><thead><tr><th>Hora</th><th class="n">PM2.5 (µg/m³)</th><th>Tipo</th></tr></thead><tbody>' +
      a.series.map(function (p, i) { return '<tr><td>' + p.t.slice(8, 10) + '/' + p.t.slice(5, 7) + ' ' + p.t.slice(11, 16) + '</td><td class="n">' + fmt(p.v, 1) + '</td><td>' + (i > a.nowIndex ? 'Pronóstico' : 'Estimado') + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }
  function renderRain() {
    var w = city.wx[city.idx];
    var labels = w.time.map(function (t, i) { if (i === 0) return 'Hoy'; var d = new Date(t + 'T12:00:00Z'); return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate(); });
    barChart($('rain-chart'), {
      values: w.precipitation_sum, labels: labels, label: 'Lluvia diaria en ' + CITIES[city.idx].name,
      tip: function (i) { return '<b>' + labels[i] + ': ' + fmt(w.precipitation_sum[i], 1) + ' mm</b><br>Probabilidad máx.: ' + fmt(w.precipitation_probability_max[i]) + ' %'; }
    });
    $('rain-table').innerHTML = '<table><thead><tr><th>Día</th><th class="n">Lluvia (mm)</th><th class="n">Prob. (%)</th><th class="n">UV máx.</th></tr></thead><tbody>' +
      labels.map(function (l, i) { return '<tr><td>' + l + '</td><td class="n">' + fmt(w.precipitation_sum[i], 1) + '</td><td class="n">' + fmt(w.precipitation_probability_max[i]) + '</td><td class="n">' + fmt(w.uv_index_max[i], 1) + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  // ---------------------------------------------------------------- proof strip
  function renderProof() {
    var sats = 'GHRSST · GPM · MODIS · VIIRS · SMAP';
    $('proof').innerHTML =
      '<div><b>' + Object.keys(LAYERS).length + '</b><span>capas satelitales diarias</span></div>' +
      '<div><b>' + (CITIES.length + RIVERS.length) + '</b><span>ciudades y ríos monitoreados</span></div>' +
      '<div><b>' + (new Date().getUTCFullYear() - 1981) + '</b><span>años de datos de El Niño</span></div>' +
      '<div><b>0</b><span>servidores: todo con datos abiertos</span></div>' +
      '<div style="flex-basis:100%"><span>Satélites y modelos: ' + sats + ' · Copernicus CAMS y GloFAS · NOAA CPC</span></div>';
  }

  // ---------------------------------------------------------------- init
  var sel = $('city');
  sel.innerHTML = CITIES.map(function (c, i) { return { c: c, i: i }; })
    .sort(function (a, b) { return a.c.name.localeCompare(b.c.name, 'es'); })
    .map(function (o) { return '<option value="' + o.i + '">' + esc(o.c.name) + ' (' + esc(o.c.region) + ')</option>'; }).join('');
  try {
    var savedCity = localStorage.getItem('gd-city'), si = CITIES.findIndex(function (c) { return c.name === savedCity; });
    if (si >= 0) city.idx = si;
    var savedLayer = localStorage.getItem('gd-layer'); if (savedLayer && LAYERS[savedLayer]) sat.key = savedLayer;
  } catch (e) {}
  sel.addEventListener('change', function () { selectCity(+sel.value); });

  initMap();
  cityMarkers.addTo(map); riverMarkers.addTo(map);
  paintCityMarkers(); paintRiverMarkers();
  $('ov-cities').addEventListener('change', function (e) { e.target.checked ? cityMarkers.addTo(map) : map.removeLayer(cityMarkers); });
  $('ov-rivers').addEventListener('change', function (e) { e.target.checked ? riverMarkers.addTo(map) : map.removeLayer(riverMarkers); });
  renderProof();
  loadEnso();
  loadRivers();
  loadCities();

  var lastW = window.innerWidth, rt;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rt);
    rt = setTimeout(function () {
      renderEnso(); renderRiver();
      if (city.air) { renderPM(); renderRain(); }
    }, 150);
  });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    paintCityMarkers(); if (rivers) renderRiverCards();
  });
})();
