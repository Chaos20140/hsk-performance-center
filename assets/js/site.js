/* HSK Performance Center — Seitenlogik.
   Wörtlich aus dem Claude-Design-Original übernommen; die Design-Runtime
   (DCLogic) ist durch den Shim am Ende ersetzt. Eingriffe sind mit
   "HSK-PATCH" markiert. GENERIERT — Änderungen in build/build.js machen. */
(function () {
  'use strict';

  class DCLogic {
    constructor() { this.state = {}; }
    setState(patch) { Object.assign(this.state, patch); if (this.__render) this.__render(); }
    forceUpdate() { if (this.__render) this.__render(); }
  }

  class Component extends DCLogic {
    state = { booting: true, menu: false, mapOn: false };
    componentDidMount() {
      this._alive = true;
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // HSK-PATCH 2: Vorhang nur mit Vorhang-Markup, nie bei Anker-Aufruf
      const skipBoot = reduced || !document.querySelector('[data-if="booting"]') || !!location.hash;
      if (skipBoot) { this.setState({ booting: false }); this.skipIntroDelays(); }
      else {
        window.scrollTo(0, 0);
        document.documentElement.style.overflow = 'hidden';
        const t0 = performance.now();
        const tick = (now) => {
          if (!this._alive) return;
          const p = Math.min(1, (now - t0) / 1350);
          const el = document.querySelector('[data-pct]');
          if (el) el.textContent = String(Math.round(p * 100)).padStart(3, '0');
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        this._t1 = setTimeout(() => { document.documentElement.style.overflow = ''; if (this._alive) this.setState({ booting: false }); }, 2350);
      }
      this._onScroll = () => {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => { this._raf = 0; clearTimeout(this._fb); this.sync(); });
        clearTimeout(this._fb);
        this._fb = setTimeout(() => { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } this.sync(); }, 120);
      };
      window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onScroll);
      this._activeArea = -1;
      this.sync();
      this.playAll();
      this._unlock = () => { this.playAll(); };
      ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((ev) => window.addEventListener(ev, this._unlock, { passive: true, capture: true }));
      this._onKey = (e) => { if (e.key === 'Escape' && this.state.menu) this.setMenu(false); };
      window.addEventListener('keydown', this._onKey);
      this._clock = setInterval(() => { if (this._alive) this.forceUpdate(); }, 60000);
      // HSK-PATCH 4b: gemerkte Karten-Einwilligung anwenden
      let mapOk = false; try { mapOk = localStorage.getItem('hsk.map.consent') === '1'; } catch (e) {}
      if (mapOk && document.querySelector('[data-if="mapOn"]')) this.setState({ mapOn: true });
      // HSK-PATCH 7: Tab im Hintergrund → Reel anhalten, kein Nachladen ins Leere
      this._onVis = () => { if (!this.reel) return; if (document.hidden) this.setReelPaused(true); else if ((window.scrollY || 0) < window.innerHeight && !this.reel.userPaused) this.setReelPaused(false); };
      document.addEventListener('visibilitychange', this._onVis);
      this.bootReel();
    }
    skipIntroDelays() {
      document.querySelectorAll('[style*="animation"]').forEach((el) => {
        const d = parseFloat(el.style.animationDelay || '0');
        if (d >= 2) el.style.animationDelay = Math.max(0, d - 2.3).toFixed(2) + 's';
      });
    }
    bootReel() {
      if (!document.querySelector('[data-reel-layer]')) return; // HSK-PATCH 3b: Unterseiten haben kein Reel
      const base = 'assets/'; // HSK-PATCH 1: Clips aus dem Repo
      const clips = [['cine-rise', '08 / 10 — KATHEDRALE'], ['cine-descent', '01 / 10 — ABSTIEG'], ['cine-push', '02 / 10 — HALLE'], ['cine-lift', '03 / 10 — KREUZHEBEN'], ['cine-glide', '04 / 10 — SPIEGELWAND'], ['cine-sled', '05 / 10 — SPRINTBAHN'], ['cine-orbit', '06 / 10 — PLATTFORM'], ['cine-plates', '07 / 10 — SCHEIBEN'], ['v-crane', '09 / 10 — WEITE'], ['cine-grip', '10 / 10 — GRIFF']];
      // HSK-PATCH 8: Hochkant-Clips auf dem Telefon
      const portrait = !!(window.matchMedia && window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches);
      const mobileClips = [['m-racks', '01 / 04 — RACKS'], ['m-platform', '02 / 04 — PLATTFORM'], ['m-cardio', '03 / 04 — AUSDAUER'], ['m-sprint', '04 / 04 — SPRINTBAHN']];
      const list = portrait ? mobileClips : clips;
      this.reel = { base, clips: list, i: 0, layer: 0, hold: 4600, t0: performance.now(), timer: 0, fails: 0, paused: false, swapping: false };
      this.reel.portrait = portrait;
      const v0 = document.querySelector('[data-reel-layer="0"]');
      if (v0 && portrait && v0.dataset.posterMobile) v0.setAttribute('poster', v0.dataset.posterMobile);
      const lab0 = document.querySelector('[data-reel-label]'); if (lab0) lab0.textContent = list[0][1];
      // HSK-PATCH 3: Save-Data / 2G → das Posterbild bleibt, kein Videoabruf
      const conn = navigator.connection;
      if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) {
        if (v0) { v0.removeAttribute('autoplay'); v0.preload = 'none'; }
        this.reel.paused = true; this.reel.saveData = true; return;
      }
      // Quelle erst setzen, wenn der Hero im Bild ist (sonst lädt ein Anker-Aufruf ins Leere);
      // setReelPaused(false) holt sie nach, sobald jemand hochscrollt
      // (der Sprung zum Anker passiert in Chromium erst nach DOMContentLoaded — der Hash zählt deshalb mit)
      const offscreen = (window.scrollY || 0) >= (window.innerHeight || 1) || (!!location.hash && location.hash !== '#top');
      if (v0 && !v0.getAttribute('src') && !offscreen) {
        v0.src = (portrait && v0.dataset.srcMobile) || v0.dataset.src;
        v0.muted = true; v0.loop = true; const pr = v0.play(); if (pr && pr.catch) pr.catch(() => {});
      }
      this.reelTick = () => {
        if (!this._alive) return;
        const r = this.reel;
        if (!r.paused) {
          const el = (performance.now() - r.t0) / 1000;
          const tc = document.querySelector('[data-tc]');
          if (tc) { const h = Math.floor(el / 3600), m = Math.floor(el / 60) % 60, s = Math.floor(el) % 60, f = Math.floor((el % 1) * 25); tc.textContent = [h, m, s, f].map((n) => String(n).padStart(2, '0')).join(':'); }
          const prog = Math.min(1, (performance.now() - r.cutAt) / r.hold);
          document.querySelectorAll('[data-seg]').forEach((seg, k) => {
            const fill = seg.firstElementChild; if (!fill) return;
            const clipIdx = parseInt(r.clips[r.i][1], 10) - 1;
            fill.style.transform = k < clipIdx ? 'scaleX(1)' : (k === clipIdx ? 'scaleX(' + prog.toFixed(3) + ')' : 'scaleX(0)');
          });
        }
        this._reelRaf = requestAnimationFrame(this.reelTick);
      };
      this.reel.cutAt = performance.now();
      this._reelRaf = requestAnimationFrame(this.reelTick);
      // HSK-PATCH 12
      this.reel.noCuts = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if ((window.scrollY || 0) >= (window.innerHeight || 1) || (!!location.hash && location.hash !== '#top')) { this.setReelPaused(true); return; }
      if (!this.reel.noCuts) this.scheduleCut();
    }
    scheduleCut(delay) {
      const r = this.reel; if (!r) return;
      clearTimeout(r.timer);
      r.timer = setTimeout(() => this.cut(), delay == null ? r.hold : delay);
    }
    cut() {
      const r = this.reel; if (!r || !this._alive || r.paused || r.swapping) return;
      const next = (r.i + 1) % r.clips.length;
      const cur = document.querySelector('[data-reel-layer="' + r.layer + '"]');
      const nxt = document.querySelector('[data-reel-layer="' + (1 - r.layer) + '"]');
      if (!cur || !nxt) return;
      r.swapping = true;
      let done = false;
      const finish = (ok) => {
        if (done) return; done = true;
        nxt.removeEventListener('canplay', onReady); nxt.removeEventListener('error', onErr);
        r.swapping = false;
        if (!ok) { r.fails++; r.i = next; if (r.fails < r.clips.length) this.scheduleCut(0); return; }
        r.fails = 0;
        nxt.style.opacity = '1'; nxt.style.transform = 'scale(1)';
        cur.style.opacity = '0';
        const flash = document.querySelector('[data-flash]');
        if (flash) { flash.style.transition = 'none'; flash.style.opacity = '.55'; requestAnimationFrame(() => { flash.style.transition = 'opacity .45s ease'; flash.style.opacity = '0'; }); }
        const label = document.querySelector('[data-reel-label]'); if (label) label.textContent = r.clips[next][1];
        setTimeout(() => { if (!cur.paused) cur.pause(); cur.style.transform = 'scale(1.08)'; }, 800);
        r.i = next; r.layer = 1 - r.layer; r.cutAt = performance.now();
        this.scheduleCut();
      };
      const onReady = () => { const pr = nxt.play(); if (pr && pr.then) pr.then(() => finish(true)).catch(() => finish(false)); else finish(true); };
      const onErr = () => finish(false);
      nxt.addEventListener('canplay', onReady, { once: true });
      nxt.addEventListener('error', onErr, { once: true });
      nxt.muted = true; nxt.loop = true;
      nxt.preload = 'auto'; // HSK-PATCH 9
      nxt.src = r.base + r.clips[next][0] + '.mp4';
      nxt.load();
      setTimeout(() => { if (!done) finish(false); }, 9000);
    }
    toggleReel() {
      const r = this.reel; if (!r || r.saveData) return;
      r.userPaused = !r.userPaused;
      this.setReelPaused(r.userPaused || (window.scrollY || 0) >= (window.innerHeight || 1));
      document.documentElement.dataset.reel = r.userPaused ? 'paused' : 'playing';
      const b = document.querySelector('[data-reel-toggle]');
      if (b) {
        b.setAttribute('aria-pressed', r.userPaused ? 'true' : 'false');
        b.setAttribute('aria-label', r.userPaused ? 'Film abspielen' : 'Film anhalten');
        const t = b.querySelector('[data-reel-toggle-text]'); if (t) t.textContent = r.userPaused ? 'PAUSE' : 'REC';
      }
    }
    setReelPaused(paused) {
      const r = this.reel; if (!r || r.saveData || r.paused === paused) return; // HSK-PATCH 3c
      r.paused = paused;
      document.querySelectorAll('[data-reel-layer]').forEach((v, k) => {
        if (paused) { if (!v.paused) v.pause(); }
        else if (k === r.layer) {
          if (!v.getAttribute('src') && v.dataset.src) v.src = (r.portrait && v.dataset.srcMobile) || v.dataset.src; // HSK-PATCH 12b
          v.muted = true; v.loop = true; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
        }
      });
      if (paused) clearTimeout(r.timer); else if (!r.noCuts) { r.cutAt = performance.now(); this.scheduleCut(); }
    }
    componentWillUnmount() {
      this._alive = false; clearTimeout(this._t1); clearInterval(this._clock);
      clearTimeout(this._fb); if (this.reel) clearTimeout(this.reel.timer); if (this._reelRaf) cancelAnimationFrame(this._reelRaf);
      window.removeEventListener('scroll', this._onScroll); window.removeEventListener('resize', this._onScroll); window.removeEventListener('keydown', this._onKey);
      ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((ev) => window.removeEventListener(ev, this._unlock, true));
      document.documentElement.style.overflow = '';
    }
    playAll() {
      // HSK-PATCH 10: die Reel-Ebenen nur anstoßen, wenn das Reel läuft und es die aktive Ebene ist
      const r = this.reel;
      document.querySelectorAll('video[autoplay]').forEach((v) => {
        if (v.hasAttribute('data-reel-layer')) {
          if (!r || r.paused || r.userPaused || r.saveData || String(r.layer) !== v.getAttribute('data-reel-layer') || !v.getAttribute('src')) return;
        }
        v.muted = true; v.loop = true; const p = v.play(); if (p && p.catch) p.catch(() => {});
      });
    }
    setMenu(open) {
      // HSK-PATCH 6: Fokus wandert ins Menü und zurück, der Rest der Seite ist derweil inert
      const ae = document.activeElement;
      const wasInOverlay = !!(ae && ae.closest && ae.closest('[data-overlay]'));
      this.setState({ menu: open });
      document.documentElement.style.overflow = open ? 'hidden' : '';
      document.documentElement.dataset.menu = open ? 'open' : 'closed';
      const btn = document.querySelector('[data-burger]');
      if (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü'); }
      document.querySelectorAll('main, footer, [data-mbar], [data-navlinks]').forEach((el) => { try { el.inert = open; } catch (e) {} });
      if (open) { const first = document.querySelector('[data-overlay] a'); if (first) first.focus(); }
      else if (wasInOverlay && btn) btn.focus();
    }
    sync() {
      const y = window.scrollY || 0, vh = window.innerHeight || 1;
      const total = Math.max(1, document.documentElement.scrollHeight - vh);
      const prog = y / total;
      const scrl = document.querySelector('[data-scrl]');
      if (scrl) scrl.textContent = 'SCRL ' + String(Math.round(prog * 100)).padStart(2, '0') + '%';
      const mbar = document.querySelector('[data-mbar]');
      if (mbar) { const on = y > vh * 0.85; mbar.style.transform = on ? 'translate3d(0,0,0)' : 'translate3d(0,110%,0)'; mbar.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1)'; }
      const bar = document.querySelector('[data-progress]');
      if (bar) bar.style.transform = 'scaleX(' + prog.toFixed(4) + ')';
      const p = Math.min(1, Math.max(0, y / vh));
      this.heroFx(p);
      const nav = document.querySelector('[data-nav]');
      if (nav) { const on = y > (document.querySelector('[data-hero-video]') ? vh * 0.9 : 24); nav.style.background = on ? 'rgba(5,5,6,.72)' : 'transparent'; nav.style.backdropFilter = on ? 'blur(14px)' : 'none'; nav.style.webkitBackdropFilter = on ? 'blur(14px)' : 'none'; /* HSK-PATCH 5 */ nav.style.borderBottom = on ? '1px solid rgba(255,255,255,.08)' : '1px solid transparent'; }
      document.querySelectorAll('[data-px]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const c = (r.top + r.height / 2) - vh / 2;
        el.style.transform = 'translate3d(0,' + (c * parseFloat(el.dataset.px) / 100).toFixed(1) + 'px,0)';
      });
      this.areasFx(vh);
      this.wipeFx(vh);
    }
    heroFx(p) {
      const q = 1 - Math.pow(1 - p, 3);
      const red = document.querySelector('[data-red]');
      if (red) red.style.transform = 'translate3d(' + (-q * 104).toFixed(2) + '%,0,0)';
      const vid = document.querySelector('[data-hero-video]');
      if (vid) vid.style.transform = 'scale(' + (1.12 - q * 0.1).toFixed(3) + ')';
      this.setReelPaused(p >= 1 || !!(this.reel && this.reel.userPaused)); // HSK-PATCH 13
      const scrim = document.querySelector('[data-hero-scrim]');
      if (scrim) scrim.style.opacity = String(0.5 + q * 0.5);
      const hud = document.querySelector('[data-hero-hud]');
      if (hud) hud.style.opacity = String(Math.max(0, 1 - p * 2.4));
      const after = document.querySelector('[data-hero-after]');
      if (after) { const a = Math.min(1, Math.max(0, (p - 0.45) * 2.2)); after.style.opacity = String(a); after.style.transform = 'translate3d(0,' + ((1 - a) * 40).toFixed(1) + 'px,0)'; }
      const logo = document.querySelector('[data-nav-logo]');
      if (logo) logo.style.filter = p > 0.5 ? 'none' : 'brightness(0) invert(1)';
      this._overRed = p < 0.5;
    }
    areasFx(vh) {
      const sec = document.querySelector('[data-areas]');
      if (!sec) return;
      const r = sec.getBoundingClientRect();
      // HSK-PATCH 11: außerhalb des Sichtfelds kein Bereichs-Video
      if (r.top > vh || r.bottom < 0) {
        if (this._activeArea !== -1) { this._activeArea = -1; document.querySelectorAll('[data-area-media] video').forEach((v) => { if (!v.paused) v.pause(); }); }
        return;
      }
      const span = r.height - vh;
      const p = Math.min(0.999, Math.max(0, -r.top / Math.max(1, span)));
      const idx = Math.min(2, Math.floor(p * 3));
      if (idx === this._activeArea) return;
      this._activeArea = idx;
      const labels = ['03 / 10 — KREUZHEBEN', '05 / 10 — SPRINTBAHN', '07 / 10 — AUSDAUER'];
      document.querySelectorAll('[data-area-row]').forEach((row, i) => {
        const on = i === idx;
        const name = row.querySelector('[data-area-name]'), copy = row.querySelector('[data-area-copy]'), barEl = row.querySelector('[data-area-bar]');
        if (name) name.style.color = on ? '#F2EFEA' : '#5A5A62';
        if (copy) { copy.style.maxHeight = on ? '160px' : '0px'; copy.style.opacity = on ? '1' : '0'; copy.style.marginTop = on ? '14px' : '0px'; }
        if (barEl) barEl.style.transform = on ? 'scaleY(1)' : 'scaleY(0)';
      });
      document.querySelectorAll('[data-area-media]').forEach((m, i) => {
        const on = i === idx;
        m.style.opacity = on ? '1' : '0';
        const v = m.querySelector('video');
        if (!v) return;
        if (on) { if (!v.getAttribute('src')) v.src = v.dataset.src; v.muted = true; v.loop = true; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); v.style.opacity = '1'; }
        else if (!v.paused) { v.pause(); }
      });
      const count = document.querySelector('[data-area-count]'); if (count) count.textContent = '0' + (idx + 1) + ' / 03';
      const label = document.querySelector('[data-area-label]'); if (label) label.textContent = labels[idx];
    }
    wipeFx(vh) {
      const sec = document.querySelector('[data-eq]');
      const w = document.querySelector('[data-wipe]');
      if (!sec || !w) return;
      const r = sec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - (r.bottom - vh) / vh));
      const q = 1 - Math.pow(1 - p, 2);
      w.style.clipPath = 'inset(' + ((1 - q) * 100).toFixed(2) + '% 0 0 0)';
      const t = w.querySelector('[data-wipe-title]');
      if (t) t.style.transform = 'translate3d(0,' + ((1 - q) * 60).toFixed(1) + 'px,0)';
    }
    renderVals() {
      // HSK-PATCH 14
      let h = new Date().getHours();
      try {
        // de-DE formatiert „12 Uhr" — deshalb formatToParts statt Number(format())
        const part = new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin' }).formatToParts(new Date()).find((p) => p.type === 'hour');
        const bh = part ? parseInt(part.value, 10) : NaN;
        if (!isNaN(bh)) h = bh % 24;
      } catch (e) {}
      const open = h >= 6;
      return {
        booting: this.state.booting,
        menu: this.state.menu,
        mapOn: this.state.mapOn,
        mapOff: !this.state.mapOn,
        statusText: open ? 'JETZT GEÖFFNET · BIS 24 UHR' : 'GESCHLOSSEN · ÖFFNET 06 UHR',
        navHover: (e) => {
          const el = e.currentTarget, red = document.querySelector('[data-red]');
          let onRed = false;
          if (this._overRed && red) {
            const a = el.getBoundingClientRect(), r = red.getBoundingClientRect();
            onRed = a.left < r.right - 4 && a.right > r.left + 4 && a.top < r.bottom - 4 && a.bottom > r.top + 4;
          }
          el.style.color = onRed ? '#050506' : '#E10600';
        },
        navOut: (e) => { e.currentTarget.style.color = '#F2EFEA'; },
        toggleMenu: () => this.setMenu(!this.state.menu),
        closeMenu: () => this.setMenu(false),
        loadMap: () => { try { localStorage.setItem('hsk.map.consent', '1'); } catch (e) {} this.setState({ mapOn: true }); const l = document.querySelector('[data-map-open]'); if (l) l.focus(); }, // HSK-PATCH 4
        goArea: (e) => {
          const i = parseInt(e.currentTarget.dataset.areaRow, 10);
          const sec = document.querySelector('[data-areas]');
          if (!sec) return;
          const vh = window.innerHeight, top = sec.getBoundingClientRect().top + window.scrollY;
          const span = sec.offsetHeight - vh;
          window.scrollTo({ top: top + span * (i / 3 + 0.08), behavior: 'smooth' });
        },
        toggleFaq: (e) => {
          const head = e.currentTarget, body = head.nextElementSibling, icon = head.querySelector('[data-faq-icon]');
          const open = body.style.maxHeight && body.style.maxHeight !== '0px';
          document.querySelectorAll('[data-faq-body]').forEach((b) => { b.style.maxHeight = '0px'; });
          document.querySelectorAll('[data-faq-icon]').forEach((i) => { i.style.transform = 'rotate(0deg)'; });
          if (!open) { body.style.maxHeight = body.scrollHeight + 'px'; if (icon) icon.style.transform = 'rotate(45deg)'; }
        },
        eqEnter: (e) => {
          const v = e.currentTarget.querySelector('video');
          if (!v) return;
          if (!v.getAttribute('src')) v.src = v.dataset.src;
          v.muted = true; v.loop = true; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
          v.style.opacity = '1';
        },
        eqLeave: (e) => {
          const v = e.currentTarget.querySelector('video');
          if (!v) return;
          v.style.opacity = '0'; if (!v.paused) v.pause();
        }
      };
    }
  }

  /* ---------------------------------------------------------- Runtime-Shim */
  var app = new Component();

  function vals() { try { return app.renderVals() || {}; } catch (e) { return {}; } }

  /* Karte: der iframe trägt data-src und bekommt src erst, wenn sein Block
     sichtbar wird — also nach dem Klick (oder mit gemerkter Einwilligung).
     Der Link darüber öffnet den Ort in der Karten-App: Apple Karten auf
     Apple-Geräten, sonst Google Maps. Das iframe selbst schluckt Klicks. */
  function armMap(block) {
    var frame = block.querySelector('[data-map-frame]');
    if (!frame) return;
    if (!frame.getAttribute('src')) frame.setAttribute('src', frame.getAttribute('data-src'));
    var wrap = frame.parentElement;
    if (!wrap || wrap.querySelector('[data-map-open]')) return;
    var q = 'HSK Performance Center, Strackestraße 22, 59929 Brilon';
    var apple = false;
    try { apple = /Apple/.test(navigator.vendor || ''); } catch (e) {}
    var a = document.createElement('a');
    a.setAttribute('data-map-open', '');
    a.href = apple ? 'https://maps.apple.com/?q=' + encodeURIComponent(q)
                   : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    var label = document.createElement('span'); label.textContent = 'In Karten öffnen';
    var arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    a.appendChild(label); a.appendChild(arrow);
    wrap.appendChild(a);
  }

  app.__render = function () {
    var v = vals();
    var ifs = document.querySelectorAll('[data-if]');
    for (var i = 0; i < ifs.length; i++) {
      var name = ifs[i].getAttribute('data-if');
      var on = (name in v) ? v[name] : app.state[name];
      ifs[i].style.display = on ? 'contents' : 'none';
      if (on && name === 'mapOn') armMap(ifs[i]);
    }
    var texts = document.querySelectorAll('[data-text]');
    for (var j = 0; j < texts.length; j++) {
      var t = v[texts[j].getAttribute('data-text')];
      if (t != null && texts[j].textContent !== String(t)) texts[j].textContent = String(t);
    }
  };

  /* onClick="{{ fn }}" aus dem Design → data-on-click="fn" → echter Listener.
     Die Handler entstehen in renderVals() als Closures; sie werden je Ereignis
     frisch geholt, damit sie immer den aktuellen Zustand sehen. */
  var lastPointer = 'mouse';
  window.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; }, { capture: true, passive: true });

  function wire() {
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i], attrs = el.attributes;
      for (var k = 0; k < attrs.length; k++) {
        var n = attrs[k].name;
        if (n.indexOf('data-on-') !== 0) continue;
        (function (el, ev, fn) {
          el.addEventListener(ev, function (e) {
            // Auf Touch feuern pointerenter und pointerleave beide beim Tippen —
            // der Clip wäre an und wieder aus, bevor man ihn sieht. Dort
            // schaltet stattdessen der Tipp um (click, unten).
            if ((ev === 'pointerenter' || ev === 'pointerleave') && e.pointerType === 'touch') return;
            var h = vals()[fn]; if (typeof h === 'function') h(e);
          });
          if (ev === 'pointerenter' && fn === 'eqEnter') {
            el.addEventListener('click', function (e) {
              if (lastPointer !== 'touch') return;
              if (e.target.closest && e.target.closest('a')) return;
              var v = el.querySelector('video');
              var h = vals()[v && v.style.opacity === '1' ? 'eqLeave' : 'eqEnter'];
              if (typeof h === 'function') h({ currentTarget: el });
            });
          }
          // Tastatur: klickbare <div>s (FAQ, Bereiche) reagieren auf Enter/Leertaste
          if (ev === 'click' && el.getAttribute('role') === 'button') {
            el.addEventListener('keydown', function (e) {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault(); el.click();
            });
          }
        })(el, n.slice(8), attrs[k].value);
      }
    }
    // FAQ: aria-expanded am Knopf und aria-hidden am Text folgen dem sichtbaren Zustand
    document.addEventListener('click', function () {
      var heads = document.querySelectorAll('[data-faq-head]');
      for (var i = 0; i < heads.length; i++) {
        var body = heads[i].nextElementSibling, btn = heads[i].querySelector('[data-faq-btn]');
        var open = !!(body && body.style.maxHeight && body.style.maxHeight !== '0px');
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (body) body.setAttribute('aria-hidden', open ? 'false' : 'true');
      }
    });
    // Hero-HUD: REC-Knopf hält Film und Laufschriften an
    var tg = document.querySelector('[data-reel-toggle]');
    if (tg) tg.addEventListener('click', function () { if (app.toggleReel) app.toggleReel(); });
  }

  /* Formular („Mitglied werden"): die Seite ist statisch, es gibt keinen
     Server. Die Anfrage wird als fertiger E-Mail-Entwurf an das Mailprogramm
     des Besuchers übergeben; derselbe Entwurf bleibt als Button auf dem
     Bestätigungsfeld, damit ein fehlendes Mailprogramm keine Sackgasse ist.
     Nichts wird gespeichert, nichts wird an Dritte gesendet. */
  var FORM_MODE = "mailto";
  var MAIL_TO = 'sb@hsk.fitness';

  function draft(form) {
    var d = new FormData(form);
    var get = function (k) { return (d.get(k) || '').toString().trim(); };
    var ziel = get('ziel') || 'Probetraining';
    var body = [
      'Name:      ' + get('name'),
      'E-Mail:    ' + get('email'),
      'Telefon:   ' + (get('tel') || '—'),
      'Anliegen:  ' + ziel,
      '',
      'Nachricht:',
      get('msg') || '—'
    ].join('\r\n');
    return 'mailto:' + MAIL_TO +
      '?subject=' + encodeURIComponent('Anfrage über die Website — ' + ziel) +
      '&body=' + encodeURIComponent(body);
  }

  function bootForm() {
    var form = document.querySelector('[data-form]');
    if (!form) return;
    app.state.sent = false; app.state.notSent = true;
    // ?ziel=jahr|halbjahr|monat|coaching|partner|probetraining wählt das Anliegen vor
    try {
      var want = new URLSearchParams(location.search).get('ziel');
      var sel = form.querySelector('[data-ziel]');
      if (want && sel) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].getAttribute('data-key') === want) { sel.selectedIndex = i; break; }
        }
      }
    } catch (e) {}
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
      if (FORM_MODE !== 'mailto') { app.setState({ sent: true, notSent: false }); return; }
      var url;
      try { url = draft(form); } catch (err) { return; }
      var link = document.querySelector('[data-sent-mail]');
      if (link) link.setAttribute('href', url);
      app.setState({ sent: true, notSent: false });
      var panel = document.querySelector('[data-if="sent"]');
      var box = panel && panel.firstElementChild;
      if (box) {
        // Statusmeldung für Hilfstechnik + Fokus, der sonst mit dem Formular verschwände
        box.setAttribute('role', 'status'); box.setAttribute('tabindex', '-1');
        try { box.focus({ preventScroll: true }); } catch (err) {}
        if (box.scrollIntoView) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      // dem Bestätigungsfeld einen Moment zum Zeichnen lassen, bevor das
      // Mailprogramm den Fokus nimmt
      setTimeout(function () { try { window.location.href = url; } catch (err) {} }, 350);
    });
  }

  function boot() {
    wire();
    bootForm();
    app.__render();
    app.componentDidMount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HSK = app;
})();
