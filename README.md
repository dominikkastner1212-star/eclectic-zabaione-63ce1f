# Eurojackpot Circle

Statische Netlify-App fuer eine gemeinsame Eurojackpot-Runde.

## Was bereits vorbereitet ist

- Static App mit Netlify Functions.
- Automatische Eurojackpot-Daten ueber `netlify/functions/eurojackpot.js`.
- Geteilte Speicherung fuer Benutzer, Tipps und Zahlungen ueber `netlify/functions/state.js`.
- Lokaler Fallback per `localStorage`, falls die Function lokal nicht erreichbar ist.

## Deploy auf Netlify

1. Netlify CLI installieren: `npm install -g netlify-cli`
2. Einloggen: `netlify login`
3. Dependencies installieren: `npm install`
4. Projekt verknuepfen: `netlify link`
5. Deploy: `netlify deploy --prod`

Die Netlify Function liegt unter `netlify/functions/eurojackpot.js`.

## User-Verwaltung produktiv machen

Netlify Identity ist laut Netlify-Doku fuer kreditbasierte Plaene verfuegbar und unterstuetzt:

- E-Mail/Passwort Login
- Invite-only Benutzer
- Rollenbasierte Rechte
- serverseitige User-Pruefung in Netlify Functions
- Admin-Operationen fuer Benutzer

Nach dem ersten Deploy:

1. In Netlify das Projekt oeffnen.
2. `Project configuration > Identity` aktivieren.
3. Registrierung auf `Invite only` setzen.
4. Kollegen einladen.
5. Danach ist die App nur noch fuer eingeloggte Nutzer nutzbar.

Die `state` Function lehnt Requests ohne gueltigen Identity-Login mit `401` ab.

## Rollen

In Netlify Identity sollte mindestens ein Benutzer die Rolle `admin` bekommen.

- `admin`: darf Benutzer, Zahlungsstatus und alle Tipps verwalten.
- ohne `admin`: darf die App sehen und nur den eigenen Tipp speichern.

Rollen werden in Netlify unter `Identity > Users > Benutzer > Roles` gepflegt.

## Wichtige Dateien

- `index.html`: App-Struktur.
- `styles.css`: visuelles System.
- `app.js`: Frontend-Logik, lokaler Fallback und Netlify-Sync.
- `netlify/functions/state.js`: geteilte zentrale Daten.
- `netlify/functions/eurojackpot.js`: Jackpot/Gewinnzahlen.
