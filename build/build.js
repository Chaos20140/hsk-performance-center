/* HSK Performance Center — Build (v2, „Redesign").
   Baut aus dem Claude-Design-Original (src/HSK Performance Center.dc.html) die
   deploybare Site: Startseite 1:1, dazu die im Design verlinkten Unterseiten,
   die Rechtsseiten und die statischen Nebendateien. Reines Node, keine
   Abhängigkeiten. Jeder Eingriff in den Design-Quelltext ist an einem exakten
   String verankert (must) — ändert sich das Original, bricht der Build laut ab. */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const OUT = path.resolve(__dirname, '..');
const fail = (m) => { console.error('BUILD FAIL: ' + m); process.exit(1); };
const must = (cond, m) => { if (!cond) fail(m); };

// Ohne Zieladresse gäbe es auslieferfähige Dateien mit falschem canonical/og:url —
// lieber laut scheitern als still eine Platzhalter-Adresse einbauen.
must(process.env.HSK_CANONICAL, 'HSK_CANONICAL fehlt (z. B. https://chaos20140.github.io/hsk-performance-center/)');
const CANONICAL = process.env.HSK_CANONICAL.replace(/\/?$/, '/');
must(/^https:\/\/[^/]+\//.test(CANONICAL), 'HSK_CANONICAL muss eine https-Adresse sein');
const ORIGIN = new URL(CANONICAL).origin;
const BASE = new URL(CANONICAL).pathname;            // z. B. /hsk-performance-center/
const FORM_MODE = process.env.HSK_FORM_MODE || 'mailto';
must(FORM_MODE === 'mailto' || FORM_MODE === 'demo', 'HSK_FORM_MODE muss mailto oder demo sein, nicht ' + FORM_MODE);
const read = (p) => fs.readFileSync(p, 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const count = (re, s) => (s.match(re) || []).length;

/* ------------------------------------------------------------ transforms */

function stripOmelette(html) {
  const before = html.length;
  html = html.replace(/<style data-omelette-injected>[\s\S]*?<\/style>/g, '');
  html = html.replace(/<script data-omelette-injected>[\s\S]*?<\/script>/g, '');
  must(html.length < before, 'omelette preamble not found');
  must(!/data-omelette-injected/.test(html), 'omelette leftovers');
  html = html.replace(/<script src="\.\/support\.js"><\/script>\s*/g, '');
  must(!/support\.js/.test(html), 'support.js reference left');
  return html;
}

function extractHelmet(html) {
  const m = html.match(/<helmet>([\s\S]*?)<\/helmet>/);
  must(m, '<helmet> block not found');
  return { html: html.replace(m[0], ''), helmet: m[1] };
}

/* Die Logik des Designs (class Component extends DCLogic). v2 hat kein
   data-props-Attribut mehr — der Zustand steht als Klassenfeld im Skript. */
function extractLogic(html) {
  const m = html.match(/<script type="text\/x-dc" data-dc-script>([\s\S]*?)<\/script>/);
  must(m, 'data-dc-script block not found');
  return { html: html.replace(m[0], ''), js: m[1] };
}

// "a:b;c:d" -> "a:b !important;c:d !important"  (Inline-Styles schlägt nur !important)
function important(decls) {
  return decls.split(';').map(s => s.trim()).filter(Boolean)
    .map(d => (/!important$/i.test(d) ? d : d + ' !important')).join(';');
}

/* style-hover="…" ist ein Design-Host-Feature; support.js kennt es nicht.
   → data-hh="N" + echte :hover-Regel, nur für Zeigegeräte. */
function extractHover(html, prefix, counter) {
  const rules = [];
  html = html.replace(/\s+style-hover="([^"]*)"/g, (_, decls) => {
    const id = prefix + (++counter.n);
    rules.push('[data-hh="' + id + '"]:hover{' + important(decls) + '}');
    return ' data-hh="' + id + '"';
  });
  must(!/style-hover=/.test(html), 'style-hover leftovers');
  return { html, rules };
}

/* <sc-if value="{{ x }}" hint-placeholder-val="{{ true|false }}"> → <div data-if="x">
   Der Startzustand kommt aus dem Platzhalter-Hinweis, damit die Seite ohne
   Skript genau so aussieht wie der erste Render des Designs. */
function convertScIf(html) {
  let n = 0;
  html = html.replace(/<sc-if\s+value="\{\{\s*([A-Za-z0-9_$]+)\s*\}\}"\s+hint-placeholder-val="\{\{\s*(true|false)\s*\}\}"\s*>/g, (_, name, init) => {
    n++;
    return '<div data-if="' + name + '" style="display:' + (init === 'true' ? 'contents' : 'none') + '">';
  });
  html = html.replace(/<\/sc-if>/g, '</div>');
  must(!/<sc-if|<\/sc-if>|hint-placeholder-val/.test(html), 'sc-if leftovers');
  return { html, count: n };
}

/* onClick="{{ fn }}" / onPointerEnter="{{ fn }}" → data-on-click="fn" …
   Der Shim in site.js hängt dafür echte Listener an. */
function convertHandlers(html) {
  let n = 0;
  html = html.replace(/\son([A-Z][A-Za-z]+)="\{\{\s*([A-Za-z0-9_$]+)\s*\}\}"/g, (_, ev, fn) => {
    n++;
    return ' data-on-' + ev.toLowerCase() + '="' + fn + '"';
  });
  return { html, count: n };
}

/* {{ statusText }} als Textknoten → <span data-text="statusText"></span> */
function convertText(html) {
  let n = 0;
  html = html.replace(/\{\{\s*([A-Za-z0-9_$]+)\s*\}\}/g, (_, name) => { n++; return '<span data-text="' + name + '"></span>'; });
  must(!/\{\{/.test(html), 'mustache leftovers in markup');
  return { html, count: n };
}

/* Das Design verlinkt Unterseiten als .dc.html — hier bekommen sie ihre
   echten Dateinamen. Unbekannte .dc.html-Ziele lassen den Build scheitern. */
const PAGE_MAP = {
  'HSK Performance Center.dc.html': './',   // die Startseite heißt kanonisch „/", nicht index.html
  'Coaching.dc.html': 'coaching.html',
  'Galerie.dc.html': 'galerie.html',
  'Termine.dc.html': 'termine.html',
  'Mitglied werden.dc.html': 'mitglied-werden.html',
  'Preise.dc.html': 'preise.html',
  'Impressum.dc.html': 'impressum.html',
  'Datenschutz.dc.html': 'datenschutz.html'
};
function rewritePageLinks(html) {
  html = html.replace(/href="([^"]*\.dc\.html)([#?][^"]*)?"/g, (_, file, tail) => {
    must(PAGE_MAP[file], 'unknown design page link: ' + file);
    return 'href="' + PAGE_MAP[file] + (tail || '') + '"';
  });
  must(!/\.dc\.html/.test(html), 'dc.html link left');
  return html;
}

/* Die Clips zeigten per absoluter URL auf die Live-Seite (das Design lief im
   Host ohne die Videos). Hier liegen sie im Repo — also relativ. */
const LIVE_ASSETS = 'https://chaos20140.github.io/hsk-performance-center/assets/';
function localizeMedia(s) {
  const before = count(/https:\/\/chaos20140\.github\.io\/hsk-performance-center\/assets\//g, s);
  s = s.split(LIVE_ASSETS).join('assets/');
  must(!/chaos20140\.github\.io/.test(s), 'live-site URL left');
  return { s, count: before };
}

/* Bilder unterhalb des Hero laden faul; das Logo und alles im Hero nicht. */
function lazyImages(html) {
  return html.replace(/<img (?![^>]*loading=)([^>]*src="assets\/(?!hsk-logo)[^"]*"[^>]*)>/g, '<img loading="lazy" decoding="async" $1>');
}

/* Auf Unterseiten zeigen die Anker der Leiste/des Menüs/des Footers zurück
   auf die Startseite. */
function anchorsToIndex(html) {
  return html.replace(/href="#top"/g, 'href="./"').replace(/href="#([A-Za-z0-9_-]+)"/g, 'href="./#$1"');
}

/* Ein Block von einem Start-String bis zum passenden schließenden Tag. Zählt
   verschachtelte gleichnamige Tags mit, damit z. B. ein <div> mit inneren <div>s
   vollständig erwischt wird. */
function cutBlock(html, startMarker, tag, label) {
  const start = html.indexOf(startMarker);
  must(start > -1, 'block not found: ' + label);
  const open = new RegExp('<' + tag + '(\\s|>)', 'g');
  const close = '</' + tag + '>';
  let depth = 0, i = start;
  for (;;) {
    open.lastIndex = i;
    const o = open.exec(html);
    const c = html.indexOf(close, i);
    must(c > -1, 'block end not found: ' + label);
    if (o && o.index < c) { depth++; i = o.index + 1; continue; }
    depth--;
    i = c + close.length;
    if (depth === 0) break;
  }
  return { block: html.slice(start, i), rest: html.slice(0, start) + html.slice(i), start, end: i };
}

/* Alle Umformungen, die jeder Seitenteil durchläuft. */
function processFragment(html, hoverPrefix, counter) {
  html = convertScIf(html).html;
  html = convertHandlers(html).html;
  html = convertText(html).html;
  const hv = extractHover(html, hoverPrefix, counter);
  html = rewritePageLinks(hv.html);
  html = localizeMedia(html).s;
  html = lazyImages(html);
  // Alle Videos sind stumme Atmosphäre; das Bild daneben trägt den Alt-Text.
  html = html.replace(/<video( [^>]*)>/g, '<video$1 aria-hidden="true">');
  return { html, rules: hv.rules };
}

/* ------------------------------------------------------------- head bits */

/* GitHub Pages setzt keine Antwort-Header; die Policy lebt deshalb im <meta>.
   default-src 'none' + Allowlist: die Seite lädt nichts außer sich selbst,
   die einzige Fremd-Einbettung ist die (per Klick freigegebene) Karte. */
const CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'self' mailto:",       // ohne Skript geht das Formular als mailto: raus
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",   // das Design besteht aus Inline-Styles
  "img-src 'self'",
  "media-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src https://www.google.com"
].join('; ');

const FONT_FILES = [
  'big-shoulders-display-normal-100_900.woff2',
  'ibm-plex-mono-normal-400.woff2',
  'ibm-plex-mono-normal-500.woff2',
  'schibsted-grotesk-normal-400_900.woff2'
];

function head(meta) {
  const url = CANONICAL + (meta.file === 'index.html' ? '' : meta.file);
  const og = CANONICAL + 'assets/cine-rise-poster.jpg';
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<title>' + esc(meta.title) + '</title>',
    '<meta name="description" content="' + esc(meta.desc) + '">',
    meta.noindex ? '<meta name="robots" content="noindex,follow">' : '',
    '<link rel="canonical" href="' + url + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="de_DE">',
    '<meta property="og:site_name" content="HSK Performance Center">',
    '<meta property="og:title" content="' + esc(meta.title) + '">',
    '<meta property="og:description" content="' + esc(meta.desc) + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + og + '">',
    '<meta property="og:image:width" content="1600">',
    '<meta property="og:image:height" content="900">',
    '<meta property="og:image:alt" content="Die Halle des HSK Performance Center in Brilon">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="theme-color" content="#050506">',
    '<meta name="color-scheme" content="dark">',
    '<meta name="format-detection" content="telephone=no">',
    '<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">',
    '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">',
    '<link rel="manifest" href="site.webmanifest">',
    FONT_FILES.map(f => '<link rel="preload" as="font" type="font/woff2" href="assets/fonts/' + f + '" crossorigin>').join('\n'),
    meta.file === 'index.html' ? jsonLd() : ''
  ].filter(Boolean).join('\n');
}

/* Strukturierte Daten für die Startseite — nur verbürgte Angaben. JSON-LD wird
   nicht ausgeführt, die CSP (script-src) greift dafür nicht. */
function jsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ExerciseGym',
    name: 'HSK Performance Center',
    url: CANONICAL,
    image: CANONICAL + 'assets/cine-rise-poster.jpg',
    telephone: '+49 160 90285812',
    email: 'sb@hsk.fitness',
    address: { '@type': 'PostalAddress', streetAddress: 'Strackestraße 22', postalCode: '59929', addressLocality: 'Brilon', addressCountry: 'DE' },
    geo: { '@type': 'GeoCoordinates', latitude: 51.3956, longitude: 8.5681 },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '06:00', closes: '24:00' }],
    founder: { '@type': 'Person', name: 'Steve Brenke' },
    sameAs: ['https://www.facebook.com/HSKPerformancecenter/']
  };
  return '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
}

/* ================================================================= main === */

function build() {
  let html = read(path.join(SRC, 'HSK Performance Center.dc.html'));
  html = stripOmelette(html);

  const logic = extractLogic(html);
  html = logic.html;

  const hel = extractHelmet(html);
  html = hel.html;
  let helmet = hel.helmet;

  // DSGVO: keine Schriften von Google. Dieselben Familien liegen im Repo.
  must(/fonts\.googleapis\.com/.test(helmet), 'expected Google Fonts link in helmet');
  helmet = helmet
    .replace(/^[ \t]*<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\r?\n?/gm, '')
    .replace(/^[ \t]*<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet">\r?\n?/gm, '')
    .replace(/^[ \t]*<meta name="viewport"[^>]*>\r?\n?/m, '');
  must(!/fonts\.(googleapis|gstatic)\.com|<link|<meta/.test(helmet), 'helmet still carries links/metas');
  const sysStyle = helmet.match(/<style>([\s\S]*?)<\/style>/);
  must(sysStyle, 'helmet style block not found');
  const designCss = sysStyle[1].trim();

  html = html.replace(/<x-dc>\s*/, '').replace(/\s*<\/x-dc>/, '');
  must(!/<x-dc|<\/x-dc>/.test(html), 'x-dc wrapper left');
  const bodyStart = html.indexOf('<body>');
  must(bodyStart > -1, 'no <body>');
  let body = html.slice(bodyStart + 6, html.lastIndexOf('</body>')).trim();

  // ---- Inhaltliche Anker, bevor irgendetwas umgeformt wird -------------------
  // Preis-Karten und Partner-Anfrage tragen ihr Anliegen in den Link — das
  // Formular auf „Mitglied werden" wählt den Eintrag dann vor.
  {
    const card = 'href="Mitglied werden.dc.html" style="margin-top:auto;';
    must(count(new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), body) === 3, 'expected 3 price-card links');
    const ziel = ['jahr', 'halbjahr', 'monat'];
    let k = 0;
    body = body.split(card).map((part, i, arr) => i < arr.length - 1 ? part + 'href="Mitglied werden.dc.html?ziel=' + ziel[k++] + '" style="margin-top:auto;' : part).join('');
    const partner = 'href="Mitglied werden.dc.html" style="display:inline-flex;align-items:center;gap:12px;background:#E10600;color:#fff;padding:15px 24px;';
    must(body.indexOf(partner) > -1, 'partner enquiry link not found');
    body = body.replace(partner, partner.replace('Mitglied werden.dc.html', 'Mitglied werden.dc.html?ziel=partner'));
  }

  // Der Karten-<iframe> im Design trägt src — in einem display:none-Block lädt
  // ein iframe trotzdem. Also data-src; site.js setzt src erst nach dem Klick.
  {
    const mapSrc = 'src="https://www.google.com/maps?q=Strackestra%C3%9Fe%2022%2C%2059929%20Brilon&amp;output=embed"';
    must(body.indexOf(mapSrc) > -1, 'map iframe src not found');
    body = body.replace(mapSrc, 'data-map-frame data-' + mapSrc);
    must(!/<iframe[^>]*\ssrc="https/.test(body), 'a third-party iframe still loads on view');
    // Das Element-Attribut würde die Seiten-Policy aufweichen (volle URL an Google)
    const rp = 'referrerpolicy="no-referrer-when-downgrade"';
    must(body.indexOf(rp) > -1, 'map referrerpolicy not found');
    body = body.replace(rp, 'referrerpolicy="strict-origin-when-cross-origin"');
    // Der Hinweis nennt nur die IP; Google setzt im Kartenfenster auch Cookies
    const gate = 'Die Karte wird von Google Maps geladen. Dabei wird deine IP-Adresse an Google übertragen.';
    must(body.indexOf(gate) > -1, 'map gate copy not found');
    body = body.replace(gate, 'Die Karte wird von Google Maps geladen. Dabei wird deine IP-Adresse an Google übertragen und Google kann Cookies setzen.');
  }

  // FAQ-Einleitung: die Nummer ist auf dem Telefon nur als Link wählbar
  // (format-detection=telephone=no schaltet die Auto-Erkennung ab)
  {
    const tel = 'Was nicht dabei ist: kurz anrufen. 0160 90285812, täglich 06–24 Uhr.';
    must(body.indexOf(tel) > -1, 'FAQ intro not found');
    body = body.replace(tel, 'Was nicht dabei ist: kurz anrufen. <a href="tel:+4916090285812" style="color:#F2EFEA;border-bottom:1px solid rgba(225,6,0,.6)">0160 90285812</a>, täglich 06–24 Uhr.');
  }

  // Überschriften-Hierarchie: der Preise-Titel ist im Design der Wipe (ein <div>);
  // Screenreader bekommen eine unsichtbare h2.
  {
    const pre = '<section id="preise" data-screen-label="05 Preise" style="position:relative;background:#E10600;color:#050506;padding:clamp(20px,4vw,60px) clamp(18px,4vw,64px) clamp(90px,11vw,170px)">';
    must(body.indexOf(pre) > -1, 'preise section not found');
    body = body.replace(pre, pre + '\n  <h2 data-sr>Preise — Eine Leistung. Drei Laufzeiten.</h2>');
  }

  // Landmarken benennen, dekorative Nummern verbergen
  {
    const ovNav = '<nav style="display:flex;flex-direction:column">';
    must(body.indexOf(ovNav) > -1, 'overlay nav not found');
    body = body.replace(ovNav, '<nav aria-label="Hauptmenü" style="display:flex;flex-direction:column">');
    const hdNav = '<nav data-navlinks style=';
    must(body.indexOf(hdNav) > -1, 'header nav not found');
    body = body.replace(hdNav, '<nav data-navlinks aria-label="Seitennavigation" style=');
    const numRe = /<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:\.22em;color:#E10600;width:3ch">(\d\d)<\/span>/g;
    must(count(numRe, body) === 7, 'expected 7 overlay numbers');
    body = body.replace(numRe, '<span aria-hidden="true" style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:.22em;color:#E10600;width:3ch">$1</span>');
  }

  // Hero-HUD: „REC" wird zum Knopf, der Film und Laufschriften anhält (WCAG 2.2.2 —
  // bewegter Inhalt länger als 5 s braucht eine Pause). Optik bleibt.
  {
    const rec = '<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:block;width:7px;height:7px;background:#E10600;animation:hs-blink 1.4s steps(1) infinite"></span>REC</span>\n        <span data-reel-label';
    must(body.indexOf(rec) > -1, 'hero REC label not found');
    body = body.replace(rec, '<button type="button" data-reel-toggle aria-pressed="false" aria-label="Film anhalten"><span style="display:block;width:7px;height:7px;background:#E10600;animation:hs-blink 1.4s steps(1) infinite"></span><span data-reel-toggle-text>REC</span></button>\n        <span data-reel-label');
  }

  // Hero-Film: die Quelle wählt site.js (Querformat-Clips am Rechner, die vier
  // Hochkant-Clips auf dem Telefon). Ohne src im Markup lädt das Telefon nicht
  // erst 1,3 MB Querformat, um sie dann zu verwerfen.
  {
    const v0 = 'poster="assets/cine-rise-poster.jpg" src="https://chaos20140.github.io/hsk-performance-center/assets/cine-rise.mp4"';
    must(body.indexOf(v0) > -1, 'hero video layer 0 not found');
    body = body.replace(v0, 'poster="assets/cine-rise-poster.jpg" data-poster-mobile="assets/m-racks-poster.jpg" data-src="assets/cine-rise.mp4" data-src-mobile="assets/m-racks.mp4"');
    must(fs.existsSync(path.join(OUT, 'assets', 'm-racks-poster.jpg')), 'mobile poster missing');
  }

  // Tastatur: FAQ-Zeilen und Bereichs-Zeilen sind klickbare <div>s. Sie bekommen
  // Rolle und Fokus; Enter/Leertaste löst in site.js den Klick aus.
  {
    // FAQ: <h3><button aria-expanded aria-controls> — echte Semantik, Tastatur nativ;
    // der Klick blubbert zum Design-Handler auf dem Kopf-<div>.
    const headRe = /<div data-faq-head onClick="\{\{ toggleFaq \}\}" (style="[^"]*")><h3 (style="[^"]*")>([^<]+)<\/h3><span data-faq-icon /g;
    must(count(headRe, body) === 6, 'expected 6 FAQ heads');
    let n = 0;
    body = body.replace(headRe, (_, s1, s2, q) => '<div data-faq-head onClick="{{ toggleFaq }}" ' + s1 + '><h3 ' + s2 + '><button type="button" data-faq-btn aria-expanded="false" aria-controls="faq-' + (++n) + '">' + q + '</button></h3><span data-faq-icon aria-hidden="true" ');
    let m = 0;
    must(count(/<div data-faq-body style=/g, body) === 6, 'expected 6 FAQ bodies');
    body = body.replace(/<div data-faq-body style=/g, () => '<div data-faq-body id="faq-' + (++m) + '" aria-hidden="true" style=');
    // Bereichs-Zeilen: klickbare <div>s bekommen Rolle, Fokus und einen kurzen Namen
    const names = ['Kraft', 'Athletik', 'Conditioning'];
    const rowRe = /<div data-area-row="(\d)" onClick/g;
    must(count(rowRe, body) === 3, 'expected 3 area rows');
    body = body.replace(rowRe, (_, i) => '<div data-area-row="' + i + '" role="button" tabindex="0" aria-label="Bereich ' + names[+i] + ' anzeigen" onClick');
  }

  // Burger: Zustand für Screenreader (site.js schreibt aria-expanded nach)
  {
    const burger = '<button data-burger aria-label="Menü"';
    must(body.indexOf(burger) > -1, 'burger not found');
    body = body.replace(burger, '<button data-burger type="button" aria-label="Menü" aria-expanded="false" aria-controls="hsk-menu"');
    const overlay = '<div data-overlay style=';
    must(body.indexOf(overlay) > -1, 'overlay not found');
    body = body.replace(overlay, '<div data-overlay id="hsk-menu" style=');
  }

  // ---- Seitenteile herausschneiden (Chrome wird auf allen Seiten wiederverwendet)
  const boot = cutBlock(body, '<sc-if value="{{ booting }}"', 'sc-if', 'boot'); body = boot.rest;
  const progress = cutBlock(body, '<div data-progress', 'div', 'progress'); body = progress.rest;
  const overlay = cutBlock(body, '<sc-if value="{{ menu }}"', 'sc-if', 'overlay'); body = overlay.rest;
  const header = cutBlock(body, '<header data-nav', 'header', 'header'); body = header.rest;
  const footer = cutBlock(body, '<footer data-screen-label="Footer"', 'footer', 'footer'); body = footer.rest;
  const mbar = cutBlock(body, '<div data-mbar', 'div', 'mbar'); body = mbar.rest;
  const grain = cutBlock(body, '<svg aria-hidden="true" style="position:fixed', 'svg', 'grain'); body = grain.rest;
  const loslegen = cutBlock(body, '<section id="loslegen"', 'section', 'loslegen');
  // (loslegen bleibt in der Startseite und wird zusätzlich als Schlussband der Unterseiten benutzt)

  const sections = body.trim();
  must(/^<section id="top"/.test(sections) && /<\/section>$/.test(sections), 'landing body is not a clean run of sections');
  const labels = (sections.match(/data-screen-label="([^"]+)"/g) || []).map(s => s.slice(19, -1));
  must(labels.join('|') === ['01 Hero', '02 Haltung', '03 Trainingsbereiche', '04 Ausstattung', '05 Preise', '06 Partner', '07 FAQ', '08 Standort', '09 Loslegen'].join('|'),
    'unexpected section order: ' + labels.join(', '));

  // Produktions-CSS (Schriften, Fokus, Unterseiten, Rechtsseiten, Druck)
  const siteCss = read(path.join(__dirname, 'site.css'));

  const hoverAll = [];
  const counter = { n: 0 };
  const chrome = {};
  for (const [k, v] of Object.entries({ boot, progress, overlay, header, footer, mbar, grain })) {
    const f = processFragment(v.block, 'c', counter);
    chrome[k] = f.html;
    hoverAll.push(...f.rules);
  }
  const main = processFragment(sections, 'h', counter);
  hoverAll.push(...main.rules);
  const band = processFragment(loslegen.block, 'b', counter);
  hoverAll.push(...band.rules);
  const chromeHover = hoverAll.slice();

  // Gegenprüfung der Design-Mechanik — Zahlen aus dem Original, nicht geraten
  must(count(/data-if="/g, chrome.boot + chrome.overlay + main.html) === 4, 'expected 4 sc-if blocks (booting, menu, mapOn, mapOff)');
  must(count(/data-text="statusText"/g, chrome.overlay + main.html) === 2, 'expected statusText twice');
  must(count(/data-on-/g, chrome.header + chrome.overlay + main.html) === 37, 'expected 37 event bindings, got ' + count(/data-on-/g, chrome.header + chrome.overlay + main.html));
  must(counter.n === 9, 'expected 8 style-hover rules + 1 for the reused Loslegen band, got ' + counter.n);
  must(count(/<video data-reel-layer/g, main.html) === 2, 'expected 2 reel layers');
  must(/data-src="assets\/cine-rise\.mp4" data-src-mobile="assets\/m-racks\.mp4"/.test(main.html), 'hero clip sources not set');

  // ---------------------------------------------------------------- pages
  const hoverCss = (rules) => rules.length ? '@media (hover:hover) and (pointer:fine){\n' + rules.join('\n') + '\n}' : '';

  // „Nach oben" meint die aktuelle Seite — auf Unterseiten also nicht die Startseite
  must(chrome.footer.indexOf('href="#top">NACH OBEN') > -1, 'footer "Nach oben" link not found');
  const footerFor = (sub) => sub
    ? anchorsToIndex(chrome.footer).replace('href="./">NACH OBEN', 'href="#inhalt">NACH OBEN')
    : chrome.footer;

  function page(meta, opts) {
    const sub = meta.file !== 'index.html';
    const fix = (s) => sub ? anchorsToIndex(s) : s;
    const rules = chromeHover.concat(opts.rules || []);
    return '<!DOCTYPE html>\n<html lang="de">\n<head>\n' + head(meta) + '\n<style>\n' +
      '/* --- Design-System (aus dem Claude-Design-Original) --- */\n' + designCss + '\n' +
      '/* --- style-hover → :hover (' + rules.length + ') --- */\n' + hoverCss(rules) + '\n' +
      '/* --- Produktionsschicht --- */\n' + siteCss + '\n</style>\n' +
      '<noscript><style>\n' +
      '/* Ohne Skript: kein Vorhang, kein Menü-Overlay, keine Fortschrittsleiste, kein Reel */\n' +
      '[data-if="booting"],[data-progress],[data-mbar],[data-reel-toggle]{display:none!important}\n' +
      '[data-nav]{animation:none!important;background:rgba(5,5,6,.72)!important}\n' +
      '[style*="animation"]{animation-delay:0s!important}\n' +
      '/* Der Öffnungsstatus kommt aus Skript — ohne Skript steht die feste Zeit */\n' +
      '[data-text="statusText"]::after{content:"TÄGLICH 06 — 24 UHR"}\n' +
      '</style></noscript>\n' +
      '</head>\n<body' + (sub ? ' data-sub' : '') + '>\n' +
      '<a data-skip href="#' + (sub ? 'inhalt' : 'haltung') + '">Zum Inhalt springen</a>\n' +
      (opts.boot ? chrome.boot + '\n' : '') +
      chrome.progress + '\n' +
      fix(chrome.overlay) + '\n' +
      fix(chrome.header) + '\n' +
      '<main id="inhalt">\n' + opts.main + '\n</main>\n' +
      footerFor(sub) + '\n' +
      (opts.mbar === false ? '' : fix(chrome.mbar) + '\n') +
      chrome.grain + '\n' +
      '<script src="assets/js/site.js"></script>\n' +
      '<script src="assets/js/marquee.js"></script>\n' +
      '</body>\n</html>\n';
  }

  const pages = [];
  const emit = (meta, opts) => {
    fs.writeFileSync(path.join(OUT, meta.file), page(meta, opts), 'utf8');
    pages.push(meta);
  };

  emit({
    file: 'index.html',
    title: 'HSK Performance Center — Fitnessstudio in Brilon',
    desc: 'Krafttraining, Personal Training und echte Betreuung in Brilon. Täglich 06–24 Uhr, Strackestraße 22. Probetraining ohne Termin.'
  }, { boot: true, main: main.html });

  // Unterseiten: eigener Inhalt aus build/pages/, Schlussband aus der Startseite
  const subPage = (file, title, desc, extra) => {
    let src = read(path.join(__dirname, 'pages', file));
    if (extra && extra.pre) src = extra.pre(src);
    const c = { n: 0 };
    const f = processFragment(src, file.replace(/\.html$/, '').replace(/[^a-z]/g, '') + '-', c);
    const mainHtml = f.html + (extra && extra.noBand ? '' : '\n' + band.html);
    emit({ file, title, desc }, { main: mainHtml, rules: f.rules, mbar: extra && extra.mbar });
  };

  subPage('coaching.html', 'Coaching & Personal Training — HSK Performance Center',
    'Personal Training in Brilon: Trainingsplanung, Wettkampfvorbereitung, Ernährungsberatung, Rückenfitness. Steve Brenke, Trainer seit 2001.');
  subPage('galerie.html', 'Galerie — HSK Performance Center',
    'Die Halle in Brilon: Sprintbahn, Racks, Lifting-Plattformen, Spiegelwand, Umkleiden. Fotos und Clips aus dem Studio.');
  subPage('termine.html', 'Termine — HSK Performance Center',
    'Probetraining, Beratung vor Ort und aktuelle Termine im HSK Performance Center Brilon.',
    { pre: renderTermine });
  subPage('preise.html', 'Preise — HSK Performance Center',
    'Mitgliedschaft ab 49,90 € im Monat: Jahr, Halbjahr oder monatlich kündbar — immer derselbe Umfang. Alle Details, einmalige Gebühr, Tageskarte, Wellhub.',
    { pre: (s) => s.replace('<!--PREISE-->', () => preiseBlock(sections)) });
  subPage('mitglied-werden.html', 'Mitglied werden — HSK Performance Center',
    'Probetraining oder Mitgliedschaft anfragen. Wir melden uns persönlich — täglich 06–24 Uhr, Strackestraße 22, Brilon.',
    { noBand: true, mbar: false });

  // Rechtsseiten aus den v1-Quellen (Text unverändert), Gestaltung im neuen System
  const legal = (srcName, h1, intro, otherHref, otherLabel) => {
    const f = processFragment(legalPage(srcName, h1, intro, otherHref, otherLabel), 'l', { n: 0 });
    return { main: f.html, rules: f.rules, mbar: false };
  };
  emit({ file: 'impressum.html', title: 'Impressum — HSK Performance Center', noindex: true,
    desc: 'Impressum und Anbieterkennzeichnung des HSK Performance Center, Strackestraße 22, 59929 Brilon.' },
    legal('Impressum.dc.html', 'Impressum', 'Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz) und § 18 Abs. 2 MStV.', 'datenschutz.html', 'Datenschutz'));
  emit({ file: 'datenschutz.html', title: 'Datenschutzerklärung — HSK Performance Center', noindex: true,
    desc: 'Datenschutzerklärung des HSK Performance Center, Brilon: Umgang mit personenbezogenen Daten, Rechtsgrundlagen und Betroffenenrechte.' },
    legal('Datenschutz.dc.html', 'Datenschutz<wbr>erklärung', 'Informationen zur Verarbeitung personenbezogener Daten nach Art. 13 und 14 DSGVO.', 'impressum.html', 'Impressum'));

  // ---------------------------------------------------------------- site.js
  writeSiteJs(logic.js);
  fs.copyFileSync(path.join(__dirname, 'marquee.js'), path.join(OUT, 'assets', 'js', 'marquee.js'));

  buildStatic(pages);

  // Schlussprüfungen über alle erzeugten Seiten
  for (const p of pages) {
    const out = read(path.join(OUT, p.file));
    // (canonical/og-URLs dürfen auf die Live-Adresse zeigen — Medien nicht)
    must(!/style-hover=|\.dc\.html|\{\{|<sc-if|src="https?:\/\/[^"]*\.(mp4|jpg|svg|woff2)"|fonts\.googleapis/.test(out), p.file + ': leftovers');
    // JSON-LD wird nicht ausgeführt; jedes andere Inline-Skript wäre ein CSP-Verstoß
    must(!/<script(?![^>]*\ssrc=)(?![^>]*application\/ld\+json)/.test(out), p.file + ': inline script (CSP)');
    const ext = out.match(/(?:src|href)="https?:\/\/[^"]+"/g) || [];
    for (const e of ext) must(/^(?:src|href)="https:\/\/(www\.google\.com\/maps|www\.facebook\.com\/HSKPerformancecenter\/)/.test(e) || e.startsWith('href="' + CANONICAL), p.file + ': unexpected external reference ' + e);
    for (const m of out.matchAll(/(?:src|href|poster|data-src|data-src-mobile|data-poster-mobile)="(assets\/[^"#?]+)"/g)) must(fs.existsSync(path.join(OUT, m[1])), p.file + ': missing asset ' + m[1]);
    for (const m of out.matchAll(/href="([a-z0-9-]+\.html)/g)) must(fs.existsSync(path.join(OUT, m[1])), p.file + ': dead page link ' + m[1]);
    must(!/href="index\.html/.test(out), p.file + ': links to index.html instead of ./');
  }
  for (const f of FONT_FILES) must(fs.existsSync(path.join(OUT, 'assets', 'fonts', f)), 'font missing: ' + f);
  // die Clip-Listen des Reels (Desktop + Hochkant) müssen im Repo liegen
  const siteJs = read(path.join(OUT, 'assets', 'js', 'site.js'));
  const clips = [...siteJs.matchAll(/\['([a-z-]+)', '\d\d \/ \d\d — /g)].map(m => m[1]);
  must(clips.length === 14, 'expected 14 reel clips in site.js, got ' + clips.length);
  for (const c of clips) must(fs.existsSync(path.join(OUT, 'assets', c + '.mp4')), 'reel clip missing: ' + c);

  console.log('canonical : ' + CANONICAL);
  console.log('form mode : ' + FORM_MODE);
  console.log('pages     : ' + pages.map(p => p.file).join(', '));
  console.log('hover     : ' + counter.n + ' (landing)   bindings: ' + count(/data-on-/g, chrome.header + chrome.overlay + main.html));
  console.log('OK');
}

/* Preisblock der Startseite (Karten + Leistungen), 1:1 für die Preisseite.
   Der Link „Alle Details" zeigt dort auf sich selbst und wird durch die FAQ ersetzt. */
function preiseBlock(sections) {
  const sec = cutBlock(sections, '<section id="preise"', 'section', 'preise').block;
  const inner = cutBlock(sec, '<div style="max-width:1500px;margin:0 auto">', 'div', 'preise inner').block;
  const details = '<a href="Preise.dc.html" style="color:#050506;font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;border-bottom:1px solid #050506;align-self:flex-start;padding-bottom:3px">Alle Details zu den Preisen →</a>';
  must(inner.indexOf(details) > -1, 'price details link not found');
  return inner.replace(details, () => details.replace('href="Preise.dc.html"', 'href="./#faq"').replace('Alle Details zu den Preisen →', 'Fragen? Kurz geklärt in der FAQ →'));
}

/* Termine — aus build/events.json gerendert. Ein neuer Termin ist ein Eintrag
   in der JSON-Datei, kein Markup. */
function renderTermine(src) {
  const events = JSON.parse(read(path.join(__dirname, 'events.json')));
  must(Array.isArray(events) && events.length, 'events.json is empty');
  const rows = events.map((e) => {
    must(!e.ctaHref || /^(#[A-Za-z0-9_-]+|[A-Za-z ]+\.dc\.html(\?[a-z=]+)?|https:\/\/www\.facebook\.com\/)/.test(e.ctaHref), 'events.json: unexpected ctaHref ' + e.ctaHref);
    return `
      <article data-termin>
        <div>
          <div data-termin-wann>${esc(e.wann)}</div>
          <div data-termin-zusatz>${esc(e.zusatz || '')}</div>
        </div>
        <div>
          <h2>${esc(e.titel)}</h2>
          <p>${esc(e.text)}</p>
        </div>
        <div data-termin-tail>
          ${e.status ? '<span data-termin-status><span></span>' + esc(e.status) + '</span>' : ''}
          ${e.ctaHref ? '<a href="' + esc(e.ctaHref) + '">' + esc(e.ctaText || 'Mehr') + ' <span aria-hidden="true">→</span></a>' : ''}
        </div>
      </article>`;
  }).join('\n');
  must(src.indexOf('<!--TERMINE-->') > -1, 'termine placeholder not found');
  return src.replace('<!--TERMINE-->', () => rows);
}

/* ===================================================== Rechtsseiten === */

/* Der Text der v1-Rechtsseiten bleibt wörtlich; nur die Gestaltung wird auf das
   neue System umgestellt. Dafür werden alle Inline-Styles entfernt und die
   Elemente über site.css ([data-legal]) gesetzt. */
function legalPage(srcName, h1, intro, otherHref, otherLabel) {
  let html = read(path.join(SRC, srcName));
  html = stripOmelette(html);
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  must(m, srcName + ': <main> not found');
  let inner = m[1];

  // Kopf (Eyebrow, H1, Intro) und Schlusszeile werden neu gesetzt
  const startMarker = srcName === 'Impressum.dc.html' ? '<section style=' : '<nav data-toc';
  const s = inner.indexOf(startMarker);
  must(s > -1, srcName + ': content start not found');
  const e = inner.indexOf('<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:clamp(48px,6vw,80px)');
  must(e > s, srcName + ': content end not found');
  inner = inner.slice(s, e);

  if (srcName === 'Impressum.dc.html') {
    // Die EU-Plattform zur Online-Streitbeilegung gibt es nicht mehr.
    const odr = 'Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit. ';
    must(inner.indexOf(odr) > -1, 'ODR sentence not found');
    inner = inner.replace(odr, '');
    // Die neue Startseite trägt keine „Musterbild"-Kennzeichnungen mehr (die
    // KI-Musterbilder Coach/Empfang werden nicht mehr gezeigt).
    const bild = ' Entsprechende Abbildungen sind auf der Startseite als „Musterbild" gekennzeichnet.';
    must(inner.indexOf(bild) > -1, 'Bildnachweis sentence not found');
    inner = inner.replace(bild, '');
  } else {
    // Die Erklärung muss zur Site passen — diese Sätze stehen in der Quelle und werden hier festgenagelt
    must(inner.indexOf('Facebook (Fußbereich, Termine) sowie auf Google Maps bzw. Apple Karten (Kartenbereich)') > -1, 'external links sentence missing');
    must(inner.indexOf('Google kann im eingebetteten Kartenfenster eigene Cookies setzen') > -1, 'maps cookie sentence missing');
    must(inner.indexOf('Ihr Anliegen (z.&nbsp;B. Probetraining') > -1, 'form field sentence missing');
    const stand = 'Stand: 2. September 2026';
    must(inner.indexOf(stand) > -1, 'Stand not found');
    inner = inner.replace(stand, 'Stand: 4. September 2026');
    must(!/Platzhalter|\[ … \]/.test(inner), 'placeholder note still present');
  }

  inner = inner.replace(/\s+style="[^"]*"/g, '').replace(/\s+style-hover="[^"]*"/g, '');
  must(!/style=/.test(inner), srcName + ': inline style left');
  inner = inner.replace(/href="HSK Performance Center\.dc\.html"/g, 'href="./"');
  must(!/\.dc\.html/.test(inner), srcName + ': dc link left');
  // Abschnittsnummern sind Dekoration; das Inhaltsverzeichnis ist eine benannte Landmarke
  inner = inner.replace(/<h2><span>(\d\d)<\/span>/g, '<h2><span aria-hidden="true">$1</span>');
  inner = inner.replace('<nav data-toc>', '<nav data-toc aria-label="Inhaltsverzeichnis">');

  return `<section data-legal style="position:relative;background:#050506;padding:clamp(130px,18vh,210px) clamp(18px,4vw,64px) clamp(90px,11vw,170px)">
  <div style="max-width:860px;margin:0 auto">
    <div style="display:flex;align-items:center;gap:14px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.26em;color:#9A9AA2"><span style="display:block;width:28px;height:1px;background:#E10600"></span>RECHTLICHES</div>
    <h1 style="margin:clamp(22px,3vw,40px) 0 0;font-family:'Big Shoulders Display',Impact,sans-serif;font-weight:900;font-size:clamp(56px,10vw,150px);line-height:.86;text-transform:uppercase;color:#F2EFEA">${h1}<span style="color:#E10600">.</span></h1>
    <p style="margin:clamp(22px,3vw,40px) 0 clamp(44px,6vw,74px);max-width:60ch;font-size:clamp(15px,1.15vw,18px);line-height:1.7;color:#C4C4CA;text-wrap:pretty">${intro}</p>
    <div data-legal-body>
${inner.trim()}
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:clamp(48px,6vw,80px);padding-top:clamp(26px,3.4vw,40px);border-top:1px solid rgba(255,255,255,.12)">
      <a href="./" style="display:inline-flex;align-items:center;gap:12px;background:#E10600;color:#fff;padding:17px 28px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;transition:background .3s,color .3s" style-hover="background:#F2EFEA;color:#050506">Zur Startseite</a>
      <a href="${otherHref}" style="display:inline-flex;align-items:center;gap:12px;color:#F2EFEA;padding:17px 28px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;border:1px solid rgba(255,255,255,.22);transition:border-color .3s,color .3s" style-hover="border-color:#E10600;color:#E10600">${otherLabel}</a>
    </div>
  </div>
</section>`;
}

/* ============================================================ site.js === */

/* Die Design-Logik wird wörtlich übernommen und an markierten Stellen
   (HSK-PATCH) angepasst; der Shim darunter ersetzt die Design-Runtime. */
function patchLogic(js) {
  const patch = (anchor, replacement, label) => {
    must(js.indexOf(anchor) > -1, 'patch anchor not found: ' + label);
    js = js.replace(anchor, replacement);
  };

  // 1) Clips liegen im Repo, nicht auf der Live-Seite
  patch("const base = 'https://chaos20140.github.io/hsk-performance-center/assets/';",
        "const base = 'assets/'; // HSK-PATCH 1: Clips aus dem Repo", 'base url');

  // 2) Vorhang nur dort, wo er existiert (Startseite) — und nie, wenn jemand
  //    per Anker kommt (index.html#preise): scrollTo(0,0) würde den Sprung fressen.
  patch("    window.scrollTo(0, 0);\n    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n    if (reduced) { this.setState({ booting: false }); }\n    else {",
        "    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n" +
        "    // HSK-PATCH 2: Vorhang nur mit Vorhang-Markup, nie bei Anker-Aufruf\n" +
        "    const skipBoot = reduced || !document.querySelector('[data-if=\"booting\"]') || !!location.hash;\n" +
        "    if (skipBoot) { this.setState({ booting: false }); this.skipIntroDelays(); }\n" +
        "    else {\n      window.scrollTo(0, 0);", 'boot');

  // 3) Sparsame Verbindung: Poster statt Film, kein Reel.
  // 8) Hochkant-Telefon: die vier Hochkant-Clips (derselbe Raum, fürs Telefon
  //    gerahmt, ein Viertel der Bytes) statt der 16:9-Kinoclips, von denen
  //    object-fit:cover auf 9:16 zwei Drittel wegschneidet. Die Quelle des
  //    ersten Layers wird hier gesetzt, nicht im Markup.
  patch("    this.reel = { base, clips, i: 0, layer: 0, hold: 4600, t0: performance.now(), timer: 0, fails: 0, paused: false, swapping: false };",
        "    // HSK-PATCH 8: Hochkant-Clips auf dem Telefon\n" +
        "    const portrait = !!(window.matchMedia && window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches);\n" +
        "    const mobileClips = [['m-racks', '01 / 04 — RACKS'], ['m-platform', '02 / 04 — PLATTFORM'], ['m-cardio', '03 / 04 — AUSDAUER'], ['m-sprint', '04 / 04 — SPRINTBAHN']];\n" +
        "    const list = portrait ? mobileClips : clips;\n" +
        "    this.reel = { base, clips: list, i: 0, layer: 0, hold: 4600, t0: performance.now(), timer: 0, fails: 0, paused: false, swapping: false };\n" +
        "    this.reel.portrait = portrait;\n" +
        "    const v0 = document.querySelector('[data-reel-layer=\"0\"]');\n" +
        "    if (v0 && portrait && v0.dataset.posterMobile) v0.setAttribute('poster', v0.dataset.posterMobile);\n" +
        "    const lab0 = document.querySelector('[data-reel-label]'); if (lab0) lab0.textContent = list[0][1];\n" +
        "    // HSK-PATCH 3: Save-Data / 2G → das Posterbild bleibt, kein Videoabruf\n" +
        "    const conn = navigator.connection;\n" +
        "    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) {\n" +
        "      if (v0) { v0.removeAttribute('autoplay'); v0.preload = 'none'; }\n" +
        "      this.reel.paused = true; this.reel.saveData = true; return;\n    }\n" +
        "    // Quelle erst setzen, wenn der Hero im Bild ist (sonst lädt ein Anker-Aufruf ins Leere);\n" +
        "    // setReelPaused(false) holt sie nach, sobald jemand hochscrollt\n" +
        "    // (der Sprung zum Anker passiert in Chromium erst nach DOMContentLoaded — der Hash zählt deshalb mit)\n" +
        "    const offscreen = (window.scrollY || 0) >= (window.innerHeight || 1) || (!!location.hash && location.hash !== '#top');\n" +
        "    if (v0 && !v0.getAttribute('src') && !offscreen) {\n" +
        "      v0.src = (portrait && v0.dataset.srcMobile) || v0.dataset.src;\n" +
        "      v0.muted = true; v0.loop = true; const pr = v0.play(); if (pr && pr.catch) pr.catch(() => {});\n" +
        "    }", 'save-data + portrait reel');

  // 9) Layer 1 trägt preload="none": manche Engines schieben den Abruf dann auf, bis
  //    play() kommt — canplay käme nie, der Schnitt liefe in den 9-s-Timeout.
  patch("    nxt.muted = true; nxt.loop = true;\n    nxt.src = r.base + r.clips[next][0] + '.mp4';",
        "    nxt.muted = true; nxt.loop = true;\n    nxt.preload = 'auto'; // HSK-PATCH 9\n    nxt.src = r.base + r.clips[next][0] + '.mp4';", 'cut preload');

  // 10) playAll() hängt an jedem Wheel-/Pointer-/Tastenereignis (Autoplay-Freigabe).
  //     Ungebremst startet es die pausierte oder unsichtbare Reel-Ebene immer wieder.
  patch("  playAll() {\n    document.querySelectorAll('video[autoplay]').forEach((v) => { v.muted = true; v.loop = true; const p = v.play(); if (p && p.catch) p.catch(() => {}); });\n  }",
        "  playAll() {\n" +
        "    // HSK-PATCH 10: die Reel-Ebenen nur anstoßen, wenn das Reel läuft und es die aktive Ebene ist\n" +
        "    const r = this.reel;\n" +
        "    document.querySelectorAll('video[autoplay]').forEach((v) => {\n" +
        "      if (v.hasAttribute('data-reel-layer')) {\n" +
        "        if (!r || r.paused || r.userPaused || r.saveData || String(r.layer) !== v.getAttribute('data-reel-layer') || !v.getAttribute('src')) return;\n" +
        "      }\n" +
        "      v.muted = true; v.loop = true; const p = v.play(); if (p && p.catch) p.catch(() => {});\n" +
        "    });\n  }", 'playAll');

  // 11) Bereichs-Videos nur, wenn die Sektion im Bild ist (vorher startete der erste
  //     Clip schon beim Laden der Seite, der letzte lief nach dem Durchscrollen ewig)
  patch("    const r = sec.getBoundingClientRect();\n    const span = r.height - vh;",
        "    const r = sec.getBoundingClientRect();\n" +
        "    // HSK-PATCH 11: außerhalb des Sichtfelds kein Bereichs-Video\n" +
        "    if (r.top > vh || r.bottom < 0) {\n" +
        "      if (this._activeArea !== -1) { this._activeArea = -1; document.querySelectorAll('[data-area-media] video').forEach((v) => { if (!v.paused) v.pause(); }); }\n" +
        "      return;\n    }\n" +
        "    const span = r.height - vh;", 'areasFx guard');

  // 12) Reel-Start: keine Schnitte bei reduzierter Bewegung (der Film läuft, die
  //     Effekte nicht); pausiert starten, wenn der Hero nicht im Bild ist.
  patch("    this.reel.cutAt = performance.now();\n    this._reelRaf = requestAnimationFrame(this.reelTick);\n    this.scheduleCut();\n  }",
        "    this.reel.cutAt = performance.now();\n    this._reelRaf = requestAnimationFrame(this.reelTick);\n" +
        "    // HSK-PATCH 12\n" +
        "    this.reel.noCuts = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);\n" +
        "    if ((window.scrollY || 0) >= (window.innerHeight || 1) || (!!location.hash && location.hash !== '#top')) { this.setReelPaused(true); return; }\n" +
        "    if (!this.reel.noCuts) this.scheduleCut();\n  }", 'bootReel tail');
  patch("      else if (k === r.layer) { v.muted = true; v.loop = true; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }",
        "      else if (k === r.layer) {\n" +
        "        if (!v.getAttribute('src') && v.dataset.src) v.src = (r.portrait && v.dataset.srcMobile) || v.dataset.src; // HSK-PATCH 12b\n" +
        "        v.muted = true; v.loop = true; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});\n      }", 'setReelPaused src');
  patch("    if (paused) clearTimeout(r.timer); else { r.cutAt = performance.now(); this.scheduleCut(); }",
        "    if (paused) clearTimeout(r.timer); else if (!r.noCuts) { r.cutAt = performance.now(); this.scheduleCut(); }", 'setReelPaused cuts');

  // 13) Pause-Knopf im HUD (WCAG 2.2.2) — ein Nutzerstopp überdauert das Scrollen
  patch("    this.setReelPaused(p >= 1);",
        "    this.setReelPaused(p >= 1 || !!(this.reel && this.reel.userPaused)); // HSK-PATCH 13", 'heroFx pause');
  patch("  setReelPaused(paused) {",
        "  toggleReel() {\n" +
        "    const r = this.reel; if (!r || r.saveData) return;\n" +
        "    r.userPaused = !r.userPaused;\n" +
        "    this.setReelPaused(r.userPaused || (window.scrollY || 0) >= (window.innerHeight || 1));\n" +
        "    document.documentElement.dataset.reel = r.userPaused ? 'paused' : 'playing';\n" +
        "    const b = document.querySelector('[data-reel-toggle]');\n" +
        "    if (b) {\n" +
        "      b.setAttribute('aria-pressed', r.userPaused ? 'true' : 'false');\n" +
        "      b.setAttribute('aria-label', r.userPaused ? 'Film abspielen' : 'Film anhalten');\n" +
        "      const t = b.querySelector('[data-reel-toggle-text]'); if (t) t.textContent = r.userPaused ? 'PAUSE' : 'REC';\n" +
        "    }\n  }\n  setReelPaused(paused) {", 'toggleReel');

  // 14) Öffnungsstatus nach Brilon-Zeit, nicht nach der Uhr des Besuchers
  patch("    const h = new Date().getHours();",
        "    // HSK-PATCH 14\n" +
        "    let h = new Date().getHours();\n" +
        "    try {\n" +
        "      // de-DE formatiert „12 Uhr\" — deshalb formatToParts statt Number(format())\n" +
        "      const part = new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin' }).formatToParts(new Date()).find((p) => p.type === 'hour');\n" +
        "      const bh = part ? parseInt(part.value, 10) : NaN;\n" +
        "      if (!isNaN(bh)) h = bh % 24;\n" +
        "    } catch (e) {}", 'berlin time');
  patch("  bootReel() {\n    const base",
        "  bootReel() {\n    if (!document.querySelector('[data-reel-layer]')) return; // HSK-PATCH 3b: Unterseiten haben kein Reel\n    const base", 'reel guard');
  patch("    const r = this.reel; if (!r || r.paused === paused) return;",
        "    const r = this.reel; if (!r || r.saveData || r.paused === paused) return; // HSK-PATCH 3c", 'setReelPaused guard');

  // 4) Karte: Einwilligung merken, wie auf der alten Seite (Schlüssel bleibt,
  //    die Datenschutzerklärung nennt ihn)
  patch("      loadMap: () => this.setState({ mapOn: true }),",
        "      loadMap: () => { try { localStorage.setItem('hsk.map.consent', '1'); } catch (e) {} this.setState({ mapOn: true }); const l = document.querySelector('[data-map-open]'); if (l) l.focus(); }, // HSK-PATCH 4", 'loadMap');
  patch("    this._clock = setInterval(() => { if (this._alive) this.forceUpdate(); }, 60000);",
        "    this._clock = setInterval(() => { if (this._alive) this.forceUpdate(); }, 60000);\n" +
        "    // HSK-PATCH 4b: gemerkte Karten-Einwilligung anwenden\n" +
        "    let mapOk = false; try { mapOk = localStorage.getItem('hsk.map.consent') === '1'; } catch (e) {}\n" +
        "    if (mapOk && document.querySelector('[data-if=\"mapOn\"]')) this.setState({ mapOn: true });\n" +
        "    // HSK-PATCH 7: Tab im Hintergrund → Reel anhalten, kein Nachladen ins Leere\n" +
        "    this._onVis = () => { if (!this.reel) return; if (document.hidden) this.setReelPaused(true); else if ((window.scrollY || 0) < window.innerHeight && !this.reel.userPaused) this.setReelPaused(false); };\n" +
        "    document.addEventListener('visibilitychange', this._onVis);", 'mount tail');

  // 5) WebKit vor Safari 18 kennt backdrop-filter nur mit Präfix; die Leiste
  //    ist auf jeder Unterseite ab dem ersten Pixel gefüllt (kein Film darunter).
  patch("    if (nav) { const on = y > vh * 0.9; nav.style.background = on ? 'rgba(5,5,6,.72)' : 'transparent'; nav.style.backdropFilter = on ? 'blur(14px)' : 'none';",
        "    if (nav) { const on = y > (document.querySelector('[data-hero-video]') ? vh * 0.9 : 24); nav.style.background = on ? 'rgba(5,5,6,.72)' : 'transparent'; nav.style.backdropFilter = on ? 'blur(14px)' : 'none'; nav.style.webkitBackdropFilter = on ? 'blur(14px)' : 'none'; /* HSK-PATCH 5 */", 'nav scrim');

  // 6) Menüzustand für Screenreader und CSS
  patch("    this.setState({ menu: open });\n    document.documentElement.style.overflow = open ? 'hidden' : '';",
        "    // HSK-PATCH 6: Fokus wandert ins Menü und zurück, der Rest der Seite ist derweil inert\n" +
        "    const ae = document.activeElement;\n" +
        "    const wasInOverlay = !!(ae && ae.closest && ae.closest('[data-overlay]'));\n" +
        "    this.setState({ menu: open });\n    document.documentElement.style.overflow = open ? 'hidden' : '';\n" +
        "    document.documentElement.dataset.menu = open ? 'open' : 'closed';\n" +
        "    const btn = document.querySelector('[data-burger]');\n" +
        "    if (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü'); }\n" +
        "    document.querySelectorAll('main, footer, [data-mbar], [data-navlinks]').forEach((el) => { try { el.inert = open; } catch (e) {} });\n" +
        "    if (open) { const first = document.querySelector('[data-overlay] a'); if (first) first.focus(); }\n" +
        "    else if (wasInOverlay && btn) btn.focus();", 'setMenu');

  // Hilfsmethode für Patch 2: die Eintrittsanimationen sind auf den Vorhang
  // getaktet (2,3–3,05 s). Ohne Vorhang wartet niemand darauf.
  patch("  bootReel() {",
        "  skipIntroDelays() {\n" +
        "    document.querySelectorAll('[style*=\"animation\"]').forEach((el) => {\n" +
        "      const d = parseFloat(el.style.animationDelay || '0');\n" +
        "      if (d >= 2) el.style.animationDelay = Math.max(0, d - 2.3).toFixed(2) + 's';\n" +
        "    });\n  }\n  bootReel() {", 'skipIntroDelays');

  must(count(/HSK-PATCH/g, js) === 18, 'expected 18 HSK-PATCH markers, got ' + count(/HSK-PATCH/g, js));
  return js;
}

function writeSiteJs(logicJs) {
  must(!/chaos20140\.github\.io/.test(patchLogic(logicJs)), 'live URL left in logic');
  const js = `/* HSK Performance Center — Seitenlogik.
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

${patchLogic(logicJs).trim().replace(/^/gm, '  ')}

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
  var FORM_MODE = ${JSON.stringify(FORM_MODE)};
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
    ].join('\\r\\n');
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
`;
  fs.mkdirSync(path.join(OUT, 'assets', 'js'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'assets', 'js', 'site.js'), js, 'utf8');
}

/* ============================================== statische Nebendateien === */

function buildStatic(pages) {
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
    background_color: '#050506',
    theme_color: '#050506',
    icons: [
      { src: 'assets/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'assets/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  }, null, 2), 'utf8');

  fs.writeFileSync(path.join(OUT, 'robots.txt'),
    'User-agent: *\nAllow: /\nDisallow: /build/\nDisallow: /src/\n\nSitemap: ' + base + '/sitemap.xml\n', 'utf8');

  // lastmod bewusst weggelassen: ein falsches Datum ist schlimmer als keins
  const urls = pages.filter(p => !p.noindex).map(p =>
    '  <url><loc>' + base + '/' + (p.file === 'index.html' ? '' : p.file) + '</loc><priority>' + (p.file === 'index.html' ? '1.0' : '0.7') + '</priority></url>');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n', 'utf8');

  const notFound = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; object-src 'none'">
<title>Seite nicht gefunden — HSK Performance Center</title>
<meta name="robots" content="noindex,follow">
<meta name="theme-color" content="#050506">
<link rel="icon" type="image/svg+xml" href="${BASE}assets/favicon.svg">
<style>
/* Pfade absolut: GitHub Pages liefert diese Seite unter jeder Fehl-URL aus, auch tief verschachtelt */
@font-face{font-family:'Big Shoulders Display';font-weight:100 900;font-display:swap;src:url(${BASE}assets/fonts/big-shoulders-display-normal-100_900.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:400;font-display:swap;src:url(${BASE}assets/fonts/ibm-plex-mono-normal-400.woff2) format('woff2')}
@font-face{font-family:'Schibsted Grotesk';font-weight:400 900;font-display:swap;src:url(${BASE}assets/fonts/schibsted-grotesk-normal-400_900.woff2) format('woff2')}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#050506;color:#F2EFEA;font-family:'Schibsted Grotesk',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{position:relative;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(28px,6vw,80px);overflow:hidden}
.bg{position:absolute;inset:0;background:url(${BASE}assets/cine-rise-poster.jpg) center/cover no-repeat;opacity:.22}
.veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,5,6,.4) 0%,rgba(5,5,6,.95) 100%)}
.in{position:relative;display:flex;flex-direction:column;gap:22px;max-width:1500px;margin:0 auto;width:100%}
.eyebrow{display:flex;align-items:center;gap:14px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.26em;color:#9A9AA2}
.eyebrow span{display:block;width:28px;height:1px;background:#E10600}
h1{margin:0;font-family:'Big Shoulders Display',Impact,sans-serif;font-weight:900;font-size:clamp(90px,22vw,320px);line-height:.84;text-transform:uppercase}
h1 em{font-style:normal;color:#E10600}
p{margin:0;max-width:52ch;font-size:clamp(15px,1.15vw,18px);line-height:1.7;color:#C4C4CA;text-wrap:pretty}
a{display:inline-flex;align-items:center;gap:12px;align-self:flex-start;background:#E10600;color:#fff;padding:17px 28px;text-decoration:none;font-family:'IBM Plex Mono',monospace;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;transition:background .3s,color .3s}
a:hover{background:#F2EFEA;color:#050506}
</style>
</head>
<body>
<main>
  <div class="bg"></div><div class="veil"></div>
  <div class="in">
    <div class="eyebrow"><span></span>FEHLER 404 — SEITE NICHT GEFUNDEN</div>
    <h1>Nicht<em>.</em> Hier<em>.</em></h1>
    <p>Diese Seite gibt es nicht — vielleicht ein alter Link oder ein Tippfehler. Die Halle steht aber noch: Strackestraße 22, täglich 06–24 Uhr.</p>
    <a href="${BASE}">Zur Startseite <span aria-hidden="true">→</span></a>
  </div>
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, '404.html'), notFound, 'utf8');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');
}

build();
