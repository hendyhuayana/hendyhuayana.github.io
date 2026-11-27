/* Hendy in Green Data · languages
 * English is the base. Other languages load i18n/keys.js (English keys) + i18n/<lang>.js (translations, same order).
 * Choose with ?lang=xx or the selector in the top bar; the choice is remembered in this browser.
 */
(function () {
  'use strict';
  var LANGS = {
    en: ['English', 'en-US'], es: ['Español', 'es-PE'], pt: ['Português', 'pt-BR'],
    fr: ['Français', 'fr-FR'], de: ['Deutsch', 'de-DE'], zh: ['中文', 'zh-CN']
  };
  var me = document.currentScript, base = me ? me.src.replace(/i18n\.js(\?.*)?$/, '') : '';

  function pick() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (q && LANGS[q]) { try { localStorage.setItem('gd-lang', q); } catch (e) {} return q; }
    try { var s = localStorage.getItem('gd-lang'); if (s && LANGS[s]) return s; } catch (e) {}
    return 'en';
  }
  var lang = pick();
  window.GD_LANG = lang;
  window.GD_LOCALE = LANGS[lang][1];
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;

  var dict = null;
  function ensure() {
    if (dict || lang === 'en') return dict;
    if (window.GD_KEYS && window.GD_TR) {
      dict = {};
      // keep units and French punctuation on the same line as the word before them
      window.GD_KEYS.forEach(function (k, i) { var v = window.GD_TR[i]; if (v) dict[k] = v.replace(/ (°C|%|[?!:;»])/g, ' $1'); });
    }
    return dict;
  }
  // t('Text with {0}', value) → translated text with the values filled in
  window.t = function (s) {
    var d = ensure(), out = d && d[s] ? d[s] : s, a = arguments;
    return String(out).replace(/\{(\d)\}/g, function (_, i) { return a[+i + 1]; });
  };

  if (lang !== 'en') {
    // Synchronous on purpose: the page code that follows uses t() while it builds the page.
    document.write('<script src="' + base + 'i18n/keys.js"><\/script><script src="' + base + 'i18n/' + lang + '.js"><\/script>');
  }

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function translateStatic() {
    var d = ensure();
    if (!d) return;
    var tt = norm(document.title); if (d[tt]) document.title = d[tt];
    document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"]').forEach(function (m) {
      var v = d[norm(m.content)]; if (v) m.content = v;
    });
    document.querySelectorAll('[aria-label], [alt]').forEach(function (el) {
      ['aria-label', 'alt'].forEach(function (a) { var k = el.getAttribute(a); if (k && d[norm(k)]) el.setAttribute(a, d[norm(k)]); });
    });
    // 1) blocks with inline formatting: the translation carries its own markup
    var done = [];
    document.querySelectorAll('body p, body h1, body h2, body h3, body h4, body li, body span, body a, body div, body td, body dd').forEach(function (el) {
      if (el.closest('script, style, svg, .leaflet-container') || done.some(function (p) { return p.contains(el); })) return;
      if (el.querySelector('input, select, textarea, button, svg')) return;
      var v = d[norm(el.textContent)];
      if (v && v.indexOf('<') > -1) { el.innerHTML = v; done.push(el); }
    });
    // 2) plain text pieces
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || p.closest('script, style, svg, .leaflet-container, .tip')) return NodeFilter.FILTER_REJECT;
        return /[A-Za-z]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var raw = node.nodeValue, k = norm(raw), v = d[k];
      if (v && v.indexOf('<') === -1) node.nodeValue = raw.replace(k, v);
    });
  }

  function addSwitcher() {
    var bar = document.querySelector('.nav-in');
    if (!bar || document.getElementById('lang-sel')) return;
    var box = document.createElement('div');
    box.className = 'lang-switch';
    var label = document.createElement('label');
    label.className = 'sr'; label.htmlFor = 'lang-sel'; label.textContent = window.t('Language');
    var sel = document.createElement('select');
    sel.id = 'lang-sel';
    Object.keys(LANGS).forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = LANGS[k][0]; if (k === lang) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      try { localStorage.setItem('gd-lang', sel.value); } catch (e) {}
      var u = new URL(location.href);
      if (sel.value === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', sel.value);
      location.href = u.toString();
    });
    box.appendChild(label); box.appendChild(sel);
    var menu = bar.querySelector('.menu-btn');
    bar.insertBefore(box, menu || null);
    // a second copy inside the phone menu, where the top bar has no room
    var nav = document.getElementById('site-nav');
    if (nav) {
      var box2 = box.cloneNode(true);
      box2.classList.add('in-menu');
      var sel2 = box2.querySelector('select'), lab2 = box2.querySelector('label');
      sel2.id = 'lang-sel-menu'; lab2.htmlFor = 'lang-sel-menu';
      sel2.value = lang;
      sel2.addEventListener('change', function () { sel.value = sel2.value; sel.dispatchEvent(new Event('change')); });
      nav.insertBefore(box2, nav.firstChild);
    }
  }

  document.addEventListener('DOMContentLoaded', function () { translateStatic(); addSwitcher(); });
})();
