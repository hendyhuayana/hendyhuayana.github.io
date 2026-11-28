/* hendy.greendata · Peru environmental observatory
 * Open data: NASA GIBS, NOAA CPC, Copernicus GloFAS and CAMS (via Open-Meteo).
 */
(function () {
  'use strict';

  var TZ = 'America/Lima';
  var LOC = window.GD_LOCALE || 'en-US';
  var t = window.t || function (x) { var a = arguments; return String(x).replace(/\{(\d)\}/g, function (_, i) { return a[+i + 1]; }); };
  var DAY = 864e5;

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(v, d) {
    if (v == null || isNaN(v)) return '–';
    return v.toLocaleString(LOC, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function signed(v, d) { return v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function utcToday() { var n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); }
  var MONTHS = Array.from({ length: 12 }, function (_, m) { return new Intl.DateTimeFormat(LOC, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2020, m, 15)); });
  var DAYS = Array.from({ length: 7 }, function (_, i) { return new Intl.DateTimeFormat(LOC, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2020, 0, 5 + i)); });
  var DFS = new Intl.DateTimeFormat(LOC, { month: 'short', day: 'numeric', timeZone: 'UTC' }), DFL = new Intl.DateTimeFormat(LOC, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  function dShort(s) { return DFS.format(new Date(s + 'T12:00:00Z')); }
  function dHour(t) { return dShort(t.slice(0, 10)) + ', ' + t.slice(11, 16); }
  function dLong(s) { return DFL.format(new Date(s + 'T12:00:00Z')); }
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
    var y0c = Math.max(0, Math.min(H, y(0)));
    s += '<defs><clipPath id="' + id + 'a"><rect x="0" y="0" width="' + W + '" height="' + y0c + '"/></clipPath>' +
         '<clipPath id="' + id + 'b"><rect x="0" y="' + y0c + '" width="' + W + '" height="' + (H - y0c) + '"/></clipPath></defs>';
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
           '<text x="' + (+nx + 5) + '" y="' + (m.t + 4) + '" class="lbl">' + esc(o.nowLabel || t('Today')) + '</text>';
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
    if (maxRaw < 0.1) s += '<p class="card-sub" style="margin:6px 0 0">' + t('No rain expected this week.') + '</p>';
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
    { name: 'Ocean', layers: ['sst_anom', 'sst', 'chl'] },
    { name: 'Water', layers: ['rain', 'soil', 'snow'] },
    { name: 'Land', layers: ['true', 'ndvi', 'lst'] },
    { name: 'Air & fire', layers: ['aod', 'fire'] }
  ];
  var LAYERS = {
    sst_anom: { label: 'El Niño (sea temperature anomaly)', id: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies', z: 7, ext: 'png', lag: 2,
      legend: 'GHRSST_Sea_Surface_Temperature_Anomalies_H.svg',
      info: '<b>How much warmer or colder the ocean is than normal.</b> Deep red = warmer water, the fingerprint of El Niño off the coast. Blue = colder.',
      meta: 'GHRSST MUR L4 · NASA JPL · ~1 km · daily' },
    sst: { label: 'Sea temperature', id: 'GHRSST_L4_MUR_Sea_Surface_Temperature', z: 7, ext: 'png', lag: 2,
      legend: 'GHRSST_Sea_Surface_Temperature_H.svg',
      info: '<b>Sea surface temperature.</b> The Humboldt Current keeps Peru\'s ocean cold and nutrient-rich; El Niño warms it up.',
      meta: 'GHRSST MUR L4 · NASA JPL · ~1 km · daily' },
    chl: { label: 'Chlorophyll (phytoplankton)', id: 'VIIRS_NOAA20_Chlorophyll_a', z: 7, ext: 'png', lag: 1,
      legend: 'VIIRS_Chlorophyll_H.svg',
      info: '<b>Phytoplankton, the base of the anchovy food web.</b> Peru\'s upwelling system is one of the most productive on Earth. Clouds leave gaps.',
      meta: 'VIIRS NOAA-20 · NASA Ocean Biology · ~750 m · daily' },
    rain: { label: 'Rainfall (GPM IMERG)', id: 'IMERG_Precipitation_Rate', z: 6, ext: 'png', lag: 2,
      legend: 'GPM_Precipitation_Rate_H.svg',
      info: '<b>Rainfall estimated by the GPM satellite constellation.</b> Useful to track heavy rain on the northern coast and in the Andes.',
      meta: 'GPM IMERG · NASA / JAXA · ~10 km · daily' },
    soil: { label: 'Soil moisture', id: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', z: 6, ext: 'png', lag: 4,
      legend: 'SMAP_Analyzed_Soil_Moisture_H.svg',
      info: '<b>Water in the top metre of soil.</b> Saturated soils raise the risk of debris flows and landslides when it rains.',
      meta: 'SMAP L4 · NASA · ~9 km · daily' },
    snow: { label: 'Snow & glaciers', id: 'MODIS_Terra_NDSI_Snow_Cover', z: 8, ext: 'png', lag: 1,
      legend: 'MODIS_NDSI_Snow_Cover_H.svg',
      info: '<b>Snow cover in the Andes.</b> Peru holds most of the world\'s tropical glaciers, and they are shrinking. Zoom into the Cordillera Blanca.',
      meta: 'MODIS Terra · NASA · 500 m · daily' },
    true: { label: 'True color', id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', z: 9, ext: 'jpeg', lag: 1, legend: null,
      info: '<b>Peru as an astronaut would see it.</b> Clouds, deserts, the rainforest and sometimes wildfire smoke. Zoom in for detail.',
      meta: 'VIIRS NOAA-20 · NASA · 375 m · daily' },
    ndvi: { label: 'Vegetation (NDVI)', id: 'MODIS_Terra_NDVI_8Day', z: 9, ext: 'png', lag: 2,
      legend: 'MODIS_NDVI_H.svg',
      info: '<b>How green and healthy vegetation is.</b> Compare the Amazon with the desert coast and its irrigated valleys.',
      meta: 'MODIS Terra · NASA · 250 m · 8-day composite' },
    lst: { label: 'Land surface temperature', id: 'MODIS_Terra_Land_Surface_Temp_Day', z: 7, ext: 'png', lag: 1,
      legend: 'MODIS_Land_Surface_Temp_H.svg',
      info: '<b>How hot the ground surface gets during the day</b>, not the air. Cities and deserts heat up far more than vegetation.',
      meta: 'MODIS Terra · NASA · 1 km · daily' },
    fire: { label: 'Active fires (VIIRS)', wms: true, id: 'VIIRS_NOAA21_Thermal_Anomalies_375m_All', lag: 1, legend: null,
      info: '<b>Every red dot is a heat anomaly detected from space that day</b>, most often a wildfire or agricultural burning. Fire season in the Peruvian Amazon and Andes peaks in the dry months. Some dots can be volcanoes or industrial heat sources.<span class="fire-key"><i></i>Thermal anomaly (375 m pixel)</span>',
      meta: 'VIIRS NOAA-21 · NASA FIRMS / LANCE · 375 m · daily' },
    aod: { label: 'Aerosols (smoke & dust)', id: 'MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth', z: 7, ext: 'png', lag: 2,
      legend: 'MODIS_VIIRS_AOD_H.svg',
      info: '<b>Particles in the atmosphere: wildfire smoke, dust and pollution.</b> In the dry season, Amazon fire smoke can blanket eastern Peru.',
      meta: 'MODIS MAIAC · NASA · 1 km · daily' }
  };
  // plain words for the two ends of each colour scale
  var SCALE_WORDS = {
    sst_anom: ['Colder than normal', 'Warmer than normal'], sst: ['Cold water', 'Warm water'], chl: ['Little plankton', 'A lot of plankton'],
    rain: ['Light rain', 'Heavy rain'], soil: ['Dry soil', 'Wet soil'], snow: ['No snow', 'Full snow cover'],
    ndvi: ['Little or no vegetation', 'Dense, healthy vegetation'], lst: ['Cool ground', 'Hot ground'], aod: ['Clean air', 'Thick smoke or dust']
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
  var GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';
  function setSatDate(layer, key, date) {
    if (LAYERS[key].wms) layer.setParams({ TIME: date }); else layer.setUrl(gibsUrl(key, date));
  }
  function makeSat(key, date, pane) {
    if (LAYERS[key].wms) {
      return L.tileLayer.wms(GIBS_WMS, {
        layers: LAYERS[key].id, format: 'image/png', transparent: true, version: '1.3.0', TIME: date,
        pane: pane, maxZoom: 12, attribution: '<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> · FIRMS'
      });
    }
    return L.tileLayer(gibsUrl(key, date), {
      pane: pane, maxNativeZoom: LAYERS[key].z, maxZoom: 12, bounds: [[-85, -180], [85, 180]], keepBuffer: 4,
      attribution: '<a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>'
    });
  }

  function initMap() {
    map = L.map('map', { zoomControl: false, scrollWheelZoom: false, worldCopyJump: true, minZoom: 3, zoomSnap: 0.25, attributionControl: true });
    L.control.zoom({ position: window.innerWidth > 980 ? 'bottomleft' : 'topright' }).addTo(map);
    var wide = window.innerWidth > 980, W = map.getSize().x;
    var padL = wide ? Math.min(W * 0.45, document.querySelector('.copy-col').getBoundingClientRect().right + 10) : 10;
    var padR = wide ? 370 : 10;
    // the region El Niño affects most: from Colombia to central Chile, with the Pacific off the coast
    map.fitBounds([[-30, -84], [7, -67]], { paddingTopLeft: [wide ? Math.min(padL, W * 0.22) : 10, 20], paddingBottomRight: [padR, 10] });
    // put the compare line over the sea just off the northern coast, where El Niño shows
    var coastX = map.latLngToContainerPoint([-7, -82.2]).x;
    sat.ratio = Math.max(wide ? 0.15 : 0.4, Math.min(0.85, coastX / W));
    map.getContainer().appendChild($('swipe'));
    map.createPane('satNow').style.zIndex = 250;
    cmpPane = map.createPane('satCmp'); cmpPane.style.zIndex = 260;
    map.createPane('labels').style.zIndex = 420; map.getPane('labels').style.pointerEvents = 'none';
    var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    var baseLayer = L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, maxNativeZoom: 16, attribution: 'Base: Esri, HERE, Garmin, © OpenStreetMap'
    }).addTo(map);
    if (window.gdMapTools) window.gdMapTools(map, { home: [[-30, -84], [7, -67]], base: baseLayer, position: window.innerWidth > 980 ? 'bottomleft' : 'topright' });
    labelsLayer = L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 12, pane: 'labels' }).addTo(map);
    fetchJSON('data/peru.geojson').then(function (g) {
      L.geoJSON(g, { interactive: false, style: { color: '#ffffff', weight: 1.4, opacity: .85, fill: false } }).addTo(map);
    }).catch(function () {});
    // neighbouring countries also hit by El Niño (outlines: Natural Earth, public domain)
    var NINO_IMPACT = {
      ECU: 'El Niño brings heavy rain and floods to the coast of Ecuador.',
      COL: 'In Colombia, El Niño usually means less rain, droughts and more fires.',
      BOL: 'In Bolivia, El Niño often brings drought to the highlands and floods to the lowlands.',
      CHL: 'In central Chile, El Niño tends to bring wetter winters.'
    };
    fetchJSON('data/nino_neighbours.geojson').then(function (g) {
      L.geoJSON(g, {
        style: { color: '#d7f36b', weight: 1.2, opacity: .75, dashArray: '4 3', fill: true, fillOpacity: 0 },
        onEachFeature: function (f, layer) {
          layer.bindTooltip('<b>' + esc(t(f.properties.name)) + '</b><br>' + esc(t(NINO_IMPACT[f.properties.iso] || '')), { className: 'gd-tip', sticky: true });
        }
      }).addTo(map);
    }).catch(function () {});
    map.on('move zoom resize', clipCompare);
    // allow wheel zoom after the user clicks the map
    map.once('focus', function () { map.scrollWheelZoom.enable(); });
    buildLayerUI();
    setLayer(sat.key, true);
  }

  function buildLayerUI() {
    // all layers visible, in a tidy grid: one row per theme
    $('layers').innerHTML = '<div class="lg-grid" role="radiogroup" aria-label="' + esc(t('Choose a layer')) + '">' + GROUPS.map(function (g) {
      return '<p class="lg-name">' + esc(t(g.name)) + '</p><div class="chips">' + g.layers.map(function (k) {
        return '<button type="button" class="chip" role="radio" data-k="' + k + '" aria-checked="' + (k === sat.key) + '" title="' + esc(t('Source:') + ' ' + t(LAYERS[k].meta)) + '">' + esc(t(LAYERS[k].label)) + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
    $('layers').addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (c) setLayer(c.getAttribute('data-k')); });
    var dr = $('date-range'); dr.max = MAX_BACK; dr.value = MAX_BACK - sat.back;
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
    var ls = null;
    var L0 = LAYERS[key];
    $('layer-info').innerHTML = t(L0.info) + '<span class="meta"><b>' + esc(t('Source:')) + '</b> ' + esc(t(L0.meta)) + '</span>';
    var lg = $('legend');
    if (L0.legend) { lg.src = 'https://gibs.earthdata.nasa.gov/legends/' + L0.legend; lg.alt = t('Legend for {0}', t(L0.label)); lg.hidden = false; }
    else { lg.hidden = true; lg.removeAttribute('src'); }
    var sw = $('scale-words'), W = SCALE_WORDS[key];
    if (W) { sw.innerHTML = '<span>◀ ' + esc(t(W[0])) + '</span><span>' + esc(t(W[1])) + ' ▶</span>'; sw.hidden = false; } else { sw.hidden = true; sw.innerHTML = ''; }
    if (satNow) map.removeLayer(satNow);
    if (satCmp) map.removeLayer(satCmp);
    satNow = null; satCmp = null;
    updateDates();
    if (!first) try { localStorage.setItem('gd-layer', key); } catch (e) {}
  }

  function updateDates() {
    var d = layerDate(sat.key, sat.back);
    $('date-label').textContent = dLong(d);
    if (!satNow) { satNow = makeSat(sat.key, d, 'satNow').addTo(map); } else setSatDate(satNow, sat.key, d);
    var showCmp = sat.compare && !sat.playing;
    $('swipe').hidden = !showCmp;
    if (showCmp) {
      var d2 = yearAgo(d);
      if (!satCmp) satCmp = makeSat(sat.key, d2, 'satCmp').addTo(map); else setSatDate(satCmp, sat.key, d2);
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
    $('play').setAttribute('aria-label', t('Stop animation'));
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
    $('play').setAttribute('aria-label', t('Animate the last 14 days'));
    updateDates();
  }

  // ---------------------------------------------------------------- El Niño (NOAA CPC, updated weekly by GitHub Actions)
  var enso = null, ensoRange = 'all';
  var ONI_CLASS = [
    { min: 2.0, label: 'Very strong El Niño' }, { min: 1.5, label: 'Strong El Niño' }, { min: 1.0, label: 'Moderate El Niño' },
    { min: 0.5, label: 'Weak El Niño' }, { min: -0.5, label: 'Neutral' }, { min: -1.0, label: 'Weak La Niña' },
    { min: -1.5, label: 'Moderate La Niña' }, { min: -Infinity, label: 'Strong La Niña' }
  ];
  function oniClass(v) { for (var i = 0; i < ONI_CLASS.length; i++) if (v >= ONI_CLASS[i].min) return t(ONI_CLASS[i].label); }
  function seasonLabel(c) { return MONTHS.at((c + 10) % 12) + '–' + MONTHS.at(c % 12); }
  var SEASON_ES = { DJF: 'Dec–Feb', JFM: 'Jan–Mar', FMA: 'Feb–Apr', MAM: 'Mar–May', AMJ: 'Apr–Jun', MJJ: 'May–Jul', JJA: 'Jun–Aug', JAS: 'Jul–Sep', ASO: 'Aug–Oct', SON: 'Sep–Nov', OND: 'Oct–Dec', NDJ: 'Nov–Jan' };

  function loadEnso() {
    return fetchJSON('data/enso.json').then(function (d) {
      enso = d;
      var w = d.weekly.rows, last = w[w.length - 1];
      var prev = w.slice(0, -26).reduce(function (b, r) { return r[1] > b[1] ? r : b; }, w[0]);
      var recentMax = w.slice(-26).reduce(function (b, r) { return r[1] > b[1] ? r : b; }, w[w.length - 26]);
      var record = recentMax[1] > prev[1];
      var oni = d.oni.rows[d.oni.rows.length - 1];
      $('kpi-n12').innerHTML = '<div class="k">' + t('Ocean off northern Peru · Niño 1+2') + '</div>' +
        '<div class="v">' + signed(last[1], 1) + '<small>°C</small></div>' +
        '<div class="s">' + t('above normal · week of {0}', dShort(last[0])) + '</div>' +
        (record ? '<span class="badge">▲ ' + t('Record since 1981 ({0} °C)', signed(recentMax[1], 1)) + '</span>' : '');
      $('kpi-oni').innerHTML = '<div class="k">' + t('Official El Niño index · ONI') + '</div>' +
        '<div class="v">' + signed(oni[3], 2) + '<small>°C</small></div>' +
        '<div class="s">' + t('Central Pacific · {0} {1}', seasonLabel(oni[2]), oni[1]) + '</div>' +
        '<span class="badge">' + oniClass(oni[3]) + '</span>';
      live.n12 = last[1]; live.oni = [oni[3], oniClass(oni[3])]; updateTicker(); countKpis();
      if (record) {
        $('hero-h').innerHTML = t('Did you know Peru\'s ocean is <span class="hl">{0} °C</span> warmer than normal?', signed(last[1], 1));
        $('hero-lede').innerHTML = t('The highest value in the satellite record since 1981: <strong>coastal El Niño</strong>, live. Drag the white line to compare with one year ago.');
        $('nino-lede').innerHTML = t('Niño 1+2 reached <strong>{0} °C</strong> in the week of {1}, above the 1982-83 peak ({2} °C). Weekly sea surface temperature anomaly relative to normal.', signed(recentMax[1], 1), dLong(recentMax[0]), signed(prev[1], 1));
      }
      renderEnso();
    }).catch(function (e) {
      console.error(e);
      ['kpi-n12', 'kpi-oni'].forEach(function (id) { $(id).innerHTML = '<div class="k">El Niño</div><div class="s">' + t('Could not load the indices.') + '</div>'; });
      $('enso-chart').innerHTML = '<div class="msg">' + t('Could not load the El Niño indices.') + '</div>';
    });
  }


  // ---------------------------------------------------------------- plain-language help under each chart
  // explain(chart, sentence, tips): "In simple terms" + a folding "How to read this chart?" list
  function explain(anchor, simple, tips, src) {
    if (!anchor) return;
    var id = anchor.id + '-ex', ex = $(id);
    if (!ex) {
      ex = document.createElement('div'); ex.className = 'explainer'; ex.id = id;
      ex.innerHTML = '<p class="ex-simple"></p><details class="ex-how"><summary></summary><ul></ul></details>';
      anchor.insertAdjacentElement('afterend', ex);
    }
    ex.querySelector('.ex-simple').innerHTML = '<b>' + t('In simple terms:') + '</b> ' + simple;
    ex.querySelector('summary').textContent = t('How to read this chart?');
    ex.querySelector('ul').innerHTML = tips.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('');
    var sl = ex.querySelector('.src-line');
    if (src) { if (!sl) { sl = document.createElement('p'); sl.className = 'src-line'; ex.appendChild(sl); } sl.innerHTML = '<b>' + esc(t('Source:')) + '</b> ' + src; }
  }
  function srcLink(href, text) { return '<a href="' + href + '" target="_blank" rel="noopener">' + esc(text) + '</a>'; }

  function renderEnso() {
    if (!enso) return;
    (function () {
      var all = enso.weekly.rows, last = all[all.length - 1], rec = all.reduce(function (b, r) { return r[1] > b[1] ? r : b; }, all[0]);
      explain($('enso-chart'), last[1] >= rec[1] - 0.05
        ? t('Today the sea off northern Peru is {0} °C above normal, the highest value since 1981.', '<strong>' + signed(last[1], 1) + '</strong>')
        : t('Today the sea off northern Peru is {0} °C compared with normal. The highest value since 1981 was {1} °C, in {2}.', '<strong>' + signed(last[1], 1) + '</strong>', signed(rec[1], 1), rec[0].slice(0, 4)),
        ['Each line is the ocean temperature compared with normal: above 0 means warmer, below 0 means colder.',
         'The red line is the sea off Peru and Ecuador (Niño 1+2); the dashed line is the central Pacific (Niño 3.4).',
         'The tall peaks are El Niño years, like 1983, 1998 and 2017, when heavy rains hit northern Peru.'],
        srcLink('https://www.cpc.ncep.noaa.gov/data/indices/', 'NOAA Climate Prediction Center') + ' · OISST v2.1 · ' + esc(t('updated every week')));
    })();
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
    var events = [['1982-09', '1983-09', '1983'], ['1997-03', '1998-09', '1997-98'], ['2017-01', '2017-06', t('Coastal 2017')], ['2023-01', '2024-03', '2023'], ['2025-06', '2027-12', t('Now')]];
    var ann = [];
    events.forEach(function (ev) {
      var best = -1;
      rows.forEach(function (r, i) { if (r[0].slice(0, 7) >= ev[0] && r[0].slice(0, 7) <= ev[1] && (best < 0 || r[1] > rows[best][1])) best = i; });
      if (best >= 0 && rows[best][1] >= 2) ann.push({ i: best, v: rows[best][1], label: ev[2] + ': ' + signed(rows[best][1], 1) + '°' });
    });
    lineChart($('enso-chart'), {
      n: n, label: t('Weekly sea surface temperature anomaly in the Niño 1+2 and Niño 3.4 regions'),
      series: [
        { values: rows.map(function (r) { return r[1]; }), color: 'var(--warm)', width: n > 600 ? 1.4 : 2, diverging: true },
        { values: rows.map(function (r) { return r[2]; }), color: 'var(--ref)', width: 1.5, dash: '4 3' }
      ],
      xTicks: ticks, ann: ann, height: 300,
      tip: function (i) {
        var r = rows[i];
        return '<b>' + t('Week of {0}', dLong(r[0])) + '</b><br><i class="sw" style="background:var(--warm)"></i>Niño 1+2: ' + signed(r[1], 1) + ' °C<br>' +
          '<i class="sw" style="background:var(--ref)"></i>Niño 3.4: ' + signed(r[2], 1) + ' °C';
      }
    });
    $('enso-table').innerHTML = '<table><thead><tr><th>' + t('Week') + '</th><th class="n">Niño 1+2 (°C)</th><th class="n">Niño 3.4 (°C)</th></tr></thead><tbody>' +
      enso.weekly.rows.slice(-12).reverse().map(function (r) { return '<tr><td>' + dLong(r[0]) + '</td><td class="n">' + signed(r[1], 1) + '</td><td class="n">' + signed(r[2], 1) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="card-sub" style="margin-top:8px">' + t('Source: {0}. Updated: {1}.', esc(enso.source), dLong(enso.updated)) + '</p>';
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
    { name: 'Amazon', place: 'Iquitos, Loreto', lat: -3.57, lon: -73.2 },
    { name: 'Marañón', place: 'Nauta, Loreto', lat: -4.5, lon: -73.58 },
    { name: 'Ucayali', place: 'Pucallpa, Ucayali', lat: -8.38, lon: -74.52 },
    { name: 'Huallaga', place: 'Yurimaguas, Loreto', lat: -5.9, lon: -76.1 },
    { name: 'Madre de Dios', place: 'Puerto Maldonado', lat: -12.53, lon: -69.03 },
    { name: 'Urubamba', place: 'Machu Picchu, Cusco', lat: -13.16, lon: -72.53 },
    { name: 'Mantaro', place: 'Junín', lat: -11.52, lon: -75.9 },
    { name: 'Rímac', place: 'Chosica, Lima', lat: -11.93, lon: -76.7 },
    { name: 'Santa', place: 'Áncash', lat: -8.92, lon: -78.6 },
    { name: 'Piura', place: 'Piura', lat: -5.03, lon: -80.68 },
    { name: 'Tumbes', place: 'Tumbes', lat: -3.52, lon: -80.5 },
    { name: 'Guayas', place: 'Guayaquil, Ecuador', lat: -1.95, lon: -79.85 },
    { name: 'Magdalena', place: 'Barrancabermeja, Colombia', lat: 7.07, lon: -73.88 },
    { name: 'Mamoré', place: 'Trinidad, Bolivia', lat: -14.8, lon: -64.95 }
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
      $('kpi-rivers').innerHTML = '<div class="k">' + t('Rivers with rising discharge') + '</div>' +
        '<div class="v">' + rising + '<small>' + t('of {0}', rivers.length) + '</small></div>' +
        '<div class="s">' + t('Up more than 10% vs. 7 days ago · GloFAS') + '</div>';
      live.river = [RIVERS[0].name, qfmt(rivers[0].q[rivers[0].now])]; updateTicker(); countKpis();
      if (window.gdReveal) window.gdReveal($('river-cards'));
    }).catch(function (e) {
      console.error(e);
      $('river-cards').innerHTML = '<div class="msg">' + t('Could not load river discharge.') + ' <button type="button" id="river-retry">' + t('Retry') + '</button></div>';
      $('river-retry').addEventListener('click', loadRivers);
      $('river-chart').innerHTML = '';
      $('kpi-rivers').innerHTML = '<div class="k">' + t('Rivers') + '</div><div class="s">' + t('GloFAS is unavailable.') + '</div>';
    });
  }
  function trend(chg) {
    if (chg == null) return '';
    if (chg > 10) return '<span aria-hidden="true">▲</span> ' + t('Up {0}% in 7 days', fmt(chg));
    if (chg < -10) return '<span aria-hidden="true">▼</span> ' + t('Down {0}% in 7 days', fmt(-chg));
    return '<span aria-hidden="true">▬</span> ' + t('Stable over 7 days');
  }
  function qfmt(v) { return v >= 100 ? fmt(v) : fmt(v, 1); }
  function renderRiverCards() {
    $('river-cards').innerHTML = rivers.map(function (r, i) {
      return '<button class="rcard" data-i="' + i + '" aria-pressed="' + (i === riverIdx) + '">' +
        '<div class="rn">' + esc(t(RIVERS[i].name)) + '</div><div class="rp">' + esc(RIVERS[i].place) + '</div>' +
        '<div class="rv">' + qfmt(r.q[r.now]) + ' <small>m³/s</small></div><div class="rt">' + trend(r.chg) + '</div>' +
        sparkline(r.q.slice(Math.max(0, r.now - 60), r.now + 1), 'var(--series-1)') + '</button>';
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
    if (scroll) $('rivers').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function renderRiver() {
    if (!rivers) return;
    var r = rivers[riverIdx], R = RIVERS[riverIdx];
    $('river-title').textContent = t('{0} River · {1}', t(R.name), R.place);
    $('river-sub').textContent = t('Today: {0} m³/s · 90-day mean: {1} m³/s · forecast peak: {2} m³/s', qfmt(r.q[r.now]), qfmt(r.mean90), qfmt(r.fmax));
    var dif = r.mean90 ? (r.q[r.now] - r.mean90) / r.mean90 * 100 : 0;
    explain($('river-chart'), t(dif >= 0 ? 'Today the {0} River carries {1} m³/s, {2}% more than its average over the last 90 days. The forecast suggests it could reach about {3} m³/s in the coming weeks.'
      : 'Today the {0} River carries {1} m³/s, {2}% less than its average over the last 90 days. The forecast suggests it could reach about {3} m³/s in the coming weeks.',
      t(R.name), '<strong>' + qfmt(r.q[r.now]) + '</strong>', fmt(Math.abs(dif)), qfmt(r.fmax)),
      ['The solid line shows how much water passed each day over the last 90 days.',
       'After the “Today” line, the dotted line is the forecast and the green band is its most likely range.',
       'm³/s means cubic metres of water passing every second: 1 m³ is 1,000 litres.'],
      srcLink('https://global-flood.emergency.copernicus.eu/', 'GloFAS (Copernicus)') + ' ' + esc(t('via')) + ' ' + srcLink('https://open-meteo.com/en/docs/flood-api', 'Open-Meteo') + ' · CC BY 4.0');
    var ticks = [];
    r.t.forEach(function (t, i) { if (t.slice(8, 10) === '01') ticks.push({ i: i, label: MONTHS[+t.slice(5, 7) - 1] }); });
    var lo = r.p25.map(function (v, i) { return i >= r.now ? v : null; }), hi = r.p75.map(function (v, i) { return i >= r.now ? v : null; });
    lineChart($('river-chart'), {
      n: r.t.length, label: t('Daily discharge of the {0} River', t(R.name)), now: r.now, nowLabel: t('Today'),
      series: [{ values: r.q, color: 'var(--series-1)', forecastDash: true }],
      band: { lo: lo, hi: hi }, xTicks: ticks, yMin: 0,
      tip: function (i) {
        var s = '<b>' + dLong(r.t[i]) + (i > r.now ? ' · ' + t('forecast') : '') + '</b><br>' + qfmt(r.q[i]) + ' m³/s';
        if (i >= r.now && r.p25[i] != null) s += '<br>' + t('Likely range: {0}–{1}', qfmt(r.p25[i]), qfmt(r.p75[i]));
        return s;
      }
    });
    var rowsH = '';
    for (var i = r.t.length - 1; i >= 0; i -= 1) {
      rowsH += '<tr><td>' + dLong(r.t[i]) + '</td><td class="n">' + qfmt(r.q[i]) + '</td><td>' + (i > r.now ? t('Forecast') : t('Modelled')) + '</td></tr>';
    }
    $('river-table').innerHTML = '<div class="table-scroll"><table><thead><tr><th>' + t('Date') + '</th><th class="n">' + t('Discharge (m³/s)') + '</th><th>' + t('Type') + '</th></tr></thead><tbody>' + rowsH + '</tbody></table></div>';
  }
  function paintRiverMarkers() {
    riverMarkers.clearLayers();
    RIVERS.forEach(function (R, i) {
      var r = rivers && rivers[i];
      var m = L.circleMarker([R.lat, R.lon], { radius: i === riverIdx ? 9 : 7, weight: 2, color: '#ffffff', fillColor: '#3987e5', fillOpacity: 1 })
        .bindTooltip(t('{0} River', t(R.name)) + (r ? ': ' + qfmt(r.q[r.now]) + ' m³/s' : ''), { className: 'gd-tip', direction: 'top', offset: [0, -8] })
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
    { name: 'Tacna', region: 'Tacna', lat: -18.006, lon: -70.246 },
    // neighbouring countries also hit by El Niño
    { name: 'Guayaquil', region: 'Ecuador', lat: -2.170, lon: -79.922 },
    { name: 'Quito', region: 'Ecuador', lat: -0.180, lon: -78.468 },
    { name: 'Manta', region: 'Ecuador', lat: -0.967, lon: -80.709 },
    { name: 'Bogotá', region: 'Colombia', lat: 4.711, lon: -74.072 },
    { name: 'Medellín', region: 'Colombia', lat: 6.244, lon: -75.581 },
    { name: 'Cali', region: 'Colombia', lat: 3.452, lon: -76.532 },
    { name: 'La Paz', region: 'Bolivia', lat: -16.500, lon: -68.150 },
    { name: 'Santa Cruz', region: 'Bolivia', lat: -17.784, lon: -63.181 },
    { name: 'Arica', region: 'Chile', lat: -18.478, lon: -70.321 },
    { name: 'Antofagasta', region: 'Chile', lat: -23.650, lon: -70.400 },
    { name: 'Santiago', region: 'Chile', lat: -33.449, lon: -70.669 }
  ];
  var WHO_PM25 = 15, ECA_PM25 = 50;
  var PM_STATUS = [
    { max: WHO_PM25, key: 'good', label: 'Good', long: 'within the WHO guideline', shape: 'circle' },
    { max: ECA_PM25, key: 'warning', label: 'Moderate', long: 'above WHO guideline, below Peru\'s standard', shape: 'tri' },
    { max: Infinity, key: 'critical', label: 'Poor', long: 'above Peru\'s air quality standard', shape: 'sq' }
  ];
  var UV_STATUS = [
    { max: 2.99, key: 'good', label: 'Low' }, { max: 5.99, key: 'warning', label: 'Moderate' },
    { max: 7.99, key: 'serious', label: 'High' }, { max: 10.99, key: 'critical', label: 'Very high' }, { max: Infinity, key: 'critical', label: 'Extreme' }
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
    // 1) the copy GitHub Actions saves every 3 hours (data/air.json); 2) live Open-Meteo if that copy is old;
    // 3) the old copy if Open-Meteo is busy. Visitors rarely need to call the API themselves.
    var MAX_AGE = 4 * 3600e3;
    function live() {
      return Promise.all([fetchJSON(airUrl), fetchJSON(wxUrl)]).then(function (res) {
        return { air: Array.isArray(res[0]) ? res[0] : [res[0]], wx: Array.isArray(res[1]) ? res[1] : [res[1]], updated: new Date() };
      });
    }
    var fileP = fetchJSON('data/air.json?h=' + Math.floor(Date.now() / 3600e3)).then(function (d) {
      if (!d || !d.air || d.air.length !== CITIES.length) throw new Error('bad air.json');
      return { air: d.air, wx: d.wx, updated: new Date(d.updated) };
    });
    return fileP.then(function (f) {
      if (Date.now() - f.updated.getTime() < MAX_AGE) return f;
      return live().catch(function () { return f; });
    }, function () { return live(); }).then(function (res) {
      var now = limaHour();
      city.air = res.air.map(function (a) { return summarizeAir(a.hourly, now); });
      city.wx = res.wx.map(function (w) { return w.daily; });
      if ($('updated')) $('updated').textContent = t('Updated: {0} (Lima time)', res.updated.toLocaleString(LOC, { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
      var over = city.air.filter(function (a) { return a.pm25 != null && a.pm25 > WHO_PM25; }).length;
      var valid = city.air.filter(function (a) { return a.pm25 != null; }).length;
      $('kpi-air').innerHTML = '<div class="k">' + t('Cities above the WHO air guideline') + '</div>' +
        '<div class="v">' + over + '<small>' + t('of {0}', valid) + '</small></div><div class="s">' + t('24 h mean PM2.5 above 15 µg/m³ · CAMS') + '</div>';
      live.air = t('{0} of {1}', over, valid); updateTicker(); countKpis();
      selectCity(city.idx);
    }).catch(function (e) {
      console.error(e);
      var html = '<div class="msg">' + t('Could not load air quality and weather data.') + '<br><button type="button" class="retry">' + t('Retry') + '</button></div>';
      ['tiles', 'pm-chart', 'rain-chart'].forEach(function (id) { if ($(id)) $(id).innerHTML = html; });
      if ($('city-title')) $('city-title').textContent = t('Data unavailable');
      $('kpi-air').innerHTML = '<div class="k">' + t('Air quality') + '</div><div class="s">' + t('CAMS is unavailable.') + '</div>';
      document.querySelectorAll('.retry').forEach(function (b) { b.addEventListener('click', loadCities); });
    });
  }
  // the full air & weather view lives on the environmental data page
  function openAir(i) {
    var c = CITIES[i], u = 'environment/?lat=' + c.lat + '&lon=' + c.lon + '&name=' + encodeURIComponent(c.name) + '&sub=' + encodeURIComponent(c.region);
    if (window.GD_LANG && window.GD_LANG !== 'en') u += '&lang=' + window.GD_LANG;
    location.href = u + '#air';
  }
  function selectCity(i, scroll) {
    city.idx = i;
    if ($('city')) $('city').value = String(i);
    try { localStorage.setItem('gd-city', CITIES[i].name); } catch (e) {}
    paintCityMarkers();
    if (!$('cities')) { if (scroll) openAir(i); return; }
    if (!city.air) return;
    renderNow(); renderPM(); renderRain();
    if (scroll) $('cities').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function paintCityMarkers() {
    cityMarkers.clearLayers();
    CITIES.forEach(function (c, i) {
      var a = city.air && city.air[i], st = a && a.pm25 != null ? pmStatus(a.pm25) : null;
      var m = L.circleMarker([c.lat, c.lon], { className: "city-mk",
        radius: i === city.idx ? 8 : 6, weight: 2, color: i === city.idx ? '#ffffff' : '#0b1411',
        fillColor: st ? css('--' + st.key) : '#8a958f', fillOpacity: 1
      }).bindTooltip(c.name + (a && a.pm25 != null ? ' · PM2.5 ' + fmt(a.pm25) + ' µg/m³ (' + t(st.label).toLowerCase() + ')' : ''), { className: 'gd-tip', direction: 'top', offset: [0, -6] })
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
    $('city-sub').textContent = t('{0} region · now and today', c.region);
    var pmSt = a.pm25 != null ? pmStatus(a.pm25) : null, uv = w.uv_index_max[0], uvSt = uv != null ? uvStatus(uv) : null;
    $('tiles').innerHTML = '<div class="tiles">' +
      tile(t('PM2.5 · 24 h mean'), fmt(a.pm25), 'µg/m³',
        pmSt ? '<span class="status">' + swatch(pmSt) + t('{0} air · {1}', t(pmSt.label), t(pmSt.long)) + '</span>' : '<span class="note">' + t('Not enough data') + '</span>',
        'PM10: ' + fmt(a.pm10) + ' µg/m³') +
      tile(t('Max UV index today'), fmt(uv, 1), '', uvSt ? '<span class="status">' + swatch({ key: uvSt.key }) + t(uvSt.label) + '</span>' : '',
        uv >= 8 ? t('Avoid the sun from 10 am to 4 pm') : uv >= 3 ? t('Wear sunscreen') : t('Minimal protection needed')) +
      tile(t('Rain today'), fmt(w.precipitation_sum[0], 1), 'mm', '',
        t('Max probability: {0}% · {1}° to {2} °C', fmt(w.precipitation_probability_max[0]), fmt(w.temperature_2m_min[0]), fmt(w.temperature_2m_max[0]))) +
      '</div>';
  }
  function renderPM() {
    var a = city.air[city.idx], box = $('pm-chart');
    if (a.series.filter(function (p) { return p.v != null; }).length < 2) { box.innerHTML = '<div class="msg">' + t('No hourly PM2.5 data for this city.') + '</div>'; $('pm-table').innerHTML = ''; return; }
    var pst = a.pm25 != null ? pmStatus(a.pm25) : null;
    if (pst) explain(box, t('In {0}, the air had an average of {1} µg/m³ of fine particles over the last 24 hours ({2}). The WHO recommends staying below 15.', CITIES[city.idx].name, '<strong>' + fmt(a.pm25) + '</strong>', t(pst.long)),
      ['The line shows fine particles (PM2.5) hour by hour: the lower, the cleaner the air.',
       'The dashed lines are the WHO guideline (15) and Peru’s standard (50).',
       'After “Now”, the dotted line is the forecast for the next 24 hours.']);
    var narrow = (box.clientWidth || 600) < 420;
    var ticks = [];
    a.series.forEach(function (p, i) { if (+p.t.slice(11, 13) % (narrow ? 12 : 6) === 0) ticks.push({ i: i, label: p.t.slice(11, 16) }); });
    lineChart(box, {
      n: a.series.length, label: t('Hourly PM2.5 in {0}', CITIES[city.idx].name), now: a.nowIndex, nowLabel: t('Now'), height: 220,
      series: [{ values: a.series.map(function (p) { return p.v; }), color: 'var(--series-1)', forecastDash: true }],
      refs: [{ v: WHO_PM25, label: t('WHO 15') }, { v: ECA_PM25, label: t('Peru 50') }], xTicks: ticks, yMin: 0,
      tip: function (i) { var p = a.series[i]; return '<b>' + fmt(p.v, 1) + ' µg/m³</b><br>' + dHour(p.t) + (i > a.nowIndex ? ' · ' + t('forecast') : ''); }
    });
    $('pm-table').innerHTML = '<div class="table-scroll"><table><thead><tr><th>' + t('Time') + '</th><th class="n">PM2.5 (µg/m³)</th><th>' + t('Type') + '</th></tr></thead><tbody>' +
      a.series.map(function (p, i) { return '<tr><td>' + dHour(p.t) + '</td><td class="n">' + fmt(p.v, 1) + '</td><td>' + (i > a.nowIndex ? t('Forecast') : t('Estimated')) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }
  function renderRain() {
    var w = city.wx[city.idx];
    var labels = w.time.map(function (day, i) { if (i === 0) return t('Today'); var d = new Date(day + 'T12:00:00Z'); return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate(); });
    var tot = w.precipitation_sum.reduce(function (x, v) { return x + (v || 0); }, 0), mi = 0;
    w.precipitation_sum.forEach(function (v, i) { if ((v || 0) > (w.precipitation_sum[mi] || 0)) mi = i; });
    explain($('rain-chart'), tot < 0.1 ? t('No rain is expected in {0} over the next 7 days.', CITIES[city.idx].name)
      : t('About {1} mm of rain are expected in {0} over the next 7 days; the rainiest day would be {2}, with {3} mm.', CITIES[city.idx].name, '<strong>' + fmt(tot, 1) + '</strong>', labels[mi].toLowerCase(), fmt(w.precipitation_sum[mi], 1)),
      ['Each bar is one day; the taller the bar, the more rain.',
       '1 mm of rain means 1 litre of water on each square metre of ground.']);
    barChart($('rain-chart'), {
      values: w.precipitation_sum, labels: labels, label: t('Daily rainfall in {0}', CITIES[city.idx].name),
      tip: function (i) { return '<b>' + labels[i] + ': ' + fmt(w.precipitation_sum[i], 1) + ' mm</b><br>' + t('Max probability: {0}%', fmt(w.precipitation_probability_max[i])); }
    });
    $('rain-table').innerHTML = '<table><thead><tr><th>' + t('Day') + '</th><th class="n">' + t('Rain (mm)') + '</th><th class="n">' + t('Prob. (%)') + '</th><th class="n">' + t('Max UV') + '</th></tr></thead><tbody>' +
      labels.map(function (l, i) { return '<tr><td>' + l + '</td><td class="n">' + fmt(w.precipitation_sum[i], 1) + '</td><td class="n">' + fmt(w.precipitation_probability_max[i]) + '</td><td class="n">' + fmt(w.uv_index_max[i], 1) + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }


  // ---------------------------------------------------------------- Climate projections (CMIP6, built by GitHub Actions)
  var proj = { data: null, city: null, v: 0 };
  function projSeries(c, v) {
    var d = proj.data, years = [], mean = [], lo = [], hi = [];
    for (var y = d.first_year; y <= d.last_year; y++) {
      var vals = d.models.map(function (m) { var r = c.years[m] && c.years[m][y]; return r ? r[v] : null; });
      years.push(y);
      if (vals.some(function (x) { return x == null; })) { mean.push(null); lo.push(null); hi.push(null); continue; }
      mean.push(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
      lo.push(Math.min.apply(null, vals)); hi.push(Math.max.apply(null, vals));
    }
    return { years: years, mean: mean, lo: lo, hi: hi };
  }
  function avgYears(sr, a, b) {
    var v = sr.mean.filter(function (x, i) { return sr.years[i] >= a && sr.years[i] <= b && x != null; });
    return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null;
  }
  // Warming stripes (ColorBrewer RdBu, the palette used by the original climate stripes)
  var STRIPES = ['#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'];
  function stripeColor(a, lim) {
    var t = Math.max(-1, Math.min(1, a / lim)), i = Math.round((t + 1) / 2 * (STRIPES.length - 1));
    return STRIPES[i];
  }
  function renderStripes(T, t0, city, firstYear) {
    var box = $('stripes'), W = Math.max(300, box.clientWidth || 800), H = W < 520 ? 120 : 170, mb = 22;
    var an = T.mean.map(function (v) { return v == null ? null : v - t0; });
    var lim = Math.max.apply(null, an.filter(function (x) { return x != null; }).map(Math.abs)) || 1;
    var n = an.length, sw = W / n, nowI = new Date().getUTCFullYear() - firstYear;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + (H + mb) + '" role="img" aria-label="' + esc(t('Warming stripes for {0}, {1}–{2}', city, T.years[0], T.years[n - 1])) + '">';
    an.forEach(function (a, i) {
      if (a == null) return;
      svg += '<rect data-i="' + i + '" x="' + (i * sw).toFixed(2) + '" y="0" width="' + (sw + 0.6).toFixed(2) + '" height="' + H + '" fill="' + stripeColor(a, lim) + '"/>';
    });
    if (nowI > 0 && nowI < n) {
      var nx = (nowI * sw).toFixed(1);
      svg += '<line x1="' + nx + '" x2="' + nx + '" y1="0" y2="' + H + '" stroke="#fff" stroke-width="2"/>' +
        '<text x="' + (+nx + 6) + '" y="16" class="stripe-lbl">' + t('Today · projections →') + '</text>';
    }
    T.years.forEach(function (y, i) { if (y % 10 === 0) svg += '<text x="' + (i === 0 ? 0 : i * sw + sw / 2) + '" y="' + (H + 16) + '" text-anchor="' + (i === 0 ? 'start' : 'middle') + '">' + y + '</text>'; });
    svg += '</svg>';
    box.innerHTML = svg;
    $('stripes-title').textContent = t('Warming stripes · {0}', city);
    $('stripes-legend').innerHTML = '<span>' + t('Cooler') + ' ' + signed(-lim, 1) + ' °C</span><i style="background:linear-gradient(90deg,' + STRIPES.join(',') + ')"></i><span>' + signed(lim, 1) + ' °C ' + t('Warmer') + '</span>';
    var svgEl = box.querySelector('svg'), tip = tipFor(box);
    svgEl.addEventListener('pointermove', function (e) {
      var r = svgEl.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n)));
      if (an[i] == null) return;
      tip.innerHTML = '<b>' + T.years[i] + (i > nowI ? ' · ' + t('projection') : '') + '</b><br>' + t('{0} °C vs 1981–2010', signed(an[i], 2));
      tip.style.left = Math.max(70, Math.min(r.width - 70, (i + 0.5) / n * r.width)) + 'px';
      tip.style.top = '8px'; tip.style.opacity = 1;
    });
    svgEl.addEventListener('pointerleave', function () { tip.style.opacity = 0; });
  }

  function renderProj() {
    var d = proj.data, c = d.cities[proj.city], v = proj.v;
    var unit = v === 0 ? '°C' : '%';
    var T = projSeries(c, 0), P = projSeries(c, 1), B = d.baseline;
    var t0 = avgYears(T, B[0], B[1]), t1 = avgYears(T, 2040, 2049), p0 = avgYears(P, B[0], B[1]), p1 = avgYears(P, 2040, 2049);
    var dp = p0 ? (p1 - p0) / p0 * 100 : null;
    var nowY = new Date().getUTCFullYear(), warmK = 0;
    T.years.forEach(function (y, i) { if (y >= nowY - 10 && y < nowY && T.mean[i] != null && T.mean[i] > t0) warmK++; });
    explain($('stripes'), t('Each bar is one year: blue was cooler than the 1981–2010 average and red was warmer. In the models, {1} of the last 10 years in {0} were warmer than average, and by the 2040s they project about {2} °C more.', proj.city, '<strong>' + warmK + '</strong>', '<strong>' + signed(t1 - t0, 1) + '</strong>'),
      ['Read it from left to right, like a timeline from 1960 to 2049.',
       'Blue means cooler than the 1981–2010 average and red means warmer; the darker the colour, the bigger the difference.',
       'The white line marks today: everything to its right is a projection, not a measurement.'],
      'CMIP6 HighResMIP (EC-Earth3P-HR, MRI-AGCM3-2-S) ' + esc(t('via')) + ' ' + srcLink('https://open-meteo.com/en/docs/climate-api', 'Open-Meteo Climate API'));
    explain($('proj-chart'), v === 0 ? t('In {0} the average temperature would rise from {1} °C (1981–2010) to {2} °C in the 2040s.', proj.city, fmt(t0, 1), '<strong>' + fmt(t1, 1) + '</strong>')
      : t('In {0} the models project a rainfall change of {1}% by the 2040s, but they often disagree, so take it with caution.', proj.city, '<strong>' + signed(dp, 0) + '</strong>'),
      ['The line is the average of two climate models; the shaded area shows how much they differ.',
       'The dashed horizontal line is the 1981–2010 average, used as the reference.',
       'To the right of “Today” the values are projections under a high-emissions scenario.'],
      'CMIP6 HighResMIP (EC-Earth3P-HR, MRI-AGCM3-2-S) ' + esc(t('via')) + ' ' + srcLink('https://open-meteo.com/en/docs/climate-api', 'Open-Meteo Climate API'));
    $('proj-kpis').innerHTML =
      '<div class="proj-kpi"><div class="k">' + esc(t('{0} · warming by the 2040s', proj.city)) + '</div><div class="v">' + signed(t1 - t0, 1) + '<small>°C</small></div>' +
      '<div class="s">' + t('2040–2049 vs {0}–{1} ({2} → {3} °C)', B[0], B[1], fmt(t0, 1), fmt(t1, 1)) + '</div></div>' +
      '<div class="proj-kpi"><div class="k">' + t('Rainfall change by the 2040s') + '</div><div class="v">' + signed(dp, 0) + '<small>%</small></div>' +
      '<div class="s">' + t('2040–2049 vs {0}–{1} · relative change; models often disagree on rainfall', B[0], B[1]) + '</div></div>';
    var pct = function (x) { return x == null || !p0 ? null : (x - p0) / p0 * 100; };
    var S = v === 0 ? T : { years: P.years, mean: P.mean.map(pct), lo: P.lo.map(pct), hi: P.hi.map(pct) };
    renderStripes(T, t0, proj.city, d.first_year);
    var base = v === 0 ? t0 : 0;
    var nowI = new Date().getUTCFullYear() - d.first_year;
    var ticks = S.years.map(function (y, i) { return y % 10 === 0 ? { i: i, label: String(y) } : null; }).filter(Boolean);
    lineChart($('proj-chart'), {
      n: S.years.length, label: t('{0} in {1}, 1960–2049', v === 0 ? t('Annual mean temperature') : t('Annual rainfall change vs 1981–2010'), proj.city),
      series: [{ values: S.mean, color: 'var(--series-1)', width: 2.2 }],
      band: { lo: S.lo, hi: S.hi }, refs: [{ v: base, label: v === 0 ? t('{0}–{1} avg', B[0], B[1]) : t('{0}–{1} baseline', B[0], B[1]) }],
      now: nowI >= 0 && nowI < S.years.length ? nowI : null, nowLabel: t('Today'), xTicks: ticks, yMin: v === 0 ? Math.floor(Math.min.apply(null, S.lo.filter(function (x) { return x != null; })) - 1) : null,
      tip: function (i) {
        var f = v === 0 ? function (x) { return fmt(x, 1); } : function (x) { return signed(x, 0); };
        return '<b>' + S.years[i] + '</b><br>' + t('Models average: {0} {1}', f(S.mean[i]), unit) +
          (S.lo[i] != null ? '<br>' + t('Range: {0} to {1} {2}', f(S.lo[i]), f(S.hi[i]), unit) : '');
      }
    });
    var rows = '';
    for (var y0 = d.first_year; y0 <= d.last_year; y0 += 10) {
      var pd = avgYears(P, y0, y0 + 9);
      rows += '<tr><td>' + t('{0}s', y0) + '</td><td class="n">' + fmt(avgYears(T, y0, y0 + 9), 1) + '</td><td class="n">' + signed(p0 ? (pd - p0) / p0 * 100 : null, 0) + '</td></tr>';
    }
    $('proj-table').innerHTML = '<table><thead><tr><th>' + t('Decade') + '</th><th class="n">' + t('Mean temperature (°C)') + '</th><th class="n">' + t('Rainfall vs 1981–2010 (%)') + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function loadProj() {
    return fetchJSON('data/climate.json').then(function (d) {
      proj.data = d;
      var ready = d.complete_cities || [];
      if (!ready.length) throw new Error('no complete city yet');
      proj.city = ready[0];
      $('projections').hidden = false;
      $('proj-city').innerHTML = ready.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
      $('proj-city').addEventListener('change', function (e) { proj.city = e.target.value; renderProj(); });
      document.querySelectorAll('#projections .seg button').forEach(function (b) {
        b.addEventListener('click', function () {
          proj.v = +b.getAttribute('data-var');
          document.querySelectorAll('#projections .seg button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
          renderProj();
        });
      });
      renderProj();
      var pc = d.cities[proj.city], pt = projSeries(pc, 0);
      var dT = avgYears(pt, 2040, 2049) - avgYears(pt, d.baseline[0], d.baseline[1]);
      if (isFinite(dT)) { live.proj = [proj.city, dT]; updateTicker(); }
    }).catch(function () {
      $('projections').hidden = true;
    });
  }



  // ---------------------------------------------------------------- live ticker + count-up (only real, loaded values)
  var live = {};
  function countKpis() {
    if (!window.gdCount) return;
    document.querySelectorAll('.kpi .v').forEach(function (el) { window.gdCount(el); });
  }
  function updateTicker() {
    var items = [];
    if (live.n12) items.push(['Niño 1+2', t('{0} °C above normal', signed(live.n12, 1))]);
    if (live.oni) items.push([t('El Niño index (ONI)'), signed(live.oni[0], 2) + ' °C · ' + live.oni[1]]);
    if (live.river) items.push([t('{0} River', t(live.river[0])), t('{0} m³/s today', live.river[1])]);
    if (live.air) items.push([t('Air quality'), t('{0} cities above the WHO PM2.5 guideline', live.air)]);
    if (live.proj) items.push([t('{0} by the 2040s', live.proj[0]), t('{0} °C warmer (CMIP6)', signed(live.proj[1], 1))]);
    if (!items.length) return;
    var one = items.map(function (it) { return '<span class="tk-item"><b>' + esc(it[0]) + '</b> ' + esc(it[1]) + '</span>'; }).join('<span class="tk-dot" aria-hidden="true">●</span>');
    $('ticker-track').innerHTML = '<span class="tk-live"><i aria-hidden="true"></i>' + t('LIVE') + '</span>' + one +
      '<span class="tk-copy" aria-hidden="true"><span class="tk-dot">●</span><span class="tk-live"><i></i>' + t('LIVE') + '</span>' + one + '</span>';
    $('ticker').hidden = false;
  }

  // ---------------------------------------------------------------- proof strip
  function renderProof() {
    var sats = 'GHRSST · GPM · MODIS · VIIRS · SMAP';
    $('proof').innerHTML =
      '<div><b>' + Object.keys(LAYERS).length + '</b><span>' + t('daily satellite layers') + '</span></div>' +
      '<div><b>' + (CITIES.length + RIVERS.length) + '</b><span>' + t('cities and rivers monitored') + '</span></div>' +
      '<div><b>' + (new Date().getUTCFullYear() - 1981) + '</b><span>' + t('years of El Niño data') + '</span></div>' +
      '<div><b>0</b><span>' + t('backend servers: static site on open data') + '</span></div>' +
      '<div style="flex-basis:100%"><span>' + t('Satellites and models: {0} · Copernicus CAMS and GloFAS · NOAA CPC', sats) + '</span></div>';
  }

  // ---------------------------------------------------------------- init
  var sel = $('city') || document.createElement('select');
  sel.innerHTML = CITIES.map(function (c, i) { return { c: c, i: i }; })
    .sort(function (a, b) { return a.c.name.localeCompare(b.c.name, 'es'); })
    .map(function (o) { return '<option value="' + o.i + '">' + esc(o.c.name) + ' (' + esc(o.c.region) + ')</option>'; }).join('');
  try {
    var savedCity = localStorage.getItem('gd-city'), si = CITIES.findIndex(function (c) { return c.name === savedCity; });
    if (si >= 0) city.idx = si;
    var savedLayer = localStorage.getItem('gd-layer'); if (savedLayer && LAYERS[savedLayer]) sat.key = savedLayer;
  } catch (e) {}
  sel.addEventListener('change', function () { selectCity(+sel.value); });

  // A shared link can open a precise view: ?layer=fire&days=3&city=Lima&river=Rímac
  var Q = new URLSearchParams(location.search);
  if (Q.get('layer') && LAYERS[Q.get('layer')]) sat.key = Q.get('layer');
  if (/^\d+$/.test(Q.get('days') || '')) sat.back = Math.min(MAX_BACK, +Q.get('days'));
  if (Q.get('compare') === '0') { sat.compare = false; $('compare').checked = false; }
  var qc = CITIES.findIndex(function (c) { return c.name === Q.get('city'); }); if (qc >= 0) city.idx = qc;
  var qr = RIVERS.findIndex(function (r) { return r.name === Q.get('river'); }); if (qr >= 0) riverIdx = qr;

  initMap();
  document.querySelectorAll('a[data-layer]').forEach(function (el) {
    el.addEventListener('click', function () { setLayer(el.getAttribute('data-layer')); });
  });
  cityMarkers.addTo(map); riverMarkers.addTo(map);
  paintCityMarkers(); paintRiverMarkers();
  $('ov-cities').addEventListener('change', function (e) { e.target.checked ? cityMarkers.addTo(map) : map.removeLayer(cityMarkers); });
  $('ov-rivers').addEventListener('change', function (e) { e.target.checked ? riverMarkers.addTo(map) : map.removeLayer(riverMarkers); });
  renderProof();

  // Hooks for the search palette, the share button and the welcome tour (ux.js)
  window.gdApp = {
    layers: Object.keys(LAYERS).map(function (k) { return { key: k, label: t(LAYERS[k].label) }; }),
    cities: CITIES.map(function (c) { return { name: c.name, region: c.region }; }),
    rivers: RIVERS.map(function (r) { return { name: r.name, place: r.place }; }),
    showLayer: function (k) { setLayer(k); $('satellite').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); },
    showCity: function (i) { selectCity(i, true); },
    showRiver: function (i) { if (rivers) selectRiver(i, true); else { riverIdx = i; $('rivers').scrollIntoView(); } },
    state: function () { return { layer: sat.key, days: sat.back, compare: sat.compare, city: CITIES[city.idx].name, river: RIVERS[riverIdx].name }; }
  };
  loadEnso();
  loadRivers();
  loadCities();
  loadProj();

  var lastW = window.innerWidth, rt;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rt);
    rt = setTimeout(function () {
      renderEnso(); renderRiver(); if (proj.data && proj.city) renderProj();
      if (city.air && $('cities')) { renderPM(); renderRain(); }
    }, 150);
  });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    paintCityMarkers(); if (rivers) renderRiverCards();
  });
})();
