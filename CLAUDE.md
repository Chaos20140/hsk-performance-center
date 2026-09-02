# CLAUDE.md — HSK Performance Center

Arbeitsnotizen für mich (Claude). Kein Kundendokument. Ziel: beim nächsten Mal in
zwei Minuten wieder drin sein — was die Seite ist, wie sie funktioniert, wo die
Fallstricke liegen und welche Fehler ich schon gemacht habe.

---

## 1. Was das hier ist

Statische Website für das **HSK Performance Center**, ein Fitnessstudio in
Brilon (Hochsauerlandkreis). Kunde von Tolunay. Original: <https://www.hsk.fitness/>

Die Seite ist **kein Neuentwurf von mir**. Sie kommt 1:1 aus einem Claude-Design-Projekt
(`HSK Fitness Redesign`, Projekt-ID `521a5b9e-c706-4f72-85e8-3a2578727adb`) und wurde
von einem `.dc.html`-Design-Component in eine eigenständige, deploybare Site
überführt. **Markup, CSS und Verhalten stammen unverändert aus dem Design.**
Alles was ich ergänzt habe, ist unten in §5 einzeln aufgeführt.

Deployment: GitHub Pages, Repo-Root ist die Seite.

---

## 2. Repo-Aufbau

```
/                      ← GitHub Pages Root (das ist die Website)
├── index.html         ← generiert aus src/HSK Performance Center.dc.html
├── impressum.html     ← generiert aus src/Impressum.dc.html
├── datenschutz.html   ← generiert aus src/Datenschutz.dc.html
├── 404.html           ← von Hand, generiert in build.js
├── robots.txt · sitemap.xml · site.webmanifest · .nojekyll
├── assets/
│   ├── *.jpg · *.mp4  ← Fotos + Clips des Studios (44 Dateien, ~30 MB)
│   ├── fonts/*.woff2  ← Bricolage Grotesque, Instrument Serif, Manrope (selbst gehostet)
│   ├── favicon.svg · apple-touch-icon.png
│   └── js/
│       ├── site.js    ← GENERIERT. Nicht direkt editieren.
│       ├── mobile.js  ← Handmade: Mobile-Dock
│       └── consent.js ← Handmade: Karten-Consent
├── build/             ← die Pipeline (siehe §3)
├── src/               ← die drei .dc.html Originale + support.js (Provenienz)
└── CLAUDE.md · README.md
```

**Wichtig:** `index.html`, `impressum.html`, `datenschutz.html`, `assets/js/site.js`,
`404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest` sind **Build-Artefakte**.
Änderungen daran gehen beim nächsten Build verloren. Immer in `build/` oder `src/`
ändern und neu bauen.

---

## 3. Build

```bash
cd build
HSK_CANONICAL="https://chaos20140.github.io/hsk-performance-center/" node build.js
```

Reines Node, keine Dependencies. Env-Variablen:

| Variable | Default | Wirkung |
|---|---|---|
| `HSK_CANONICAL` | `https://example.invalid/` | canonical, og:url, sitemap, robots |
| `HSK_FORM_MODE` | `mailto` | `mailto` = Formular öffnet Mailprogramm; `demo` = Original-Preview-Text |

`build.js` ist **absichtlich voller Assertions** (`must(...)`). Jede Stelle, an der
ich in den Design-Quelltext greife, ist an einem exakten String verankert. Ändert
sich das Design-Original, **bricht der Build laut ab** statt still ein Feature zu
verschlucken. Wenn ein `BUILD FAIL: … anchor not found` kommt: im `src/`-File die
Stelle suchen, Anker anpassen — nicht die Assertion löschen.

Was der Build macht:
1. Entfernt die Design-Host-Injektionen (`data-omelette-injected`), `support.js`,
   `__bundler_thumbnail`, `ext-resource-dependency`-Metas.
2. Zieht `<helmet>` in den echten `<head>`, entpackt `<x-dc>`.
3. `style-hover="…"` → echte `:hover`-Regeln (siehe §4.1).
4. `<sc-if value="{{ x }}">` → `<div data-if="x">` (siehe §4.2).
5. Extrahiert die `class Component extends DCLogic` in `assets/js/site.js` und
   hängt einen ~40-Zeilen-Shim an, der die Design-Runtime ersetzt.
6. Patcht die Logik an 4 Stellen (alle mit `HSK-PATCH` markiert, siehe §5).
7. Erzeugt die statischen Nebendateien.

---

## 4. Wie die Seite funktioniert

### 4.0 Grundprinzip

Eine Klasse, `Component`, in `assets/js/site.js`. Sie steuert **alles** per
`document.querySelector` über `data-*`-Attribute — es gibt kein Framework, keine
Komponenten, kein Virtual DOM. Der Shim am Ende der Datei instanziiert sie,
ruft `componentDidMount()` und stellt sie als `window.HSK` bereit.

`window.HSK` ist im Browser der Debug-Einstiegspunkt:
`HSK.setMenu(true)`, `HSK.setArea(1)`, `HSK.goToShot(3)`, `HSK.state`, `HSK._locked`.

### 4.1 `style-hover` — der wichtigste Fallstrick

Das Design nutzt ein Attribut `style-hover="box-shadow:…;transform:…"`.
**`support.js` implementiert das nicht** — das machte der Design-Host.
In einer exportierten Seite wären also alle 28 Hover-Effekte tot gewesen.

Der Build übersetzt sie in echtes CSS:
`style-hover="…"` → `data-hh="h7"` + Regel im `<style>`-Block:

```css
@media (hover:hover) and (pointer:fine){
  [data-hh="h7"]:hover{ box-shadow:… !important; transform:… !important }
}
```

`!important` ist **zwingend**: die Elemente tragen Inline-`style`, und ein
Selektor schlägt Inline-Styles nur mit `!important`. Die Media-Query verhindert,
dass Hover-Zustände auf Touchgeräten kleben bleiben.

Zähler zum Gegenprüfen: index 28, impressum 3, datenschutz 11.

### 4.2 Formular-Zustand

Statt `<sc-if>` gibt es zwei Wrapper:
`<div data-if="sent">` und `<div data-if="notSent">`.
Der Shim schaltet sie in `app.__render()` zwischen `display:contents` und
`display:none`. **`contents`, nicht `block`** — sonst käme eine zusätzliche Box
in den Grid-Fluss und das Layout wäre nicht mehr 1:1.

`setState({sent:true})` → `__render()` → Panel-Wechsel + `componentDidUpdate()`.

### 4.3 Hintergrund-Reel (das „Video im Hintergrund")

`[data-reel]` ist `position:fixed`, `z-index:0`, füllt immer den Viewport.
Alle Sections liegen mit `z-index:3` und halbtransparentem Schwarz darüber —
deshalb wirkt das Video als durchgehender Hintergrund der ganzen Seite.

- `data-shots` = 10 Clips, `data-labels` = deren Namen (Anzeige rechts unten im Hero).
- Zwei `<video data-reel-layer>` blenden hart gegeneinander über (`pumpReel`).
- **Der Fortschritt kommt aus dem Scroll**, nicht aus einem Timer: `syncReel(p)`
  teilt `pageProgress()` in `shots.length` Kapitel. Runterscrollen = neuer Clip.
- `data-shots-mobile` / `data-labels-mobile`: falls gesetzt und Viewport ≤ 820 px,
  nimmt `bootReel` diese statt der Desktop-Liste (HSK-PATCH 1). Vier Hochkant-Clips
  `assets/m-*.mp4`. `paintShotMeta` liest die Anzahl aus `reel.shots.length`,
  der Zähler im Hero springt also von selbst auf „01 / 04".
- Autoplay-Block: `playSafe()` merkt sich jedes Video und startet es beim ersten
  User-Gesture nach (`armGestureUnlock`).

### 4.3a Codecs — bitte nie wieder HEVC

Der Design-Export lieferte **10 Clips als HEVC** (alle `cine-*` plus `v-crane`).
`video.canPlayType('video/mp4; codecs="hvc1"')` gibt in Chromium `""` zurück —
HEVC im `<video>` hängt am Betriebssystem-Decoder. Auf einem Rechner ohne
HEVC-Erweiterung, unter Linux und in älteren Firefox-Versionen wäre der
Hintergrundfilm — also der halbe Auftritt der Seite — **komplett ausgefallen**
(nur das Posterbild wäre geblieben).

Alle Clips liegen jetzt als **H.264 High, yuv420p, `+faststart`, ohne Tonspur** vor:
- `cine-*` / `v-crane`: 1600×900, CRF 21 (Vollbild-Hintergrund unter Verläufen + Grain)
- `v-*`: 1280×720 (waren schon H.264)
- `m-*`: 828 px breit, CRF 23, ~1–1,3 MB pro Clip

**Regel für neue Clips:** immer H.264 einbetten, nie HEVC/AV1 ohne Fallback.
Prüfen mit `ffprobe -select_streams v:0 -show_entries stream=codec_name`.

Die Hochkant-Clips sind mit Higgsfield (`cinematic_studio_video_v2`, `mode:pro`,
`sound:off`) aus den **eigenen Hochkant-Fotos des Studios** als `start_image`
erzeugt — deshalb zeigen sie denselben Raum und nicht irgendein Stock-Gym.
Ergebnis-Seitenverhältnis ist 3:4 (das Modell folgt dem Startbild), nicht 9:16 —
auf dem Telefon beschneidet `object-fit:cover` damit ~25 % der Breite statt ~68 %
wie beim 16:9-Material. Für die Originale siehe Git-Historie.

### 4.4 Ladevorhang

`[data-loader]` liegt auf `z-index:95` und sperrt `html{overflow:hidden}`.
Er verschwindet über **drei unabhängige Wege**, damit er nie hängen bleibt:
`finish()` (Bilder geladen), `_loaderKill` (6 s), `_lockKill` (5,2 s).
`<noscript>` blendet ihn zusätzlich aus — ohne JS gäbe es sonst eine schwarze Wand.

### 4.5 Navigation

- **Desktop**: `applyResponsive()` **misst** die Nav-Zeile (`rowW()`) und schaltet
  auf Burger um, sobald die Links nicht mehr passen — kein fixer Breakpoint.
  Reihenfolge beim Schrumpfen: Links → Wortmarke → CTA-Pille.
- **Overlay-Menü**: `[data-overlay]`, `setMenu(open)`. Nummerierung 01–05 + **09**
  für Kontakt ist **kein Fehler** — sie spiegelt die Abschnittsnummern auf der Seite
  (Kontakt = „09 — Öffnungszeiten & Anfahrt"). Nicht „korrigieren".
- **Mobile-Dock**: siehe §5.

### 4.6 Weitere Systeme (alle in `site.js`)

| Was | Einstieg | Hook |
|---|---|---|
| Trainingsbereiche (Index → Bühne) | `bootAreas` / `setArea` | `[data-area-row]`, `[data-stage-layer]` |
| Galerie-Kacheln mit Video bei Hover | `bootLive` / `setLive` | `[data-live]`, `data-live-src` |
| Lightbox | `bootLightbox` / `openLb` | `[data-lb]`, `[data-lbox]` |
| Zähler-Animation | `bootCounts` | `[data-count]`, `data-dec`, `data-suffix` |
| Öffnungsstatus live | `bootStatus` | `[data-status-dot]`, `[data-status-text]` |
| Eigener Cursor | `bootCursor` | `[data-cursor]` (nur `pointer:fine`) |
| Magnetische Buttons | `bootMagnet` | `[data-magnet]` |
| Parallax | `syncDom` | `[data-parallax="-26"]` |
| Scroll-Spy | `syncSpy` | `[data-navlink]` |
| FAQ | `bootDelegates` | `[data-faq-head]`, `[data-faq-body]` |

Scroll-Engine: **eine** `requestAnimationFrame`-Schleife (`bootLoop`) + ein
140-ms-Interval als Selbstheilung, falls der rAF je abreißt. `syncDom()` kehrt
sofort zurück, wenn sich weder `scrollTop` noch Breite geändert haben.

### 4.7 Scroll-getriebene CSS-Animationen

Sehr viele Reveals laufen über `animation-timeline: view()` + `animation-range`.
In Browsern ohne Support (Firefox, ältere Safari) wird die Deklaration ignoriert,
die Animation läuft einmal beim Laden und endet wegen `both` im Endzustand —
**Inhalt bleibt also immer sichtbar**, nur die Choreografie fehlt. Das ist gewollt.

Die Kontakt-Karte nutzt `view-timeline-name:--hs-card` + `timeline-scope` an der
Section. Bei schmalen Viewports baut `applyResponsive()` das auf `view()` + `hs-rise` um.

---

## 5. Was ich ergänzt habe (nicht aus dem Design)

Alles einzeln, damit man es rückgängig machen kann.

1. **Mobile-Dock** (`build/mobile.html`, `mobile.js`, CSS-Block in `extra.css`).
   Feste Leiste unten ≤ 819 px: Menü · Anrufen · Route · Mitglied.
   Spiegelt den Header-Burger über `HSK.setMenu()`; `html[data-menu]` synchronisiert
   beide. Versteckt sich im Querformat (≤ 460 px Höhe) und bei offener Tastatur
   (`visualViewport`). `env(safe-area-inset-bottom)` für Geräte mit Home-Indicator.
2. **Menü-Fußzeile** `[data-ov-legal]`: Startseite · Impressum · Datenschutz —
   damit das Mobilmenü auch die Unterseiten erreicht, nicht nur Abschnitte.
3. **Karten-Consent** (`consent.js` + Gate-Markup + CSS). Der Google-Maps-`<iframe>`
   trägt `data-src` statt `src` und lädt erst nach Klick. Grund: sonst geht die
   IP jedes Besuchers ungefragt an Google — für eine deutsche Seite nicht haltbar.
   Entscheidung liegt in `localStorage['hsk.map.consent']`.
   **Zurückdrehen:** `consent.js` + `<script>`-Tag löschen, im Build `data-src` → `src`.
4. **Formular sendet wirklich** (`HSK_FORM_MODE=mailto`). Das Design war eine
   Vorschau und schrieb wörtlich „es wird nichts versendet" — auf einer Live-Seite
   ein Defekt. Jetzt: Absenden baut einen fertigen `mailto:`-Entwurf an
   sb@hsk.fitness und übergibt ihn dem Mailprogramm; das Bestätigungspanel zeigt
   denselben Entwurf zusätzlich als Button plus Telefonnummer, damit ein fehlendes
   Mailprogramm keine Sackgasse ist. `HSK_FORM_MODE=demo` stellt das Original her.
5. **Google Fonts entfernt** — Impressum und Datenschutz zogen sie noch von
   `fonts.googleapis.com`. Jetzt lokale `@font-face` auf dieselben Dateien.
6. **Tastatur-Fokus** (`:focus-visible`), **Skip-Link**, `prefers-reduced-motion`,
   `<noscript>`-Fallback, Druck-Styles.
7. **Save-Data / 2G** (HSK-PATCH 3): kein Videoabruf bei sparsamer Verbindung,
   das Posterbild bleibt stehen.
8. **Favicon, Apple-Touch-Icon, Manifest, robots, sitemap, 404-Seite.**
9. Drei Mobil-Korrekturen (§6, Nr. 5–7).

---

## 6. Fehler, die mir passiert sind — und die Ursache

Damit ich nicht zweimal dieselbe Stunde verliere.

1. **`isBase64` heißt nicht „ist base64"**
   Der Design-RPC (`OmeletteService/GetFile`) liefert `content` als proto-`bytes`,
   also **immer** Base64. Das Feld `isBase64` sagt nur, ob die Datei binär ist, und
   fehlt bei `false` (proto3 lässt Defaults weg). Ich habe deshalb erst nur die
   „binären" Dateien dekodiert — HTML, JS und **`hsk-logo.svg`** blieben Base64-Text.
   → **Regel:** alles dekodieren, danach Magic Bytes prüfen (`FFD8`, `\x89PNG`,
   `ftyp`, `wOF2`, `<svg`). Genau das hat den SVG-Fehler gefunden.

2. **Chrome blockt `fetch` auf localhost von einer https-Seite**
   Local Network Access: der Request hängt einfach, ohne Fehler, bis ins Timeout.
   `Access-Control-Allow-Private-Network` half nicht.
   → Workaround, der funktioniert hat: alle 79 Dateien im Tab zu **einem ZIP**
   (Store-Methode, selbst geschriebener Writer) zusammenbauen und per
   `<a download>` speichern. Ein Download statt 79 → kein Multi-Download-Prompt.
   Chrome legte die Datei auf dem **Desktop** ab, nicht in `Downloads`.

3. **Statischer Server gab 403 auf Windows**
   `path.join()` liefert Backslashes, `ROOT` war mit Slashes geschrieben →
   `f.startsWith(ROOT)` immer falsch. → Beide Seiten durch `path.resolve()`.

4. **Der Browser-Pane liefert schwarze Screenshots**
   Ab Scroll > ~900 px kam nur noch Schwarz, während das DOM nachweislich korrekt
   war (`opacity:1`, richtige Rects, kein Overlay). Ich habe eine Weile einen
   Rendering-Bug gejagt, den es nicht gab — es ist ein **Capture-Artefakt** des
   Panes (fixed Video + `backdrop-filter`).
   → **Für visuelle Prüfung immer Playwright nehmen**, nicht den Pane.

5. **Mobil: Hero-Zeile lag unter dem Dock**
   „SCROLL / ABSTIEG 01/10" sitzt auf `bottom:clamp(24px,3.6vh,40px)` — genau dort,
   wo jetzt das Dock ist. → `[data-hero-block]` / `[data-hero-meta]` getaggt und
   ≤ 819 px um 66 px + Safe-Area angehoben.

6. **Mobil: der Puls-Punkt stand allein in einer Zeile**
   Die Hero-Eyebrow ist eine Flex-Zeile `[Punkt][Text]`. Unter ~560 px ist der Text
   als *ganzes* Flex-Item zu breit und umbricht komplett — der Punkt bleibt allein
   oben stehen. `flex-wrap:wrap` machte es nicht besser, nur ordentlicher.
   → Unter 560 px auf `display:block` + Punkt als `inline-block`. Dann fließt der
   Punkt mit dem ersten Wort und der Text bricht normal um.

7. **Consent-Gate überdeckte auf Desktop die Adresskarte** ← der ernsteste
   `[data-map-wrap]` ist `position:absolute` **ohne** `z-index` → **kein**
   Stacking-Context. Seine Kinder konkurrieren also direkt mit der Karte
   `[data-two]` (z-index auto = 0). Mein Gate mit `z-index:3` malte sich über die
   komplette Adresskarte; die Kontaktdaten waren auf Desktop unsichtbar.
   → `[data-map-wrap]{isolation:isolate}`. Sperrt die Karten-Layer in sich ein,
   DOM-Reihenfolge entscheidet wieder. Das Gate braucht `z-index:3`, weil der
   animierte Pin auf `2` liegt und sonst über der Consent-Schrift schwebt.
   **Merke:** in dieser Datei ist fast nichts `position:relative` mit z-index —
   jedes neue `z-index` gegenprüfen, auf Desktop *und* mobil.

8. **Higgsfield gab 10-MB-Clips zurück**
   5 Sekunden bei 17,7 Mbit/s. Als Handy-Hintergrund absurd — hätte den ganzen
   Zweck („weniger Bytes auf dem Telefon") ins Gegenteil verkehrt.
   → `ffmpeg` liegt unter
   `~/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_*/…/bin/`.
   Auf 828 px Breite, CRF 23 → ~1,1 MB. **Immer nachkomprimieren.**

9. **Higgsfield schlug ein Preset vor, statt zu generieren**
   `generate_video_batch` gab bei 3 von 4 Anfragen `submission_failed` mit
   `preset_recommendation` zurück. → mit `declined_preset_id: <id>` erneut senden.
   Presets abgelehnt, weil sie einen generischen Look drübergelegt hätten statt
   den bestehenden Studio-Aufnahmen zu folgen.

10. **`applyResponsive` fegt alle direkten Kinder von `[data-map-wrap]` weg**
   `':scope > div:not([data-map-pin])'` → mein Gate wäre mobil `display:none`
   gewesen (Karte dann komplett leer, weil das iframe ja kein `src` hat).
   → HSK-PATCH 4 ergänzt `:not([data-map-gate])`.

---

## 7. Offene Punkte / bewusst nicht gemacht

- **Impressum enthält Platzhalter** in eckigen Klammern (Rechtsform, USt-IdNr.,
  Registergericht). Vor dem echten Livegang **muss** der Kunde die füllen —
  in Deutschland sonst abmahnfähig. Steht als Hinweis-Box auch auf der Seite.
- **Bilder sind teils KI-generierte Musterbilder** („Musterbild"-Badges bei
  Coach-Porträt und Empfang). Der Datenschutz-Text weist darauf hin. Echte Fotos
  ersetzen dieselben Dateinamen 1:1.
- **Formular ohne Backend.** `mailto` ist die ehrliche Lösung für eine statische
  Seite. Wenn echtes Server-Versenden gewünscht ist: Endpoint in `site.js` im
  Submit-Handler ergänzen — dann aber Auftragsverarbeitungsvertrag + Hinweis in
  der Datenschutzerklärung.
- **`.thumbnail`** aus dem Design-Export ist nicht mitgenommen (nur Host-intern).
- Kein Cookie-Banner: die Seite setzt **keine** Cookies. `localStorage` speichert
  nur die Karten-Entscheidung — das ist technisch notwendig für die Funktion,
  die der Nutzer selbst ausgelöst hat, und braucht keine Einwilligung.

---

## 8. Prüf-Routine vor jedem Push

```bash
cd build && HSK_CANONICAL="…" node build.js     # muss "OK" sagen
cd .. && node --check assets/js/site.js
grep -c 'HSK-PATCH' assets/js/site.js            # muss 5 sein
grep -oE 'https?://[^"]+' index.html | sort -u   # nichts darf ungefragt laden
```

Dann lokal servieren und mit **Playwright** (nicht dem Browser-Pane) ansehen:
390×844 und 1440×900, Hero / Training / Galerie / Kontakt / Formular / Menü.
