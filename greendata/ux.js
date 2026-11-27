/* Hendy in Green Data · interaction layer shared by every page
 * - Search palette (Ctrl/⌘ K or "/"): sections, satellite layers, cities, rivers, research, data, languages
 * - Toast messages and "Share this view" (a link that reopens the same layer, date, city and river)
 * - Scroll spy: the top menu marks the section you are reading
 * - "What brings you here?" paths for recruiters, researchers and curious visitors
 * - A 3-step welcome tour, shown once
 * Everything works with the keyboard and respects prefers-reduced-motion.
 */
(function () {
  'use strict';
  var t = window.t || function (s) { var a = arguments; return String(s).replace(/\{(\d)\}/g, function (_, i) { return a[+i + 1]; }); };
  var me = document.currentScript, BASE = me ? me.src.replace(/ux\.js(\?.*)?$/, '') : './';
  var LANG = window.GD_LANG || 'en';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isHome = !!document.getElementById('satellite');
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fold(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function withLang(url) {
    if (LANG === 'en') return url;
    var h = url.split('#'), q = h[0].indexOf('?') > -1 ? '&' : '?';
    return h[0] + q + 'lang=' + LANG + (h[1] != null ? '#' + h[1] : '');
  }
  function scrollToId(id) {
    var e = $(id); if (!e) return false;
    e.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
    return true;
  }
  function go(href) {
    var m = href.match(/^#(.+)$/);
    if (m && scrollToId(m[1])) return;
    location.href = href;
  }
  var ICON = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    // one small icon per result group
    section: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    layer: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    city: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    river: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8c3-2 6 2 9 0s6-2 9 0M3 13c3-2 6 2 9 0s6-2 9 0M3 18c3-2 6 2 9 0s6-2 9 0"/></svg>',
    research: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/></svg>',
    data: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    lang: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>'
  };

  // ------------------------------------------------------------------ toast
  var toastBox;
  window.gdToast = function (msg, ok) {
    if (!toastBox) { toastBox = el('div', 'gd-toast'); toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
    toastBox.innerHTML = (ok === false ? '' : ICON.check) + '<span></span>';
    toastBox.lastChild.textContent = msg;
    toastBox.classList.remove('show'); void toastBox.offsetWidth; toastBox.classList.add('show');
    clearTimeout(toastBox._t); toastBox._t = setTimeout(function () { toastBox.classList.remove('show'); }, 2600);
  };

  // ------------------------------------------------------------------ share this view
  function viewUrl() {
    var u = new URL(BASE + 'index.html', location.href), s = window.gdApp && window.gdApp.state();
    if (LANG !== 'en') u.searchParams.set('lang', LANG);
    if (s) {
      u.searchParams.set('layer', s.layer);
      if (s.days) u.searchParams.set('days', s.days);
      if (!s.compare) u.searchParams.set('compare', '0');
      u.searchParams.set('city', s.city);
      u.searchParams.set('river', s.river);
    }
    u.hash = 'satellite';
    return u.toString();
  }
  function share() {
    var url = viewUrl(), title = document.title;
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    var done = function () { window.gdToast(t('Link copied: it opens this same view')); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
    function fallback() {
      var ta = el('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      if (ok) done(); else window.prompt(t('Copy this link'), url);
    }
  }
  if (isHome) {
    var row = document.querySelector('#panel-body');
    if (row) {
      var sb = el('button', 'share-btn', ICON.share + '<span>' + esc(t('Share this view')) + '</span>');
      sb.type = 'button'; sb.addEventListener('click', share);
      row.appendChild(sb);
    }
  }

  // ------------------------------------------------------------------ search palette
  function items() {
    var out = [], home = isHome ? '' : BASE + 'index.html';
    function add(group, icon, title, sub, action, extra) { out.push({ g: group, icon: icon, title: title, sub: sub || '', act: action, key: fold(title + ' ' + (sub || '') + ' ' + (extra || '')) }); }
    function link(h) { return function () { go(h.charAt(0) === '#' && !isHome ? withLang(home + h) : (h.charAt(0) === '#' ? h : withLang(h))); }; }
    var S = t('Sections');
    [['#satellite', 'Satellite map', 'map space nasa'], ['#expertise', 'Expertise', 'skills areas'], ['#nino', 'Ocean & climate', 'el nino enso sea'],
     ['#rivers', 'Rivers', 'water discharge flood'], ['#projections', 'Climate projections', 'cmip6 2050 warming stripes'],
     ['#cities', 'Air & weather', 'pm2.5 uv rain air quality'], ['#about', 'About', 'cv profile'], ['#experience', 'Experience', 'jobs oefa work'],
     ['#skills', 'Skills & tools', 'python arcgis gee'], ['#contact', 'Contact', 'email linkedin hire']].forEach(function (s) {
      add(S, 'section', t(s[1]), '', link(s[0]), s[1] + ' ' + s[2]);
    });
    [['xp-climate', 'Climate Risk'], ['xp-geo', 'Geospatial Analysis'], ['xp-rs', 'Remote Sensing'], ['xp-ews', 'Early Warning'], ['xp-air', 'Air Quality'], ['xp-fire', 'Wildfire']].forEach(function (s) {
      add(t('Expertise'), 'section', t(s[1]), t('Areas of expertise'), link('#' + s[0]), s[1]);
    });
    var R = t('Research');
    add(R, 'research', t('Scientific research'), '', function () { location.href = withLang(BASE + 'research/'); }, 'Research');
    add(R, 'research', t('Quiulacocha case study'), t('Undergraduate thesis'), function () { location.href = withLang(BASE + 'research/quiulacocha/'); }, 'thesis tesis mine drainage metals');
    var A = window.gdApp;
    var layers = A ? A.layers : null, cities = A ? A.cities : null, rivers = A ? A.rivers : null;
    if (layers) layers.forEach(function (l) { add(t('Satellite layers'), 'layer', l.label, t('Satellite map'), function () { A.showLayer(l.key); }, l.key); });
    if (cities) cities.forEach(function (c, i) { add(t('Cities'), 'city', c.name, t('Air quality') + ' · ' + c.region, function () { A.showCity(i); }, 'air'); });
    if (rivers) rivers.forEach(function (r, i) { add(t('Rivers'), 'river', t('{0} River', t(r.name)), r.place, function () { A.showRiver(i); }, r.name + ' river'); });
    if (!A) { // on other pages, still offer the main places
      add(t('Satellite layers'), 'layer', t('Active fires (VIIRS)'), t('Satellite map'), function () { location.href = withLang(BASE + 'index.html?layer=fire#satellite'); }, 'fire');
      add(t('Cities'), 'city', 'Lima', t('Air quality'), function () { location.href = withLang(BASE + 'index.html?city=Lima#cities'); }, 'air');
    }
    var D = t('Open data');
    [['enso.json', 'El Niño indices · JSON', 'NOAA CPC · 1981–'], ['climate.json', 'Climate projections by city · JSON', 'CMIP6 · 1960–2049'], ['peru.geojson', 'Peru boundary · GeoJSON', 'Natural Earth']].forEach(function (d) {
      add(D, 'data', t(d[1]), d[2], function () { window.open(BASE + 'data/' + d[0], '_blank', 'noopener'); }, 'download data ' + d[1]);
    });
    if (isHome) add(t('Actions'), 'data', t('Share this view'), t('Copy a link to this layer, date, city and river'), share, 'share link copy');
    add(t('Actions'), 'section', t('Connect on LinkedIn'), '', function () { window.open('https://www.linkedin.com/in/hendy-huayana/', '_blank', 'noopener'); }, 'linkedin contact');
    var LN = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', zh: '中文' };
    Object.keys(LN).forEach(function (k) {
      if (k === LANG) return;
      add(t('Language'), 'lang', LN[k], k.toUpperCase(), function () {
        try { localStorage.setItem('gd-lang', k); } catch (e) {}
        var u = new URL(location.href); if (k === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', k); location.href = u.toString();
      }, 'language idioma ' + k);
    });
    return out;
  }

  var pal, palInput, palList, palItems = [], palShown = [], palActive = 0, palReturn = null;
  function buildPalette() {
    pal = el('div', 'gd-pal'); pal.hidden = true;
    pal.innerHTML =
      '<div class="gd-pal-back" data-close></div>' +
      '<div class="gd-pal-box" role="dialog" aria-modal="true" aria-label="' + esc(t('Search the site')) + '">' +
        '<div class="gd-pal-in">' + ICON.search +
          '<input type="text" role="combobox" aria-expanded="true" aria-controls="gd-pal-list" aria-autocomplete="list" autocomplete="off" spellcheck="false">' +
          '<kbd data-close>Esc</kbd></div>' +
        '<ul class="gd-pal-list" id="gd-pal-list" role="listbox"></ul>' +
        '<div class="gd-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> ' + esc(t('to move')) + '</span><span><kbd>↵</kbd> ' + esc(t('to open')) + '</span><span><kbd>Esc</kbd> ' + esc(t('to close')) + '</span></div>' +
      '</div>';
    document.body.appendChild(pal);
    palInput = pal.querySelector('input'); palList = pal.querySelector('ul');
    palInput.placeholder = t('Search places, layers, sections…');
    palInput.setAttribute('aria-label', t('Search the site'));
    palInput.addEventListener('input', function () { palActive = 0; render(); });
    palInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); run(palShown[palActive]); }
      else if (e.key === 'Escape') { e.preventDefault(); closePal(); }
      else if (e.key === 'Tab') { e.preventDefault(); }
    });
    pal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return closePal();
      var li = e.target.closest('li[data-i]'); if (li) run(palShown[+li.getAttribute('data-i')]);
    });
    palList.addEventListener('mousemove', function (e) {
      var li = e.target.closest('li[data-i]'); if (li && +li.getAttribute('data-i') !== palActive) { palActive = +li.getAttribute('data-i'); mark(); }
    });
  }
  function render() {
    var q = fold(palInput.value.trim()), words = q.split(/\s+/).filter(Boolean);
    var res = palItems.filter(function (it) { return words.every(function (w) { return it.key.indexOf(w) > -1; }); });
    if (!q) res = res.filter(function (it) { return it.g === t('Sections') || it.g === t('Research') || it.g === t('Actions'); });
    else res.sort(function (a, b) { return (fold(b.title).indexOf(q) === 0) - (fold(a.title).indexOf(q) === 0); });
    palShown = res.slice(0, 40);
    if (!palShown.length) { palList.innerHTML = '<li class="gd-pal-empty">' + esc(t('No results for “{0}”', palInput.value.trim())) + '</li>'; palInput.removeAttribute('aria-activedescendant'); return; }
    var html = '', last = null;
    palShown.forEach(function (it, i) {
      if (it.g !== last) { html += '<li class="gd-pal-g" role="presentation">' + esc(it.g) + '</li>'; last = it.g; }
      html += '<li role="option" id="gd-pal-' + i + '" data-i="' + i + '"><span class="gd-pal-ico">' + ICON[it.icon] + '</span><span class="gd-pal-t">' + esc(it.title) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' + ICON.arrow + '</li>';
    });
    palList.innerHTML = html;
    mark();
  }
  function mark() {
    palList.querySelectorAll('li[data-i]').forEach(function (li) { li.setAttribute('aria-selected', +li.getAttribute('data-i') === palActive); });
    var cur = $('gd-pal-' + palActive);
    if (cur) { palInput.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
  }
  function move(d) { if (!palShown.length) return; palActive = (palActive + d + palShown.length) % palShown.length; mark(); }
  function run(it) { if (!it) return; closePal(true); setTimeout(it.act, 10); }
  function openPal() {
    if (!pal) buildPalette();
    palItems = items(); palReturn = document.activeElement;
    document.body.classList.remove('menu-open');
    var mb = document.querySelector('.menu-btn'); if (mb) mb.setAttribute('aria-expanded', 'false');
    palInput.value = ''; palActive = 0; render();
    pal.hidden = false; document.documentElement.classList.add('pal-open');
    palInput.focus();
    requestAnimationFrame(function () { pal.classList.add('open'); });
  }
  function closePal(keepFocus) {
    if (!pal || pal.hidden) return;
    pal.classList.remove('open'); document.documentElement.classList.remove('pal-open');
    setTimeout(function () { pal.hidden = true; }, reduce ? 0 : 160);
    if (!keepFocus && palReturn && palReturn.focus) palReturn.focus();
  }
  window.gdSearch = openPal;
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); pal && !pal.hidden ? closePal() : openPal(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); openPal(); }
  });
  // trigger button in the top bar
  var navIn = document.querySelector('.nav-in');
  if (navIn) {
    var sbtn = el('button', 'search-btn', ICON.search + '<span class="search-l">' + esc(t('Search')) + '</span><kbd>' + (IS_MAC ? '⌘' : 'Ctrl') + ' K</kbd>');
    sbtn.type = 'button'; sbtn.setAttribute('aria-label', t('Search the site'));
    sbtn.addEventListener('click', openPal);
    navIn.insertBefore(sbtn, navIn.querySelector('.lang-switch') || navIn.querySelector('.menu-btn'));
  }

  // ------------------------------------------------------------------ scroll spy
  var spyLinks = [].slice.call(document.querySelectorAll('#site-nav a[href^="#"]')).filter(function (a) { return $(a.getAttribute('href').slice(1)); });
  if (spyLinks.length) {
    var spyTick = false;
    var spy = function () {
      spyTick = false;
      var line = window.innerHeight * 0.35, best = null, bestTop = -Infinity;
      spyLinks.forEach(function (a) {
        if (!a.getClientRects().length) return; // link hidden at this screen size
        var target = $(a.getAttribute('href').slice(1)), r = target.getBoundingClientRect();
        if (!r.height) return;
        if (r.top <= line && r.bottom > 80 && r.top > bestTop) { best = a; bestTop = r.top; }
      });
      spyLinks.forEach(function (a) { if (a === best) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    };
    window.addEventListener('scroll', function () { if (!spyTick) { spyTick = true; requestAnimationFrame(spy); } }, { passive: true });
    window.addEventListener('resize', spy);
    spy();
  }

  // ------------------------------------------------------------------ "What brings you here?" (home only)
  if (isHome && $('kpis')) {
    var PATHS = [
      { id: 'hire', tab: 'I’m hiring', cards: [
        ['#experience', 'Experience', 'Three years building climate-risk and early-warning products for Peru’s environmental agency.'],
        ['#skills', 'Skills & tools', 'GIS, remote sensing, Python and risk analysis: the tools I use every day.'],
        ['#contact', 'Get in touch', 'Open to international roles and collaborations.']] },
      { id: 'research', tab: 'I do research', cards: [
        ['research/quiulacocha/', 'Quiulacocha case study', 'Can fruit peels remove heavy metals from acid mine drainage? My thesis, as an app.'],
        ['#nino', 'El Niño since 1981', 'Weekly NOAA indices you can explore, read as a table or download.'],
        ['#projections', 'Climate to 2050', 'CMIP6 projections and warming stripes for Peruvian cities.']] },
      { id: 'curious', tab: 'I’m curious', cards: [
        ['#satellite', 'Peru from space', 'Compare today’s satellite images with the same day one year ago.'],
        ['#cities', 'The air in your city', 'Live PM2.5, UV and rain for cities across Peru.'],
        ['#rivers', 'Rivers today', 'How much water the big rivers carry, with a 30-day forecast.']] }
    ];
    var sec = el('section', 'wrap section paths sec-light'); sec.id = 'start'; sec.setAttribute('aria-labelledby', 'paths-h');
    sec.innerHTML = '<div class="sec-head"><p class="kicker">' + esc(t('Start here')) + '</p><h2 id="paths-h">' + t('What brings you <span class="hl">here</span>?') + '</h2></div>' +
      '<div class="path-tabs" role="tablist" aria-label="' + esc(t('Choose your path')) + '"></div><div class="path-panel" role="tabpanel" id="path-panel" tabindex="0"></div>' +
      '<p class="path-tip">' + t('Tip: press {0} to search anything on this site.', '<kbd>' + (IS_MAC ? '⌘' : 'Ctrl') + ' K</kbd>') + '</p>';
    $('kpis').insertAdjacentElement('afterend', sec);
    var tabs = sec.querySelector('.path-tabs'), panel = sec.querySelector('.path-panel');
    PATHS.forEach(function (p, i) {
      var b = el('button', 'path-tab'); b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'path-tab-' + p.id;
      b.setAttribute('aria-controls', 'path-panel'); b.textContent = t(p.tab); b.dataset.i = i;
      tabs.appendChild(b);
    });
    var pick = function (i, focus) {
      var p = PATHS[i];
      [].forEach.call(tabs.children, function (b, j) { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
      if (focus) tabs.children[i].focus();
      panel.setAttribute('aria-labelledby', 'path-tab-' + p.id);
      panel.innerHTML = p.cards.map(function (c, j) {
        var href = c[0].charAt(0) === '#' ? c[0] : withLang(c[0]);
        return '<a class="path-card" href="' + href + '" style="--d:' + j * 60 + 'ms"><span class="path-n">0' + (j + 1) + '</span><b>' + esc(t(c[1])) + '</b><span>' + esc(t(c[2])) + '</span><i>' + ICON.arrow + '</i></a>';
      }).join('');
      panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
      try { localStorage.setItem('gd-path', p.id); } catch (e) {}
    };
    tabs.addEventListener('click', function (e) { var b = e.target.closest('.path-tab'); if (b) pick(+b.dataset.i); });
    tabs.addEventListener('keydown', function (e) {
      var i = [].indexOf.call(tabs.children, document.activeElement), n = PATHS.length;
      if (i < 0) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); pick((i + 1) % n, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); pick((i - 1 + n) % n, true); }
      else if (e.key === 'Home') { e.preventDefault(); pick(0, true); }
      else if (e.key === 'End') { e.preventDefault(); pick(n - 1, true); }
    });
    panel.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]'); if (!a) return;
      e.preventDefault(); scrollToId(a.getAttribute('href').slice(1));
    });
    var saved = 0;
    try { var sp = localStorage.getItem('gd-path'); PATHS.forEach(function (p, i) { if (p.id === sp) saved = i; }); } catch (e) {}
    pick(saved);
    if (window.gdReveal) window.gdReveal(sec);
  }

  // ------------------------------------------------------------------ welcome tour (home, first visit)
  function startTour() {
    var steps = [
      { sel: '#swipe-knob', text: 'Drag the white line to compare today with the same day one year ago.' },
      { sel: '#layers', text: 'Choose what to see from space: ocean heat, rain, snow, fires and more.' },
      { sel: '.city-mk', text: 'Tap a city or a river on the map to see its live data.' },
      { sel: '.search-btn', text: 'Looking for something? Search the whole site from here.' }
    ].filter(function (s) { var e = document.querySelector(s.sel); return e && e.getBoundingClientRect().width > 0; });
    if (!steps.length) return;
    var ring = el('div', 'tour-ring'), card = el('div', 'tour-card'), k = 0;
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite'); card.setAttribute('aria-label', t('Quick tour'));
    document.body.appendChild(ring); document.body.appendChild(card);
    function place() {
      var s = steps[k], target = document.querySelector(s.sel); if (!target) return end();
      var r = target.getBoundingClientRect(), pad = 8;
      ring.style.cssText = 'left:' + (r.left - pad) + 'px;top:' + (r.top - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
      var cw = Math.min(300, window.innerWidth - 32), ch = card.offsetHeight || 150;
      var left = Math.max(16, Math.min(window.innerWidth - cw - 16, r.left + r.width / 2 - cw / 2));
      var top = r.bottom + 16; if (top + ch > window.innerHeight - 12) top = Math.max(12, r.top - ch - 16);
      card.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + cw + 'px';
    }
    function show() {
      var last = k === steps.length - 1;
      card.innerHTML = '<p class="tour-step">' + esc(t('Step {0} of {1}', k + 1, steps.length)) + '</p><p class="tour-text">' + esc(t(steps[k].text)) + '</p>' +
        '<div class="tour-btns"><button type="button" class="tour-skip">' + esc(t('Skip')) + '</button><button type="button" class="btn sm tour-next">' + esc(last ? t('Got it') : t('Next')) + '</button></div>';
      place(); requestAnimationFrame(place);
      card.querySelector('.tour-next').focus({ preventScroll: true });
    }
    function end() {
      try { localStorage.setItem('gd-tour', '1'); } catch (e) {}
      ring.remove(); card.remove();
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place);
      document.removeEventListener('keydown', key, true);
    }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); end(); } }
    card.addEventListener('click', function (e) {
      if (e.target.closest('.tour-skip')) end();
      else if (e.target.closest('.tour-next')) { if (++k >= steps.length) end(); else show(); }
    });
    window.addEventListener('resize', place); window.addEventListener('scroll', place, { passive: true });
    document.addEventListener('keydown', key, true);
    show();
  }
  window.gdTour = startTour;
  if (isHome) {
    var seen = false;
    try { seen = localStorage.getItem('gd-tour') === '1'; } catch (e) { seen = true; }
    var qs = new URLSearchParams(location.search);
    if (qs.get('tour') === '1' || (!seen && qs.get('tour') !== '0' && !location.hash && !navigator.webdriver)) {
      setTimeout(function () { if (window.scrollY < 120 && (!pal || pal.hidden)) startTour(); }, 2200);
    }
  }

  // ------------------------------------------------------------------ vertical "Contact" tab on the right edge
  (function () {
    var target = $('contact');
    var a = el('a', 'side-contact');
    a.href = target ? '#contact' : withLang(BASE + 'index.html#contact');
    a.textContent = t('Contact');
    if (target) a.addEventListener('click', function (e) { e.preventDefault(); scrollToId('contact'); });
    document.body.appendChild(a);
    // step aside while the contact block itself is on screen
    // and while the satellite map is on screen, so it never covers the layer panel
    if ('IntersectionObserver' in window) {
      var vis = {}, hero = $('satellite');
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (x) { vis[x.target.id] = x.isIntersecting; });
        a.classList.toggle('away', !!(vis.contact || vis.satellite));
      }, { threshold: 0.2 });
      if (target) io.observe(target);
      if (hero) io.observe(hero);
    }
  })();

  // ------------------------------------------------------------------ cursor dot (mouse only)
  if (!reduce && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var dot = el('div', 'cursor-dot'); dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    var mx = -100, my = -100, dx = -100, dy = -100, running = false;
    var loop = function () {
      dx += (mx - dx) * 0.22; dy += (my - dy) * 0.22;
      dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      if (Math.abs(mx - dx) > 0.1 || Math.abs(my - dy) > 0.1) requestAnimationFrame(loop); else running = false;
    };
    document.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY; dot.classList.add('on');
      // grow over things you can click, hide over the map so it never hides what you are looking at
      var tgt = e.target.closest ? e.target : null;
      dot.classList.toggle('big', !!(tgt && tgt.closest('a, button, [role="tab"], [role="option"], .chip, label')));
      dot.classList.toggle('off', !!(tgt && tgt.closest('.leaflet-container, input, select, textarea, .gd-pal')));
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { dot.classList.remove('on'); });
    document.documentElement.addEventListener('mouseleave', function () { dot.classList.remove('on'); });
  }

  // ------------------------------------------------------------------ footer: credentials, giant wordmark, social bar
  (function () {
    var foot = document.querySelector('.footer'), wrap = foot && foot.querySelector('.wrap');
    if (!wrap) return;
    var BADGES = [['Esri Young Professionals Network', 'Community Ambassador 2026'], ['Women in GIS', 'Member'], ['Women Techmakers', 'Member'],
      ['GEO Mountains', 'Network'], ['Mountain Research Initiative', 'Expert database']];
    var top = el('div', 'foot-top');
    top.innerHTML = '<ul class="foot-badges">' + BADGES.map(function (b) { return '<li><b>' + esc(b[0]) + '</b><span>' + esc(t(b[1])) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="foot-claim">' + esc(t('Communities and networks I am part of')) + '</p>';
    wrap.insertBefore(top, wrap.firstChild);
    var SOC = [
      ['https://www.linkedin.com/in/hendy-huayana/', 'LinkedIn', '<path d="M6 9.5v8M6 6.2v.1M10 17.5v-8M10 13c0-2 1.2-3.5 3-3.5s3 1.2 3 3.5v4.5"/><rect x="2.5" y="2.5" width="19" height="19" rx="4"/>'],
      ['https://github.com/hendyhuayana', 'GitHub', '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21.5v-3.6c0-1 .1-1.5-.5-2.1 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C6.6 3.1 5.5 3.4 5.5 3.4a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.8c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2.1v3.6"/>'],
      ['https://orcid.org/0009-0000-9348-6078', 'ORCID', '<circle cx="12" cy="12" r="9.5"/><path d="M8.5 10v7M8.5 7v.1M11.5 17v-7h2.2a3.5 3.5 0 0 1 0 7z"/>'],
      ['https://www.tiktok.com/@hendy.greendata', 'TikTok', '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>']
    ];
    var brand = foot.querySelector('.brand'); if (brand) brand.hidden = true;
    var fine = foot.querySelector('.fine');
    var big = el('div', 'foot-giant');
    big.innerHTML = '<svg viewBox="0 0 1000 118" role="img" aria-label="Hendy in Green Data"><text x="2" y="104" textLength="996" lengthAdjust="spacingAndGlyphs">HENDY<tspan class="in" dx="10">in</tspan><tspan class="g" dx="10">GREEN</tspan><tspan dx="12">DATA</tspan></text></svg>';
    var bar = el('div', 'wrap foot-bar');
    bar.innerHTML = '<p class="foot-copy">© ' + new Date().getFullYear() + ' Hendy Mayumi Huayana</p>' +
      '<ul class="foot-social" aria-label="' + esc(t('Find me on')) + '">' + SOC.map(function (x) {
        return '<li><a href="' + x[0] + '" aria-label="' + x[1] + '" title="' + x[1] + '"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + x[2] + '</svg></a></li>';
      }).join('') + '</ul>';
    if (fine) bar.appendChild(fine);
    foot.appendChild(big); foot.appendChild(bar);
  })();
})();
