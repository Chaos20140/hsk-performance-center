/* HSK Performance Center — map consent gate.
   The contact section embeds Google Maps. An <iframe> that loads on page view
   hands the visitor's IP address to Google before anyone agreed to it, which is
   not defensible for a German site. The frame therefore carries data-src and is
   only connected after an explicit click; the choice is remembered per browser.

   To go back to an always-on map: delete this file, its <script> tag, and swap
   the iframe's data-src back to src in index.html. */
(function () {
  'use strict';

  var KEY = 'hsk.map.consent';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var frame = document.querySelector('[data-map-frame]');
    var gate = document.querySelector('[data-map-gate]');
    if (!frame || !gate) return;

    function load() {
      var src = frame.getAttribute('data-src');
      if (src && !frame.getAttribute('src')) frame.setAttribute('src', src);
      gate.style.opacity = '0';
      gate.style.pointerEvents = 'none';
      setTimeout(function () { gate.style.display = 'none'; }, 600);
    }

    var remembered = false;
    try { remembered = window.localStorage.getItem(KEY) === '1'; } catch (e) {}
    if (remembered) { load(); return; }

    var btn = gate.querySelector('[data-map-accept]');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        try { window.localStorage.setItem(KEY, '1'); } catch (err) {}
        load();
      });
    }
  });
})();
