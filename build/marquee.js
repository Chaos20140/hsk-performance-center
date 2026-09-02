/* HSK Performance Center — Laufschriften lückenlos halten.

   Die Laufbänder (Schlagwortleiste, Bewertungsreihe, „Jetzt anfangen") bestehen
   aus zwei identischen Gruppen und werden per Keyframe um -50 % geschoben. Das
   ist nur dann nahtlos, wenn eine Gruppe mindestens so breit ist wie das
   Fenster — sonst läuft die Spur am Ende der Runde aus dem Bild und es bleibt
   eine leere Fläche stehen.

   Gemessen: bei 1920 px fehlten der Schlagwortleiste 130 px, bei 2560 px
   770 px. Auf einem 1440er fiel es nicht auf, deshalb blieb es lange unentdeckt.

   Hier werden so viele Kopien angelegt, dass eine Spurhälfte das Fenster immer
   füllt. Die -50 %-Animation bleibt dabei unangetastet: die Zahl der Gruppen
   ist immer gerade, eine Hälfte ist also exakt die Wiederholung der anderen. */
(function () {
  'use strict';

  function tracks() {
    var out = [];
    var all = document.querySelectorAll('[data-screen-label] div, section div, footer div');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length < 2) continue;
      var name = getComputedStyle(el).animationName || '';
      if (name.indexOf('hs-mq') === 0) out.push(el);
    }
    return out;
  }

  function fit(track) {
    var first = track.firstElementChild;
    if (!first) return;

    // Die Vorlage einmal festhalten, bevor Kopien dazukommen.
    if (!track.__tpl) {
      track.__tpl = first.cloneNode(true);
      track.__tpl.setAttribute('aria-hidden', 'true');
    }

    var vw = document.documentElement.clientWidth || window.innerWidth;
    var gw = first.getBoundingClientRect().width;
    if (!gw || !vw) return;                       // noch nicht ausgelegt

    var perHalf = Math.max(1, Math.ceil((vw + 4) / gw));
    var need = perHalf * 2;
    if (track.children.length === need) return;

    while (track.children.length > need) track.removeChild(track.lastElementChild);
    while (track.children.length < need) track.appendChild(track.__tpl.cloneNode(true));
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
    // Schriften ändern die Breite der Gruppen, also danach noch einmal.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run).catch(function () {});
    window.addEventListener('load', run, { once: true });

    var t = null, lastW = document.documentElement.clientWidth;
    window.addEventListener('resize', function () {
      var w = document.documentElement.clientWidth;
      if (w === lastW) return;                    // reine Höhenänderung ignorieren
      lastW = w;
      clearTimeout(t);
      t = setTimeout(run, 180);
    });
  });
})();
