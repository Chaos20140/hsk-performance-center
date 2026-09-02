# HSK Performance Center

Website für das **HSK Performance Center**, Strackestraße 22, 59929 Brilon.
Statische Seite, keine Datenbank, kein Server, keine externen Tracker.

**Live:** https://chaos20140.github.io/hsk-performance-center/

---

## Aufbau

Der Deploy läuft über GitHub Actions (`.github/workflows/pages.yml`). Der Workflow
veröffentlicht alles außer `build/`, `src/` und den internen Notizen.

| Pfad | Inhalt |
|---|---|
| `index.html` | Startseite |
| `impressum.html`, `datenschutz.html` | Rechtliches |
| `404.html` | Fehlerseite |
| `assets/` | Bilder, Videos, Schriften, Icons, JavaScript |
| `build/` | Build-Skript und Zusatz-Layer (nicht veröffentlicht) |
| `src/` | Die Design-Originale, aus denen gebaut wird (nicht veröffentlicht) |

`index.html`, `impressum.html`, `datenschutz.html` und `assets/js/site.js` sind
**generiert**. Nicht direkt bearbeiten — Änderungen in `build/` bzw. `src/` machen
und neu bauen.

## Bauen

Nur Node, keine Abhängigkeiten:

```bash
cd build
HSK_CANONICAL="https://chaos20140.github.io/hsk-performance-center/" node build.js
```

Bei eigener Domain einfach `HSK_CANONICAL` auf die Zieladresse setzen und neu bauen.

## Inhalte ändern

| Was | Wo |
|---|---|
| Texte, Abschnitte, Bilder | `src/HSK Performance Center.dc.html`, danach bauen |
| Fotos austauschen | Datei in `assets/` unter **gleichem Namen** ersetzen |
| Akzentfarbe | `data-props` im `src/`-File (`accent`, Standard `#E10600`) |
| Mobile-Leiste unten | `build/mobile.html` + `build/extra.css` |
| Kontaktformular-Verhalten | `HSK_FORM_MODE=mailto` (Standard) oder `demo` |

## Vor dem echten Livegang

1. **Impressum vervollständigen** — die Felder in eckigen Klammern
   (Rechtsform, USt-IdNr., Registergericht) müssen gefüllt oder gestrichen werden.
2. **Musterbilder ersetzen** — Coach-Porträt und Empfang sind als „Musterbild"
   gekennzeichnet.
3. **Datenschutzerklärung prüfen** lassen, sobald die echte Domain steht.

## Datenschutz

- Keine Cookies, kein Analytics, keine Web-Fonts von Dritten.
- Die Google-Maps-Karte lädt **erst nach ausdrücklichem Klick**; vorher geht keine
  Anfrage an Google. Die Entscheidung liegt lokal im Browser des Besuchers.
- Das Kontaktformular speichert nichts: es öffnet einen fertigen E-Mail-Entwurf
  im Mailprogramm des Besuchers.
