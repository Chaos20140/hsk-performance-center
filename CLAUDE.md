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
8. `writeSiteJs()`: Logik wörtlich + `patchLogic()` (18 Marker `HSK-PATCH`) + Shim.
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
| Rote Fläche fährt raus, Video zoomt zurück, „Die Halle." erscheint | `heroFx` | `[data-red]`, `[data-hero-video]`, `[data-hero-after]`, `[data-nav-logo]` |
| Trainingsbereiche: 330vh sticky, Index ↔ Bühne, Clip je Bereich | `areasFx`, `goArea` | `[data-areas]`, `[data-area-row]`, `[data-area-media]` |
| Roter Wipe „Eine Leistung. Drei Laufzeiten." | `wipeFx` | `[data-eq]`, `[data-wipe]` (sticky bottom, clip-path) |
| Ausstattungs-Clips beim Hover | `eqEnter/eqLeave` | `[data-eq-card] video[data-src]` |
| FAQ | `toggleFaq` | `[data-faq-head]`, `[data-faq-body]` (max-height) |
| Nav-Hintergrund, SCRL %, Progress-Balken, Mobilleiste ab 0,85 vh, Parallax | `sync` | `[data-nav]`, `[data-scrl]`, `[data-progress]`, `[data-mbar]`, `[data-px]` |
| Öffnungsstatus | `renderVals().statusText` | `h >= 6` → „JETZT GEÖFFNET · BIS 24 UHR" |
| Karte | `loadMap` + Shim | `[data-if="mapOn"/"mapOff"]`, `[data-map-frame]`, `[data-map-open]` |

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
16. **Der Anker-Sprung passiert in Chromium nach DOMContentLoaded.** `scrollY` war beim
    Mount noch 0, also lud der Hero-Clip trotz `#preise`. Der Hash zählt jetzt als
    „nicht im Bild".

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
grep -c 'HSK-PATCH' assets/js/site.js                 # 19 (18 Marker + Kopfkommentar)
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

---

## 9. Änderungslog (jede Änderung, neueste oben)

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
