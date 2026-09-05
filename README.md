# HSK Performance Center

Website für das **HSK Performance Center**, Strackestraße 22, 59929 Brilon.
Statische Seite, keine Datenbank, kein Server, keine externen Tracker.

**Live:** https://chaos20140.github.io/hsk-performance-center/

---

## Seiten

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite (Hero-Film, Haltung, Trainingsbereiche, Ausstattung, Preise, Partner, FAQ, Standort) |
| `coaching.html` | Personal Training, Steve Brenke, Ablauf |
| `galerie.html` | Fotos und Clips aus der Halle |
| `termine.html` | Termine, Beratungszeiten |
| `preise.html` | Preismodelle und Details |
| `mitglied-werden.html` | Anfrage-Formular (Probetraining, Mitgliedschaft, Coaching, Partner) |
| `impressum.html`, `datenschutz.html` | Rechtliches |
| `404.html` | Fehlerseite |

Alle HTML-Dateien, `assets/js/site.js`, `robots.txt`, `sitemap.xml` und
`site.webmanifest` sind **generiert**. Nicht direkt bearbeiten — Änderungen in
`build/` bzw. `src/` machen und neu bauen.

## Bauen

Nur Node, keine Abhängigkeiten:

```bash
cd build
HSK_CANONICAL="https://chaos20140.github.io/hsk-performance-center/" node build.js
```

Bei eigener Domain `HSK_CANONICAL` auf die Zieladresse setzen und neu bauen.
Der Deploy läuft über GitHub Actions (`.github/workflows/pages.yml`) und
veröffentlicht alles außer `build/`, `src/` und den internen Notizen.

## Inhalte ändern

| Was | Wo |
|---|---|
| Startseite (Texte, Abschnitte, Bilder) | `src/HSK Performance Center.dc.html` (Claude-Design-Original), danach bauen |
| Unterseiten | `build/pages/*.html` |
| Termine | `build/events.json` — ein Eintrag pro Termin |
| Fotos/Clips austauschen | Datei in `assets/` unter **gleichem Namen** ersetzen (Videos: H.264, ohne Ton) |
| Untere Leiste auf dem Telefon | `build/build.js`, `page()` → `mbar` |
| Formular-Verhalten | `HSK_FORM_MODE=mailto` (Standard) oder `demo` |

## Datenschutz

- Keine Cookies, kein Analytics, keine Web-Fonts von Dritten (Schriften liegen im Repo).
- Die Google-Maps-Karte lädt **erst nach ausdrücklichem Klick**; vorher geht keine
  Anfrage an Google. Die Entscheidung liegt lokal im Browser des Besuchers.
- Das Formular speichert nichts: es öffnet einen fertigen E-Mail-Entwurf im
  Mailprogramm des Besuchers.
