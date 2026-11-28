/* Hendy in Green Data · extra map tools shared by every map
 * gdMapTools(map, { home: [[s,w],[n,e]], base: tileLayer, position: 'topleft' })
 * - Full screen · My location · Back to the start view · Measure a distance · Base map (dark / satellite / light)
 * - Scale bar and live coordinates under the pointer
 */
(function () {
  'use strict';
  var t = window.t || function (s) { return s; };
  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  var BASES = {
    dark: { label: 'Dark map', url: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: 'Esri, HERE, Garmin, © OpenStreetMap' },
    sat: { label: 'Satellite image', url: ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Esri, Maxar, Earthstar Geographics' },
    light: { label: 'Light map', url: ESRI + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', attr: 'Esri, HERE, Garmin, © OpenStreetMap' },
    relief: { label: 'Relief', url: ESRI + 'World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', attr: 'Esri' }
  };
  var I = {
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    exit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    loc: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'
  };
  function svg(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  function km(m) { return m >= 1000 ? (m / 1000).toLocaleString(window.GD_LOCALE || 'en-US', { maximumFractionDigits: m >= 100000 ? 0 : 1 }) + ' km' : Math.round(m) + ' m'; }

  window.gdMapTools = function (map, o) {
    o = o || {};
    var box = map.getContainer();
    L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 110 }).addTo(map);

    // live coordinates
    var Coord = L.Control.extend({ options: { position: 'bottomright' }, onAdd: function () { var d = L.DomUtil.create('div', 'gd-coord'); d.setAttribute('aria-hidden', 'true'); return d; } });
    var coord = new Coord().addTo(map);
    map.on('mousemove', function (e) { coord.getContainer().textContent = e.latlng.lat.toFixed(3) + '°, ' + e.latlng.lng.toFixed(3) + '°'; });
    map.on('mouseout', function () { coord.getContainer().textContent = ''; });

    var Bar = L.Control.extend({
      options: { position: o.position || 'topleft' },
      onAdd: function () {
        var bar = L.DomUtil.create('div', 'gd-tools leaflet-bar');
        L.DomEvent.disableClickPropagation(bar); L.DomEvent.disableScrollPropagation(bar);
        function btn(icon, label, fn) {
          var b = L.DomUtil.create('button', 'gd-tool', bar); b.type = 'button'; b.innerHTML = svg(icon);
          b.title = t(label); b.setAttribute('aria-label', t(label));
          b.addEventListener('click', function (e) { e.preventDefault(); fn(b); });
          return b;
        }
        // full screen (the map box itself)
        var fs = btn(I.full, 'Full screen', function (b) {
          var on = box.classList.toggle('gd-full');
          document.documentElement.classList.toggle('gd-full-open', on);
          b.innerHTML = svg(on ? I.exit : I.full); b.title = t(on ? 'Exit full screen' : 'Full screen');
          setTimeout(function () { map.invalidateSize(); }, 60);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('gd-full')) fs.click(); });
        // my location
        var me = null;
        btn(I.loc, 'My location', function (b) {
          if (!navigator.geolocation) return;
          b.classList.add('busy');
          navigator.geolocation.getCurrentPosition(function (p) {
            b.classList.remove('busy');
            var ll = [p.coords.latitude, p.coords.longitude];
            if (me) map.removeLayer(me);
            me = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#3987e5', fillOpacity: 1 }).bindTooltip(t('You are here'), { className: 'gd-tip' }).addTo(map);
            map.setView(ll, Math.max(map.getZoom(), 8));
            if (o.onLocate) o.onLocate(ll);
          }, function () { b.classList.remove('busy'); if (window.gdToast) window.gdToast(t('Location not available'), false); }, { timeout: 10000 });
        });
        // back to the start view
        btn(I.home, 'Back to the start view', function () { if (o.home) map.fitBounds(o.home, { animate: true }); });
        // measure a distance: click points, double-click or press the button again to finish
        var meas = null, pts = [], line = null, lab = null;
        function stopMeasure(b) { meas = null; b.classList.remove('on'); box.classList.remove('gd-measuring'); map.doubleClickZoom.enable(); }
        btn(I.ruler, 'Measure a distance', function (b) {
          if (meas) { stopMeasure(b); return; }
          if (line) { map.removeLayer(line); map.removeLayer(lab); line = lab = null; }
          pts = []; meas = true; b.classList.add('on'); box.classList.add('gd-measuring'); map.doubleClickZoom.disable();
          if (window.gdToast) window.gdToast(t('Click points on the map; click the ruler again to finish'));
          map.once('dblclick', function () { stopMeasure(b); });
        });
        map.on('click', function (e) {
          if (!meas) return;
          L.DomEvent.stop(e.originalEvent || e);
          pts.push(e.latlng);
          if (!line) { line = L.polyline(pts, { color: '#d7f36b', weight: 3, dashArray: '6 5' }).addTo(map); lab = L.tooltip({ permanent: true, direction: 'right', className: 'gd-tip gd-measure' }); }
          else line.setLatLngs(pts);
          var d = 0; for (var i = 1; i < pts.length; i++) d += pts[i - 1].distanceTo(pts[i]);
          lab.setLatLng(e.latlng).setContent(pts.length > 1 ? km(d) : t('Click the next point')).addTo(map);
        });
        // base map switcher
        if (o.base) {
          var cur = 'dark', menu = null;
          var bb = btn(I.layers, 'Base map', function () {
            if (menu) { menu.remove(); menu = null; return; }
            menu = L.DomUtil.create('div', 'gd-basemenu', bar);
            menu.innerHTML = Object.keys(BASES).map(function (k) { return '<button type="button" data-k="' + k + '" aria-pressed="' + (k === cur) + '">' + t(BASES[k].label) + '</button>'; }).join('');
            menu.addEventListener('click', function (e) {
              var k = e.target.getAttribute('data-k'); if (!k) return;
              cur = k; o.base.setUrl(BASES[k].url);
              if (map.attributionControl) { Object.keys(BASES).forEach(function (x) { map.attributionControl.removeAttribution(BASES[x].attr); }); map.attributionControl.addAttribution(BASES[k].attr); }
              box.classList.toggle('gd-base-light', k === 'light' || k === 'relief');
              menu.remove(); menu = null;
            });
          });
          bb.classList.add('gd-basebtn');
        }
        return bar;
      }
    });
    new Bar().addTo(map);
  };
})();
