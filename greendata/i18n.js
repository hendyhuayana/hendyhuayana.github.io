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
    document.querySelectorAll('[aria-label], [alt], [placeholder]').forEach(function (el) {
      ['aria-label', 'alt', 'placeholder'].forEach(function (a) { var k = el.getAttribute(a); if (k && d[norm(k)]) el.setAttribute(a, d[norm(k)]); });
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

  var GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function go(code) {
    if (code === lang) return;
    try { localStorage.setItem('gd-lang', code); } catch (e) {}
    var u = new URL(location.href);
    if (code === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', code);
    document.documentElement.classList.add('lang-leaving');
    setTimeout(function () { location.href = u.toString(); }, 160);
  }

  // A list of languages: native name, short code and a check on the current one
  function list(id) {
    var ul = document.createElement('ul');
    ul.className = 'lang-list'; ul.id = id; ul.setAttribute('role', 'listbox');
    ul.setAttribute('aria-label', window.t('Language'));
    Object.keys(LANGS).forEach(function (k) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option'); li.tabIndex = -1; li.dataset.lang = k;
      li.setAttribute('lang', k === 'zh' ? 'zh-Hans' : k);
      li.setAttribute('aria-selected', k === lang ? 'true' : 'false');
      li.innerHTML = '<span class="lang-name"></span><span class="lang-code">' + k.toUpperCase() + '</span>' + CHECK;
      li.firstChild.textContent = LANGS[k][0];
      li.addEventListener('click', function () { go(k); });
      ul.appendChild(li);
    });
    ul.addEventListener('keydown', function (e) {
      var items = [].slice.call(ul.children), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if ((e.key === 'Enter' || e.key === ' ') && i > -1) { e.preventDefault(); go(items[i].dataset.lang); }
    });
    return ul;
  }

  function addSwitcher() {
    var bar = document.querySelector('.nav-in');
    if (!bar || document.getElementById('lang-btn')) return;

    // Top bar: compact button that opens a panel
    var box = document.createElement('div');
    box.className = 'lang-switch';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'lang-btn'; btn.className = 'lang-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'lang-list');
    btn.setAttribute('aria-label', window.t('Language') + ': ' + LANGS[lang][0]);
    btn.innerHTML = GLOBE + '<span class="lang-cur">' + lang.toUpperCase() + '</span><svg class="lang-chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>';
    var ul = list('lang-list');
    var panel = document.createElement('div');
    panel.className = 'lang-panel'; panel.hidden = true;
    var head = document.createElement('p'); head.className = 'lang-head'; head.textContent = window.t('Language');
    panel.appendChild(head); panel.appendChild(ul);
    box.appendChild(btn); box.appendChild(panel);

    function open(focusCurrent) {
      panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(function () { box.classList.add('open'); });
      if (focusCurrent) (ul.querySelector('[aria-selected="true"]') || ul.firstChild).focus();
    }
    function close(refocus) {
      box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
      setTimeout(function () { if (!box.classList.contains('open')) panel.hidden = true; }, 180);
      if (refocus) btn.focus();
    }
    btn.addEventListener('click', function () { box.classList.contains('open') ? close() : open(true); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(true); } });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('open')) { e.preventDefault(); close(true); } });
    document.addEventListener('click', function (e) { if (!box.contains(e.target) && box.classList.contains('open')) close(); });
    box.addEventListener('focusout', function (e) { if (box.classList.contains('open') && e.relatedTarget && !box.contains(e.relatedTarget)) close(); });

    var menu = bar.querySelector('.menu-btn');
    bar.insertBefore(box, menu || null);

    // Phone menu: the six languages as a grid of chips, no extra tap needed
    var nav = document.getElementById('site-nav');
    if (nav) {
      var m = document.createElement('div');
      m.className = 'lang-switch in-menu';
      var h = document.createElement('p'); h.className = 'lang-head'; h.innerHTML = GLOBE; h.appendChild(document.createTextNode(window.t('Language')));
      m.appendChild(h); m.appendChild(list('lang-list-menu'));
      nav.insertBefore(m, nav.firstChild);
    }
  }

  document.addEventListener('DOMContentLoaded', function () { translateStatic(); addSwitcher(); });
})();
