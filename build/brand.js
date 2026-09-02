/* HSK Performance Center — Auftritt des Markenzeichens in der Kopfleiste.

   Ablauf: der Ladevorhang hebt sich, das HSK-Zeichen zündet, „PERFORMANCE
   CENTER" detoniert Buchstabe für Buchstabe herein. Kurz darauf zieht sich die
   Wortmarke wieder zusammen und übrig bleibt das kurze Zeichen, mittig in der
   Leiste. Der Kollaps selbst liegt im CSS (html[data-brand="mark"]); hier wird
   nur der richtige Moment bestimmt.

   Läuft dieses Skript nicht, bleibt die volle Wortmarke stehen — kein Loch. */
(function () {
  'use strict';

  var root = document.documentElement;

  /* Die Buchstaben starten mit 0,62 s Verzögerung, der letzte mit 1,18 s, jeder
     läuft 0,7 s. Nach ~1,9 s steht die Wortmarke also vollständig. Danach ein
     Moment zum Lesen, dann zusammenziehen. */
  var HOLD_AFTER_ENTRANCE = 4200;

  function collapse() {
    if (root.dataset.brand === 'mark') return;
    root.dataset.brand = 'mark';
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* WebKit (Safari, und auf iOS ausnahmslos jeder Browser) zeichnet ein
     <video> nicht mehr, sobald ein SVG-Referenzfilter darauf liegt: das
     Element spielt weiter — paused=false, currentTime läuft — malt aber nichts.
     Auf dem iPhone blieb der Hintergrundfilm deshalb schwarz.
     Das Kennzeichen hier schaltet in extra.css auf einen reinen CSS-Filter um,
     der den Gamma-Filter nachbildet (eingemessen, siehe CLAUDE.md).
     navigator.vendor ist der verlässlichste Weg: „Apple Computer, Inc." gilt
     für Safari ebenso wie für Chrome und Firefox auf iOS, die alle WebKit
     benutzen — genau die Menge, um die es geht. */
  try {
    if (/Apple/.test(navigator.vendor || '')) root.dataset.engine = 'webkit';
  } catch (e) {}

  ready(function () {
    var overlay = document.querySelector('[data-overlay]');
    var burger = document.querySelector('[data-menu-btn]');
    if (overlay && !overlay.id) overlay.id = 'hsk-menu';
    if (overlay && burger) burger.setAttribute('aria-controls', overlay.id);

    // Wer weniger Bewegung möchte, bekommt das Endbild sofort.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      collapse();
      return;
    }

    // Auf igniteBrand() warten — das ist der Moment, in dem der Vorhang weg ist
    // und die Detonation auf der echten Seite beginnt.
    var t0 = Date.now();
    var poll = setInterval(function () {
      var lit = window.HSK && window.HSK._brandLit;
      // Notausstieg: sollte das Zünden ausbleiben, trotzdem aufräumen
      var overdue = Date.now() - t0 > 9000;
      if (!lit && !overdue) return;
      clearInterval(poll);
      setTimeout(collapse, lit ? HOLD_AFTER_ENTRANCE : 0);
    }, 120);
  });
})();
