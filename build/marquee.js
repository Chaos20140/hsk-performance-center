/* HSK Performance Center — Laufschriften lückenlos halten (v2).

   Die Bänder des Designs (rotes Schlagwortband, „Jetzt anfangen") sind eine
   Spur aus einzelnen <span>-Kindern, in der die Wortfolge bereits ZWEIMAL
   steht, und werden per Keyframe um -50 % geschoben. Nahtlos ist das nur,
   wenn eine Spurhälfte mindestens so breit ist wie das Fenster — sonst läuft
   die Spur am Rundenende aus dem Bild.

   Hier wird die komplette Spur so oft verdoppelt, bis eine Hälfte das Fenster
   füllt. Verdoppeln erhält die Symmetrie der beiden Hälften, die -50 %-Animation
   bleibt gültig. Es wird nie ein Kind entfernt (die v1-Fassung ging von
   Gruppen-Wrappern aus und zerlegte diese Spuren — siehe CLAUDE.md §6 Nr. 10).
   Die zweite Hälfte (und alle Kopien) sind für Hilfstechnik verborgen: eine
   Laufschrift muss nur einmal vorgelesen werden. */
(function () {
  'use strict';

  function tracks() {
    var out = [];
    var all = document.querySelectorAll('section div');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length < 2) continue;
      var name = getComputedStyle(el).animationName || '';
      if (name.indexOf('hs-mq') === 0) out.push(el);
    }
    return out;
  }

  function hideSecondHalf(track) {
    var kids = track.children, n = kids.length;
    for (var i = Math.floor(n / 2); i < n; i++) kids[i].setAttribute('aria-hidden', 'true');
  }

  function fit(track) {
    if (!track.__base) {
      // Grundzustand einmal festhalten (die Spur des Designs, zwei Hälften)
      track.__base = Array.prototype.map.call(track.children, function (c) { return c.cloneNode(true); });
      hideSecondHalf(track);
    }
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var half = track.scrollWidth / 2;
    if (!half || !vw) return;
    var guard = 0;
    while (half < vw + 4 && guard++ < 4) {
      var frag = document.createDocumentFragment();
      Array.prototype.forEach.call(track.children, function (c) {
        var k = c.cloneNode(true);
        k.setAttribute('aria-hidden', 'true');
        frag.appendChild(k);
      });
      track.appendChild(frag);
      half = track.scrollWidth / 2;
    }
  }

  function run() {
    var list = tracks();
    for (var i = 0; i < list.length; i++) {
      try { fit(list[i]); } catch (e) {}
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    run();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run).catch(function () {});
    window.addEventListener('load', run, { once: true });
    var t = null, lastW = document.documentElement.clientWidth;
    window.addEventListener('resize', function () {
      var w = document.documentElement.clientWidth;
      if (w <= lastW) { lastW = w; return; }        // nur breiter werden braucht mehr Kopien
      lastW = w;
      clearTimeout(t);
      t = setTimeout(run, 180);
    });
  });
})();
