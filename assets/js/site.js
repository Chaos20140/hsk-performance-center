/* HSK Performance Center — page behaviour.
   Extracted verbatim from the Claude Design source; the design-runtime harness
   (DCLogic / React) is replaced by the small shim at the bottom of this file.
   Patched sections are marked with "HSK-PATCH". */
(function () {
  'use strict';

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { Object.assign(this.state, patch); if (this.__render) this.__render(); }
  }

  
  class Component extends DCLogic {
    state = { sent: false };
  
    renderVals() {
      return {
        sent: this.state.sent,
        notSent: !this.state.sent,
        onSubmit: (e) => { e.preventDefault(); this.setState({ sent: true }); }
      };
    }
  
    get motion() {
      const m = this.props.motionLevel || 'Kräftig';
      return m === 'Dezent' ? 0.45 : m === 'Maximal' ? 1.5 : 1;
    }
  
    accentHex() {
      const a = this.props.accent;
      return (typeof a === 'string' && /^#[0-9a-f]{6}$/i.test(a)) ? a : '#E10600';
    }
  
    applyTheme() {
      const acc = this.accentHex();
      const r = document.querySelector('[data-root]');
      if (r) r.style.setProperty('--acc', acc);
      document.documentElement.style.setProperty('--acc', acc);
      const g = document.querySelector('[data-grain]');
      if (g) g.style.display = this.props.grain === false ? 'none' : 'block';
    }
  
    componentDidMount() {
      this.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      this.fine = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
      this.applyTheme();
      this.applyResponsive();
      this.bootLoader();
      this.bootReel();
      this.bootLive();
      this.bootLightbox();
      this.bootAreas();
      this.bootBgVideos();
      this.bootCursor();
      this.bootMagnet();
      this.bootCounts();
      this.bootStatus();
      this.bootDelegates();
      this.bootLoop();
      this.armGestureUnlock();
    }
  
    componentDidUpdate() {
      this.applyTheme();
      this.applyResponsive();
      this.refreshAreas();
      this.unpauseBrand();
      if (this._heroShown) this.revealHero();
      // a template re-render replaces the loader node with a fresh, unwired one; without
      // this the overlay would stay up and hold the scroll lock forever
      this.bootLoader();
    }
  
    componentWillUnmount() {
      clearInterval(this._poll); clearInterval(this._clock); clearTimeout(this._loaderKill); clearTimeout(this._lockKill);
      clearTimeout(this._lbSwap); clearTimeout(this._lbHide);
      document.removeEventListener('click', this._onLbClick, true);
      document.removeEventListener('keydown', this._onLbKey);
      document.documentElement.style.overflow = '';
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._io) this._io.disconnect();
      if (this._bgIo) this._bgIo.disconnect();
      if (this._ro) this._ro.disconnect();
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('load', this._onResize);
      window.removeEventListener('scroll', this._onScroll, true);
      window.removeEventListener('mousemove', this._onMove);
      document.removeEventListener('visibilitychange', this._onVis);
      document.removeEventListener('keydown', this._onKey);
      document.removeEventListener('click', this._onClick, true);
      document.removeEventListener('mouseenter', this._onEnter, true);
      document.removeEventListener('mouseleave', this._onLeave, true);
      document.removeEventListener('mousemove', this._onMagMove);
      document.removeEventListener('mouseenter', this._onBrandEnter, true);
      clearTimeout(this._brandT);
    }
  
    /* ---------- magnetic CTAs: the button leans toward the pointer ---------- */
    bootMagnet() {
      if (!this.fine) return;
      this._onMagMove = (e) => {
        const el = e.target && e.target.closest ? e.target.closest('[data-magnet]') : null;
        if (this._mag && this._mag !== el) {
          this._mag.style.setProperty('transform', 'translate3d(0,0,0)', 'important');
          this._mag = null;
        }
        if (!el) return;
        this._mag = el;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.34;
        el.style.setProperty('transition', 'transform .22s cubic-bezier(.16,1,.3,1),box-shadow .4s ease,background .4s ease,border-color .4s ease', 'important');
        el.style.setProperty('transform', 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)', 'important');
      };
      document.addEventListener('mousemove', this._onMagMove, { passive: true });
    }
  
    clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  
    /* Autoplay can be refused even for muted+playsinline video: the element then sits at
       readyState 4 and paused, which reads as a frozen still. Remember everything that
       wanted to play and retry on the first user gesture, which lifts the block. */
    playSafe(v) {
      if (!v) return;
      if (!this._wanted) this._wanted = new Set();
      this._wanted.add(v);
      const p = v.play();
      if (p && p.catch) p.catch(() => { this.armGestureUnlock(); });
    }
  
    armGestureUnlock() {
      if (this._unlockArmed) return;
      this._unlockArmed = true;
      const unlock = () => {
        if (!this._wanted) return;
        this._wanted.forEach((v) => {
          if (!v.isConnected) { this._wanted.delete(v); return; }
          if (v.style.opacity === '0') return;
          const q = v.play();
          if (q && q.catch) q.catch(() => {});
        });
      };
      ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach((ev) => {
        window.addEventListener(ev, unlock, { passive: true, once: true, capture: true });
      });
    }
  
    /* ---------- loading screen ---------- */
    bootLoader() {
      const el = document.querySelector('[data-loader]');
      if (!el || el.dataset.booted) return;
      el.dataset.booted = '1';
      // HSK-PATCH: script is alive, so it owns the curtain — drop the CSS failsafe
      el.style.animation = 'none';
      this._locked = true;
      document.documentElement.style.overflow = 'hidden';
      // the hero entrance is armed by the curtain, never by page load — otherwise it
      // plays behind the loader and the visitor sees a headline that has already landed
      this.armHero();
      clearTimeout(this._heroKill);
      this._heroKill = setTimeout(() => this.revealHero(), 2100);
      // independent of the progress loop: the lock always lifts, even when rAF is
      // throttled or the logic class reloads mid-run
      clearTimeout(this._lockKill);
      this._lockKill = setTimeout(() => {
        this._locked = false;
        this.igniteBrand();
        if (!this._menuOpen) document.documentElement.style.overflow = '';
        // timers keep firing where rAF and CSS animations are throttled, so this is the
        // one path guaranteed to clear the overlay
        this.revealHero();
        const node = document.querySelector('[data-loader]');
        if (node) {
          node.style.opacity = '0';
          node.style.visibility = 'hidden';
          node.style.pointerEvents = 'none';
        }
      }, 5200);
  
      const bar = el.querySelector('[data-loader-bar]');
      const pct = el.querySelector('[data-loader-pct]');
      const imgs = Array.from(document.images).filter(i => i.getAttribute('loading') !== 'lazy');
      const MIN = 1500, MAX = 4200, HARD = 6000;
      const t0 = performance.now();
      let shown = 0, finished = false;
  
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this._fontsReady = true; this.applyResponsive(); });
      else this._fontsReady = true;
  
      const ratio = () => imgs.length ? imgs.filter(i => i.complete && i.naturalWidth > 0).length / imgs.length : 1;
  
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(this._loaderKill);
        if (bar) bar.style.width = '100%';
        if (pct) pct.textContent = '100';
        setTimeout(() => {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          this.revealHero();
          this._locked = false;
          if (!this._menuOpen) document.documentElement.style.overflow = '';
          setTimeout(() => { el.style.visibility = 'hidden'; }, 950);
          this.armReel();
          this._lastTop = null;
          this.syncDom();
        }, 400);
      };
  
      const tick = () => {
        if (finished) return;
        const dt = performance.now() - t0;
        const a = ratio();
        const target = Math.min(1, a * 0.86 + Math.min(1, dt / MIN) * 0.14 + (this._fontsReady ? 0.02 : 0));
        shown += (target - shown) * 0.12;
        const v = Math.min(99, Math.round(shown * 100));
        if (bar) bar.style.width = v + '%';
        if (pct) pct.textContent = (v < 10 ? '0' : '') + v;
        if ((a > 0.995 && this._fontsReady && dt > MIN) || dt > MAX) { finish(); return; }
        requestAnimationFrame(tick);
      };
  
      this._loaderKill = setTimeout(finish, HARD);
      requestAnimationFrame(tick);
    }
  
    // Setting the resting value directly (rather than running a keyframe animation) means
    // a throttled timeline can only cost the motion, never the text: the property still
    // commits, so the headline is present either way.
    // Arm the entrance only in a document that is actually painting. A frozen timeline
    // would otherwise hold the headline at its start frame forever, so the safe default
    // is "already arrived" and the motion is the addition, not the prerequisite.
    armHero() {
      if (this._heroArmed || document.hidden || this.reduced) return;
      this._heroArmed = true;
      document.querySelectorAll('[data-hero-line]').forEach((el) => {
        el.style.transform = 'translateY(112%)';
        el.style.transition = 'transform 1.15s cubic-bezier(.16,1,.3,1) ' + (el.dataset.delay || 0) + 'ms';
      });
      const logo = document.querySelector('[data-hero-logo-img]');
      if (logo) {
        logo.style.opacity = '0';
        logo.style.transform = 'scale(.92) translateY(14px)';
        logo.style.transition = 'opacity 1s ease .1s,transform 1.2s cubic-bezier(.16,1,.3,1) .1s';
      }
      const glow = document.querySelector('[data-hero-glow]');
      if (glow) {
        glow.style.opacity = '0';
        glow.style.transform = 'scale(.7)';
        glow.style.transition = 'opacity 1.2s ease .2s,transform 1.4s cubic-bezier(.16,1,.3,1) .2s';
      }
    }
  
    // the wordmark is held paused until the loader clears, so the detonation is the first
    // thing that happens on the real page rather than playing behind the curtain
    // re-assert after a render, which restores the template's paused state on new nodes
    unpauseBrand() {
      if (!this._brandLit) return;
      document.querySelectorAll('[data-brand-word] span, [data-navlink]').forEach((s) => {
        if (s.style.getPropertyValue('animation-play-state') !== 'running') {
          s.style.setProperty('animation-play-state', 'running', 'important');
        }
      });
    }
  
    igniteBrand() {
      if (this._brandLit) return;
      this._brandLit = true;
      // !important: a plain assignment is re-applied as "paused" from the template on the
      // next React render, which is why the detonation never played
      // every nav item slides out from the logo's actual position, so the bar
      // literally grows out of the mark
      const logo = document.querySelector('[data-brand-logo]');
      const lr = logo && logo.getBoundingClientRect();
      if (lr) {
        const cx = lr.left + lr.width / 2;
        document.querySelectorAll('[data-navlink], [data-cta-pill], [data-menu-btn]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width) el.style.setProperty('--nx', (cx - (r.left + r.width / 2)).toFixed(1) + 'px');
        });
      }
      document.querySelectorAll('[data-nav-bar], [data-brand-word] span, [data-navlink], [data-emerge]').forEach((s) => {
        s.style.setProperty('animation-play-state', 'running', 'important');
      });
      const ring = document.querySelector('[data-brand-ring]');
      if (ring) ring.style.animation = 'hs-shock 1s cubic-bezier(.16,1,.3,1) .3s both';
      const glow = document.querySelector('[data-brand-glow]');
      if (glow) glow.style.setProperty('animation', 'hs-glow 1.2s ease-out .35s both', 'important');
    }
  
    // a short neon power-surge on the nav mark: hover, and once per film chapter
    surgeBrand() { /* the mark stays still after its entrance — no pulsing */ }
  
    revealHero() {
      this.igniteBrand();
      this._heroShown = true;
      if (!this._heroArmed) return;
      // !important, because a later render re-applies the template's style attribute
      document.querySelectorAll('[data-hero-line]').forEach((el) => {
        el.style.setProperty('transform', 'none', 'important');
      });
      const logo = document.querySelector('[data-hero-logo-img]');
      if (logo) {
        logo.style.setProperty('opacity', '1', 'important');
        logo.style.setProperty('transform', 'scale(1) translateY(0)', 'important');
      }
      const glow = document.querySelector('[data-hero-glow]');
      if (glow) {
        glow.style.setProperty('opacity', '.5', 'important');
        glow.style.setProperty('transform', 'scale(1)', 'important');
      }
    }
  
    /* ---------- hero reel: hard cuts between continuous takes ---------- */
    bootReel() {
      const stage = document.querySelector('[data-reel]');
      if (!stage || stage.dataset.booted) return;
      stage.dataset.booted = '1';
      // HSK-PATCH: phones get the portrait-native reel (9:16 clips, lighter payload)
      const portrait = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
      const shotAttr = (portrait && stage.dataset.shotsMobile) ? stage.dataset.shotsMobile : stage.dataset.shots;
      const labelAttr = (portrait && stage.dataset.labelsMobile) ? stage.dataset.labelsMobile : stage.dataset.labels;
      const shots = (shotAttr || '').split(',').map(s => this.res(s.trim())).filter(Boolean);
      const labels = (labelAttr || '').split(',').map(s => s.trim());
      const layers = Array.from(stage.querySelectorAll('[data-reel-layer]'));
      if (shots.length < 2 || layers.length < 2) return;
      this.reel = { stage, shots, labels, layers, i: 0, front: 0, started: false, armed: false,
                    poster: stage.querySelector('[data-reel-poster]') };
      layers.forEach((v) => {
        // each clip loops inside its own scroll chapter; the chapter itself is driven
        // by page progress, so the film runs the whole length of the document
        v.muted = true; v.playsInline = true; v.loop = true;
        v.addEventListener('error', () => this.advanceReel());
      });
    }
  
    armReel() {
      const r = this.reel;
      if (!r || r.armed) return;
      // HSK-PATCH: never pull video on a metered or very slow connection —
      // the poster frame stays and the page reads exactly the same
      const c = navigator.connection;
      if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) { r.armed = true; return; }
      // HSK-PATCH: a full-screen film that plays for minutes is exactly what
      // prefers-reduced-motion asks us not to do (WCAG 2.2.2). Poster only.
      if (this.reduced) { r.armed = true; return; }
      r.armed = true;
      r.layers[0].preload = 'auto';
      r.layers[1].preload = 'auto';
      r.layers[0].src = r.shots[0];
      r.layers[1].src = r.shots[1 % r.shots.length];
      r.want = 0;
      r.layers[0].addEventListener('loadeddata', () => {
        if (r.started) return;
        r.started = true;
        r.layers[0].style.opacity = '1';
        r.layers[0].style.transform = 'scale(1)';
        if (r.poster) r.poster.style.opacity = '0';
        this.playSafe(r.layers[0]);
        // pick up whatever chapter the page is already scrolled to
        this.syncReel(this.pageProgress());
      }, { once: true });
      this.paintShotMeta();
    }
  
    pad(n) { return (n < 10 ? '0' : '') + n; }
  
    paintShotMeta() {
      const r = this.reel;
      if (!r) return;
      const n = document.querySelector('[data-shot-name]');
      const i = document.querySelector('[data-shot-i]');
      if (n && r.labels[r.i] && n.textContent !== r.labels[r.i]) {
        n.textContent = r.labels[r.i];
        n.style.animation = 'none';
        void n.offsetWidth;
        n.style.animation = 'hs-roll .55s cubic-bezier(.16,1,.3,1) both';
        if (r.started) this.surgeBrand();
      }
      // index AND total both come from reel state, so adding a chapter can never desync them
      if (i) i.textContent = this.pad(r.i + 1);
      const tot = document.querySelector('[data-shot-total]');
      if (tot) tot.textContent = this.pad(r.shots.length);
    }
  
    advanceReel() { this.goToShot(this.reel ? this.reel.i + 1 : 0); }
  
    // record the wanted shot; the pump does the work and chases fast scrolling
    goToShot(idx) {
      const r = this.reel;
      if (!r || !r.started) return;
      const n = r.shots.length;
      r.want = ((idx % n) + n) % n;
      this.pumpReel();
    }
  
    // Cross-fade one step toward r.want. r.i and the on-screen label are only updated
    // once the new layer is actually visible, so the caption can never lead the picture;
    // after each dissolve it re-checks r.want, so skipping chapters still lands correctly.
    pumpReel() {
      const r = this.reel;
      if (!r || !r.started || r.busy) return;
      if (r.want == null || r.want === r.i) return;
      const n = r.shots.length;
      const target = r.want;
      const back = 1 - r.front;
      const cur = r.layers[r.front];
      const next = r.layers[back];
      const src = r.shots[target];
      r.busy = true;
      const TR = 'opacity 1.35s cubic-bezier(.4,0,.2,1),transform 1.7s cubic-bezier(.16,1,.3,1)';
      const land = () => {
        // incoming layer is parked slightly pushed-in (no transition), then settles to 1
        // while it fades up; the outgoing layer drifts on by a hair as it leaves
        next.style.transition = 'none';
        next.style.transform = 'scale(1.07)';
        void next.offsetWidth;
        next.style.transition = TR;
        cur.style.transition = TR;
        next.style.opacity = '1';
        next.style.transform = 'scale(1)';
        cur.style.opacity = '0';
        cur.style.transform = 'scale(1.035)';
        this.playSafe(next);
        r.front = back;
        r.i = target;
        clearTimeout(r.rel);
        r.rel = setTimeout(() => {
          try { cur.pause(); } catch (e) {}
          // the incoming layer is fully opaque only now, so this is the first moment the
          // caption can name it without getting ahead of the picture
          this.paintShotMeta();
          r.busy = false;
          this.pumpReel();
        }, 1400);
      };
      const already = (next.getAttribute('src') || '').indexOf(src) >= 0;
      if (already && next.readyState > 2) { try { next.currentTime = 0; } catch (e) {} land(); return; }
      next.src = src;
      next.addEventListener('loadeddata', land, { once: true });
      next.addEventListener('error', () => { r.busy = false; }, { once: true });
      // if the clip stalls, don't strand the film on a half-finished chapter
      clearTimeout(r.guard);
      r.guard = setTimeout(() => { if (r.busy && r.i !== target) { r.busy = false; this.pumpReel(); } }, 4000);
    }
  
    // page progress -> active shot, plus a slow drift within each chapter
    syncReel(p) {
      const r = this.reel;
      if (!r || !r.started) return;
      const n = r.shots.length;
      const q = Math.min(1, Math.max(0, p) / 0.88);
      const raw = Math.min(n - 0.0001, q * n);
      const idx = Math.floor(raw);
      const local = raw - idx;
      if (idx !== r.want) this.goToShot(idx);
      const inner = r.inner || (r.inner = r.stage.querySelector('[data-reel-inner]'));
      if (inner) inner.style.transform = 'scale(' + (1.03 + local * 0.09).toFixed(4) + ') translate3d(0,' + (local * -1.6).toFixed(2) + '%,0)';
    }
  
    /* ---------- full-screen menu overlay ---------- */
    setMenu(open) {
      this._menuOpen = open;
      const ov = document.querySelector('[data-overlay]');
      const lbl = document.querySelector('[data-menu-label]');
      const a = document.querySelector('[data-burger-a]');
      const b = document.querySelector('[data-burger-b]');
      const items = Array.from(document.querySelectorAll('[data-ov-item]'));
      const foot = document.querySelector('[data-ov-foot]');
      const media = document.querySelector('[data-ov-media]');
  
      if (ov) {
        ov.style.opacity = open ? '1' : '0';
        ov.style.visibility = open ? 'visible' : 'hidden';
      }
      if (lbl) lbl.textContent = open ? 'Schließen' : 'Menü';
      if (a) a.style.transform = open ? 'translateY(3.25px) rotate(45deg)' : 'none';
      if (b) b.style.transform = open ? 'translateY(-3.25px) rotate(-45deg)' : 'none';
  
      // staggered reveal, driven from JS so it replays on every open
      items.forEach((it, i) => {
        const t = it.querySelector('[data-ov-text]');
        if (!t) return;
        t.style.transitionDelay = open ? (0.1 + i * 0.06) + 's' : '0s';
        t.style.transform = open ? 'translateY(0)' : 'translateY(108%)';
      });
      if (foot) {
        foot.style.transition = 'opacity .6s ease .5s, transform .6s cubic-bezier(.16,1,.3,1) .5s';
        foot.style.opacity = open ? '1' : '0';
        foot.style.transform = open ? 'none' : 'translateY(16px)';
      }
      if (media) media.style.opacity = open ? '0.5' : '0';
  
      document.documentElement.style.overflow = (open || this._locked) ? 'hidden' : '';
      // HSK-PATCH: expose menu state for the mobile chrome + a11y
      document.documentElement.dataset.menu = open ? 'open' : 'closed';
      const btn = document.querySelector('[data-menu-btn]');
      if (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen'); }
      if (ov) ov.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
  
    setOvHover(item, on) {
      const t = item.querySelector('[data-ov-text]');
      if (t) t.style.color = on ? '#FFFFFF' : '#F4F2EF';
      if (!on) return;
      const img = document.querySelector('[data-ov-img]');
      const src = this.res(item.dataset.ovSrc);
      if (img && src && !img.src.endsWith(src)) {
        img.style.opacity = '0';
        setTimeout(() => { img.src = src; img.style.opacity = '1'; }, 180);
      }
    }
  
    /* ---------- pinned sequence: element choreography, not video scrubbing ---------- */
    syncSeq(R) {
      if (!R.seq || !R.seqFrames.length) return;
      const r = R.seq.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      if (span <= 0) return;
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const p = this.clamp01(-r.top / span);
      const N = R.seqFrames.length;
      const raw = Math.min(N - 0.0001, p * N);
      const idx = Math.floor(raw);
      const local = raw - idx;
      const M = this.motion;
  
      // each frame scales slowly through its own chapter and cross-dissolves at the seam
      const fade = 0.16;
      R.seqFrames.forEach((el, i) => {
        let o = 0, scale = 1, lift = 0;
        if (i === idx) {
          o = local > 1 - fade ? (1 - local) / fade : 1;
          scale = 1.16 - local * 0.16;
          lift = -local * 4 * M;
        } else if (i === idx + 1) {
          o = local > 1 - fade ? 1 - (1 - local) / fade : 0;
          scale = 1.24;
          lift = 5 * M;
        }
        el.style.opacity = o.toFixed(3);
        el.style.transform = 'scale(' + scale.toFixed(4) + ') translate3d(0,' + lift.toFixed(2) + '%,0)';
      });
  
      R.seqCaps.forEach((el) => {
        const i = parseInt(el.dataset.seqCap, 10);
        if (i !== idx) { el.style.opacity = '0'; return; }
        const inA = this.clamp01((local - 0.06) / 0.2);
        const outA = this.clamp01((local - 0.74) / 0.2);
        el.style.opacity = (inA * (1 - outA)).toFixed(3);
        el.style.transform = 'translate3d(0,' + ((1 - inA) * 34 * M - outA * 28 * M).toFixed(1) + 'px,0)';
      });
  
      if (R.seqNum) {
        const label = ['01', '02', '03', '04'][Math.min(idx, 3)];
        if (R.seqNum.textContent !== label) R.seqNum.textContent = label;
        const wob = this.clamp01((local - 0.8) / 0.2);
        R.seqNum.style.opacity = (1 - wob * 0.7).toFixed(2);
        R.seqNum.style.transform = 'translate3d(0,' + (-local * 22 * M).toFixed(1) + 'px,0)';
      }
  
      R.seqDots.forEach((d) => {
        const i = parseInt(d.dataset.seqDot, 10);
        const on = i === idx;
        d.style.color = on ? '#FFFFFF' : '#ABABB3';
        const tick = d.querySelector('[data-seq-tick]');
        if (tick) {
          tick.style.width = on ? '48px' : '20px';
          tick.style.background = on ? this.accentHex() : 'currentColor';
        }
      });
  
      if (R.seqBar) R.seqBar.style.width = (p * 100).toFixed(1) + '%';
    }
  
    /* ---------- scroll spy: marks the section currently under the header ---------- */
    syncSpy() {
      const links = this._spy || (this._spy = Array.from(document.querySelectorAll('[data-navlink]')));
      if (!links.length) return;
      const probe = (this._navH || 70) + 30;
      let active = null;
      links.forEach((a) => {
        const s = document.getElementById(a.dataset.navlink);
        if (!s) return;
        const r = s.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) active = a;
      });
      if (active === this._spyActive) return;
      this._spyActive = active;
      links.forEach((a) => {
        const on = a === active;
        a.dataset.active = on ? '1' : '0';
        a.style.color = on ? '#FFFFFF' : '#9A9AA2';
        const line = a.querySelector('[data-navline]');
        if (line) line.style.transform = on ? 'scaleX(1)' : 'scaleX(0)';
      });
    }
  
    /* ---------- section background videos ---------- */
    bootBgVideos() {
      const vids = Array.from(document.querySelectorAll('[data-bgvid]'));
      if (!vids.length) return;
      const arm = (v) => {
        if (!v.dataset.armed) {
          v.dataset.armed = '1';
          v.preload = 'auto';
          v.src = this.res(v.dataset.bgsrc);
          v.addEventListener('loadeddata', () => { v.style.opacity = '1'; this.playSafe(v); }, { once: true });
        } else this.playSafe(v);
      };
      if (!('IntersectionObserver' in window)) { vids.forEach(arm); return; }
      this._bgIo = new IntersectionObserver((es) => {
        es.forEach((en) => {
          if (en.isIntersecting) arm(en.target);
          else { try { en.target.pause(); } catch (e) {} }
        });
      }, { rootMargin: '20% 0px' });
      vids.forEach((v) => this._bgIo.observe(v));
    }
  
    /* ---------- living images ---------- */
    bootLive() {
      this._onEnter = (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        const tile = t.closest('[data-live]');
        if (tile) this.setLive(tile, true);
        const pil = t.closest('[data-pillar]');
        if (pil) this.setPillar(pil, true);
        const arow = t.closest('[data-area-row]');
        if (arow) this.setArea(+arow.dataset.areaRow);
        const ov = t.closest('[data-ov-item]');
        if (ov) this.setOvHover(ov, true);
        const eq = t.closest('[data-eq]');
        if (eq) this.setEq(eq, true);
      };
      this._onLeave = (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        const tile = t.closest('[data-live]');
        if (tile) this.setLive(tile, false);
        const pil = t.closest('[data-pillar]');
        if (pil) this.setPillar(pil, false);
        const ov = t.closest('[data-ov-item]');
        if (ov) this.setOvHover(ov, false);
        const eq = t.closest('[data-eq]');
        if (eq) this.setEq(eq, false);
      };
      document.addEventListener('mouseenter', this._onEnter, true);
      document.addEventListener('mouseleave', this._onLeave, true);
    }
  
    setPillar(card, on) {
      card.style.borderColor = on ? 'rgba(225,6,0,.42)' : 'rgba(255,255,255,.09)';
      card.style.background = on ? 'rgba(16,10,11,.72)' : 'rgba(9,9,11,.58)';
      card.style.transform = on ? 'translateY(-4px)' : 'none';
      const glow = card.querySelector('[data-pillar-glow]');
      if (glow) glow.style.opacity = on ? '1' : '0';
    }
  
    setEq(card, on) {
      // cards are seam-separated now, so hover reads as a fill shift, not a border
      card.style.background = on ? 'rgba(225,6,0,.09)' : 'rgba(0,0,0,.4)';
      const img = card.querySelector('[data-eq-img]');
      if (img) {
        img.style.filter = on ? 'grayscale(0) brightness(1.06) contrast(1.02)' : 'grayscale(.72) brightness(.82) contrast(1.04)';
        img.style.transform = on ? 'scale(1.06)' : 'none';
      }
      const rule = card.querySelector('[data-eq-rule]');
      if (rule) rule.style.transform = on ? 'scaleX(1)' : 'scaleX(0)';
    }
  
    /* ---------- training areas: one large stage driven by an index ----------
       Three equal panels read as three identical dark rectangles, so the areas share a
       single big stage instead: only the selected area is shown, at full size. */
    bootAreas() {
      this.areaRows = Array.from(document.querySelectorAll('[data-area-row]'));
      if (this.areaRows.length) this.setArea(this._area || 0, true);
    }
  
    // a re-render restores the template's inline colours and drops the active row, and
    // setArea would short-circuit on the unchanged index — so force a repaint
    refreshAreas() {
      const rows = Array.from(document.querySelectorAll('[data-area-row]'));
      if (!rows.length) return;
      const stale = rows.length !== (this.areaRows || []).length || rows.some((r, i) => r !== this.areaRows[i]);
      const active = rows[this._area || 0];
      const painted = active && getComputedStyle(active.querySelector('[data-area-title]')).color === 'rgb(255, 255, 255)';
      if (stale || !painted) { this.areaRows = rows; this.setArea(this._area || 0, true); }
    }
  
    setArea(i, force) {
      // bootAreas can run while the template is still streaming, leaving the cache empty;
      // re-query whenever it is stale so the first paint is never lost
      if (!this.areaRows || !this.areaRows.length || !this.areaRows[0].isConnected) {
        this.areaRows = Array.from(document.querySelectorAll('[data-area-row]'));
        force = true;
      }
      if (!this.areaRows.length) return;
      if (!force && this._area === i) return;
      this._area = i;
      document.querySelectorAll('[data-stage-layer]').forEach((el, n) => {
        const on = n === i;
        el.style.opacity = on ? '1' : '0';
        const v = el.querySelector('[data-stage-vid]');
        if (!v) return;
        if (on) {
          if (!v.dataset.armed) { v.dataset.armed = '1'; v.preload = 'auto'; v.src = this.res(v.dataset.liveSrc); }
          v.style.opacity = '1';
          this.playSafe(v);
        } else {
          v.style.opacity = '0';
          try { v.pause(); } catch (e) {}
        }
      });
      this.areaRows.forEach((r, n) => {
        const on = n === i;
        const t = r.querySelector('[data-area-title]');
        const num = r.querySelector('[data-area-num]');
        const rule = r.querySelector('[data-area-rule]');
        const go = r.querySelector('[data-area-go]');
        // !important: a plain assignment is re-applied from the template on every React
        // render, which wiped the active row moments after it was set
        if (t) t.style.setProperty('color', on ? '#FFFFFF' : '#ABABB3', 'important');
        // pure accent at 11px only reaches 4.01:1; white matches the eyebrow pattern used
        // everywhere else and lets the red rule and arrow carry the accent
        if (num) num.style.setProperty('color', on ? '#FFFFFF' : '#8A8A92', 'important');
        if (rule) rule.style.transform = on ? 'scaleX(1)' : 'scaleX(0)';
        if (go) { go.style.opacity = on ? '1' : '0'; go.style.transform = on ? 'none' : 'translateX(-10px)'; }
      });
      document.querySelectorAll('[data-area-body]').forEach((b, n) => {
        const on = n === i;
        b.style.maxHeight = on ? b.scrollHeight + 'px' : '0px';
        b.style.opacity = on ? '1' : '0';
      });
      const c = document.querySelector('[data-area-count]');
      if (c) c.textContent = this.pad(i + 1) + ' / ' + this.pad(document.querySelectorAll('[data-area-row]').length);
    }
  
    setLive(tile, on) {
      const img = tile.querySelector('[data-live-img]');
      const vid = tile.querySelector('[data-live-vid]');
      const rule = tile.querySelector('[data-live-rule]');
      const body = tile.querySelector('[data-live-body]');
      const cap = tile.querySelector('[data-live-cap]');
      const shade = tile.querySelector('[data-live-shade]');
      const frame = tile.querySelector('[data-live-frame]');
      const arrow = tile.querySelector('[data-live-arrow]');
      if (rule) rule.style.transform = on ? 'scaleX(1)' : 'scaleX(0)';
      if (body) body.style.maxHeight = on ? body.scrollHeight + 'px' : '0px';
      // gallery tiles keep a resting shade so captions stay legible before hover
      if (shade) shade.style.opacity = on ? '1' : (frame ? '.35' : '0');
      if (frame) {
        frame.style.borderColor = on ? 'rgba(225,6,0,.85)' : 'rgba(255,255,255,.14)';
        frame.style.boxShadow = on ? '0 0 0 1px rgba(225,6,0,.35), 0 0 44px rgba(225,6,0,.28) inset' : 'none';
      }
      if (arrow) arrow.style.transform = on ? 'scale(1)' : 'scale(.6)';
      if (frame) tile.style.transform = on ? 'translateY(-4px)' : 'none';
      if (cap) {
        cap.style.opacity = on ? '1' : '0';
        cap.style.transform = on ? 'none' : 'translateY(10px)';
      }
      if (img) {
        const rest = img.dataset.rest || (img.dataset.rest = img.style.filter);
        img.style.filter = on ? 'grayscale(0) brightness(1)' : rest;
        img.style.transform = on ? 'scale(1.05)' : 'none';
      }
      if (!vid) return;
      if (on) {
        if (!vid.dataset.armed) { vid.dataset.armed = '1'; vid.preload = 'auto'; vid.src = this.res(vid.dataset.liveSrc); }
        vid.style.opacity = '1';
        vid.style.transform = 'scale(1.05)';
        this.playSafe(vid);
      } else {
        vid.style.opacity = '0';
        vid.style.transform = 'none';
        try { vid.pause(); } catch (e) {}
      }
    }
  
    /* ---------- gallery lightbox ----------
       Reads its slides from the tiles themselves, so adding or reordering a gallery
       tile needs no change here. */
    bootLightbox() {
      const box = document.querySelector('[data-lbox]');
      if (!box || box.dataset.booted) return;
      box.dataset.booted = '1';
      this.lbTiles = () => Array.from(document.querySelectorAll('[data-lb]'));
      this.lbIndex = -1;
  
      this._onLbClick = (e) => {
        const t = e.target;
        if (t.closest && t.closest('[data-lb-close]')) { this.closeLb(); return; }
        if (t.closest && t.closest('[data-lb-prev]')) { this.stepLb(-1); return; }
        if (t.closest && t.closest('[data-lb-next]')) { this.stepLb(1); return; }
        // clicking the darkened surround closes; clicking the picture does not
        if (t === box) { this.closeLb(); return; }
        const tile = t.closest && t.closest('[data-lb]');
        if (tile) { e.preventDefault(); this.openLb(this.lbTiles().indexOf(tile)); }
      };
      document.addEventListener('click', this._onLbClick, true);
  
      this._onLbKey = (e) => {
        const tile = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-lb]');
        if (tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.openLb(this.lbTiles().indexOf(tile)); return; }
        if (this.lbIndex < 0) return;
        if (e.key === 'Escape') { e.preventDefault(); this.closeLb(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this.stepLb(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.stepLb(-1); }
      };
      document.addEventListener('keydown', this._onLbKey);
    }
  
    openLb(i) {
      const tiles = this.lbTiles();
      if (i < 0 || i >= tiles.length) return;
      const box = document.querySelector('[data-lbox]');
      const fig = box.querySelector('[data-lb-fig]');
      const img = box.querySelector('[data-lb-img]');
      const cap = box.querySelector('[data-lb-cap]');
      const cnt = box.querySelector('[data-lb-count]');
      const src = tiles[i].querySelector('[data-live-img]');
      const label = tiles[i].querySelector('[data-live-cap] span');
      const first = this.lbIndex < 0;
      this.lbIndex = i;
  
      const swap = () => {
        img.src = src.getAttribute('src');
        img.alt = src.getAttribute('alt') || '';
        if (cap) cap.textContent = label ? label.textContent : '';
        if (cnt) cnt.textContent = (i + 1) + ' / ' + tiles.length;
        fig.style.opacity = '1';
        fig.style.transform = 'none';
      };
  
      if (first) {
        // release any hover state so a clip does not keep playing behind the overlay
        tiles.forEach((t) => this.setLive(t, false));
        box.style.display = 'flex';
        this._lbLock = true;
        document.documentElement.style.overflow = 'hidden';
        requestAnimationFrame(() => { box.style.opacity = '1'; swap(); });
      } else {
        fig.style.opacity = '0';
        fig.style.transform = 'scale(.98)';
        clearTimeout(this._lbSwap);
        this._lbSwap = setTimeout(swap, 220);
      }
    }
  
    stepLb(d) {
      const n = this.lbTiles().length;
      if (!n || this.lbIndex < 0) return;
      this.openLb((this.lbIndex + d + n) % n);
    }
  
    closeLb() {
      const box = document.querySelector('[data-lbox]');
      if (!box || this.lbIndex < 0) return;
      const fig = box.querySelector('[data-lb-fig]');
      this.lbIndex = -1;
      clearTimeout(this._lbSwap);
      box.style.opacity = '0';
      if (fig) { fig.style.opacity = '0'; fig.style.transform = 'scale(.97)'; }
      this._lbLock = false;
      if (!this._menuOpen && !this._locked) document.documentElement.style.overflow = '';
      clearTimeout(this._lbHide);
      this._lbHide = setTimeout(() => { if (this.lbIndex < 0) box.style.display = 'none'; }, 520);
    }
  
    /* ---------- cursor ---------- */
    bootCursor() {
      if (!this.fine || this.reduced) return;
      const c = document.querySelector('[data-cursor]');
      if (!c) return;
      this._cx = window.innerWidth / 2; this._cy = window.innerHeight / 2;
      this._rx = this._cx; this._ry = this._cy;
      this._onMove = (e) => {
        this._cx = e.clientX; this._cy = e.clientY;
        if (c.style.opacity !== '1') c.style.opacity = '1';
        const hot = e.target && e.target.closest && e.target.closest('a,button,[data-faq-head],[data-live],input,select,textarea');
        if (!!hot !== this._hot) {
          this._hot = !!hot;
          c.style.width = hot ? '50px' : '30px';
          c.style.height = hot ? '50px' : '30px';
          c.style.margin = hot ? '-25px 0 0 -25px' : '-15px 0 0 -15px';
          c.style.borderColor = hot ? this.accentHex() : 'rgba(244,242,239,.45)';
          c.style.background = hot ? 'rgba(225,6,0,.12)' : 'transparent';
        }
      };
      window.addEventListener('mousemove', this._onMove, { passive: true });
    }
  
    /* ---------- counters ---------- */
    bootCounts() {
      const run = (el) => {
        if (el.dataset.done) return;
        el.dataset.done = '1';
        if (this.reduced) return;
        const target = parseFloat(el.dataset.count);
        const dec = parseInt(el.dataset.dec || '0', 10);
        const suffix = el.dataset.suffix || '';
        const t0 = performance.now(), dur = 1600;
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const val = target * (1 - Math.pow(1 - p, 4));
          el.textContent = (dec ? val.toFixed(dec).replace('.', ',') : Math.round(val).toString()) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      const nodes = Array.from(document.querySelectorAll('[data-count]'));
      if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
      this._io = new IntersectionObserver((es) => {
        es.forEach((en) => { if (en.isIntersecting) { run(en.target); this._io.unobserve(en.target); } });
      }, { threshold: 0.2 });
      nodes.forEach((el) => this._io.observe(el));
    }
  
    /* ---------- live opening status ---------- */
    bootStatus() {
      const paint = () => {
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        const open = mins >= 360;
        const navDot = document.querySelector('[data-nav-dot]');
        const navTxt = document.querySelector('[data-nav-status]');
        if (navDot && navTxt) {
          navDot.style.background = open ? '#4A9E2E' : this.accentHex();
          navDot.style.boxShadow = open ? '0 0 9px rgba(74,158,46,.9)' : '0 0 9px rgba(225,6,0,.9)';
          navTxt.textContent = open ? 'Geöffnet' : 'Geschlossen';
        }
        // every chip carrying the hooks is painted, not just the first in the document —
        // two of them disagreeing about the opening state would be worse than none
        let label;
        if (open) {
          const left = 1440 - mins;
          const h = Math.floor(left / 60), m = left % 60;
          label = left <= 60
            ? 'Jetzt geöffnet · schließt in ' + m + ' Min'
            : 'Jetzt geöffnet · noch ' + h + ' Std' + (m ? ' ' + m + ' Min' : '');
        } else {
          const till = 360 - mins;
          const h = Math.floor(till / 60), m = till % 60;
          label = 'Gerade geschlossen · öffnet in ' + (h ? h + ' Std ' : '') + m + ' Min';
        }
        const acc = this.accentHex();
        document.querySelectorAll('[data-status-dot]').forEach((dot) => {
          dot.style.background = open ? '#4A9E2E' : acc;
          dot.style.boxShadow = open ? '0 0 12px rgba(74,158,46,.9)' : '0 0 12px rgba(225,6,0,.9)';
        });
        document.querySelectorAll('[data-status-text]').forEach((t) => { t.textContent = label; });
        // the tinted pill in #kontakt reads as a claim on its own, so it flips too
        document.querySelectorAll('[data-status-chip]').forEach((c) => {
          c.style.background = open ? 'rgba(74,158,46,.12)' : 'rgba(225,6,0,.12)';
          c.style.borderColor = open ? 'rgba(74,158,46,.3)' : 'rgba(225,6,0,.32)';
        });
      };
      paint();
      this._clock = setInterval(paint, 60000);
    }
  
    /* bundled builds hand out blob URLs for assets that only appear in data-* attributes */
    res(path) {
      if (!path) return path;
      const r = window.__resources;
      const v = r && r[path.replace(/^assets\//, '').replace(/[^a-z0-9]+/gi, '-')];
      return typeof v === 'string' && v ? v : path;
    }
  
    /* ---------- responsive ---------- */
    applyResponsive() {
      const w = document.documentElement.clientWidth || window.innerWidth;
      const narrow = w < 980;
      // Desktop carries a flat inline nav (no app chrome); the burger + overlay is the
      // mobile treatment only. Each element drops out at the width where it would crowd.
      // the wordmark now sits centred and absolute, so it no longer pushes the row apart —
      // the links now sit in two groups either side of the brand, so the row needs
      // roughly 3×links + brand + CTA before it stops being comfortable
      const set = (sel, disp) => { const e = document.querySelector(sel); if (e) e.style.setProperty('display', disp, 'important'); };
      const q = (s) => document.querySelector(s);
      const px = (v) => parseFloat(v) || 0;
      const bar = q('[data-nav-bar]'), brand = q('[data-brand]'), word = q('[data-brand-word]'), cta = q('[data-cta-pill]'), rgroup = q('[data-nav-rgroup]');
      const navs = Array.from(document.querySelectorAll('[data-nav-links]'));
      // offsetWidth ignores the intro transforms, so the row can be measured mid-animation.
      // Start from the full desktop row and drop pieces until nothing overlaps; the grid
      // columns are pinned (grid-column 1/2/3) so display:none keeps the brand centred.
      navs.forEach((n) => { n.style.setProperty('display', 'flex', 'important'); n.style.visibility = ''; n.style.overflow = ''; n.style.minWidth = ''; n.style.pointerEvents = ''; });
      set('[data-menu-btn]', 'none');
      set('[data-brand-word]', 'inline-block');
      set('[data-cta-pill]', w < 700 ? 'none' : 'inline-flex');
      set('[data-nav-live]', w < 1320 ? 'none' : 'flex');
      const rowW = (nav) => {
        const ls = Array.from(nav.children).filter((c) => c.offsetWidth);
        return ls.reduce((a, c) => a + c.offsetWidth, 0) + px(getComputedStyle(nav).columnGap) * Math.max(0, ls.length - 1);
      };
      let inline = w >= 1180;
      if (bar && brand && navs.length === 2 && bar.clientWidth) {
        const cs = getComputedStyle(bar);
        const side = (bar.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight) - 2 * px(cs.columnGap) - brand.offsetWidth) / 2;
        const ctaW = cta && cta.offsetWidth ? cta.offsetWidth + px(getComputedStyle(rgroup || cta.parentElement).columnGap) : 0;
        inline = w >= 900 && rowW(navs[0]) + 6 <= side && rowW(navs[1]) + ctaW + 6 <= side;
      }
      navs.forEach((n) => n.style.setProperty('display', inline ? 'flex' : 'none', 'important'));
      set('[data-menu-btn]', inline ? 'none' : 'inline-flex');
      set('[data-side-tab]', inline ? 'flex' : 'none');
      if (!inline && brand && rgroup && word) {
        // the right group (CTA + burger) overflows its column towards the brand when the
        // row is tight: give up the wordmark first, then the CTA
        const collides = () => {
          const first = Array.from(rgroup.children).find((c) => c.offsetWidth);
          return !!first && first.offsetLeft < brand.offsetLeft + brand.offsetWidth + 6;
        };
        if (collides()) set('[data-brand-word]', 'none');
        if (collides()) set('[data-cta-pill]', 'none');
      }
      
      const ovMedia = document.querySelector('[data-ov-media]');
      if (ovMedia) ovMedia.style.display = w < 900 ? 'none' : 'block';
      const ovNav = document.querySelector('[data-ov-nav]');
      if (ovNav) ovNav.style.maxWidth = w < 900 ? 'none' : '58%';
  
      document.querySelectorAll('[data-two]').forEach((el) => {
        el.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : (el.dataset.cols || 'minmax(0,1fr) minmax(0,1fr)');
      });
      document.querySelectorAll('[data-portrait]').forEach((el) => {
        // the slot holds a portrait-native photo (4/5) — forcing landscape here would
        // crop half its height away, so keep the native ratio at every width
        el.style.aspectRatio = '4/5';
        // Alone in a full-width column, a height cap would resolve the WIDTH via the
        // aspect ratio and strand the photo in a row 2.5x its width. Cap the width
        // instead and centre it, so it reads as a deliberate portrait plate.
        el.style.maxHeight = narrow ? 'none' : 'min(74vh,700px)';
        // an explicit width, not max-width: centring drops the grid stretch, and every
        // child here is absolutely positioned, so intrinsic content width is 0
        el.style.width = narrow ? 'min(520px,100%)' : 'auto';
        el.style.justifySelf = narrow ? 'center' : 'auto';
      });
      // stacked, the info card sits on top of a full-bleed map and hides it completely;
      // below the breakpoint the map becomes its own block above the card instead
      const mapWrap = document.querySelector('[data-map-wrap]');
      if (mapWrap) {
        // same threshold the two-column grid uses, so there is no band where the card
        // goes full width while the map is still a background
        const stack = narrow;
        mapWrap.style.position = stack ? 'relative' : 'absolute';
        mapWrap.style.height = stack ? 'clamp(300px,54vw,420px)' : '';
        mapWrap.style.marginBottom = stack ? 'clamp(22px,3vw,34px)' : '';
        mapWrap.style.borderRadius = stack ? '20px' : '';
        mapWrap.style.overflow = stack ? 'hidden' : '';
        // the pin is also a direct > div child and must not be swept up with the scrims
        // HSK-PATCH: keep the consent gate out of the scrim sweep
        const scrims = mapWrap.querySelectorAll(':scope > div:not([data-map-pin]):not([data-map-gate])');
        scrims.forEach((s) => { s.style.display = stack ? 'none' : 'block'; });
        // Reveal choreography (card starts centred over the map and glides left while
        // the veil lifts, the map settles and the pin drops in) is scroll-driven off the
        // card's own view timeline. Stacked, the card is full width and the map is its
        // own block above it, so the card just rises like everything else.
        const ease = 'cubic-bezier(.16,1,.3,1)';
        const drive = (el, anim, range) => {
          if (!el) return;
          if (anim) {
            el.style.animation = anim + ' 1s ' + ease + ' both';
            el.style.setProperty('animation-timeline', '--hs-card');
            el.style.setProperty('animation-range', range);
          } else el.style.animation = 'none';
        };
        const card = document.querySelector('[data-slide]');
        if (card) {
          // leftovers from the old per-tick engine would pin the card in place
          card.style.removeProperty('transform'); card.style.removeProperty('opacity');
          drive(card, stack ? 'hs-rise' : 'hs-aside', stack ? 'entry 0% cover 18%' : 'cover 4% cover 40%');
          if (stack) card.style.setProperty('animation-timeline', 'view()');
        }
        drive(document.querySelector('[data-map-frame]'), stack ? null : 'hs-map-settle', 'cover 0% cover 52%');
        drive(document.querySelector('[data-map-pin]'), stack ? null : 'hs-pin-pop', 'cover 22% cover 50%');
      }
      const arrival = document.querySelector('[data-arrival]');
      if (arrival) arrival.style.gridTemplateColumns = w < 760 ? 'minmax(0,1fr)' : 'repeat(3,minmax(0,1fr))';
      const gcard = document.querySelector('[data-gcard]');
      if (gcard) gcard.style.justifySelf = w < 900 ? 'start' : 'end';
      const three = document.querySelector('[data-three]');
      if (three) three.style.gridTemplateColumns = w < 900 ? (w < 620 ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))') : 'repeat(3,minmax(0,1fr))';
      const stats = document.querySelector('[data-stats]');
      if (stats) stats.style.gridTemplateColumns = w < 620 ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))';
      const gal = document.querySelector('[data-gal]');
      if (gal) {
        // 12 cells total (one 2x2 hero + eight singles) divides evenly by 4, 3 and 2,
        // so every breakpoint lands on a full rectangle with no orphan cell
        const cols = w < 640 ? 2 : w < 1000 ? 3 : 4;
        gal.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))';
        gal.style.gridAutoRows = w < 640 ? 'clamp(122px,29vw,180px)' : w < 1000 ? 'clamp(140px,19vw,200px)' : 'clamp(150px,15vw,220px)';
        gal.style.removeProperty('height');
        Array.from(gal.children).forEach((t) => t.style.removeProperty('height'));
      }
      const form = document.querySelector('[data-form]');
      if (form) form.style.gridTemplateColumns = w < 700 ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))';
      // 6 services: 3 or 2 columns divide evenly, 4 would leave a ragged row
      const svc = document.querySelector('[data-svc]');
      if (svc) svc.style.gridTemplateColumns = w < 560 ? 'minmax(0,1fr)' : w < 900 ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))';
      const eqg = document.querySelector('[data-eqgrid]');
      if (eqg) eqg.style.gridTemplateColumns = w < 640 ? 'minmax(0,1fr)' : w < 1000 ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))';
      const eqs = document.querySelector('[data-eqstats]');
      if (eqs) eqs.style.gridTemplateColumns = w < 640 ? 'repeat(2,minmax(0,1fr))' : w < 1000 ? 'repeat(4,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))';
      const seq = document.querySelector('[data-seq]');
      if (seq) seq.style.height = narrow ? '320vh' : '420vh';
      const rail = document.querySelector('[data-seq-rail]');
      if (rail) rail.style.display = w < 700 ? 'none' : 'flex';
  
      this.enforceTapTargets(narrow);
  
      const nav = document.querySelector('[data-nav]');
      if (nav) this._navH = Math.ceil(nav.getBoundingClientRect().height);
    }
  
    /* Touch ergonomics as a class rule, not per element: every standalone UI link or
       button gets enough vertical padding to clear 44px on narrow viewports, and link
       columns lose their row gap so the rows form one contiguous tap list. Inline prose
       links are skipped — padding there would wreck the line rhythm. */
    enforceTapTargets(narrow, force) {
      const MIN = 44;
      const state = narrow ? '1' : '0';
      const cols = new Set();
      // One deferred pass after fonts and first layout settle. Until then rects can read 0,
      // and a value derived from that must never be latched.
      if (!this._tapSettleQueued) {
        this._tapSettleQueued = 1;
        const again = () => requestAnimationFrame(() => this.enforceTapTargets(
          (document.documentElement.clientWidth || window.innerWidth) < 980, true));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(again).catch(again);
        else again();
        window.addEventListener('load', again, { once: true });
      }
      document.querySelectorAll('a,button').forEach((el) => {
        if (!force && el.dataset.tapState === state) return;
        const p = el.parentElement;
        if (!p) return;
        const cs = getComputedStyle(el);
        const pcs = getComputedStyle(p);
        if (!/flex|grid/.test(pcs.display) && !/block|flex/.test(cs.display)) { el.dataset.tapState = state; return; }
        if (narrow) {
          if (!el.dataset.tapPad) el.dataset.tapPad = cs.paddingTop + '|' + cs.paddingBottom;
          const h = el.getBoundingClientRect().height;
          const base = h - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          // not laid out yet: leave tapState unset so a later pass computes it for real
          if (h <= 0 || base <= 0) return;
          const need = (MIN - base) / 2;
          if (need > 0.5) {
            el.style.paddingTop = need.toFixed(1) + 'px';
            el.style.paddingBottom = need.toFixed(1) + 'px';
            if (pcs.flexDirection === 'column') cols.add(p);
          }
        } else {
          const b = (el.dataset.tapPad || '').split('|');
          if (b.length === 2) { el.style.paddingTop = b[0]; el.style.paddingBottom = b[1]; }
          if (pcs.flexDirection === 'column') cols.add(p);
        }
        el.dataset.tapState = state;
      });
      cols.forEach((p) => {
        if (!p.dataset.tapGap) p.dataset.tapGap = getComputedStyle(p).rowGap;
        p.style.rowGap = narrow ? '0px' : p.dataset.tapGap;
      });
    }
  
    /* ---------- scroll ---------- */
    pageProgress() {
      const se = document.scrollingElement || document.documentElement;
      const max = se.scrollHeight - window.innerHeight;
      return max > 40 ? Math.min(1, Math.max(0, se.scrollTop / max)) : 0;
    }
  
    refs() {
      // validate every cached node: a re-render can replace some and keep others, and a
      // single-node check would keep handing back detached references
      const c = this._r;
      if (c) {
        const stale = [c.bar, c.nav, c.hs, c.track, c.seq].some(n => n && !n.isConnected)
          || c.par.some(n => !n.isConnected)
          || c.par.length !== document.querySelectorAll('[data-parallax]').length;
        if (!stale && c.bar) return c;
      }
      this._r = {
        bar: document.querySelector('[data-progress]'),
        nav: document.querySelector('[data-nav]'),
        hs: document.querySelector('[data-hs]'),
        track: document.querySelector('[data-hs-track]'),
        hsBar: document.querySelector('[data-hs-bar]'),
        par: Array.from(document.querySelectorAll('[data-parallax]')),
        seq: document.querySelector('[data-seq]'),
        seqFrames: Array.from(document.querySelectorAll('[data-seq-frame]')),
        seqCaps: Array.from(document.querySelectorAll('[data-seq-cap]')),
        seqNum: document.querySelector('[data-seq-num]'),
        seqDots: Array.from(document.querySelectorAll('[data-seq-dot]')),
        seqBar: document.querySelector('[data-seq-bar]')
      };
      return this._r;
    }
  
    syncDom() {
      const se = document.scrollingElement || document.documentElement;
      const top = se.scrollTop;
      const w = document.documentElement.clientWidth;
      if (this._lastTop === top && this._lastW === w) return;
      this._lastTop = top; this._lastW = w;
      const R = this.refs();
      const M = this.motion;
  
      const pp = this.pageProgress();
      if (R.bar) R.bar.style.width = (pp * 100).toFixed(2) + '%';
  
      // guarded: a throw in the reel used to take the whole scroll engine with it,
      // silently killing everything below this line
      try { this.syncReel(pp); } catch (err) { if (!this._reelWarned) { this._reelWarned = 1; console.warn('reel', err); } }
      if (R.nav) {
        const on = top > 60;
        R.nav.style.paddingTop = on ? '9px' : 'clamp(10px,1.4vw,18px)';
        R.nav.style.paddingBottom = on ? '9px' : 'clamp(10px,1.4vw,18px)';
        // the bar itself carries the surface now, so it densifies instead of the header
        const bar = R.nav.querySelector('[data-nav-bar]');
        if (bar) {
          bar.style.background = on ? 'rgba(6,6,8,.8)' : 'rgba(9,9,11,.58)';
          bar.style.borderColor = on ? 'rgba(225,6,0,.34)' : 'rgba(225,6,0,.2)';
        }
      }
      this.syncSpy();
  
      this.syncSeq(R);
  
      if (R.hs && R.track) {
        const r = R.hs.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        const hp = span > 0 ? this.clamp01(-r.top / span) : 0;
        if (this._trackW == null || this._trackWAt !== w) { this._trackW = R.track.scrollWidth; this._trackWAt = w; }
        const dist = Math.max(0, this._trackW - w + 56);
        R.track.style.transform = 'translate3d(' + (-hp * dist).toFixed(1) + 'px,0,0)';
        if (R.hsBar) R.hsBar.style.width = (6 + hp * 94).toFixed(1) + '%';
      }
  
      R.par.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -260 || r.top > window.innerHeight + 260) return;
        const c = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        el.style.transform = 'translate3d(0,' + (c * parseFloat(el.dataset.parallax) * M).toFixed(1) + 'px,0)';
      });
  
  
    }
  
    bootLoop() {
      this._onResize = () => { this._lastW = null; this._trackWAt = null; this.applyResponsive(); this.syncDom(); };
      window.addEventListener('resize', this._onResize);
      this._onScroll = () => this.syncDom();
      window.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
      this._onVis = () => {
        const r = this.reel;
        if (r && r.started) {
          if (document.hidden) { try { r.layers[r.front].pause(); } catch (e) {} }
          else this.playSafe(r.layers[r.front]);
        }
      };
      document.addEventListener('visibilitychange', this._onVis);
  
      const cur = document.querySelector('[data-cursor]');
      const step = () => {
        this._raf = requestAnimationFrame(step);
        this.syncDom();
        if (cur && this._cx != null) {
          this._rx += (this._cx - this._rx) * 0.16;
          this._ry += (this._cy - this._ry) * 0.16;
          cur.style.transform = 'translate3d(' + this._rx.toFixed(1) + 'px,' + this._ry.toFixed(1) + 'px,0)';
        }
      };
      this._raf = requestAnimationFrame(step);
  
      // the width check here makes every breakpoint self-correcting without an observer;
      // the observer below is only a faster path and is installed LAST, in try/catch, so
      // nothing above it can be skipped if it throws
      this._pollW = document.documentElement.clientWidth;
      this._poll = setInterval(() => {
        // self-heal: if a remount ever cancels the rAF loop without re-running mount,
        // the interval restarts it so the page can never be left permanently static
        if (this._raf == null) { const s = () => { this._raf = requestAnimationFrame(s); this.syncDom(); }; this._raf = requestAnimationFrame(s); }
        const w = document.documentElement.clientWidth;
        if (w !== this._pollW) { this._pollW = w; this._onResize(); }
        this.syncDom();
        // a re-render can strip the active training row without firing componentDidUpdate
        // in time; re-assert it periodically so it is never left with no row selected
        this.refreshAreas();
      }, 140);
      this.syncDom();
  
      try {
        if (window.ResizeObserver) {
          this._ro = new window.ResizeObserver(() => {
            const w = document.documentElement.clientWidth;
            if (w === this._pollW) return;
            this._pollW = w;
            this._onResize();
          });
          this._ro.observe(document.documentElement);
        }
        requestAnimationFrame(() => this._onResize());
        window.addEventListener('load', this._onResize, { once: true });
      } catch (e) {}
    }
  
    /* ---------- delegated interactions ---------- */
    bootDelegates() {
      this._onKey = (e) => { if (e.key === 'Escape' && this._menuOpen) this.setMenu(false); };
      document.addEventListener('keydown', this._onKey);
  
      this._onClick = (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest('[data-menu-btn]')) { e.preventDefault(); this.setMenu(!this._menuOpen); return; }
  
        const head = t.closest('[data-faq-head]');
        if (head) {
          const item = head.closest('[data-faq]');
          const open = item.dataset.open === '1';
          document.querySelectorAll('[data-faq][data-open="1"]').forEach((o) => {
            o.dataset.open = '0';
            const b = o.querySelector('[data-faq-body]'); if (b) b.style.maxHeight = '0px';
            const i = o.querySelector('[data-faq-icon]'); if (i) i.style.transform = 'rotate(0deg)';
          });
          if (!open) {
            item.dataset.open = '1';
            const b = item.querySelector('[data-faq-body]');
            const i = item.querySelector('[data-faq-icon]');
            if (b) b.style.maxHeight = b.scrollHeight + 'px';
            if (i) i.style.transform = 'rotate(45deg)';
          }
          return;
        }
  
        const arow = t.closest('[data-area-row]');
        if (arow) { this.setArea(+arow.dataset.areaRow); return; }
        if (!this.fine) {
          const tile = t.closest('[data-live]');
          if (tile) { const on = tile.dataset.on === '1'; tile.dataset.on = on ? '0' : '1'; this.setLive(tile, !on); }
        }
  
        const a = t.closest('a[href^="#"]');
        if (a) {
          const id = a.getAttribute('href').slice(1);
          if (!id) return;
          const target = document.getElementById(id);
          if (!target) return;
          e.preventDefault();
          const wasOpen = this._menuOpen;
          this.setMenu(false);
          const jump = () => {
            const se = document.scrollingElement || document.documentElement;
            window.scrollTo({ top: target.getBoundingClientRect().top + se.scrollTop - (this._navH || 70), behavior: this.reduced ? 'auto' : 'smooth' });
          };
          if (wasOpen) setTimeout(jump, 420); else jump();
        }
      };
      document.addEventListener('click', this._onClick, true);
    }
  }
  

  /* ---------------------------------------------------------- runtime shim */
  var app = new Component({"accent":"#E10600","motionLevel":"Kräftig","grain":true});
  app.__mounted = false;

  app.__render = function () {
    var vals = app.renderVals() || {};
    var nodes = document.querySelectorAll('[data-if]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.display = vals[nodes[i].dataset.if] ? 'contents' : 'none';
    }
    if (app.__mounted) app.componentDidUpdate();
  };

  /* The site is static: there is no server to post to. The enquiry is composed
     into a mail draft and handed to the visitor's own client, and the same
     draft is left on the confirmation panel so a missing mail client is never
     a dead end. Nothing is stored or sent anywhere else. */
  var FORM_MODE = "mailto";
  var MAIL_TO = 'sb@hsk.fitness';

  function draft(form) {
    var d = new FormData(form);
    var get = function (k) { return (d.get(k) || '').toString().trim(); };
    var goal = get('ziel') || 'Probetraining';
    var body = [
      'Name:     ' + get('name'),
      'E-Mail:   ' + get('email'),
      'Telefon:  ' + (get('tel') || '—'),
      'Ziel:     ' + goal,
      '',
      'Nachricht:',
      get('msg') || '—'
    ].join('\r\n');
    return 'mailto:' + MAIL_TO +
      '?subject=' + encodeURIComponent('Anfrage über die Website — ' + goal) +
      '&body=' + encodeURIComponent(body);
  }

  function boot() {
    app.__render();
    var form = document.querySelector('[data-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        var h = (app.renderVals() || {}).onSubmit;
        if (h) h(e); else e.preventDefault();
        if (FORM_MODE !== 'mailto') return;
        var url;
        try { url = draft(form); } catch (err) { return; }
        var link = document.querySelector('[data-sent-mail]');
        if (link) link.setAttribute('href', url);
        // give the confirmation panel a frame to paint before the mail client
        // steals focus, so the visitor still sees where the enquiry went
        setTimeout(function () { try { window.location.href = url; } catch (err) {} }, 350);
      });
    }
    app.componentDidMount();
    app.__mounted = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.HSK = app;
})();
