# CLAUDE.md — HSK Performance Center (v2 „Redesign")

Arbeitsnotizen für mich (Claude). Kein Kundendokument. Ziel: beim nächsten Mal in
zwei Minuten wieder drin sein — was die Seite ist, wie sie funktioniert, wo die
Fallstricke liegen, welche Fehler ich schon gemacht habe. **Jede Änderung wird
ab sofort in §9 protokolliert** (Anweisung von Tolunay, 4. 9. 2026).

---

## 1. Was das hier ist

Statische Website für das **HSK Performance Center**, Fitnessstudio in Brilon
(Hochsauerlandkreis), Inhaber Steve Brenke. Kunde von Tolunay. Altseite:
<https://www.hsk.fitness/>. Live: <https://chaos20140.github.io/hsk-performance-center/>

**v2 ersetzt v1 komplett** (Anweisung: „verwerf das alte Design komplett").
Quelle ist das Claude-Design-Projekt **„HSK Performance Center Redesign"**
(`c3d4514c-6385-4feb-8f63-2ebbc83f5545`), Datei `HSK Performance Center.dc.html`.
Das Design liefert **nur die Landingpage**; es verlinkt aber sechs Unterseiten
(Coaching, Galerie, Termine, Preise, Mitglied werden, Impressum/Datenschutz), die
im Projekt nicht existieren. Die habe ich im Design-System nachgebaut (§5.2),
weil tote Links kein „perfektes Endergebnis" sind — das Briefing (`src/00
Briefing.dc.html`) nennt sie ausdrücklich als Tolunays Entscheidung.

Design-System (aus dem Briefing): Schwarz `#050506`, Panel `#0E0E11`, HSK-Rot
`#E10600`, Knochen `#F2EFEA`, Grau `#9A9AA2`. Display **Big Shoulders Display 900**
(uppercase, line-height .84–.9), HUD/Labels **IBM Plex Mono** 11 px / tracking .2em,
Fließtext **Schibsted Grotesk**. Scharfe Kanten, 1-px-Rasterlinien `rgba(255,255,255,.12)`,
keine Pillen, keine Radien. Mobile-Breakpoint 900 px.

v1 (Projekt `521a5b9e…`, Bricolage/Manrope/Instrument Serif, fixed Hintergrund-Reel)
liegt nur noch in der Git-Historie (bis Commit `588ed26`).

---

## 2. Repo-Aufbau

```
/                      ← Projektwurzel; alles außer build/, src/, CLAUDE.md wird publiziert
├── index.html         ← GENERIERT: Landing 1:1 aus src/HSK Performance Center.dc.html
├── coaching.html · galerie.html · termine.html · preise.html · mitglied-werden.html
│                      ← GENERIERT aus build/pages/*.html + Chrome der Landing
├── impressum.html · datenschutz.html  ← GENERIERT aus src/*.dc.html (v1-Text, v2-Optik)
├── 404.html · robots.txt · sitemap.xml · site.webmanifest · .nojekyll  ← GENERIERT
├── assets/
│   ├── *.jpg · *.mp4  ← Fotos + Clips (alles H.264, siehe §6 Nr. 2 / v1-Lehren)
│   ├── m-racks-poster.jpg ← Poster für den Hochkant-Hero (aus m-racks.mp4, ffmpeg)
│   ├── fonts/*.woff2  ← Big Shoulders Display (var.), IBM Plex Mono 400/500, Schibsted Grotesk (var.)
│   ├── favicon.svg (aus dem v2-Projekt) · apple-touch-icon.png
│   └── js/site.js (GENERIERT) · js/marquee.js (kopiert aus build/)
├── build/
│   ├── build.js       ← die ganze Pipeline (§3)
│   ├── site.css       ← Produktionsschicht: Fonts, Fokus, iOS, Unterseiten, Rechtsseiten, Druck
│   ├── pages/*.html   ← Inhalte der fünf Unterseiten (Design-Idiom: Inline-Styles)
│   ├── events.json    ← Termine (neuer Termin = ein Eintrag hier)
│   └── marquee.js     ← Laufschriften lückenlos (aus v1 übernommen, unverändert)
├── src/               ← Design-Originale: HSK Performance Center.dc.html, 00 Briefing.dc.html,
│                        Mobile Vorschau.dc.html, github.md, tools/upscale-4k.ps1, support.js,
│                        Impressum.dc.html + Datenschutz.dc.html (v1, nur noch Textquelle)
├── .github/workflows/pages.yml  ← Deploy per rsync ohne CLAUDE.md/build/src
└── CLAUDE.md · README.md
```

**Alles außerhalb von `build/`, `src/`, `assets/` (ohne js/site.js) ist Build-Artefakt.**
Nie direkt editieren — in `build/` oder `src/` ändern und neu bauen.

---

## 3. Build

```bash
cd build
HSK_CANONICAL="https://chaos20140.github.io/hsk-performance-center/" node build.js
```

Reines Node, keine Dependencies. `HSK_FORM_MODE=demo` schaltet den mailto-Versand
des Formulars ab (Panel wechselt dann nur). `build.js` ist **absichtlich voller
Assertions** (`must`): jeder Griff in den Design-Quelltext hängt an einem exakten
String. Ändert sich das Original, bricht der Build laut ab. Bei `BUILD FAIL: …`
den Anker im `src/`-File suchen und anpassen — **nicht die Assertion löschen**.

Was `build()` tut, in dieser Reihenfolge:

1. Omelette-Vorspann, `support.js`, `<x-dc>` entfernen; Logik-Script und `<helmet>` herauslösen.
   Helmet: Google-Fonts-Links raus, `<style>`-Block = **Design-System-CSS** (Keyframes,
   Mobile-Media-Queries) — landet auf **jeder** Seite.
2. Inhaltliche Anker **vor** jeder Umformung: `?ziel=` an Preis-Karten/Partner-Link,
   Karten-iframe `src`→`data-src` (+`data-map-frame`), Hero-Layer-0 `src`→`data-src`/
   `data-src-mobile`/`data-poster-mobile`, FAQ-/Bereichs-Zeilen `role="button" tabindex="0"`,
   Burger `aria-expanded aria-controls`, Overlay `id="hsk-menu"`.
3. **Chrome herausschneiden** (`cutBlock`, zählt verschachtelte Tags): Boot, Progress,
   Overlay, Header, Footer, Mobilleiste, Grain-SVG, plus das Loslegen-Band als Kopie.
   Rest = neun `<section>` in fester Reihenfolge (asserted).
4. Jeden Teil durch `processFragment()`: `sc-if`→`data-if` (Startzustand aus
   `hint-placeholder-val`), `onX="{{fn}}"`→`data-on-x="fn"`, `{{ statusText }}`→
   `<span data-text>`, `style-hover`→`data-hh` + `:hover`-Regel, `.dc.html`-Links→echte
   Dateien (`PAGE_MAP`, unbekannte Ziele = Fehler), Live-URL→`assets/`, `loading="lazy"`.
   Zähl-Assertions: 4 `data-if`, 2 `statusText`, **37** Event-Bindungen, **9** Hover-Regeln
   (8 im Design + 1 für das kopierte Band).
5. `page()` setzt jede Seite zusammen: `head()` (CSP, Meta, OG, Fonts-Preload) → Design-CSS
   → Hover-CSS → `site.css` → `<noscript>` → Skip-Link → [Boot] → Progress → Overlay →
   Header → `<main id="inhalt">` → Footer → [Mobilleiste] → Grain → Skripte.
   Auf Unterseiten laufen die Chrome-Fragmente durch `anchorsToIndex()` (`#x`→`index.html#x`).
6. Unterseiten: `build/pages/*.html` durch `processFragment()`, Loslegen-Band angehängt
   (außer mitglied-werden). `termine` rendert `events.json`, `preise` bekommt den
   Preisblock **aus der Landing** (`preiseBlock()`, 1:1).
7. Rechtsseiten: `legalPage()` nimmt den `<main>`-Inhalt der v1-Quellen ab der ersten
   Section / dem TOC bis vor die Schlusszeile, **entfernt alle Inline-Styles** und setzt
   Kopf + Schlusszeile neu; Optik kommt aus `site.css` (`[data-legal-body]`, `[data-row]`,
   `[data-toc]`, `[data-rights]`). Drei asserted Textkorrekturen (§5.3).
8. `writeSiteJs()`: Logik wörtlich + `patchLogic()` (27 Marker `HSK-PATCH`) + Shim.
9. `buildStatic()`: Manifest, robots, sitemap (nur indexierbare Seiten), 404, `.nojekyll`.
10. Schlussprüfung über alle Seiten: keine `style-hover`, `.dc.html`, `{{`, `<sc-if`,
    Medien-Hotlinks, Google Fonts, Inline-Skripte; externe Referenzen nur Maps/Facebook/
    Canonical; jedes `assets/…` existiert; jeder Seitenlink existiert.

---

## 4. Wie die Seite funktioniert

### 4.0 Runtime-Shim (assets/js/site.js)

Die Design-Klasse `Component extends DCLogic` wird wörtlich übernommen. Der Shim ersetzt
die Design-Runtime:
- `DCLogic.setState/forceUpdate` → `app.__render()`: schaltet `[data-if]` zwischen
  `display:contents`/`none` (Wert aus `renderVals()`, sonst `app.state`), schreibt
  `[data-text]`, und ruft für sichtbares `mapOn` `armMap()` (iframe `src` setzen,
  „In Karten öffnen"-Link anlegen — per createElement, kein innerHTML).
- `wire()`: für jedes `data-on-<event>` ein Listener, der den Handler **je Ereignis frisch**
  aus `renderVals()` holt (die Handler sind Closures mit `this`). Touch: `pointerenter`/
  `pointerleave` werden ignoriert, stattdessen schaltet `click` die Ausstattungs-/Galerie-
  Clips um. `role="button"` + Enter/Leertaste → `click()`. FAQ `aria-expanded` folgt dem Zustand.
- `bootForm()`: Formular auf mitglied-werden. `?ziel=<data-key>` wählt die Option vor
  (nur Vergleich mit `data-key`, kein Einsetzen in HTML). Submit → `reportValidity()` →
  `mailto:`-Entwurf (`encodeURIComponent`, CRLF) → Panel `sent` → nach 350 ms
  `location.href = mailto`. Ohne JS: `<form action="mailto:…" enctype="text/plain">`
  (CSP `form-action 'self' mailto:`).
- `window.HSK = app` — Debug-Einstieg (`HSK.state`, `HSK.reel`, `HSK.setMenu(true)`).

`display:contents` für die `data-if`-Wrapper ist Pflicht (kein zusätzlicher Kasten im
Layout); das Overlay-Menü startet seine `hs-menu`-Animationen bei jedem Öffnen neu, weil
die Kinder aus `display:none` kommen.

### 4.1 Ablauf beim Laden (Landing)

`componentDidMount`: Vorhang (`[data-if="booting"]`, 2,35 s, `html{overflow:hidden}`,
Zähler `[data-pct]` 000→100 in 1,35 s) → `booting:false`. **Kein Vorhang** bei
`prefers-reduced-motion`, ohne Vorhang-Markup (Unterseiten) oder mit `location.hash`
(HSK-PATCH 2) — dann `skipIntroDelays()`: alle Inline-`animation-delay ≥ 2 s` um 2,3 s
vorziehen (Header 2,3 s, Hero-Zeilen 2,35–3,05 s wären sonst leer).
Danach: Scroll-Handler (`sync()` per rAF + 120-ms-Fallback), `playAll()`, Gesture-Unlock,
Escape schließt Menü, `forceUpdate` jede Minute (Öffnungsstatus), gemerkte Karten-
Einwilligung, `visibilitychange` (Reel pausieren), `bootReel()`.

### 4.2 Hero-Reel

Zwei `<video data-reel-layer>`; alle 4,6 s (`hold`) lädt `cut()` den nächsten Clip in den
unsichtbaren Layer, blendet bei `canplay` über (roter `data-flash`), pausiert den alten
nach 800 ms. Fehler → nächster Clip, nach `clips.length` Fehlern Schluss. Desktop: 10
Clips `cine-*`/`v-crane` (1600×900). **Hochkant-Telefon** (`max-width:900px and
portrait`): die vier `m-*.mp4` (828 px, 3:4, aus den eigenen Fotos generiert, v1),
Labels „01 / 04 — RACKS" … (HSK-PATCH 8). Layer 0 hat im Markup **kein `src`** —
`bootReel()` setzt es aus `data-src`/`data-src-mobile`, sonst lüde das Telefon erst
1,3 MB Querformat. Save-Data/2G: Poster bleibt, kein Reel (HSK-PATCH 3).
`heroFx(p)` pausiert das Reel, sobald der Hero aus dem Bild ist (`p ≥ 1`).
HUD: `[data-tc]` Timecode, `[data-seg]` 10 Segmente (nur Desktop, `data-hide-m`).

### 4.3 Weitere Systeme (alle in der Design-Logik)

| Was | Methode | Hooks |
|---|---|---|
| Rote Fläche fährt seitwärts aus dem Bild (Telefon mit eigener Kurve), Video zoomt zurück, „Die Halle." erscheint | `heroFx` | `[data-red]`, `[data-hero-video]`, `[data-hero-after]`, `[data-nav-logo]` |
| Trainingsbereiche: das ganze Raster klebt, nur der Bereich wechselt (330 vh, Raster 100 vh/dvh; Klebestrecke = Sektion minus Raster) | `areasFx`, `goArea` | `[data-areas]`, `[data-areas-grid]`, `[data-area-row]`, `[data-area-media]` |
| Roter Wipe „Eine Leistung. Drei Laufzeiten." — **Rechner:** clip-path von oben. **Telefon:** clip-path von links nach rechts, die Schrift steigt wortweise ein, dazu der Preis-Zusatz | `wipeFx` | `[data-eq]`, `[data-wipe]`, `[data-wipe-word]`, `[data-wipe-sub]` |
| Ausstattungs-Clips beim Hover | `eqEnter/eqLeave` | `[data-eq-card] video[data-src]` |
| FAQ | `toggleFaq` | `[data-faq-head]`, `[data-faq-body]` (max-height) |
| Nav-Hintergrund, SCRL %, Progress-Balken, Mobilleiste ab 0,7 vh, Parallax | `sync` | `[data-nav]`, `[data-scrl]`, `[data-progress]`, `[data-mbar]`, `[data-px]` |
| Öffnungsstatus | `renderVals().statusText` | `h >= 6` → „JETZT GEÖFFNET · BIS 24 UHR" |
| Karte: `ll=`-Einbettung ohne Google-Nadel (die pulsierende Marke kommt aus dem Design), ganze Fläche startet die Route (Apple Karten / Google Maps) | `loadMap` + `armMap` im Shim | `[data-if="mapOn"/"mapOff"]`, `[data-map-frame]`, `[data-map-open]` |

Scroll-getriebene Reveals laufen über `animation-timeline: view()`; ohne Support
(Firefox/ältere Safari) spielt die Animation einmal beim Laden und endet dank `both`
im Endzustand — Inhalt bleibt sichtbar.

### 4.4 Unterseiten

Gleiches Chrome (aus der Landing geschnitten), gleiche `site.js` (alle Hero-Teile
sind gegen fehlende Elemente abgesichert, `bootReel()` steigt ohne `[data-reel-layer]`
aus). Nav-Hintergrund ab 24 px Scroll (kein Film darunter). Inhalte in
`build/pages/*.html` im Design-Idiom: Eyebrow (28-px-Strich + Plex Mono), H1 Big
Shoulders `clamp(56px,10vw,170px)`, Raster `gap:1px` auf `rgba(255,255,255,.12)`.
Mobile-Regeln dafür in `site.css` (`[data-gal]`, `[data-termin]`, `[data-form]`, `[data-kv]`
kommt aus dem Design-CSS).

---

## 5. Was ich ergänzt oder verändert habe (nicht aus dem Design)

### 5.1 Technik / Produktion
1. **Schriften selbst gehostet** (DSGVO; das Briefing verlangt es für den Livegang).
   Big Shoulders Display + Schibsted Grotesk als variable woff2, Plex Mono 400/500.
2. **Clips aus dem Repo** statt Hotlink auf die Live-Seite (`LIVE_ASSETS`).
3. **CSP per `<meta>`**: `default-src 'none'` + Allowlist, `form-action 'self' mailto:`,
   `frame-src https://www.google.com`. Keine Inline-Skripte (Build prüft das).
4. **Karten-Consent**: iframe lädt erst nach Klick (im Design lud er trotz
   `display:none` — iframes laden immer), Entscheidung in `localStorage['hsk.map.consent']`
   (gleicher Schlüssel wie v1, steht so in der Datenschutzerklärung). Klick auf die
   geladene Karte → Karten-App (Apple Karten auf Apple-Geräten, sonst Google Maps),
   Ort statt Route — Tolunays Wunsch aus v1.
5. **Vorhang nur mit Sinn** (HSK-PATCH 2): nicht bei Anker-Aufruf (`index.html#preise`
   aus einer Unterseite), nicht auf Unterseiten, nicht bei reduzierter Bewegung.
   `skipIntroDelays()` zieht die getakteten Eintrittsanimationen vor.
6. **Hochkant-Clips auf dem Telefon** (HSK-PATCH 8) — Begründung in §4.2. Poster
   `m-racks-poster.jpg` (ffmpeg, 0,5 s).
7. **Save-Data/2G** → Poster (HSK-PATCH 3), **Tab im Hintergrund** → Reel pausiert
   (HSK-PATCH 7).
8. **`-webkit-backdrop-filter`** in JS (HSK-PATCH 5) und CSS — WebKit vor Safari 18.
9. **iOS-Viewport**: unter 900 px `svh` statt `vh` für Hero (200/100), Bereiche (330/100,
   Bühne 40), Wipe (100) — sonst liegt der Hero-Knopf hinter der Safari-Leiste.
10. **Touch**: Hover-Clips per Tipp umschalten (Pointer-Events feuern enter+leave beim
    Tippen). **Tastatur**: FAQ und Bereichs-Zeilen `role="button" tabindex="0"`,
    Enter/Leertaste, `aria-expanded`. Burger `aria-expanded/aria-controls` + X-Zustand
    (`html[data-menu="open"]`). Skip-Link, `:focus-visible`.
11. **Mobile-Korrekturen am Design** (`site.css`, ≤ 900 px): FAQ-Kopf nicht sticky
    (lief über die Fragen), Bühnen-Label „HSK — BRILON" versteckt (kollidierte mit
    REC-Label), Kartenbox 1:1 statt 4:3 + Chip unten (Gate überdeckte den Chip).
12. **Verhalten**: Preis-Karten → `mitglied-werden.html?ziel=jahr|halbjahr|monat`,
    Partner → `?ziel=partner`, Coaching → `?ziel=coaching`; das Formular wählt vor.
13. `<main id="inhalt">`, `loading="lazy" decoding="async"` auf Bildern unterhalb des
    Hero, `<title>`/Description/OG (+ Bildmaße/Alt)/Canonical/theme-color (das Design
    hatte keinen Titel), **JSON-LD `ExerciseGym`** auf der Startseite (nur verbürgte Daten).
14. Keine Mobilleiste auf mitglied-werden (würde auf sich selbst zeigen) und den
    Rechtsseiten.

### 5.1a Nach der Prüfrunde (Workflow, 8 Dimensionen) ergänzt
15. **`marquee.js` neu** (§6 Nr. 10): verdoppelt die ganze Spur statt Kinder zu löschen;
    zweite Hälfte + Kopien `aria-hidden`.
16. **Reel-Robustheit**: `preload='auto'` vor dem Schnitt (HSK-PATCH 9; bei `preload=none`
    käme in manchen Engines nie `canplay`); `playAll()` stößt Reel-Ebenen nur an, wenn das
    Reel läuft und es die aktive Ebene ist (10; vorher startete jeder Wheel-Tick die
    pausierte Ebene 0 neu); Bereichs-Videos nur im Bild (11); Reel startet pausiert und
    **ohne Quelle**, wenn der Hero nicht im Bild ist oder ein Hash ansteht (12/12b) —
    `setReelPaused(false)` holt die Quelle nach; keine Schnitte bei reduzierter Bewegung
    (der Film läuft, die Effekte nicht).
17. **REC-Knopf** im Hero-HUD (`[data-reel-toggle]`, HSK-PATCH 13): hält Film und
    Laufschriften an (`html[data-reel="paused"]`), WCAG 2.2.2. Optik wie das Label.
18. **Öffnungsstatus nach Brilon-Zeit** (`Intl … Europe/Berlin`, HSK-PATCH 14) — vorher
    Browser-Uhr des Besuchers. `formatToParts`, weil de-DE „12 Uhr" formatiert.
19. **Menü mit Fokusführung**: erster Menüpunkt bekommt Fokus, `main/footer/Leiste/Nav`
    sind `inert`, beim Schließen Fokus zurück auf den Burger (HSK-PATCH 6).
20. **FAQ semantisch**: `<h3><button data-faq-btn aria-expanded aria-controls>` (Klick
    blubbert zum Design-Handler auf dem Kopf-`<div>`), Antworten `aria-hidden` im
    zugeklappten Zustand. Bereichs-Zeilen `role="button"` + `aria-label`.
21. **Fokus nach Aktionen**: Bestätigungsfeld des Formulars `role="status"` + Fokus;
    „Karte laden" → Fokus auf „In Karten öffnen".
22. **Kontrast/Farben**: Fokusring in Knochen `#F2EFEA` (Rot auf Rot war unsichtbar),
    Platzhalter `#8A8A92` (5,9:1), Label „TELEFON · OPTIONAL". Dekorative Nummern
    (Menü, Rechtsseiten) `aria-hidden`; alle `<video>` `aria-hidden`; `<nav>`-Landmarken
    benannt; unsichtbare `h2` (`[data-sr]`) wo das Design nur ein `<div>` hat (Preise,
    Preisseite); Termine als `h2`.
23. **Reduzierte Bewegung**: `animation-iteration-count:1` + `animation:none` für
    Laufschrift/Blink/Cue — die Design-Regel (`duration:.001ms`) ließe Endlosanimationen
    tausendfach pro Sekunde neu starten (Flimmern).
24. **Telefon**: `safe-area-inset-top/left/right` für Leiste, Menü, untere Leiste
    (`viewport-fit=cover`); untere Leiste schwarz statt 14-%-Grau im Home-Indikator-
    Polster; `-webkit-backdrop-filter … !important`; `:hover`-Regeln der Produktions-
    schicht nur für Zeigegeräte; Karten-Link ≥ 44 px; Telefonnummer in der FAQ-Einleitung
    als `tel:`-Link.
25. **Links**: Startseite heißt `./` (nicht `index.html`), „Nach oben" auf Unterseiten →
    `#inhalt`; 404 mit **absoluten** Pfaden (`BASE` aus `HSK_CANONICAL`), sonst bricht
    sie unter verschachtelten Fehl-URLs; Karten-iframe `referrerpolicy=
    strict-origin-when-cross-origin` (Design: `no-referrer-when-downgrade`).
26. **Texte**: Karten-Gate nennt Cookies; Datenschutz 06 („Diese Website selbst setzt
    keine Cookies … Google kann im Kartenfenster Cookies setzen"), 03 („Ihr Anliegen"
    statt „Trainingsziel"), 05 (Apple Karten, Facebook auf Termine), typografische
    Anführungszeichen; „Performance Mentor" gestrichen (nicht verbürgt); `&nbsp;` vor
    €/%.
27. **Build**: `HSK_CANONICAL` Pflicht, `HSK_FORM_MODE` validiert, externe Referenzen
    gegen `CANONICAL` geprüft, Asset-Prüfung auch für `poster`/`data-src*` und die
    Clip-Listen in `site.js`, `$`-sichere Ersetzungen, `ctaHref`-Schema in `events.json`.
    CI baut neu und bricht ab, wenn die eingecheckten Ausgaben abweichen.

### 5.1b Bewusst NICHT geändert (Design-Entscheidungen, im Übergabetext genannt)
- **Dunkle Schrift auf Rot** (`#2A0300`/`#3A0400` auf `#E10600`, 3,5–3,8:1) erreicht kein
  AA für Fließtext; nur Weiß (4,97:1) würde — das wäre ein anderes Design. Große
  Überschriften sind in Ordnung (≥ 3:1).
- Inaktive Bereichsnamen `#5A5A62` (2,98:1, Großtext) — Design.
- Untere Mobilleiste (§5.4), Grain-Overlay, Reel-Datenvolumen am Rechner.
- Rote 10–11-px-Nummern (4,1:1) sind jetzt `aria-hidden`, bleiben aber sichtbar so.

### 5.2 Unterseiten (neu, weil verlinkt aber nicht im Design)
- **coaching.html**: Headline aus v1 („Beratung ist hier kein Verkaufsgespräch."),
  sechs Leistungen (v1/Altseite), „Der Kopf dahinter" (Steve Brenke, Zitat, Zahlen,
  sieben Qualifikationen — alles von hsk.fitness/uber-uns), drei Schritte, Foto
  `p-mirror.jpg` (kein Musterbild; `coach.jpg` ist KI und bleibt draußen).
- **galerie.html**: 16 Fotos aus dem Bestand in 12-Spalten-Raster, Bildunterschriften
  nach Sichtung der Bilder; vier Clip-Kacheln (v-mirror, cine-descent, v-dumbbells/
  Poster g-dumbbell, v-kettle, v-crane) mit der Hover-/Tipp-Mechanik der Landing.
- **termine.html**: aus `events.json` (nur der belegbare Dauereintrag), Beratungszeiten,
  Facebook-Verweis. Keine erfundenen Veranstaltungen.
- **preise.html**: Preisblock **1:1 aus der Landing** (Karten + Leistungen; „Alle
  Details"-Link → FAQ), dazu sechs Detailzeilen (Gebühr, Laufzeiten, Probetraining,
  Tageskarte, Wellhub, Beratung) — nur verbürgte Fakten.
- **mitglied-werden.html**: Formular (Name, E-Mail, Telefon, Anliegen, Nachricht) +
  Bestätigungsfeld mit E-Mail-/Anruf-Knopf, Aside mit Kontakt, Beratungszeiten, Preisen.
- **Loslegen-Band** der Landing schließt coaching/galerie/termine/preise ab (Kopie).

### 5.3 Rechtsseiten
Text wörtlich aus v1 (der bereits mit echten Daten gefüllt war), Optik neu.
Drei asserted Korrekturen in `legalPage()`:
- Impressum: ODR-Satz raus (Plattform existiert nicht mehr); im Bildnachweis der Satz
  „…auf der Startseite als Musterbild gekennzeichnet" raus (v2 zeigt keine Musterbilder).
- Datenschutz: „Verweise auf Google und Facebook im Fußbereich" → „Facebook (Fußbereich)
  und Google Maps (Kartenbereich)"; Stand 4. September 2026; die v1-Hinweisbox
  „Vorlage mit Platzhaltern" fällt weg (es gibt keine Platzhalter mehr — Assertion).

### 5.4 Bewusst 1:1 gelassen, obwohl diskutabel
- **Untere Mobilleiste** („Probetraining / Anrufen"). Tolunay hatte sie in v1 entfernen
  lassen; das v2-Design bringt sie zurück und die Mobile-Vorschau zeigt sie ausdrücklich
  („Sticky Bar unten"). 1:1 umgesetzt, im Übergabetext angesprochen — ein Wort, und sie
  fliegt (`opts.mbar=false` in `page()`).
- Grain-Overlay (fixed SVG feTurbulence, `mix-blend-mode:overlay`, 7 %) — Design.
- Reel lädt am Rechner alle 4,6 s einen neuen Clip (~17 MB pro Runde) — Design; am
  Telefon durch die m-Clips auf ~4,7 MB gedrückt.

---

## 6. Fehler, die mir passiert sind — und die Ursache

### v2 (dieses Projekt)
1. **`get_page_text` schreibt nur bei > 50 k Zeichen auf Platte — und kappt dort auch.**
   Ich wollte 6 Scheiben à 49 k „persistieren lassen": kamen inline in den Kontext.
   Die Datei auf Platte war der frühere, bei 50 000 Zeichen abgeschnittene Versuch.
   → Dieser Kanal taugt nicht für Binärtransfer.
2. **Zwischenablage aus der Extension geht nicht.** `navigator.clipboard.writeText` →
   „Document is not focused"; `execCommand('copy')` meldete `true`, die
   System-Zwischenablage blieb unverändert (CDP-Tastatur ist kein OS-Fokus).
3. **Was funktioniert hat:** in der claude.ai-Seite `window.open('http://127.0.0.1:4174/recv#'+b64)`
   nach einem echten Klick (Aktivierung). Die neue Tab-URL trägt das Fragment — und
   das `javascript_tool` hängt an jedes Ergebnis den „Tab Context" mit **allen Tab-URLs**
   an; bei 249 k Zeichen wird das Ergebnis **auf Platte persistiert**. Daraus
   `assemble.js` (Scratchpad): längster Base64-Lauf, ZIP-CRC prüfen, entpacken.
   Merke: LNA blockt `fetch` auf localhost, aber **keine Navigation** dorthin.
4. **Zählungen erst nach dem Lesen festlegen.** „27 Bindungen" geraten → 37; Hover
   8 → 9 wegen des kopierten Bands. Assertions gehören auf gezählte Werte, nicht auf
   Kopfrechnen.
5. **Zeilenkommentar frisst den Rest der Zeile.** `// HSK-PATCH 5` am Ende eines
   Ersetzungsstrings, dessen Anker **mitten in einer Zeile** endete → der Rest der
   Originalzeile (samt `}`) wurde auskommentiert → SyntaxError in site.js.
   → Bei Ankern, die nicht am Zeilenende enden: Blockkommentar `/* */`. `node --check`
   nach jedem Build ist Pflicht.
6. **`localStorage` aus alten Tests verfälscht Prüfungen.** Das Playwright-Profil hatte
   `hsk.map.consent=1` → Karte schon offen → „Karte laden" unsichtbar → Timeout.
   → Vor jedem Lauf `localStorage.clear()` + Reload.
7. **Touch: `pointerenter` UND `pointerleave` feuern beim Tippen.** Erst nur `leave`
   ignoriert → Tipp schaltete ein und der `click` sofort wieder aus. Beide ignorieren,
   `click` schaltet um.
8. **Design-Mobile-Fehler, die die Vorschau nicht zeigte:** FAQ-Kopf `position:sticky`
   in einer einspaltigen Anordnung (Überschrift läuft über die Fragen), Bühnen-Labels
   links/rechts kollidieren auf 375 px, Karten-Gate (≈ 230 px) in einer 4:3-Box (251 px)
   überdeckt den Koordinaten-Chip. Alle drei in `site.css` unter 900 px korrigiert.
   **Merke:** eine Mobile-Vorschau mit drei Zuständen ist keine Mobile-Prüfung — jede
   Section auf 390 px anschauen.
9. **Ein `<iframe>` in `display:none` lädt trotzdem.** Das Design hatte `src` am
   Karten-iframe hinter `sc-if mapOn` — die IP wäre bei jedem Aufruf an Google gegangen.
10. **v1-Skript ungeprüft übernommen: `marquee.js` zerlegte die neuen Laufschriften.**
    v1-Bänder bestanden aus zwei Gruppen-Wrappern; die v2-Spur hat die Wort-Spans
    direkt als Kinder. `fit()` nahm das erste Wort als „Gruppe", kürzte die Spur auf
    4–8 Kinder und klonte nur dieses Wort — „Täglich 06–24 Uhr" war weg, die Hälften
    ungleich, am Rundenende eine Lücke. In meinen Screenshots fiel es nicht auf (der
    Ausschnitt sah plausibel aus). Gefunden von der Workflow-Prüfung.
    → **Jedes übernommene Skript gegen die neue DOM-Struktur lesen**, nicht nur
    „läuft ohne Fehler".
11. **`Number(Intl.DateTimeFormat('de-DE',{hour:'numeric'}).format())` ist NaN** —
    de-DE formatiert „12 Uhr". `formatToParts()` nehmen.
12. **Zeilenkommentar in Patch-Strings** (siehe Nr. 5) — passierte fast erneut; jetzt
    Block-Kommentare, wo der Anker nicht am Zeilenende endet.
13. **Patch-Reihenfolge**: ein Patch, der Text ändert, den ein späterer Patch einfügt,
    findet seinen Anker nicht (`_onVis`). Ergänzungen direkt im einfügenden Patch machen.
14. **`sed` mit Regex-Sonderzeichen im Ersatztext** (`|`, `\/`, `$`) — zweimal Zeit
    verloren. Für Code-Änderungen das Edit-Tool nehmen, `sed` nur für triviale Strings.
15. **Workflow-Verifizierer fielen am Session-Limit aus** (47 von 134 Agenten). Die
    unverifizierten Befunde (mobile/html/build) habe ich selbst bewertet; alle
    berechtigten sind umgesetzt (§5.1a), die übrigen begründet verworfen (robots.txt
    auf Project-Pages wirkungslos → egal; README öffentlich → ist ohnehin public).
17. **Ein Selektor „für die Unterseiten" traf auch die Startseite.**
    `main>section[data-screen-label]{padding:52px 0}` sollte den Unterseiten einen
    Takt geben — die Landing-Sektionen tragen dieselben Labels. Folge: 52 px unter
    der Ausstattung, also ein schwarzer Spalt zwischen dem roten Wipe und der roten
    Preisfläche (der Wipe klebt `bottom:0` am Container, das Padding schiebt ihn
    hoch). Aufgefallen erst beim Nachmessen der Sektionsgrenze, nicht im Screenshot.
    → Auf `body[data-sub]` eingeschränkt. **Merke:** die Unterseiten benutzen das
    Chrome und die Idiome der Landing — jeder „nur für Unterseiten"-Selektor braucht
    `body[data-sub]`, und Sektionsgrenzen misst man (`rect.bottom` vs. `rect.top`),
    statt sie auf Bildern zu suchen.
18. **Patch-Reihenfolge — schon wieder** (vgl. Nr. 13). Ein neuer Patch für die
    Kopfleiste suchte den Text, den ein *späterer* Patch erst erzeugt. Beide betrafen
    dieselbe Zeile. → **Eine Zeile, ein Patch**: zusammenlegen statt stapeln.
    Ebenso: die Einrückung im Anker ist die des **Originals** (4 Leerzeichen), nicht
    die der Ausgabe (6, weil `writeSiteJs` alles um 2 einrückt).
19. **Ein Kunden-Screenshot kann aus dem Cache stammen.** GitHub Pages liefert
    `Cache-Control: max-age=600`. Drei Screenshots zeigten Fehler, die lokal längst
    behoben waren — der Deploy lag drei Minuten davor. → **Erst die Live-Seite mit
    Cache-Buster in der Gerätegröße nachmessen**, dann diagnostizieren.
20. **`_mob` wurde nach dem ersten `sync()` gesetzt** — der allererste Frame lief noch
    im Desktop-Zweig und hinterließ ein Inline-Transform, das auf dem Telefon niemand
    mehr aufräumte. → Kennzeichen ganz an den Anfang von `componentDidMount`.
21. **Playwright-Seite im Hintergrund drosselt Transitions und rAF.** Eine Messung
    zeigte HUD und Schlusszeile mit vertauschten Deckkraft-Werten — der Browser hatte
    die laufenden Übergänge eingefroren, weil die Seite nicht im Vordergrund war.
    → **Vor jeder Messung von Animationen `page.bringToFront()`**, sonst jagt man
    Fehler, die es nicht gibt (vgl. Nr. 4: der schwarze Screenshot des Panes).
22. **Der Anker-Sprung passiert in Chromium nach DOMContentLoaded.** `scrollY` war beim
    Mount noch 0, also lud der Hero-Clip trotz `#preise`. Der Hash zählt jetzt als
    „nicht im Bild".
23. **Sektionshöhe in `svh`, Klebeblock in `dvh` — das läuft auseinander.** Ich hatte
    das sogar als Absicht kommentiert („die Scroll-Strecke darf sich nicht ändern").
    Falsch: die Klebestrecke ist Sektionshöhe **minus** Blockhöhe. Bleibt die eine
    fest und wächst die andere mit der Adressleiste, wandert der Punkt, an dem der
    Block abgibt — er löst sich vor dem Ende der Sektion, und darunter steht deren
    Grund. Regel: **beide Höhen in derselben Einheit**, oder besser: gar keine
    gerechnete Strecke, sondern eine Sektion, die so hoch ist wie ihr Inhalt.
24. **Ich habe das Symptom behandelt, nicht die Ursache.** Auf „schwarze Fläche in den
    Trainingsbereichen" habe ich die langsam ladenden Bühnenbilder optimiert — das war
    richtig, aber es war nicht der Fehler. Der Kunde meldete dieselbe Fläche eine Runde
    später wieder. Merke: eine plausible Erklärung ist noch keine belegte. Erst
    reproduzieren, dann messen, dann reparieren.
25. **Erste These im echten Browser prüfen, bevor ich darauf baue.** Ich war sicher,
    `body{overflow-x:hidden}` mache in WebKit den Body zum Scroll-Container und töte
    jedes `position:sticky`. Klang schlüssig, erklärte alle drei Beschwerden — und war
    falsch: in WebKit 26 gemessen, `gridTop` bleibt 0. `npx playwright install webkit`
    kostet eine Minute und hätte mir die halbe Fehlersuche gespart. **WebKit ist ab
    jetzt der Prüfstand für alles, was der Kunde auf dem iPhone sieht.**
26. **Bewegung wegnehmen ist keine Lösung, wenn Bewegung gewünscht ist.** Ich habe
    das Ruckeln zweimal dadurch behoben, dass ich die Animation entfernt habe — beim
    Vorhang ganz, beim Hero-Balken auf einen Schaltpunkt. Der Kunde wollte beides:
    die Bewegung UND flüssig. Die Antwort heißt scroll-gesteuerte CSS-Animation
    (`animation-timeline`), nicht „weniger". **Erst prüfen, was der Browser kann,
    dann den Umfang kürzen** — nicht umgekehrt.
27. **`p >= 1` ist nicht „aus dem Bild".** Bei einer Klebesektion ist p=1 der Moment,
    in dem der Block ANFÄNGT wegzuscrollen — danach steht er noch eine volle
    Bildschirmhöhe lang da. Der Hero-Film fror deshalb sichtbar ein. Wer „nicht mehr
    zu sehen" meint, muss die Sektionshöhe nehmen, nicht die Klebestrecke.

29. **Eine scroll-gesteuerte Animation darf nur dort stehen, wo „sofort fertig" der
    gewünschte Ruhezustand ist.** Live meldete die Zeitachse einen festgefrorenen
    Fortschritt von 90 % bei Scrollposition 0 — die rote Hero-Fläche war damit weg,
    bevor jemand gescrollt hatte. Das Design nutzt dieselbe Technik an vielen Stellen
    gefahrlos, weil dort der Endzustand „sichtbar" ist. Meine Anwendung hatte den
    Endzustand „verschwunden" — Fehlschlag = Inhalt fort. **Vor jeder neuen
    Browser-Technik prüfen: Was passiert, wenn sie nicht greift?**
30. **Lokal grün heißt nicht live grün.** Der Fehler trat in keiner lokalen Messung
    auf, nur auf der ausgelieferten Seite. Seitdem gehört zur Prüfroutine: nach dem
    Push dieselbe Messung noch einmal gegen die Live-URL — und zwar **ohne vorher zu
    scrollen**, denn ein `scrollTo` verdeckte den Fehler.
31. **Headless-WebKit läuft mit ~10 Bildern/s.** Jede Bild-für-Bild-Bewegung sieht
    dort stufig aus, und der Zustand hinkt nach einem Sprung bis zu 1,5 s nach. Ich
    hätte das fast für ein Ruckeln der Seite gehalten. Vor solchen Schlüssen die
    Bildrate messen (`requestAnimationFrame` zählen).

32. **„Funktioniert nicht wie gewollt" hieß dreimal: ich hatte die Choreografie
    umgebaut, statt den Fehler darin zu beheben.** Die Bereiche sollten immer schon
    die feststehende Ansicht des Designs sein — Bild oben, Liste darunter, nur der
    Bereich wechselt. Ich habe stattdessen die Konstruktion ersetzt, weil sie einen
    Geometriefehler hatte. **Erst den Fehler isolieren, dann entscheiden, ob die
    Konstruktion wirklich falsch war.** Hier war sie es nie; falsch war nur die
    Einheit (svh gegen dvh).
33. **Bild für Bild am Scrollweg ruckelt auf dem iPhone — auch bei einem einzigen
    Transform.** Ich hatte gehofft, es liege allein an den erzwungenen Layouts
    drumherum. Tut es nicht: Safari reicht die Scroll-Ereignisse beim Nachlauf
    gebündelt nach, und dagegen hilft keine Optimierung. Auf dem Telefon gilt:
    Schaltpunkt + CSS-Blende, oder gar keine Bewegung.

34. **Ein Schaltpunkt mit CSS-Blende ist nicht immer die Antwort auf Ruckeln.** Beim
    Vorhang hätte er zwar sauber animiert, aber vor dem Umschlagen eine bildschirmhohe
    leere Fläche stehen lassen — der Block belegt im Fluss eine volle Bildschirmhöhe.
    Die bessere Lösung war, die Animation ganz wegzulassen: ohne `position:sticky`
    kommt er von unten ins Bild, weil die Seite scrollt. **Die flüssigste Bewegung auf
    dem Telefon ist die, die der Browser ohnehin macht.**

### v1-Lehren, die weiter gelten (Kurzfassung; Details in Git `588ed26:CLAUDE.md`)
- Design-RPC `GetFile`: `content` ist **immer** Base64, `isBase64` heißt nur „binär".
  Nach dem Dekodieren Magic Bytes prüfen.
- **Nie HEVC** einbetten — `canPlayType('hvc1')` ist in Chromium leer. Alle Clips H.264
  High yuv420p `+faststart` ohne Ton. Prüfen: `ffprobe -show_entries stream=codec_name`.
- **Browser-Pane liefert schwarze Screenshots** bei fixed Video/backdrop-filter → für
  visuelle Prüfung Playwright.
- **SVG-Referenzfilter auf `<video>` = schwarzes Bild in WebKit** (v2 nutzt nur
  CSS-Filter `saturate/contrast` — gut so; nie `filter:url(#…)` auf Video legen).
- **Reduzierte Bewegung ≠ Inhalt entfernen.** Film läuft weiter, nur Effekte dämpfen
  (das Design-CSS setzt `animation-duration:.001ms` — Reveals springen in den Endzustand).
- **`{once:true}`-Listener für Autoplay-Freigabe verbrennen sich** — hier hört
  `_unlock` dauerhaft zu (Design), gut.
- **Laufschriften „von Hand verdoppeln" reicht nie** — `marquee.js` klont bis eine
  Spurhälfte das Fenster füllt.
- **`style-hover` wird nur übersetzt, wo `extractHover` läuft** — Schlussprüfung auf
  `style-hover=` über alle Ausgaben.
- **Bei GitHub Pages `curl` gegen interne Dateien** — `CLAUDE.md` war einmal öffentlich.
- **Higgsfield-Clips nachkomprimieren** (10 MB → 1,1 MB bei 828 px CRF 23).
- Auf 390 px alle mehrspaltigen Raster prüfen (Schnipsel in §8) — nicht nur die, die
  eine Responsive-Funktion kennt.

---

## 7. Offene Punkte / bewusst nicht gemacht

- **Untere Mobilleiste** — siehe §5.4; Entscheidung liegt bei Tolunay.
- **Reel-Datenvolumen am Rechner** (~17 MB/Runde) ist Design; wer sparen will, setzt
  `hold` hoch oder kürzt `clips` in `bootReel()` (Patch in `build.js`).
- **Formular ohne Backend** — mailto ist die ehrliche Lösung für eine statische Seite.
  Bei echtem Versand: Endpoint im Submit-Handler + AV-Vertrag + Datenschutztext.
- **Bilder/Clips**: Fotos und `v-*`-Clips zeigen das echte Studio; die `cine-*`-Clips
  und `m-*`-Clips sind generiert (Bildnachweis im Impressum sagt das).
- **GitHub Pages**: `Cache-Control: max-age=600`, keine echten Security-Header
  (`frame-ancestors`, HSTS) — nur über eine Edge (Cloudflare) lösbar.
- **Erfahrung** „über 25 Jahre Fachexpertise" (Coaching) vs. „seit fast 30 Jahren" /
  „Trainer seit 2001" — alles von der Altseite, aber nicht deckungsgleich.

---

## 8. Prüf-Routine vor jedem Push

```bash
cd build && HSK_CANONICAL="https://chaos20140.github.io/hsk-performance-center/" node build.js   # muss "OK" sagen
cd .. && node --check assets/js/site.js
grep -c 'HSK-PATCH' assets/js/site.js                 # 23 (22 Marker + Kopfkommentar)
grep -ohE '(src|href)="https?://[^"]+"' *.html | sort -u   # nur maps / facebook / canonical
```

Dann Vorschau (`node serve.js` im Scratchpad → 127.0.0.1:4173) und mit **Playwright**
(nicht dem Browser-Pane): 1440×900 und 390×844 — Boot, Hero (Reel-Quelle!), Bereiche,
Wipe, Preise, Menü, Karten-Gate, FAQ, jede Unterseite oben + gescrollt, Formular-Fluss,
`index.html#preise` (kein Vorhang, kein scrollTo(0,0)). `localStorage.clear()` vorher.

Gequetschte Raster auf 390 px:
```js
[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).display==='grid')
  .map(e=>({el:[...e.attributes].map(a=>a.name).filter(n=>n!=='style').join(','),t:getComputedStyle(e).gridTemplateColumns}))
  .filter(x=>x.t.split(' ').length>1 && Math.min(...x.t.split(' ').map(parseFloat))<140)
```

Nach dem Push: `curl -I` auf `/CLAUDE.md`, `/build/build.js`, `/src/` → müssen 404 sein.
Und: dieselbe Messung noch einmal gegen die **Live-URL**, und zwar **ohne vorher zu
scrollen** — der Fall „rote Hero-Fläche fehlt" trat nur dort auf und verschwand,
sobald ein `scrollTo` vorausging (siehe Fehler Nr. 29/30).

---

## 9. Änderungslog (jede Änderung, neueste oben)

- **2026-09-07 — Design neu abgerufen und die mobile Fassung 1:1 übernommen**
  (Auftrag Tolunay). Das Design in Claude Design war seit meinem Import
  überarbeitet worden — und zwar genau an den Stellen, um die wir uns die
  letzten Runden gestritten haben. Es bringt jetzt selbst mit:
  - `[data-hero-sec]` 260 vh und `[data-hero-pin]` 100 dvh; `heroFx` hat einen
    eigenen Telefon-Zweig (rote Fläche seitwärts über die ersten 42 % der
    Strecke, eigene Kurven für Film-Zoom, Schleier, HUD und „Die Halle").
  - `pinFx` — eine Ersatzmechanik, die erkennt, ob `position:sticky` überhaupt
    greift, und die Klebeblöcke sonst selbst mit Transformationen hält.
  - `areasFx` rechnet die Klebestrecke aus **Sektionshöhe minus Rasterhöhe** —
    dieselbe Korrektur, die ich als HSK-PATCH 23 gebaut hatte.
  - Der Vorhang läuft auf dem Telefon als `clip-path` von **links nach rechts**,
    die Schrift steigt wortweise ein (`data-wipe-word`), dazu ein mobiler
    Preis-Zusatz (`data-wipe-sub`).
  - Eine **pulsierende Kartenmarke** (`hs-ping` / `hs-pin`) mitten in der Karte.
  - `[data-marquee]` randlos auf dem Telefon, `[data-faq-side]` statisch,
    `[data-areas-foot]` aus und der Zähler stattdessen auf der Bühne,
    `html{overflow-x:clip}` statt `body{overflow-x:hidden}`.
  **Was ich dafür entfernt habe:** meinen kompletten mobilen Abstands-Rhythmus,
  meine Höhen-Blöcke (svh/dvh), meine Hero-, Vorhang- und Zeilen-Animationen,
  meine Kartenmarke, das `data-band`-Pflaster und die Patches 15, 17, 18, 19,
  21, 23, 24, 25, 26, 27, 28. `site.css` ist von 455 auf 239 Zeilen geschrumpft,
  die Zahl der Skript-Patches von 31 auf 22.
  **Was in der Produktionsschicht bleibt** (ändert am Bild nichts): Hersteller-
  Präfixe, sichere Zonen randloser Telefone, 44-px-Trefferflächen, die
  Karten-Einwilligung, selbst gehostete Schriften, Clips aus dem Repo,
  Save-Data-Schutz, Zeitzone Berlin, Fokusführung im Menü — und alles zu den
  Unterseiten, die es im Design nicht gibt.
  **Zwei bewusste Abweichungen, beide sichtbar:**
  1. Auf dem Telefon laufen im Hero vier **Hochkant-Clips** statt der zehn
     Kinoclips (HSK-PATCH 8). Das Design zeigt die 16:9-Clips, von denen
     `object-fit:cover` auf 9:16 zwei Drittel abschneidet; die Hochkant-Fassungen
     zeigen denselben Raum, fürs Telefon gerahmt, bei einem Viertel der Bytes.
     Im HUD steht deshalb „03 / 04" statt „03 / 10".
  2. Das Einwilligungsfeld der Karte braucht bei 390 px 279 px Höhe, der
     4:3-Rahmen des Designs bietet 266. Engeres Polster im Feld (16 px statt 20,
     Fließtext 13,5 px) statt eines anderen Seitenverhältnisses — die geladene
     Karte behält damit exakt die Proportion des Designs.
  - **Ein Bild fehlte:** das Design nutzt neu `assets/eq-treadmill.jpg` für die
    Conditioning-Karte. Über die Design-API kommen Dateien nur bis 256 KB, das
    Bild ist größer und kam abgeschnitten an. Ich habe es aus `v-treadmill.mp4`
    erzeugt — also aus genau dem Clip, den dieselbe Karte beim Hover abspielt
    (`gal-cardio.jpg` im Projekt ist erkennbar ein Standbild derselben Aufnahme).
    Wer das Original will, legt es einfach darüber.
  - Gemessen: Startseite auf dem Telefon 18,92 Bildschirme gegen 18,90 im
    Design; am Rechner in **jedem** geprüften Wert identisch (Länge 15,71,
    Hero 1800, Bereiche 2970, Raster und Vorhang kleben, `clip-path` unberührt).
    Neun Ansichten Design gegen Build gegenübergestellt (Hero, Haltung,
    Bereiche 1 und 3, Ausstattung, Vorhang, Preise, Kontakt) — deckungsgleich.
    9 Seiten × 4 Breiten ohne Querlauf und Konsolenfehler, reduzierte Bewegung,
    Anker, Menü, FAQ, Antippen einer Bereichszeile. Sicherheit: kein
    `innerHTML`/`eval`/`fetch` in der übernommenen Logik, CSP unverändert,
    Google-Fonts weiterhin herausgelöst und selbst gehostet, keine neuen
    Fremdziele.


- **2026-09-07 — Siebte Rückmeldung** (Tolunay):
  - **Bereiche zurück auf die feststehende Ansicht.** Gewünscht war von Anfang an
    die Choreografie des Designs: Bild oben, darunter „Drei Flächen. Ein
    Anspruch." und die drei Zeilen — und beim Scrollen wechselt **nur** der
    Bereich, Kraft → Athletik → Conditioning, erst danach die Ausstattung. Meine
    Zwischenfassung (Bühne klebt, Liste läuft darunter durch) war ein
    Missverständnis. Der Fehler daran war nie das Kleben, sondern die Einheit:
    Sektion in svh, Klebeblock in dvh. Jetzt beide in dvh — 250 zu 100, also
    150 dvh Klebestrecke, eine halbe Bildschirmhöhe je Bereich. Gemessen über
    13 Punkte: Rasteroberkante bleibt 0, Zähler 01 → 02 → 03, kein Loch; auch
    nicht, wenn die Adressleiste mitten in der Sektion ein- oder ausblendet.
  - **Roter Hero-Balken ruckelte.** Bild für Bild am Scrollweg war die falsche
    Antwort — Safari reicht die Scroll-Ereignisse beim Nachlauf gebündelt nach.
    Jetzt dieselbe Mechanik wie beim roten Preis-Vorhang, die sich bewährt hat:
    ein Schaltpunkt im Skript, die Bewegung macht eine CSS-Blende (0,9 s) auf dem
    Compositor. Damit kann sie gar nicht stocken.
  - **Hero gestreckt:** 150 → 200 dvh, wie am Rechner. Am Bild ändert das nichts,
    der Film steht nur länger, bevor die Haltung übernimmt.
  - **Preise langsamer:** das Rot schiebt sich jetzt in 1,15 s über die Fläche
    (vorher 0,75), die Schrift folgt danach. Gemessen: Rot ab 0,2 s unterwegs,
    voll bei 1,1 s, Schrift von 1,3 bis 1,9 s.
  - **Karte pulsiert:** zwei versetzte Ringe gehen von der Nadelspitze aus, also
    genau vom Studio. Der erste Versuch lief mit einer Kurve, die sofort ans Ende
    schoss — sichtbar war er nur einen Wimpernschlag; jetzt eine gleichmäßige
    Ausbreitung über 2,4 s, zwei Ringe um 1,2 s versetzt.
  - **Aufgeräumt:** die Zeilen-Einblendung (`data-verborgen`) und das
    Aktiv-Kennzeichen (`data-aktiv`) sind wieder raus — sie gehörten zur
    Zwischenfassung. Der Bereichswechsel rechnet jetzt mit der **gemessenen**
    Klebestrecke (Sektionshöhe minus Höhe des Rasters, HSK-PATCH 23) statt mit
    der Bildschirmhöhe; `goArea` zielt auf dieselbe Strecke (HSK-PATCH 24).
  - Geprüft: 9 Seiten × 4 Breiten ohne Querlauf und Konsolenfehler; Zähler
    „03 / 03" bei 844/745/667 px Bildschirmhöhe frei von der Probetraining-Leiste;
    Desktop unverändert nachgemessen (200 vh / 330 vh, Raster und Vorhang kleben,
    `clip-path` unberührt, Zeilen klappen auf und zu, kein negativer Abstand);
    Anker, Menü, FAQ, Antippen einer Zeile. Sicherheit: nichts Neues — kein
    `innerHTML`/`eval`, CSP und Fremdziele unverändert.


- **2026-09-07 — Sechste Rückmeldung: „der rote Balken oben fehlt komplett"** (Tolunay):
  - **Der Fehler: scroll-gesteuerte Animation stand live sofort auf „fertig".**
    Auf der Live-Seite meldete die Zeitachse bei Scrollposition 0 einen
    Fortschritt von 90 % — festgefroren, unabhängig vom Scrollen. Die Animation
    war damit im Endzustand: die rote Fläche stand auf −398 px, also außerhalb
    des Bildes, **bevor der Besucher überhaupt gescrollt hatte**. Lokal trat das
    nie auf; ich habe es erst gesehen, als ich die Live-Seite selbst gemessen
    habe. Ursache nicht abschließend geklärt — und genau deshalb ist die Technik
    hier raus: eine Animation, deren Fehlschlag Inhalt verschwinden lässt, hat in
    einer Kundenseite nichts zu suchen.
    (Das Design selbst nutzt `animation-timeline` an vielen Stellen — dort ist der
    Endzustand „sichtbar". Fällt sie aus, ist der Inhalt einfach da. Das ist der
    Unterschied: **eine scroll-gesteuerte Animation darf nur dort stehen, wo
    „sofort fertig" der gewünschte Ruhezustand ist.**)
  - **Hero jetzt wie am Rechner:** die rote Fläche fährt Bild für Bild am
    Scrollweg seitwärts aus dem Bild (HSK-PATCH 17). Ein Transform auf einem
    Element je Ereignis — teuer war nie das Verschieben, sondern die erzwungenen
    Layouts drumherum, und die sind seit Nr. 15/25/26 weg.
  - **Bereiche:** jede Zeile steigt beim Hereinscrollen ein. Das Kennzeichen
    dafür nimmt `areasFx` weg, wo die Maße der Zeilen ohnehin schon vorliegen —
    ein IntersectionObserver meldete sich in der Messung bis zu einer halben
    Sekunde später. Jede Zeile trägt jetzt 40 svh statt 30, damit der Wechsel
    Kraft → Athletik → Conditioning Zeit hat (je gut ein Drittel Bildschirm).
  - **Preise:** die Schrift kommt erst, wenn das Rot komplett steht — die
    Verzögerung ist jetzt die volle Dauer der Vorhangblende (0,78 s statt 0,34 s).
  - **Karte:** statt des roten Punkts die vertraute Nadel-Form, gefüllt im Rot des
    Hauses, Spitze exakt auf der Kartenmitte (gemessen 0/0 px Abweichung). Der
    Puls-Ring ist weg.
  - Geprüft: Hero bei Scrollposition 0 **ohne jedes Zutun** (das war der Fehler) —
    rote Fläche sichtbar; Verlauf über den Scrollweg; Bereiche Schritt für Schritt
    inklusive Anker-Aufruf `#training` und einzelnem Sprung; Vorhang im
    Zeitverlauf; 9 Seiten × 4 Breiten ohne Querlauf und Konsolenfehler; Desktop
    unverändert nachgemessen. **Achtung bei Messungen:** Headless-WebKit läuft mit
    ~10 Bildern/s, jede Bild-für-Bild-Bewegung sieht dort stufig aus und der
    Zustand hinkt bis zu 1,5 s nach — das ist der Prüfstand, nicht die Seite.
    Sicherheit: nur konstante Attributnamen, kein `innerHTML`/`eval`, CSP und
    Fremdziele unverändert (das `xmlns` der Karten-Nadel entfernt, damit die
    Fremdziel-Prüfung sauber bleibt).


- **2026-09-07 — Fünfte Rückmeldung: „so hab ich das nicht gemeint"** (Tolunay):
  Drei Stellen, an denen ich die Absicht falsch getroffen hatte. Gemeinsamer
  Nenner: ich hatte Bewegung **entfernt**, um sie flüssig zu bekommen — gewünscht
  war Bewegung, die flüssig IST.
  - **Der Schlüssel: scroll-gesteuerte CSS-Animationen.** Safari 26 kann sie
    (`animation-timeline`, in WebKit 26.6 nachgeprüft: `view()`, benannte
    Zeitachsen und `animation-range` alle da). Damit hängt eine Bewegung am
    Scrollweg **und** läuft trotzdem auf dem Compositor — genau die Kombination,
    an der jede Bild-für-Bild-Fassung im Skript gescheitert ist (Safari reicht
    die Scroll-Ereignisse beim Nachlauf gebündelt nach). Ohne Unterstützung
    greift weiter der Schwellen-Ersatzweg im Skript; `_sda` (HSK-PATCH 27)
    entscheidet, und bei „weniger Bewegung" ist er immer aus.
  - **Hero: die rote Fläche fährt jetzt seitwärts, nicht nach unten.** Wie am
    Rechner, und am Scrollweg festgemacht statt an einer Schwelle — vorher
    verschwand sie auf einen Schlag. `#top` trägt die Zeitachse `--hero`, der
    Bereich `contain` ist exakt die Strecke, die der Hero geklebt bleibt.
    Gemessen: 0 → −91 → −182 → −274 px, linear zum Finger. Der Film läuft
    dahinter weiter — und zwar bis der Hero wirklich aus dem Bild ist: die
    Pause hing an `p >= 1`, also am Beginn des Wegscrollens, und der Film fror
    eine volle Bildschirmhöhe lang sichtbar ein.
  - **Trainingsbereiche: jeder Bereich kommt einzeln.** Vorher standen alle drei
    Zeilen gleich hell da, es „erschien" nichts. Jetzt steigt jede Zeile beim
    Hereinscrollen ein (`view()`-Zeitachse), und der aktive Bereich hebt sich
    über die Deckkraft ab (`data-aktiv`, HSK-PATCH 28) — der Text bleibt dabei
    stehen, eingeklappt wäre in der Zeile nur wieder Leere. Bild oben wechselt
    mit: Kraft → Athletik → Conditioning, dann „Kein Standard-Sortiment".
  - **Preise: der rote Vorhang schiebt sich von links nach rechts herein,**
    danach steigt die Schrift ein (0,34 s später). Beides eine CSS-Blende, das
    Skript setzt nur `data-wipe-auf`. Damit dabei nichts leer stehen kann,
    belegt der Vorhang auf dem Telefon **keinen eigenen Platz mehr im Fluss**
    (negativer oberer Abstand in Höhe seiner selbst) — er legt sich über das
    Ende der Ausstattung. Es gibt also keine Fläche, die schwarz bleiben könnte,
    egal wie schnell jemand scrollt. Ausgelöst bei 1,9 Bildschirmen Restweg.
  - Geprüft: WebKit 26 mit iPhone-Maßen; Hero, Bereiche und Vorhang über den
    ganzen Scrollweg gemessen; Ersatzweg für ältere Browser eigens nachgestellt
    (`CSS.supports` gestubbt, Animation abgeschaltet) — Balken fährt dort per
    Schwelle nach links; reduzierte Bewegung schaltet die Zeitachsen ab und
    lässt das Skript übernehmen. 9 Seiten × 4 Breiten ohne Querlauf und
    Konsolenfehler. Desktop unverändert nachgemessen (200 vh / 330 vh, Raster
    und Vorhang kleben, `clip-path` unberührt, Zeilen klappen weiter auf und zu,
    kein negativer Abstand). Startseite auf dem Telefon 15,3 → 14,3 Bildschirme.
    Sicherheit: nur konstante Attributnamen, kein `innerHTML`/`eval`, CSP und
    Fremdziele unverändert.


- **2026-09-07 — Vierte Rückmeldung vom Gerät** (Tolunay, iPhone-Screenshots 12:14/12:15):
  - **Karte: roter Punkt aufs Studio, ganze Fläche öffnet die Route.** Google setzt
    mit `q=Adresse` eine eigene Nadel — unter dem Graufilter der Karte steht sie
    grau im Bild, die Adresse war also auf einer grauen Karte grau markiert.
    Mit `ll=51.3956,8.5681&z=16` zentriert Google denselben Punkt **ohne** Nadel
    (in WebKit gegen die Adress-Fassung geprüft: die Kartenmitte trifft deren
    Nadelspitze). Die Marke setzen wir jetzt selbst — `[data-map-pin]` in der
    Mitte, außerhalb des iframe, also ungefiltert im Rot des Hauses.
    Der Link liegt nicht mehr als Chip in der Ecke, sondern über der **ganzen**
    Karte und startet die Route: Apple Karten auf Apple-Geräten
    (`maps.apple.com/?daddr=…&dirflg=d`), sonst Google Maps
    (`maps/dir/?api=1&destination=…`). Das räumt nebenbei die Überlappung mit
    Googles eigenem Knopf oben links auf — die war im Screenshot zu sehen.
    Der Koordinaten-Wert lebt ab jetzt an EINER Stelle (`GEO` in build.js) und
    speist strukturierte Daten, Kartenmitte und Route.
  - **Hero: der rote Banner fährt beim Scrollen weg.** Am Rechner fährt die rote
    Fläche seitwärts aus dem Bild; auf dem Telefon lag sie unten auf dem Film und
    blieb den ganzen Hero über liegen — der Film war nie zu sehen, und die
    Schlusszeile „Die Halle" stand daneben statt an ihrer Stelle. Jetzt: ein
    Schaltpunkt bei 16 % der Hero-Strecke (zurück bei 9 %), die Bewegung macht
    eine CSS-Blende auf dem Compositor. „Die Halle" sitzt wieder unten.
  - **Schwarze Fläche in den Trainingsbereichen — die eigentliche Ursache.**
    Die letzte Runde hat das Symptom (langsam ladende Bilder) behandelt, nicht den
    Fehler. Der lag in der Geometrie: die Sektion stand in `250svh` (fest), der
    Klebeblock in `100dvh` (folgt der Adressleiste). Blendet Safari die Leiste
    aus, wächst **nur der Block** — seine Klebestrecke schrumpft, er gibt vor dem
    Ende der Sektion ab, und darunter steht ihr schwarzer Grund. In WebKit mit
    iPhone-Maßen nachgestellt und gemessen: **80 px Loch**.
    Zwei Konsequenzen: (a) Hero und Vorhang stehen jetzt in **derselben** Einheit
    wie ihr Klebeblock (`150dvh` / `100dvh`). (b) Die Bereiche haben gar keine
    gerechnete Strecke mehr: die Sektion ist so hoch wie ihr Inhalt, die **Bühne**
    klebt oben, die drei Zeilen laufen darunter durch (je 30 svh), und der aktive
    Bereich wird aus den Zeilen gelesen (HSK-PATCH 23/24). Damit ist es genau das,
    was Tolunay beschrieben hat: runterscrollen → Kraft mit Bild, weiter →
    Athletik, weiter → Conditioning mit den Laufbändern. Gemessen über 31 Punkte
    der Sektion: kein Loch, und die Bühne bleibt beim Leistenwechsel bei 0.
    Nebeneffekt: die Startseite ist auf dem Telefon 16,2 → 15,3 Bildschirme kurz.
  - **Roter Vorhang ruckelt nicht mehr.** Er lief Bild für Bild am Scroll-Ereignis;
    Safari reicht die beim Nachlauf gebündelt nach, daher die Stufen. Ein
    Schaltpunkt mit CSS-Blende wäre glatt gewesen, hätte aber vor dem Umschlagen
    eine bildschirmhohe schwarze Fläche stehen lassen (der Vorhang belegt im Fluss
    eine volle Bildschirmhöhe). Deshalb steht er auf dem Telefon jetzt **still**
    (`position:static`, kein `clip-path`, kein Skript) und kommt von unten ins
    Bild, **weil die Seite scrollt**. Gemessen: 0 → 40 → 60 → 80 → 100 %, linear
    zum Scrollweg. Scrollen ist die einzige Bewegung, die auf dem Telefon
    garantiert flüssig ist.
  - **Weniger erzwungene Layouts pro Scroll-Ereignis.** `hero.offsetHeight` wurde
    bei JEDEM Ereignis nach einem Stil-Schreibvorgang gelesen — das erzwingt jedes
    Mal ein neues Layout. Jetzt gemessen, wenn sich die Bildschirmhöhe ändert
    (die Höhe hängt nur an ihr). Leiste und Fortschrittstext werden nur noch
    geschrieben, wenn sich ihr Wert ändert (HSK-PATCH 15/25/26).
  - Desktop unverändert nachgemessen: Sektion 330 vh, Raster klebt, Vorhang mit
    `clip-path`, Hero 200 vh, Seitenlänge 15,71 Bildschirme (vorher 15,69).
  - Geprüft: 9 Seiten × 4 Breiten (390/768/1440/1920) ohne Querlauf und ohne
    Konsolenfehler, reduzierte Bewegung schaltet den Kartenpuls ab, Link ohne
    Apple-Kennung auf Google Maps. Sicherheit: kein `innerHTML`/`eval`, CSP
    unverändert, keine neuen Fremdziele außer `maps.apple.com` (nur als Link).


- **2026-09-07 — Drei Rückmeldungen vom Gerät** (Tolunay, iPhone-Screenshots 02:18):
  - **Laufschrift-Band nicht randlos.** Das Band in „Haltung" liegt in einer Sektion
    mit seitlichem Polster und endete 18 px vor jedem Rand — die Schrift verschwand
    in einer Kante, was aussah, als lade das Band noch. Build setzt jetzt
    `[data-band]`, `site.css` zieht es mit negativen Außenabständen über das Polster.
    Gemessen: links 0, rechts 0, Breite = Fensterbreite.
  - **Schwarzer Bildschirm in den Trainingsbereichen.** Ursache gefunden: die drei
    Bühnenbilder (366 + 161 + 316 KB) laden faul; auf 700 kbit/s waren sie nach
    5 Sekunden **noch nicht da**, und die Bühne ist `#0E0E11` — also schwarz.
    → Erstes Bild `loading="eager" fetchpriority="high"`, und **`srcset` generisch
    im Build**: für jedes JPEG mit einer `-720.jpg`-Fassung im Repo (20 Stück,
    3,30 → 0,75 MB). Die Breite fürs `srcset` liest `jpegBreite()` aus dem
    JPEG-Kopf (SOF-Segment), ohne Fremdcode. Auf langsamem Netz stehen die Bilder
    jetzt nach ~1 s.
  - **Bereichswechsel zu schnell.** Bei 210 svh blieben je Bereich 0,37 Bildschirm-
    höhen — man wischte an Kraft/Athletik/Conditioning vorbei, ohne den Wechsel zu
    sehen. Jetzt 250 svh = 0,5 je Bereich (Tolunay wollte die Choreografie sehen).
  - **Wipe-Titel hinter der Leiste.** „Eine Leistung. Drei Laufzeiten." saß am
    unteren Rand und lag damit 106 px hinter der Probetraining-Leiste, darüber
    730 px leeres Rot. Auf dem Telefon jetzt mittig (`justify-content:center`)
    mit `padding-bottom:calc(72px + safe-area)`; Abstand zur Leiste 308 px.

- **2026-09-06 (3) — Design-Durchsicht Telefon** (Workflow, 8 Dimensionen × 2 Skeptiker,
  158 Agenten; 40 bestätigt, 35 verworfen). Umgesetzt:
  - **Typografie**: Display-Zeilen auf dem Telefon `line-height:.96` — Big Shoulders
    reicht mit Umlaut bis 0,954 em über die Grundlinie, bei .84 stießen die Punkte von
    Ä/Ö/Ü in die Zeile darüber, sobald eine Zeile umbrach. `<wbr>` → `&shy;` (im Build,
    asserted): `<wbr>` bricht ohne Trennstrich, „KEIN MASSEN / BETRIEB." war schlicht
    falsch geschrieben. Wipe-Titel unter 500 px auf `12.8vw` (traf sonst seine
    clamp-Untergrenze und wurde dreizeilig mit „DREI" allein). `hyphens:auto` für die
    langen Komposita in schmalen Spalten.
  - **Rhythmus**: Unterseiten-Sockel nur noch auf EINER Kante (jede Naht war 104 px,
    an zwei Stellen 164). `#loslegen` ausgenommen (randloses Band). Die Preisseite
    bekam `id="preise"` — alle sechs Telefon-Regeln waren id-gebunden und griffen dort
    nicht, ausgerechnet auf der Seite mit den Preisen. Rechtsseiten haben kein
    `data-screen-label` und liefen als einzige komplett im Desktop-Takt.
  - **Bedienung**: REC-Knopf 42 × 14 → 58 × 45 px (Polster + negativer Außenabstand,
    Optik unverändert), Fußzeilen-Links (der einzige Weg zu Impressum/Datenschutz)
    44 px, Termin-CTA 44 px, „In Google Maps öffnen" 44 px, Logo-Link volle Zeilenhöhe.
    **`:active`-Zustände** ergänzt — es gab keinen einzigen: das iOS-Aufblinken ist
    abgeschaltet und jeder Hover-Zustand hängt an `(hover:hover)`, was auf dem Telefon
    nie zutrifft.
  - **Echte Fehler**: `[data-hero-hud]` trug `animation:… both` — der Endzustand einer
    Keyframe-Animation steht über dem style-Attribut, das Skript hätte die Deckkraft
    nie ändern können. Jetzt `animation-fill-mode:backwards`. Die Galerie-Regel
    `[data-gal]{gap:8px!important}` machte aus den 1-px-Rasterlinien des
    Bewegtbild-Rasters 8-px-Bänder (dort SIND die Fugen die Linien) — `!important` weg.
    Leere Rasterzellen erschienen als graue Geisterkacheln → dritte Kachel jeder
    Dreiergruppe über die volle Breite. Kennzahlen („10.000+", „Meister", „06–24")
    liefen aus ihren 85-px-Zellen über die Rasterlinien → `[data-stats]` einspaltig.
    Auf 375 × 667 wurde der Zähler „03 / 03" um 14 px abgeschnitten → Bühne 34 dvh.
  - **Gewicht** (Telefon): Bereichs-Clips laden dort gar nicht mehr (4,25 MB, das
    Standbild trägt die Bühne allein, HSK-PATCH 21). Hover-Clips als 960-px-Fassungen
    `*-m.mp4` (16,5 → 2,4 MB, HSK-PATCH 22). Hochkant-Hero-Clips mit CRF 27 neu
    kodiert (4,76 → 2,55 MB). Hero-Poster nicht mehr als Attribut, sondern als
    medien-gebundener Hintergrund — das Telefon lud sonst erst 165 KB Querformat und
    danach das Hochkant-Bild. `eq-treadmill.jpg` war bytegleich mit `p-cardio.jpg`
    (316 KB doppelt) → entfernt. `reelTick` läuft auf dem Telefon gar nicht mehr
    (Timecode und Segmentleiste sind dort `display:none`, es schrieb 11 Werte pro
    Frame in unsichtbare Elemente, HSK-PATCH 20). **Zusammen rund 21 MB weniger.**
  - Offen gelassen: `srcset` für die Fotos (Aufwand/Nutzen — die Bilder sind bei
    DPR 3 kaum überdimensioniert und laden ohnehin faul).

- **2026-09-06 (2) — Ruckeln auf dem Telefon, iOS-Adressleiste.** Tolunay schickte drei
  iPhone-Screenshots: große Leerflächen und „das rote Banner zieht sich ruckelig nach
  links". Die Leerflächen waren **Cache** (Screenshot 18:13, Deploy 18:10, Pages
  cached 10 min) — auf der Live-Seite bei 430 × 932 an allen fünf Stellen 0 px Leere
  nachgemessen. Das Ruckeln war echt:
  - **HSK-PATCH 16/17**: `this._mob` (matchMedia ≤ 900 px, gesetzt **vor** dem ersten
    `sync()`, mit `change`-Listener, der die Inline-Reste der anderen Fassung löscht).
    `heroFx` kehrt auf dem Telefon früh zurück: **keine** pro Frame gesetzten
    Transformationen mehr für rote Fläche, Film-Zoom und Schleier. HUD und
    Schlusszeile wechseln nur noch an einer Schwelle (0/1) und blenden per CSS.
    Begründung fürs Design: am Rechner fährt die rote Fläche als 46-%-Spalte
    seitwärts aus dem Bild — auf dem Telefon ist sie ein Block am unteren Rand,
    ihn seitwärts wegzuschieben trägt gestalterisch nicht und stottert, weil Safari
    die Scroll-Ereignisse im Nachlauf gebündelt liefert.
  - **HSK-PATCH 18**: Parallax (`[data-px]`) auf dem Telefon aus.
  - **HSK-PATCH 5** (erweitert): Hintergrund und Weichzeichner der Leiste nur beim
    Zustandswechsel schreiben statt in jedem Frame (`backdrop-filter` ist auf iOS teuer).
  - **HSK-PATCH 19**: der rote Wipe auf dem Telefon als `translate3d` statt `clip-path`
    — Compositor statt Neuzeichnen des ganzen Blocks.
  - **`dvh` für die Vollbild-Blöcke** (`#top>div`, `[data-areas-grid]`, `[data-wipe]`):
    `svh` ist die Höhe **mit** Adressleiste; blendet Safari sie beim Scrollen aus, ist
    der sichtbare Bereich bis zu 145 px höher als jeder Vollbild-Block und darunter
    steht ein Streifen der nächsten Sektion. Die Sektions-**Höhen** bleiben in `svh`,
    damit sich die Scroll-Strecke beim Ein-/Ausblenden nicht ändert.

- **2026-09-06 — Mobiler Rhythmus** (Tolunay: „viel zu weite Abstände … das Scrollen
  muss noch angepasst werden"). Gemessen: 18,47 Bildschirme, davon 5,3 reines
  Klebe-Scrollen. Jetzt **16,18** (−12 %), Desktop unverändert (15,69).
  Alles in `site.css` unter ≤ 900 px, plus drei Fehler, die dabei aufgefallen sind
  (der dritte war mein eigener, siehe §6 Nr. 17):
  - **Scroll-Strecken**: Hero 200 → 150 svh, Bereiche 330 → 210 svh (37 vh je Bereich).
  - **HSK-PATCH 15**: `heroFx` bekam seine Strecke aus einer festen Bildschirmhöhe —
    das stimmt nur bei 200 vh. Jetzt aus `#top.offsetHeight − vh`, also unabhängig
    von der CSS-Höhe (am Rechner rechnerisch identisch zu vorher).
  - **Parallax in „Haltung"**: ohne den Desktop-Versatz (70–220 px) schoben die
    ±56 px Parallax die Bilder ins Zahlenraster. Auf dem Telefon `transform:none`,
    Bilder oben bündig nebeneinander (5/12 + 7/12), Bildunterschrift volle Breite.
  - **Bereichs-Index** war oben ausgerichtet → ~280 px leerer Klebe-Raum unter
    „03 / 03". Jetzt zentriert, Bühne 40 → 44 svh.
  - **Sockel** 80–90 → 52 px, Blockabstände 44–80 → 24–32 px, Karten enger
    (Ausstattung 325 → 300 px, Preise 293 → 252 px, Partner ohne Mindesthöhe),
    `[data-kv]` 17 → 12 px, Seitenkopf der Unterseiten unten 32 px.
  - **Hero**: „Die Halle. Täglich 06–24." lag auf dem REC-HUD (beide `top:~66px`) —
    jetzt `top:112px`. Rote Fläche mit engerem Innenabstand.
  - Overlay-Menü `overscroll-behavior:contain`.
  - Nachtrag: der Unterseiten-Sockel traf auch die Landing (§6 Nr. 17) — jetzt
    `body[data-sub]`, Endstand **15,71** Bildschirme.

- **2026-09-05 (Prüfrunde)** — 29 bestätigte + selbst bewertete Befunde umgesetzt, alles in
  §5.1a: `marquee.js` neu, Reel-Patches 9–14 (preload, playAll, Bereichs-Videos,
  pausierter Start, REC-Knopf, Brilon-Zeit), Menü-Fokus/inert, FAQ als Buttons,
  Fokus nach Formular/Karte, Fokusring Knochen, Platzhalter-Kontrast, aria-hidden auf
  Videos/Nummern, benannte Landmarken, sr-h2, reduzierte Bewegung ohne Flimmern,
  safe-area, untere Leiste schwarz, `./` statt index.html, „Nach oben" → `#inhalt`,
  404 absolut, referrerpolicy, Gate-/Datenschutz-Texte (Cookies, Anliegen, Apple
  Karten), Anführungszeichen, `&nbsp;`, Build-Härtung (CANONICAL Pflicht, FORM_MODE,
  Asset-/Clip-Prüfung, `$`-sichere Ersetzungen, ctaHref), CI-Rebuild-Check.
  `HSK-PATCH`-Marker: 18 (+1 Kopfkommentar = 19 Treffer).
- **2026-09-05** — Mobile-Korrekturen (FAQ sticky, Bühnen-Label, Kartenbox), Hochkant-
  Reel + `m-racks-poster.jpg`, Touch-Umschalten der Hover-Clips, Tastatur für FAQ/
  Bereiche, `aria-expanded`; Prüfrunde als Workflow (8 Dimensionen, adversarial).
  Build-Fixes: 37 Bindungen, 9 Hover, `/* HSK-PATCH 5 */`, Rechtsseiten durch
  `processFragment`, Leftover-Check nur auf Medien-Hotlinks.
- **2026-09-04/05** — **v2-Umbau.** Design-Projekt `c3d4514c…` per Chrome +
  `window.open`-Fragment übertragen (§6 Nr. 3); `src/` getauscht; `build/build.js`
  komplett neu; `extra.css/brand.js/consent.js/partner/preise/termine/trainer/legal.css`
  gelöscht; `site.css` + `pages/*` neu; Fonts getauscht (v1-Fonts gelöscht); fünf
  Unterseiten, Rechtsseiten neu gesetzt, 404 neu; `events.json` CTA → mitglied-werden.
- **2026-09-02** — v1: Parkplätze richtiggestellt, Beratungszeiten ergänzt (`588ed26`).
  Davor: Preise + „Der Kopf dahinter", Verkaufsweg-Reihenfolge, Menü-Design, Termine,
  Laufschriften, Partner, iPhone-Film, Marken-Auftritt, Impressum/Datenschutz mit
  echten Daten, Audit-Runde (CSP, Deploy-Filter), H.264-Umstellung, Erstimport.
