/* Hendy in Green Data · Quiulacocha thesis app
 * Every number comes from data/thesis_results.json (or data/thesis_demo.json with ?demo=1).
 */
(function () {
  'use strict';
  var BASE = document.body.getAttribute('data-base') || '';
  var LOC = window.GD_LOCALE || 'en-US';
  var tr = window.t || function (x) { var a = arguments; return String(x).replace(/\{(\d)\}/g, function (_, i) { return a[+i + 1]; }); };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(v, d) { return v == null || isNaN(v) ? '–' : v.toLocaleString(LOC, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function dLong(s) { return new Intl.DateTimeFormat(LOC, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T12:00:00Z')); }
  function fetchJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return r.json(); }); }
  function tipFor(box) {
    var t = box.querySelector('.tip');
    if (!t) { t = document.createElement('div'); t.className = 'tip'; t.setAttribute('role', 'status'); box.appendChild(t); }
    return t;
  }
  function tile(k, v, unit, status, note) {
    return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v + (unit ? '<small>' + unit + '</small>' : '') + '</div>' + status + (note ? '<div class="note">' + note + '</div>' : '') + '</div>';
  }
  // ---------------------------------------------------------------- Thesis: Quiulacocha (all numbers come from data/thesis_results.json)
  var thesis = null, thesisMap = null;
  function num(v) { return typeof v === 'number' && isFinite(v); }
  // show numbers exactly as entered in the data file (no added or dropped decimals beyond 6)
  function tfmt(v) { return num(v) ? v.toLocaleString(LOC, { maximumFractionDigits: 6 }) : '–'; }
  var BIO = [{ key: 'pitahaya', label: 'Pitahaya', color: 'var(--pitahaya)' }, { key: 'zapallo', label: 'Zapallo macre', color: 'var(--zapallo)' }];
  function removalOf(m, b) {
    var r = m['removal_' + b + '_pct'];
    if (num(r)) return r;
    var f = m['final_' + b + '_mg_L'];
    return num(m.initial_mg_L) && m.initial_mg_L > 0 && num(f) ? (m.initial_mg_L - f) / m.initial_mg_L * 100 : null;
  }
  function roundedBar(x, y, w, h, fill, r) {
    if (h < 0.5) return '';
    r = Math.min(r || 4, h, w / 2);
    return '<path d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z" fill="' + fill + '"/>';
  }
  function hbar(x, y, w, h, fill, r) {
    if (w < 0.5) return '';
    r = Math.min(r || 4, w, h / 2);
    return '<path d="M' + x + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + x + 'Z" fill="' + fill + '"/>';
  }
  function bindBarTips(box, svg, W, H, tips) {
    var tip = tipFor(box);
    svg.querySelectorAll('[data-tip]').forEach(function (el) {
      function show() {
        var t = tips[+el.getAttribute('data-tip')], r = svg.getBoundingClientRect();
        tip.innerHTML = t.html;
        tip.style.left = Math.max(70, Math.min(r.width - 70, t.x / W * r.width)) + 'px';
        tip.style.top = (t.y / H * r.height) + 'px';
        tip.style.opacity = 1;
      }
      el.addEventListener('pointerenter', show); el.addEventListener('pointerdown', show);
      el.addEventListener('pointerleave', function () { tip.style.opacity = 0; });
    });
  }

  function renderThesisMap(d) {
    var pts = (d.sampling && d.sampling.points || []).filter(function (p) { return num(p.lat) && num(p.lon); });
    if (d.sampling && d.sampling.date) $('thesis-site').textContent = tr('{0} · sampled {1}', tr(d.sampling.site || 'Quiulacocha, Pasco, Peru'), dLong(d.sampling.date));
    if (!pts.length) return;
    $('thesis-map').hidden = false; $('thesis-map-empty').hidden = true;
    if (thesisMap) { thesisMap.remove(); }
    thesisMap = L.map('thesis-map', { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: 'Imagery: Esri, Maxar, Earthstar Geographics'
    }).addTo(thesisMap);
    var group = L.featureGroup(pts.map(function (p) {
      return L.circleMarker([p.lat, p.lon], { radius: 8, weight: 3, color: '#ffffff', fillColor: '#b6e34f', fillOpacity: 1 })
        .bindTooltip(esc(p.id), { permanent: true, direction: 'right', offset: [8, 0], className: 'gd-tip' })
        .bindPopup('<b>' + esc(p.id) + '</b>' + (p.description ? '<br>' + esc(p.description) : '') + '<br>' + fmt(p.lat, 5) + ', ' + fmt(p.lon, 5));
    })).addTo(thesisMap);
    if (pts.length === 1) thesisMap.setView([pts[0].lat, pts[0].lon], 15);
    else thesisMap.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 16 });
  }

  function renderThesisConc(d) {
    var std = d.standard || {}, rows = (d.metals || []).filter(function (m) {
      return num(m.initial_mg_L) && (num(m.final_pitahaya_mg_L) || num(m.final_zapallo_mg_L));
    });
    $('thesis-conc').hidden = !rows.length;
    if (!rows.length) return false;
    $('thesis-std').innerHTML = std.short_name
      ? tr('In mg/L, compared with {0}', (std.url ? '<a href="' + esc(std.url) + '">' + esc(std.short_name) + '</a>' : esc(std.short_name)) + (std.note ? ' · ' + esc(std.note) : '')) + '.'
      : tr('In mg/L.');
    var grid = $('thesis-conc-grid'); grid.innerHTML = '';
    rows.forEach(function (m) {
      var bars = [{ label: 'Raw', v: m.initial_mg_L, color: 'var(--initial)' }]
        .concat(BIO.map(function (b) { return { label: b.label, v: m['final_' + b.key + '_mg_L'], color: b.color }; }))
        .filter(function (b) { return num(b.v); });
      var lim = num(m.limit_mg_L) ? m.limit_mg_L : null;
      var status = [];
      if (lim != null) BIO.forEach(function (b) {
        var f = m['final_' + b.key + '_mg_L'];
        if (num(f)) status.push(tr(b.label) + (f <= lim ? ' ✓ ' + tr('meets limit') : ' ✗ ' + tr('above limit')));
      });
      var card = document.createElement('div'); card.className = 'metal';
      card.innerHTML = '<h4>' + esc(m.metal) + '</h4><p class="ms">' + (lim != null ? tr('Limit: {0} mg/L', tfmt(lim)) + (m.limit_note ? ' (' + esc(m.limit_note) + ')' : '') : tr('No limit in the chosen standard')) + '</p><div class="chart"></div>' +
        (status.length ? '<p class="ms">' + status.map(esc).join(' · ') + '</p>' : '');
      grid.appendChild(card);
      var box = card.querySelector('.chart');
      var W = 220, H = 170, mg = { t: 18, r: 6, b: 22, l: 6 }, iw = W - mg.l - mg.r, ih = H - mg.t - mg.b;
      var maxV = Math.max.apply(null, bars.map(function (b) { return b.v; }).concat(lim != null ? [lim] : [])) * 1.12 || 1;
      var bw = iw / bars.length, w = Math.min(44, bw - 8);
      function y(v) { return mg.t + ih - Math.max(0, v) / maxV * ih; }
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(tr('{0} concentration before and after treatment, mg/L', m.metal)) + '">', tips = [];
      bars.forEach(function (b, i) {
        var cx = mg.l + bw * i + bw / 2, top = y(b.v);
        svg += roundedBar(cx - w / 2, top, w, mg.t + ih - top, b.color) +
          '<text x="' + cx + '" y="' + (top - 5) + '" text-anchor="middle" class="lbl">' + tfmt(b.v) + '</text>' +
          '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(tr(b.label === 'Zapallo macre' ? 'Zapallo' : b.label)) + '</text>' +
          '<rect data-tip="' + i + '" x="' + (mg.l + bw * i) + '" y="' + mg.t + '" width="' + bw + '" height="' + ih + '" fill="transparent"/>';
        tips.push({ x: cx, y: top, html: '<b>' + esc(m.metal) + ' · ' + esc(tr(b.label)) + '</b><br>' + tfmt(b.v) + ' mg/L' + (lim != null ? '<br>' + (b.v <= lim ? tr('Within the limit') : tr('Above the limit')) : '') });
      });
      if (lim != null) svg += '<line x1="' + mg.l + '" x2="' + (W - mg.r) + '" y1="' + y(lim) + '" y2="' + y(lim) + '" stroke="var(--ref)" stroke-width="1.5" stroke-dasharray="4 4"/>';
      svg += '<line x1="' + mg.l + '" x2="' + (W - mg.r) + '" y1="' + (mg.t + ih) + '" y2="' + (mg.t + ih) + '" stroke="var(--line)"/></svg>';
      box.innerHTML = svg;
      bindBarTips(box, box.querySelector('svg'), W, H, tips);
    });
    $('thesis-conc-table').innerHTML = '<div class="table-scroll"><table><thead><tr><th>' + tr('Metal') + '</th><th class="n">' + tr('Raw (mg/L)') + '</th><th class="n">Pitahaya (mg/L)</th><th class="n">Zapallo (mg/L)</th><th class="n">' + tr('Limit (mg/L)') + '</th></tr></thead><tbody>' +
      rows.map(function (m) { return '<tr><td>' + esc(m.metal) + '</td><td class="n">' + tfmt(m.initial_mg_L) + '</td><td class="n">' + tfmt(m.final_pitahaya_mg_L) + '</td><td class="n">' + tfmt(m.final_zapallo_mg_L) + '</td><td class="n">' + tfmt(m.limit_mg_L) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    return true;
  }

  function renderThesisRemoval(d) {
    var rows = (d.metals || []).map(function (m) { return { metal: m.metal, v: BIO.map(function (b) { return removalOf(m, b.key); }) }; })
      .filter(function (r) { return r.v.some(num); });
    $('thesis-removal').hidden = !rows.length;
    if (!rows.length) return false;
    var box = $('thesis-removal-chart');
    var W = Math.max(300, box.clientWidth || 600), rowH = 46, m = { t: 10, r: 46, b: 26, l: 34 };
    var H = m.t + rows.length * rowH + m.b, iw = W - m.l - m.r;
    var all = []; rows.forEach(function (r) { r.v.forEach(function (x) { if (num(x)) all.push(x); }); });
    var lo = Math.min(0, Math.min.apply(null, all)), hi = 100;
    function x(v) { return m.l + (v - lo) / (hi - lo) * iw; }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(tr('Heavy metal removal by bioflocculant, percent')) + '">', tips = [], k = 0;
    for (var g = Math.ceil(lo / 25) * 25; g <= 100; g += 25) {
      svg += '<line x1="' + x(g) + '" x2="' + x(g) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="var(--grid)"/>' +
        '<text x="' + x(g) + '" y="' + (H - 8) + '" text-anchor="middle">' + g + '%</text>';
    }
    rows.forEach(function (r, i) {
      var y0 = m.t + i * rowH + 6, bh = 15;
      svg += '<text x="' + (m.l - 8) + '" y="' + (y0 + bh + 4) + '" text-anchor="end" class="lbl">' + esc(r.metal) + '</text>';
      BIO.forEach(function (b, j) {
        var v = r.v[j], yy = y0 + j * (bh + 2);
        if (!num(v)) return;
        var x0 = x(Math.min(0, v)), x1 = x(Math.max(0, v));
        svg += hbar(x0, yy, x1 - x0, bh, b.color, 4) +
          '<text x="' + (x1 + 5) + '" y="' + (yy + bh - 3) + '" class="lbl">' + fmt(v, v >= 10 ? 0 : 1) + '%</text>' +
          '<rect data-tip="' + k + '" x="' + m.l + '" y="' + yy + '" width="' + iw + '" height="' + bh + '" fill="transparent"/>';
        tips.push({ x: x1, y: yy, html: '<b>' + esc(r.metal) + ' · ' + tr(b.label) + '</b><br>' + tr('{0}% removed', fmt(v, 1)) });
        k++;
      });
    });
    if (lo < 0) svg += '<line x1="' + x(0) + '" x2="' + x(0) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="var(--ink-2)"/>';
    svg += '</svg>';
    box.innerHTML = svg;
    bindBarTips(box, box.querySelector('svg'), W, H, tips);
    $('thesis-removal-table').innerHTML = '<table><thead><tr><th>' + tr('Metal') + '</th><th class="n">Pitahaya (%)</th><th class="n">Zapallo macre (%)</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + esc(r.metal) + '</td><td class="n">' + fmt(r.v[0], 1) + '</td><td class="n">' + fmt(r.v[1], 1) + '</td></tr>'; }).join('') + '</tbody></table>';
    return true;
  }

  function renderThesisOptimal(d) {
    var FIELDS = [['dose_mg_L', 'Dose', 'mg/L'], ['pH', 'pH', ''], ['rapid_mix_rpm', 'Rapid mix', 'rpm'], ['rapid_mix_min', 'Rapid mix time', 'min'],
      ['slow_mix_rpm', 'Slow mix', 'rpm'], ['slow_mix_min', 'Slow mix time', 'min'], ['settling_min', 'Settling', 'min']];
    var cards = (d.optimal_conditions || []).map(function (o) {
      var items = FIELDS.filter(function (f) { return num(o[f[0]]); });
      if (!items.length) return '';
      var b = BIO.filter(function (x) { return x.key === o.bioflocculant; })[0] || { label: o.bioflocculant, color: 'var(--initial)' };
      return '<div class="opt"><h4><i class="sq-key" style="background:' + b.color + '"></i>' + esc(tr(b.label)) + '</h4><dl>' +
        items.map(function (f) { return '<dt>' + tr(f[1]) + '</dt><dd>' + tfmt(o[f[0]]) + (f[2] ? ' ' + f[2] : '') + '</dd>'; }).join('') + '</dl></div>';
    }).join('');
    $('thesis-optimal').hidden = !cards;
    $('thesis-optimal-grid').innerHTML = cards;
    return !!cards;
  }

  function renderThesisRF(d) {
    var rf = d.random_forest || {}, has = num(rf.r2_test) || num(rf.rmse_test);
    $('thesis-rf').hidden = !has;
    if (!has) return false;
    $('thesis-rf-sub').textContent = (rf.target ? tr('Predicts {0}.', rf.target) + ' ' : '') + (rf.validation ? tr('Validation: {0}.', rf.validation) : '');
    var t = [];
    if (num(rf.r2_test)) t.push(tile('R² (test)', fmt(rf.r2_test, 2), '', '', ''));
    if (num(rf.rmse_test)) t.push(tile('RMSE (test)', tfmt(rf.rmse_test), esc(rf.rmse_unit || ''), '', ''));
    if (num(rf.n_train) || num(rf.n_test)) t.push(tile(tr('Samples'), fmt(rf.n_train) + ' / ' + fmt(rf.n_test), '', '', tr('train / test')));
    $('thesis-rf-metrics').innerHTML = t.join('');
    var imp = (rf.feature_importance || []).filter(function (f) { return f.feature && num(f.importance); })
      .sort(function (a, b) { return b.importance - a.importance; });
    $('thesis-rf-imp-wrap').hidden = !imp.length;
    if (imp.length) {
      var box = $('thesis-rf-imp'), W = Math.max(280, box.clientWidth || 400), rowH = 26, m = { t: 4, r: 44, b: 4, l: 110 };
      var H = m.t + imp.length * rowH + m.b, iw = W - m.l - m.r, mx = Math.max.apply(null, imp.map(function (f) { return f.importance; })) || 1;
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(tr('Random Forest variable importance')) + '">', tips = [];
      imp.forEach(function (f, i) {
        var yy = m.t + i * rowH + 4, w = f.importance / mx * iw;
        svg += '<text x="' + (m.l - 8) + '" y="' + (yy + 13) + '" text-anchor="end">' + esc(f.feature) + '</text>' + hbar(m.l, yy, w, 16, 'var(--series-1)', 4) +
          '<text x="' + (m.l + w + 5) + '" y="' + (yy + 13) + '" class="lbl">' + fmt(f.importance, 2) + '</text>' +
          '<rect data-tip="' + i + '" x="' + m.l + '" y="' + yy + '" width="' + iw + '" height="16" fill="transparent"/>';
        tips.push({ x: m.l + w, y: yy, html: '<b>' + esc(f.feature) + '</b><br>' + tr('Importance: {0}', fmt(f.importance, 3)) });
      });
      svg += '</svg>';
      box.innerHTML = svg;
      bindBarTips(box, box.querySelector('svg'), W, H, tips);
    }
    return true;
  }

  function renderThesis() {
    var d = thesis; if (!d) return;
    renderThesisMap(d);
    if (num(d.design && d.design.jar_test_runs)) $('thesis-runs').textContent = ' (' + tr('{0} runs', fmt(d.design.jar_test_runs)) + ')';
    var any = [renderThesisConc(d), renderThesisRemoval(d), renderThesisOptimal(d), renderThesisRF(d)].some(Boolean);
    var img = d.idw_map_image;
    if (img && /^img\/[\w.\-\/]+\.(png|jpe?g|webp)$/i.test(img)) { $('thesis-idw-img').src = BASE + img; $('thesis-idw').hidden = false; any = true; }
    $('thesis-soon').hidden = any;
    $('thesis-badge').textContent = tr(d.status === 'final' ? 'Research results' : any ? 'Preliminary results · research in progress' : 'Research in progress');
    var lim = (d.limitations || []).filter(function (x) { return typeof x === 'string' && x.trim(); });
    if (lim.length) $('thesis-limits').innerHTML = lim.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
  }
  function loadThesis() {
    var demo = /[?&]demo=1\b/.test(location.search);
    if (demo) {
      var ban = document.createElement('div');
      ban.className = 'demo-banner'; ban.setAttribute('role', 'alert');
      ban.textContent = tr('DEMO DATA — NOT REAL RESULTS');
      $('thesis').prepend(ban);
    }
    return fetchJSON(BASE + (demo ? 'data/thesis_demo.json' : 'data/thesis_results.json')).then(function (d) { thesis = d; renderThesis(); })
      .catch(function (e) { console.error(e); });
  }


  loadThesis();
  var lastW = window.innerWidth, rt;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW || !thesis) return;
    lastW = window.innerWidth; clearTimeout(rt);
    rt = setTimeout(function () { renderThesisRemoval(thesis); renderThesisRF(thesis); }, 150);
  });
})();
