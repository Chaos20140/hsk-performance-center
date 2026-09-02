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

    /* Ein Klick auf die Karte soll die Karten-App öffnen — den Ort, nicht eine
       Route. Das eingebettete iframe schluckt Klicks selbst, also liegt eine
       durchsichtige Fläche darüber. Auf Apple-Geräten führt der Weg zu Apple
       Karten, sonst zu Google Maps. */
    function mapsUrl() {
      var q = 'HSK Performance Center, Strackestraße 22, 59929 Brilon';
      var apple = false;
      try { apple = /Apple/.test(navigator.vendor || ''); } catch (e) {}
      return apple
        ? 'https://maps.apple.com/?q=' + encodeURIComponent(q)
        : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    }

    function armMapLink() {
      var wrap = frame.parentElement;
      if (!wrap || wrap.querySelector('[data-map-open]')) return;
      var a = document.createElement('a');
      a.setAttribute('data-map-open', '');
      a.href = mapsUrl();
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', 'Standort in der Karten-App öffnen');
      // Ohne innerHTML aufgebaut — hier steht zwar nur fester Text, aber die
      // Gewohnheit gehört gar nicht erst in die Datei.
      var label = document.createElement('span');
      label.textContent = 'In Karten öffnen';
      var arrow = document.createElement('span');
      arrow.textContent = '↗';
      arrow.setAttribute('aria-hidden', 'true');
      a.appendChild(label);
      a.appendChild(arrow);
      wrap.appendChild(a);
    }

    var remembered = false;
    try { remembered = window.localStorage.getItem(KEY) === '1'; } catch (e) {}
    if (remembered) { load(); armMapLink(); return; }

    var btn = gate.querySelector('[data-map-accept]');
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        try { window.localStorage.setItem(KEY, '1'); } catch (err) {}
        load();
        armMapLink();
      });
    }
  });
})();
