/* HSK Performance Center — mobile chrome.
   Additive layer on top of site.js. It owns the bottom command dock and the
   mobile-only bits of the menu overlay; it never reaches into the page's own
   scroll/reel engine beyond the public setMenu() entry point. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  /* The dock stays tucked away behind the loading curtain, then slides in.
     If anything below throws, the dock is still a set of plain links. */
  root.dataset.boot = 'loading';

  function ready(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var dock = doc.querySelector('[data-dock]');
    var btn = doc.querySelector('[data-dock-menu]');
    var label = doc.querySelector('[data-dock-menu-label]');
    var overlay = doc.querySelector('[data-overlay]');

    if (overlay && !overlay.id) overlay.id = 'hsk-menu';

    /* ---- dock burger mirrors the header burger ---------------------------- */
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var app = window.HSK;
        if (!app || typeof app.setMenu !== 'function') return;
        app.setMenu(!app._menuOpen);
        paintMenuState();
      });
    }

    function paintMenuState() {
      var open = root.dataset.menu === 'open';
      if (label) label.textContent = open ? 'Schließen' : 'Menü';
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    /* setMenu() is also driven from the header button, Escape and every in-page
       anchor, so mirror whatever it settles on rather than tracking it here. */
    if (window.MutationObserver) {
      new MutationObserver(paintMenuState)
        .observe(root, { attributes: true, attributeFilter: ['data-menu'] });
    }
    paintMenuState();

    /* ---- reveal the dock once the curtain is gone ------------------------- */
    var t0 = Date.now();
    var poll = setInterval(function () {
      var app = window.HSK;
      var done = (app && app._locked === false) || (Date.now() - t0 > 6500);
      if (!done) return;
      clearInterval(poll);
      root.dataset.boot = 'ready';
    }, 140);

    /* ---- iOS: keep the dock clear of the on-screen keyboard --------------- */
    if (dock && window.visualViewport) {
      var vv = window.visualViewport;
      var sync = function () {
        // when the keyboard is up the visual viewport shrinks; hide rather than
        // let the dock float in the middle of the screen
        var covered = (window.innerHeight - vv.height) > 140;
        dock.style.visibility = covered ? 'hidden' : '';
      };
      vv.addEventListener('resize', sync);
      sync();
    }
  });
})();
