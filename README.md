# 🥒 Gurken Sekte

Eine satirische Parodie-Website über eine fiktive Gurken-Sekte. Mitglieder können tägliche Punkte sammeln, mit „Gürkchen“ (KI) chatten und am Ende eine echte Gurke einlösen.

> **Wichtig:** Diese Website ist eine satirische Parodie und keine echte Sekte.

## Features

- **Landing Page** – Kult-Startseite mit Zitaten von „Gürkchen“
- **Spenden** – Spenden via Mangoe Payments (eingebetteter Checkout, `amountCents` frei wählbar)
- **Mitgliederbereich** – Authentifizierter Dashboard mit:
  - Punktesystem („Gurkensegen“)
  - Täglicher Bonus (+20 Punkte)
  - Bis zu 3 KI-Zitate pro Tag generieren (+5 Punkte je Zitat)
  - Chat mit „Gürkchen“ (Streaming-KI, +3 Punkte pro Nachricht, Turnstile-geschützt)
  - 1000 Punkte gegen eine echte Gurke eintauschen (Pflicht-Lieferadresse, Bestell-E-Mail via Hexclave)
  - Punkte-Historie

## Tech-Stack

| Technologie | Zweck |
|-------------|-------|
| **Next.js 16** (App Router) | Framework |
| **Cloudflare Workers** | Hosting (via `@opennextjs/cloudflare`) |
| **TypeScript** | Sprache |
| **Tailwind CSS v4** | Styling |
| **Hexclave** | Authentifizierung & E-Mails |
| **OpenRouter** | KI-Chat & Zitate (mit API-Key-Fallback) |
| **Mangoe Payments** | Spenden-Checkout (Session-API + Iframe-Einbettung) |
| **Phosphor Icons** | Icons |
| **pnpm** | Package Manager |

## Entwicklung

### Voraussetzungen

- Node.js
- pnpm

### Setup

```bash
pnpm install
```

### Umgebungsvariablen

Kopiere `.env.local.example` nach `.env.local` und fülle die Werte aus:

```bash
cp .env.local.example .env.local
```

Benötigte Keys:
- **Hexclave** – für den Mitgliederbereich
- **OpenRouter API Key(s)** – für KI-Chat & Zitate (mehrere Keys mit `OPENROUTER_API_KEY_2`, `_3`, … für Fallback)
- **Cloudflare Turnstile Site Key** – `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Frontend)
- **Cloudflare Turnstile Secret Key** – `TURNSTILE_SECRET_KEY` (Backend)

### Entwicklungsserver starten

```bash
pnpm dev
# oder mit Hexclave-Proxy:
pnpm dev:hexclave
```

### Build

```bash
pnpm build          # reiner Next.js-Build (Node)
pnpm build && pnpm start
```

### Linting

```bash
pnpm lint
```

## Deployment

Die Seite läuft auf **Cloudflare Workers** über
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

### Einmalig einrichten

```bash
npx wrangler login      # Cloudflare-Account verknüpfen
```

### Deployen

```bash
pnpm preview            # Build + echter Workers-Runtime lokal (workerd) testen
pnpm deploy             # Build + Deploy nach Cloudflare
pnpm upload             # nur eine neue Version hochladen (ohne Traffic-Umstellung)
```

`pnpm deploy` baut die App und lädt sie hoch. Die Konfiguration liegt in
`wrangler.jsonc` (Worker-Name, Bindings) und `open-next.config.ts` (Caching).

#### Cloudflare Workers Builds (Git-Deploy)

Im Dashboard unter Workers → `gurkensekte` → Settings → Build:

| Feld | Wert |
| --- | --- |
| Build command | `pnpm exec opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |

Der Build-Schritt ist Pflicht: `wrangler.jsonc` verweist auf
`.open-next/worker.js`, das erst durch `opennextjs-cloudflare build` entsteht.
Zusätzlich müssen die Build-Variablen aus `.env.local.example` hinterlegt sein
(mindestens `HEXCLAVE_PROJECT_ID` und `NEXT_PUBLIC_HEXCLAVE_PROJECT_ID`,
sonst bricht der Build ab, sowie alle `NEXT_PUBLIC_*`-Werte).

### Umgebungsvariablen in Production

`.env.local` gilt **nur lokal**. Auf dem Worker werden die Variablen im
Cloudflare-Dashboard (Workers → gurkensekte → Settings → Variables and Secrets)
oder per CLI gesetzt:

```bash
npx wrangler secret put HEXCLAVE_SECRET_SERVER_KEY
npx wrangler secret put SAIL_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
npx wrangler secret put MANGOE_API_KEY
npx wrangler secret put RESEND_API_KEY
# … usw. – alle Werte aus .env.local.example
```

Drei Besonderheiten:

- `NEXT_PUBLIC_*`-Werte (z. B. `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) werden beim
  **Build** in den Code eingebettet. Sie müssen also zur Build-Zeit gesetzt
  sein – lokal über `.env.local`, bei Cloudflare Workers Builds über
  „Build variables and secrets“.
- `HEXCLAVE_PROJECT_ID` (und `NEXT_PUBLIC_HEXCLAVE_PROJECT_ID`) werden
  ebenfalls schon beim Build gebraucht: Der SDK-Client wird beim Laden der
  Module instanziiert und Next sammelt beim Build Seitendaten ein. Ohne die
  Variablen bricht `pnpm build` ab – lokal also `pnpm dev:hexclave` nutzen
  oder eine `.env.local` anlegen.
- `opennextjs-cloudflare build` bettet die lokalen `.env*`-Dateien als
  Fallback in den Worker ein (`process.env[key] ??= …`, Worker-Variablen
  gewinnen). Committe daher niemals echte Secrets in eine `.env.production`.

### Eigene Domain

Im Dashboard unter Workers → gurkensekte → Settings → Domains & Routes die
Domain `gurkensekte.de` hinzufügen (Zone muss im Cloudflare-Account liegen).
Alternativ als `routes`-Eintrag in `wrangler.jsonc`.

### Wichtige Grenzen

- Worker-Bundle-Limit: 3 MiB gzip (Free) / 10 MiB (Paid) – aktuell ~2,7 MiB.
- CPU-Limit pro Request: **10 ms im Free-Plan**, 30 s im Paid-Plan. Für
  Next.js-SSR ist der Free-Plan knapp – für den Produktivbetrieb ist der
  Paid-Plan (5 $/Monat) empfehlenswert.
- Kein Dateisystem: Schreibzugriffe nur über Bindings (D1/KV/R2).
- ISR/`revalidatePath` wird mit der aktuellen Cache-Konfiguration nicht
  unterstützt; siehe Kommentare in `open-next.config.ts`.

### Nach dem ersten Deploy prüfen

Diese Pfade hängen von Diensten ab, die lokal nicht vollständig testbar sind:

- **Login-Flow**: `/mitglieder/login` → Google/OAuth bzw. E-Mail-Code →
  zurück auf `/mitglieder` (Cookie-Handling des Hexclave-SDK im Worker).
- **Gürkchen-Chat**: Streaming-Antwort in `api/guerkchen` (KI-Anbieter
  erreichen, `SAIL_API_KEY`/`OPENROUTER_API_KEY` gesetzt).
- **Turnstile**: Captcha wird auf `/` und im Casino/Roulette akzeptiert
  (`TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
- **Spenden**: Mangoe-Checkout startet und `successUrl` zeigt auf `SITE_URL`.
- **GurkenMail**: Adressvergabe (braucht Upstash, sonst 503) und Empfang
  über `GURKENMAIL_INBOUND_URL`.

## Lizenz

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en)
