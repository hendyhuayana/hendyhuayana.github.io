/* Hendy in Green Data · shared interface details for every page:
 * mobile menu, reading progress, scroll reveal, card glow and count-up numbers.
 * Everything respects prefers-reduced-motion.
 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Mobile menu
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('site-nav');
  if (btn && nav) {
    function setOpen(open) {
      btn.setAttribute('aria-expanded', open);
      document.body.classList.toggle('menu-open', open);
    }
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  // ---- Reading progress bar
  var bar = document.createElement('div');
  bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  function progress() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
  }
  window.addEventListener('scroll', progress, { passive: true });
  window.addEventListener('resize', progress);
  progress();

  // ---- Scroll reveal
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    window.gdReveal = function (root) {
      (root || document).querySelectorAll('.sec-head, .card, .kpi, .xp, .svc, .tl-item, .explain > div, .rcard').forEach(function (el, i) {
        if (el.dataset.rv) return;
        el.dataset.rv = '1';
        el.style.setProperty('--rv-delay', (i % 4) * 70 + 'ms');
        io.observe(el);
      });
    };
    window.gdReveal();
  } else {
    window.gdReveal = function () {};
  }

  // ---- Card glow that follows the pointer
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.xp, .svc, .kpi, .rcard');
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--gx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  // ---- Count-up for numbers already rendered from real data
  // Call gdCount(el): animates the first number inside el from 0 to its value, keeping sign, decimals and suffix.
  window.gdCount = function (el) {
    if (!el || reduce || el.dataset.counted) return;
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    var m = node.textContent.match(/^([+−-]?)([\d,]*\.?\d+)(.*)$/);
    if (!m) return;
    el.dataset.counted = '1';
    var sign = m[1], raw = m[2], rest = m[3], target = parseFloat(raw.replace(/,/g, ''));
    var dec = (raw.split('.')[1] || '').length, t0 = null, dur = 1100;
    function frame(t) {
      if (t0 == null) t0 = t;
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      var v = (target * e).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      node.textContent = sign + v + rest;
      if (k < 1) requestAnimationFrame(frame); else node.textContent = sign + raw + rest;
    }
    if ('IntersectionObserver' in window) {
      var o = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { o.disconnect(); requestAnimationFrame(frame); }
      }, { threshold: 0.5 });
      o.observe(el);
    } else requestAnimationFrame(frame);
  };
})();
