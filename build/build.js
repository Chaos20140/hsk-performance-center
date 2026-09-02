/* Build the standalone production site from the Claude Design .dc.html sources.
   Deterministic transform — no hand-transcription of markup. */
const fs = require('fs');
const path = require('path');

// repo layout: build/ holds this script, src/ the Claude Design export,
// and the repository root is the published site.
const SRC = path.resolve(__dirname, '..', 'src');
const OUT = path.resolve(__dirname, '..');

// overridden by the real Pages URL once the repo exists
const CANONICAL = process.env.HSK_CANONICAL || 'https://example.invalid/';

const fail = (m) => { console.error('BUILD FAIL: ' + m); process.exit(1); };
const must = (cond, m) => { if (!cond) fail(m); };

/* ---------------------------------------------------------------- helpers */

// "a:b;c:d" -> "a:b !important;c:d !important"
function important(decls) {
  return decls.split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(d => (/!important$/i.test(d) ? d : d + ' !important'))
    .join(';');
}

function stripOmelette(html) {
  const before = html.length;
  html = html.replace(/<style data-omelette-injected>[\s\S]*?<\/style>/g, '');
  html = html.replace(/<script data-omelette-injected>[\s\S]*?<\/script>/g, '');
  must(html.length < before, 'omelette preamble not found');
  must(!/data-omelette-injected/.test(html), 'omelette leftovers');
  return html;
}

/* Pull <helmet>…</helmet> out of the body and return {html, helmet}. */
function extractHelmet(html) {
  const m = html.match(/<helmet>([\s\S]*?)<\/helmet>/);
  must(m, '<helmet> block not found');
  return { html: html.replace(m[0], ''), helmet: m[1] };
}

/* style-hover="…" -> data-hh="N" + a real :hover rule. */
function extractHover(html, prefix) {
  const rules = [];
  let n = 0;
  html = html.replace(/\s+style-hover="([^"]*)"/g, (_, decls) => {
    const id = prefix + (++n);
    rules.push('[data-hh="' + id + '"]:hover{' + important(decls) + '}');
    return ' data-hh="' + id + '"';
  });
  must(!/style-hover=/.test(html), 'style-hover leftovers');
  const css = rules.length
    ? '@media (hover:hover) and (pointer:fine){\n' + rules.join('\n') + '\n}'
    : '';
  return { html, css, count: n };
}

/* <sc-if value="{{ x }}" …> … </sc-if>  ->  <div data-if="x" style="display:…"> … </div> */
function convertScIf(html) {
  let n = 0;
  html = html.replace(/<sc-if\s+value="\{\{\s*([A-Za-z0-9_$]+)\s*\}\}"[^>]*>/g, (_, name) => {
    n++;
    // notSent is the default-visible branch; sent starts hidden
    const vis = name === 'sent' ? 'none' : 'contents';
    return '<div data-if="' + name + '" style="display:' + vis + '">';
  });
  html = html.replace(/<\/sc-if>/g, '</div>');
  must(!/<sc-if/.test(html) && !/<\/sc-if>/.test(html), 'sc-if leftovers');
  // the form's React-style handler is replaced by a real submit listener in site.js
  html = html.replace(/\s+onSubmit="\{\{\s*onSubmit\s*\}\}"/g, '');
  must(!/\{\{/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), 'mustache leftovers in markup');
  return { html, count: n };
}

/* Split the x-dc logic script off the document. */
function extractLogic(html) {
  const m = html.match(/<script type="text\/x-dc" data-dc-script data-props="([^"]*)">([\s\S]*?)<\/script>/);
  must(m, 'data-dc-script block not found');
  const props = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  return { html: html.replace(m[0], ''), props, js: m[2] };
}

/* ------------------------------------------------------- shared head bits */

/* GitHub Pages cannot set response headers, so this is the only place a policy
   can live. A <meta> CSP cannot carry frame-ancestors, HSTS or report-uri —
   those need an edge in front (Cloudflare) and are noted in CLAUDE.md.
   default-src 'none' plus an explicit allowlist: the page loads nothing but its
   own files, and the single third-party frame is the (consent-gated) map. */
const CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",   // the design is built on inline style attributes
  "img-src 'self' data:",               // data: carries the film-grain SVG
  "media-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src https://www.google.com"
].join('; ');

const HEAD_EXTRA = (canonical, title, desc) => `
<meta http-equiv="Content-Security-Policy" content="${CSP}" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<link rel="canonical" href="${canonical}" />
<meta property="og:url" content="${canonical}" />
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png" />
<link rel="manifest" href="site.webmanifest" />
<meta name="format-detection" content="telephone=no" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="mobile-web-app-capable" content="yes" />
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/bricolage-grotesque-normal-200_800.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/manrope-normal-300_700.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/instrument-serif-normal-400.woff2" crossorigin />
`.trim();

/* =========================================================== main page === */

function buildIndex() {
  let html = fs.readFileSync(path.join(SRC, 'HSK Performance Center.dc.html'), 'utf8');

  html = stripOmelette(html);
  html = html.replace(/<script src="\.\/support\.js"><\/script>\s*/g, '');
  must(!/support\.js/.test(html), 'support.js reference left');
  html = html.replace(/<template id="__bundler_thumbnail"[\s\S]*?<\/template>\s*/g, '');
  must(!/__bundler_thumbnail/.test(html), 'bundler thumbnail left');

  const logic = extractLogic(html);
  html = logic.html;

  const hel = extractHelmet(html);
  html = hel.html;
  let helmet = hel.helmet;

  // design-bundler bookkeeping — meaningless outside the design host
  helmet = helmet.replace(/^[ \t]*<meta name="ext-resource-dependency"[^>]*\/>\r?\n?/gm, '');
  must(!/ext-resource-dependency/.test(helmet), 'resource-dependency metas left');
  // charset + viewport already live in <head>
  helmet = helmet.replace(/^[ \t]*<meta charset="utf-8" \/>\r?\n?/m, '');
  helmet = helmet.replace(/^[ \t]*<meta name="viewport"[^>]*\/>\r?\n?/m, '');

  // <x-dc> is the design-component wrapper, not page structure
  html = html.replace(/<x-dc>\s*/, '').replace(/\s*<\/x-dc>/, '');
  must(!/<x-dc|<\/x-dc>/.test(html), 'x-dc wrapper left');

  const sc = convertScIf(html);
  html = sc.html;
  must(sc.count === 2, 'expected 2 sc-if blocks, got ' + sc.count);

  const hv = extractHover(html, 'h');
  html = hv.html;

  // legal pages get real filenames
  html = html.replace(/href="Impressum\.dc\.html"/g, 'href="impressum.html"');
  html = html.replace(/href="Datenschutz\.dc\.html"/g, 'href="datenschutz.html"');
  must(!/\.dc\.html/.test(html), 'dc.html link left');

  // ---- the header wordmark is 18 single-letter <span>s so each can detonate
  // outward on entry. A screen reader reads that as "P-E-R-F-O-R-M-A-N-C-E",
  // and the word gap is an empty span, so it is not even "Performance Center".
  // The link is already named by the logo's alt text, so the decoration is
  // hidden from assistive tech instead of being re-labelled.
  const wordmark = '<span data-brand-word style=';
  must(html.indexOf(wordmark) > -1, 'brand wordmark anchor not found');
  html = html.replace(wordmark, '<span data-brand-word aria-hidden="true" style=');
  must(/data-brand-word aria-hidden="true"/.test(html), 'wordmark not hidden from AT');

  // ---- portrait reel for phones.
  // The background film is 16:9; on a 9:16 screen object-fit:cover throws away
  // most of every frame. These clips were generated from the studio's own
  // portrait stills (Higgsfield, cinematic_studio_video_v2) so the mobile film
  // is the same room, framed for the phone — and a quarter of the bytes.
  const MOBILE_SHOTS = [
    ['assets/m-racks.mp4', 'Racks'],
    ['assets/m-platform.mp4', 'Plattform'],
    ['assets/m-cardio.mp4', 'Ausdauer'],
    ['assets/m-sprint.mp4', 'Sprintbahn']
  ].filter(([f]) => fs.existsSync(path.join(OUT, f)));

  if (MOBILE_SHOTS.length) {
    must(html.indexOf('<div data-reel data-shots="') > -1, 'reel element anchor not found');
    html = html.replace('<div data-reel data-shots="',
      '<div data-reel data-shots-mobile="' + MOBILE_SHOTS.map(s => s[0]).join(',') + '"' +
      ' data-labels-mobile="' + MOBILE_SHOTS.map(s => s[1]).join(',') + '"' +
      ' data-shots="');
    must(/data-shots-mobile=/.test(html), 'mobile reel attributes not written');
  }

  // ---- hero: the mobile dock occupies the bottom 69px, so the hero's two
  // absolutely-positioned rows get a hook to lift themselves clear of it.
  const heroBlock = 'bottom:clamp(74px,10.5vh,112px);z-index:8';
  must(html.indexOf(heroBlock) > -1, 'hero content row anchor not found');
  html = html.replace('<div style="position:absolute;left:clamp(18px,4vw,64px);right:clamp(18px,4vw,64px);' + heroBlock,
                      '<div data-hero-block style="position:absolute;left:clamp(18px,4vw,64px);right:clamp(18px,4vw,64px);' + heroBlock);
  must(/data-hero-block/.test(html), 'hero content row not tagged');

  const heroMeta = 'bottom:clamp(24px,3.6vh,40px);z-index:8';
  must(html.indexOf(heroMeta) > -1, 'hero meta row anchor not found');
  html = html.replace('<div style="position:absolute;left:clamp(18px,4vw,64px);right:clamp(18px,4vw,64px);' + heroMeta,
                      '<div data-hero-meta style="position:absolute;left:clamp(18px,4vw,64px);right:clamp(18px,4vw,64px);' + heroMeta);
  must(/data-hero-meta/.test(html), 'hero meta row not tagged');

  // the eyebrow is a nowrap flex row; on a narrow screen the pulse dot ends up
  // alone on the first line. Tag it so the mobile layer can wrap it centred.
  const kicker = 'letter-spacing:.28em;text-transform:uppercase;color:#F2F2F5';
  must(html.indexOf(kicker) > -1, 'hero eyebrow anchor not found');
  html = html.replace('<div style="display:flex;align-items:center;gap:12px;font-size:11px;font-weight:500;' + kicker,
                      '<div data-hero-kicker style="display:flex;align-items:center;gap:12px;font-size:11px;font-weight:500;' + kicker);
  must(/data-hero-kicker/.test(html), 'hero eyebrow not tagged');

  // ---- contact form: a live site cannot ship "nothing is sent".
  html = applyFormMode(html);

  // map: consent gate instead of an unconditional third-party embed
  const mapSrc = 'src="https://www.google.com/maps?q=Strackestra%C3%9Fe%2022%2C%2059929%20Brilon&amp;output=embed"';
  must(html.indexOf(mapSrc) > -1, 'map iframe src anchor not found');
  html = html.replace(mapSrc, mapSrc.replace(/^src=/, 'data-src='));
  must(!/<iframe[^>]*\ssrc="https/.test(html), 'a third-party iframe still loads on view');

  const gateAnchor = '    <div data-map-scrim ';
  must(html.indexOf(gateAnchor) > -1, 'map scrim anchor not found');
  html = html.replace(gateAnchor,
    '    <div data-map-gate>\n' +
    '      <div data-map-gate-inner>\n' +
    '        <span data-map-gate-kicker>Karte</span>\n' +
    '        <p>Die Karte wird von Google Maps geladen. Dabei wird deine IP-Adresse an Google übertragen.</p>\n' +
    '        <button data-map-accept type="button">Karte laden</button>\n' +
    '        <a href="https://www.google.com/maps/search/?api=1&amp;query=Strackestra%C3%9Fe+22+59929+Brilon" target="_blank" rel="noopener noreferrer">In Google Maps öffnen &#8599;</a>\n' +
    '      </div>\n' +
    '    </div>\n' + gateAnchor);

  // menu overlay: reachable links to the legal pages, so the mobile menu really
  // navigates the whole site and not just the sections of this one
  const ovAnchor = '    <div data-ov-foot style="flex:0 0 auto;';
  must(html.indexOf(ovAnchor) > -1, 'overlay foot anchor not found');
  html = html.replace(ovAnchor,
    '    <div data-ov-legal>\n' +
    '      <a href="#start">Startseite</a>\n' +
    '      <a href="impressum.html">Impressum</a>\n' +
    '      <a href="datenschutz.html">Datenschutz</a>\n' +
    '    </div>\n' + ovAnchor);

  const extraCss = fs.readFileSync(path.join(__dirname, 'extra.css'), 'utf8');
  const mobileHtml = fs.readFileSync(path.join(__dirname, 'mobile.html'), 'utf8');

  // ------------------------------------------------------------- assemble
  const bodyStart = html.indexOf('<body>');
  must(bodyStart > -1, 'no <body>');
  let body = html.slice(bodyStart + 6, html.lastIndexOf('</body>'));

  // the mobile chrome lives inside [data-root] so it inherits --acc
  const rootClose = body.lastIndexOf('</div>');
  must(rootClose > -1, 'no [data-root] close');
  body = body.slice(0, rootClose) + '\n' + mobileHtml + '\n' + body.slice(rootClose);

  const page = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${helmet.trim()}
${HEAD_EXTRA(CANONICAL)}
<style>
/* --- generated from style-hover attributes (${hv.count} rules) --- */
${hv.css}
/* --- production + mobile layer --- */
${extraCss}
</style>
<noscript><style>
/* The loading curtain is dismissed by script. Without script it would sit on
   top of the page forever, so retire it and the pointer-only chrome. */
[data-loader],[data-cursor],[data-progress]{display:none!important}
[data-reel] video{display:none!important}
</style></noscript>
</head>
<body>
<a data-skip href="#start">Zum Inhalt springen</a>
${body}
<script src="assets/js/site.js"></script>
<script src="assets/js/mobile.js"></script>
<script src="assets/js/consent.js"></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(OUT, 'index.html'), page, 'utf8');

  // ------------------------------------------------------------- site.js
  const patched = patchLogic(logic.js);
  const defaults = {};
  for (const k of Object.keys(logic.props)) defaults[k] = logic.props[k].default;

  const js = `/* HSK Performance Center — page behaviour.
   Extracted verbatim from the Claude Design source; the design-runtime harness
   (DCLogic / React) is replaced by the small shim at the bottom of this file.
   Patched sections are marked with "HSK-PATCH". */
(function () {
  'use strict';

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { Object.assign(this.state, patch); if (this.__render) this.__render(); }
  }

${patched.replace(/^/gm, '  ')}

  /* ---------------------------------------------------------- runtime shim */
  var app = new Component(${JSON.stringify(defaults)});
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
  var FORM_MODE = ${JSON.stringify(FORM_MODE)};
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
    ].join('\\r\\n');
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
`;
  fs.mkdirSync(path.join(OUT, 'assets/js'), { recursive: true });
  for (const f of ['mobile.js', 'consent.js']) {
    fs.copyFileSync(path.join(__dirname, f), path.join(OUT, 'assets/js', f));
  }
  fs.writeFileSync(path.join(OUT, 'assets/js/site.js'), js, 'utf8');

  return { hover: hv.count, props: defaults };
}

/* The design was authored as a preview: the form sets a "sent" flag and the
   confirmation panel says so out loud. That copy cannot go live.

   FORM_MODE=mailto (default) hands the filled-in enquiry to the visitor's own
   mail client and turns the confirmation panel into a real hand-off with the
   address and phone number, so it works with no backend and no third party.
   FORM_MODE=demo restores the original preview wording verbatim. */
const FORM_MODE = process.env.HSK_FORM_MODE || 'mailto';

function applyFormMode(html) {
  if (FORM_MODE === 'demo') return html;
  must(FORM_MODE === 'mailto', 'unknown HSK_FORM_MODE: ' + FORM_MODE);

  const oldBody = 'In dieser Vorschau wird nichts versendet — im Livebetrieb landet die Anfrage direkt bei sb@hsk.fitness.';
  must(html.indexOf(oldBody) > -1, 'confirmation copy anchor not found');
  html = html.replace(oldBody,
    'Deine Anfrage ist fertig und geht per E-Mail an sb@hsk.fitness. ' +
    'Falls sich kein Mailprogramm öffnet, ruf einfach durch — wir sind täglich von 06 bis 24 Uhr da.');

  // action row inside the confirmation panel, so the hand-off never dead-ends
  const panelEnd = '</p>\n      </div>\n    </div>\n    <div data-if="notSent"';
  must(html.indexOf(panelEnd) > -1, 'confirmation panel end anchor not found');
  html = html.replace(panelEnd,
    '</p>\n' +
    '        <div data-sent-actions>\n' +
    '          <a data-sent-mail href="mailto:sb@hsk.fitness">E-Mail öffnen</a>\n' +
    '          <a data-sent-call href="tel:+4916090285812">0160 90285812 anrufen</a>\n' +
    '        </div>\n' +
    '      </div>\n    </div>\n    <div data-if="notSent"');

  const oldNote = 'Demo-Formular · es wird nichts versendet';
  must(html.indexOf(oldNote) > -1, 'form note anchor not found');
  html = html.replace(oldNote, 'Geht per E-Mail an sb@hsk.fitness · keine Speicherung auf dieser Seite');

  return html;
}

/* Controlled edits to the extracted logic. Each one is asserted so a source
   change upstream breaks the build instead of silently dropping a feature. */
function patchLogic(js) {
  // 1) mobile background reel: portrait clips when the viewport is phone-shaped
  const anchor = "const shots = (stage.dataset.shots || '').split(',').map(s => this.res(s.trim())).filter(Boolean);\n" +
                 "    const labels = (stage.dataset.labels || '').split(',').map(s => s.trim());";
  must(js.indexOf(anchor) > -1, 'patch 1 anchor (bootReel shot list) not found');
  js = js.replace(anchor,
    "// HSK-PATCH: phones get the portrait-native reel (9:16 clips, lighter payload)\n" +
    "    const portrait = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;\n" +
    "    const shotAttr = (portrait && stage.dataset.shotsMobile) ? stage.dataset.shotsMobile : stage.dataset.shots;\n" +
    "    const labelAttr = (portrait && stage.dataset.labelsMobile) ? stage.dataset.labelsMobile : stage.dataset.labels;\n" +
    "    const shots = (shotAttr || '').split(',').map(s => this.res(s.trim())).filter(Boolean);\n" +
    "    const labels = (labelAttr || '').split(',').map(s => s.trim());");

  // 2) the burger also drives the mobile drawer state used by the CSS layer
  const menuAnchor = "document.documentElement.style.overflow = (open || this._locked) ? 'hidden' : '';";
  must(js.indexOf(menuAnchor) > -1, 'patch 2 anchor (setMenu overflow) not found');
  js = js.replace(menuAnchor,
    "document.documentElement.style.overflow = (open || this._locked) ? 'hidden' : '';\n" +
    "    // HSK-PATCH: expose menu state for the mobile chrome + a11y\n" +
    "    document.documentElement.dataset.menu = open ? 'open' : 'closed';\n" +
    "    const btn = document.querySelector('[data-menu-btn]');\n" +
    "    if (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen'); }\n" +
    "    if (ov) ov.setAttribute('aria-hidden', open ? 'false' : 'true');");

  // 3) the reel is the heaviest asset on the page: honour Save-Data / 2G
  const armAnchor = "  armReel() {\n    const r = this.reel;\n    if (!r || r.armed) return;";
  must(js.indexOf(armAnchor) > -1, 'patch 3 anchor (armReel) not found');
  js = js.replace(armAnchor,
    "  armReel() {\n    const r = this.reel;\n    if (!r || r.armed) return;\n" +
    "    // HSK-PATCH: never pull video on a metered or very slow connection —\n" +
    "    // the poster frame stays and the page reads exactly the same\n" +
    "    const c = navigator.connection;\n" +
    "    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) { r.armed = true; return; }\n" +
    "    // HSK-PATCH: a full-screen film that plays for minutes is exactly what\n" +
    "    // prefers-reduced-motion asks us not to do (WCAG 2.2.2). Poster only.\n" +
    "    if (this.reduced) { r.armed = true; return; }");

  // 5) the loading curtain is dismissed by script. <noscript> covers "script is
  //    off"; this covers "script is on but never ran" (blocked, 404, throw).
  //    The CSS failsafe in extra.css lifts it after 8s — later than every JS
  //    path — and JS cancels the animation the moment it takes ownership.
  const bootedAnchor = "el.dataset.booted = '1';";
  must(js.indexOf(bootedAnchor) > -1, 'patch 5 anchor (loader booted flag) not found');
  js = js.replace(bootedAnchor,
    bootedAnchor + "\n" +
    "    // HSK-PATCH: script is alive, so it owns the curtain — drop the CSS failsafe\n" +
    "    el.style.animation = 'none';");

  // 4) the stacked-map branch hides every direct child div of [data-map-wrap]
  //    (they are all scrims). The consent gate is not a scrim and must survive.
  const scrimAnchor = "const scrims = mapWrap.querySelectorAll(':scope > div:not([data-map-pin])');";
  must(js.indexOf(scrimAnchor) > -1, 'patch 4 anchor (map scrims) not found');
  js = js.replace(scrimAnchor,
    "// HSK-PATCH: keep the consent gate out of the scrim sweep\n" +
    "      const scrims = mapWrap.querySelectorAll(':scope > div:not([data-map-pin]):not([data-map-gate])');");

  return js;
}

/* ====================================================== legal sub-pages === */

function buildLegal(srcName, outName, prefix) {
  let html = fs.readFileSync(path.join(SRC, srcName), 'utf8');
  html = stripOmelette(html);
  html = html.replace(/<script src="\.\/support\.js"><\/script>\s*/g, '');
  html = html.replace(/<template id="__bundler_thumbnail"[\s\S]*?<\/template>\s*/g, '');

  let logicJs = null, props = {};
  const lm = html.match(/<script type="text\/x-dc" data-dc-script(?:\s+data-props="([^"]*)")?>([\s\S]*?)<\/script>/);
  if (lm) {
    if (lm[1]) {
      const p = JSON.parse(lm[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      for (const k of Object.keys(p)) props[k] = p[k].default;
    }
    logicJs = lm[2];
    html = html.replace(lm[0], '');
  }

  const hel = extractHelmet(html);
  html = hel.html;
  let helmet = hel.helmet
    .replace(/^[ \t]*<meta name="ext-resource-dependency"[^>]*\/>\r?\n?/gm, '')
    .replace(/^[ \t]*<meta charset="utf-8" \/>\r?\n?/m, '')
    .replace(/^[ \t]*<meta name="viewport"[^>]*\/>\r?\n?/m, '');

  // DSGVO: no third-party font request. Same families, served from the repo
  // (see legal.css for the local @font-face block that replaces them).
  const hadGoogle = /fonts\.(googleapis|gstatic)\.com/.test(helmet);
  must(hadGoogle, outName + ': expected Google Fonts links to strip');
  helmet = helmet
    .replace(/^[ \t]*<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*\/>\r?\n?/gm, '')
    .replace(/^[ \t]*<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet" \/>\r?\n?/gm, '');
  must(!/fonts\.(googleapis|gstatic)\.com/.test(helmet), outName + ': Google Fonts link left');

  // The EU Online Dispute Resolution platform was shut down; pointing at it as
  // an existing service is simply wrong now. The § 36 VSBG statement stays.
  const odr = 'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit. ';
  if (html.indexOf(odr) > -1) html = html.replace(odr, '');
  must(!/Plattform zur Online-Streitbeilegung/.test(html), outName + ': stale ODR reference left');

  html = html.replace(/<x-dc>\s*/, '').replace(/\s*<\/x-dc>/, '');
  const hv = extractHover(html, prefix);
  html = hv.html;

  html = html.replace(/href="Impressum\.dc\.html"/g, 'href="impressum.html"')
             .replace(/href="Datenschutz\.dc\.html"/g, 'href="datenschutz.html"')
             .replace(/href="HSK Performance Center\.dc\.html"/g, 'href="index.html"');
  must(!/\.dc\.html/.test(html), outName + ': dc.html link left');

  const bodyStart = html.indexOf('<body>');
  const body = html.slice(bodyStart + 6, html.lastIndexOf('</body>'));
  const legalCss = fs.readFileSync(path.join(__dirname, 'legal.css'), 'utf8');

  // the page's logic goes to its own file: an inline <script> would need either
  // 'unsafe-inline' or a hash that silently rots on the next edit
  let scriptTag = '';
  if (logicJs) {
    const jsName = 'assets/js/' + outName.replace(/\.html$/, '') + '.js';
    fs.mkdirSync(path.join(OUT, 'assets/js'), { recursive: true });
    fs.writeFileSync(path.join(OUT, jsName),
      '/* ' + outName + ' — extracted from the Claude Design source. Generated; do not edit. */\n' +
      '(function () {\n  "use strict";\n' +
      '  class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(x) { Object.assign(this.state, x); } }\n\n' +
      logicJs.replace(/^/gm, '  ') + '\n\n' +
      '  var app = new Component(' + JSON.stringify(props) + ');\n' +
      '  function boot() { if (app.componentDidMount) app.componentDidMount(); }\n' +
      '  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);\n' +
      '  else boot();\n})();\n', 'utf8');
    scriptTag = '<script src="' + jsName + '"></script>';
  }

  const page = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
${helmet.trim()}
<meta name="robots" content="noindex,follow" />
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png" />
<style>
${hv.css}
${legalCss}
</style>
</head>
<body>
${body}
${scriptTag}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, outName), page, 'utf8');
  return { hover: hv.count, hadLogic: !!logicJs };
}

/* ============================================== static support files === */

function buildStatic() {
  const base = CANONICAL.replace(/\/$/, '');

  fs.writeFileSync(path.join(OUT, 'site.webmanifest'), JSON.stringify({
    name: 'HSK Performance Center',
    short_name: 'HSK',
    description: 'Leistungsorientiertes Fitnessstudio in Brilon.',
    lang: 'de',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: 'assets/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'assets/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  }, null, 2), 'utf8');

  fs.writeFileSync(path.join(OUT, 'robots.txt'),
    'User-agent: *\nAllow: /\nDisallow: /build/\nDisallow: /src/\n\nSitemap: ' + base + '/sitemap.xml\n', 'utf8');

  // lastmod is deliberately absent: a wrong date is worse than none
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + base + '/</loc><priority>1.0</priority></url>\n' +
    '</urlset>\n', 'utf8');

  const notFound = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Seite nicht gefunden — HSK Performance Center</title>
<meta name="robots" content="noindex,follow">
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<style>
@font-face{font-family:'Bricolage Grotesque';font-weight:200 800;font-display:swap;src:url(assets/fonts/bricolage-grotesque-normal-200_800.woff2) format('woff2')}
@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;font-display:swap;src:url(assets/fonts/instrument-serif-italic-400.woff2) format('woff2')}
@font-face{font-family:'Manrope';font-weight:300 700;font-display:swap;src:url(assets/fonts/manrope-normal-300_700.woff2) format('woff2')}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#000;color:#F4F2EF;font-family:Manrope,'Helvetica Neue',Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
main{position:relative;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:clamp(28px,6vw,80px);text-align:center;overflow:hidden}
.bg{position:absolute;inset:0;background:url(assets/cine-rise-poster.jpg) center/cover no-repeat;opacity:.16;filter:grayscale(.4)}
.veil{position:absolute;inset:0;background:radial-gradient(120% 92% at 50% 45%,rgba(0,0,0,.35) 0%,rgba(0,0,0,.86) 62%,#000 100%)}
.in{position:relative;display:flex;flex-direction:column;align-items:center;gap:22px;max-width:52ch}
img{height:clamp(40px,7vw,74px);width:auto;filter:drop-shadow(0 0 30px rgba(225,6,0,.45))}
h1{margin:0;font-family:'Bricolage Grotesque',Manrope,sans-serif;font-weight:800;font-size:clamp(52px,13vw,168px);line-height:.9;letter-spacing:-.04em}
h1 em{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;color:#E10600}
p{margin:0;font-size:clamp(14px,1.1vw,16.5px);line-height:1.75;color:#B4B4BB;text-wrap:pretty}
a{display:inline-flex;align-items:center;gap:11px;margin-top:8px;padding:16px 30px;border-radius:100px;background:#E10600;color:#fff;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;transition:box-shadow .4s ease,transform .4s cubic-bezier(.16,1,.3,1)}
a:hover{box-shadow:0 0 34px rgba(225,6,0,.55);transform:translateY(-2px)}
</style>
</head>
<body>
<main>
  <div class="bg"></div><div class="veil"></div>
  <div class="in">
    <img src="assets/hsk-logo.svg" alt="HSK Performance Center">
    <h1>4<em>0</em>4</h1>
    <p>Diese Seite gibt es nicht. Vielleicht ein alter Link — oder ein Tippfehler. Die Trainingsfläche steht aber noch.</p>
    <a href="./">Zur Startseite</a>
  </div>
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, '404.html'), notFound, 'utf8');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');
}

/* ================================================================= run === */

fs.mkdirSync(OUT, { recursive: true });
const idx = buildIndex();
const imp = buildLegal('Impressum.dc.html', 'impressum.html', 'i');
const dat = buildLegal('Datenschutz.dc.html', 'datenschutz.html', 'd');
buildStatic();

console.log('canonical      : ' + CANONICAL);
console.log('form mode      : ' + FORM_MODE);
console.log('index.html      hover rules: ' + idx.hover + '  props: ' + JSON.stringify(idx.props));
console.log('impressum.html  hover rules: ' + imp.hover + '  logic: ' + imp.hadLogic);
console.log('datenschutz.html hover rules: ' + dat.hover + '  logic: ' + dat.hadLogic);
console.log('OK');
