# 🥒 Gurken Sekte

Eine satirische Parodie-Website über eine fiktive Gurken-Sekte. Mitglieder können tägliche Punkte sammeln, mit „Gürkchen“ (KI) chatten und am Ende eine echte Gurke einlösen.

> **Wichtig:** Diese Website ist eine satirische Parodie und keine echte Sekte.

## Features

- **Landing Page** – Kult-Startseite mit Zitaten von „Gürkchen“
- **Spenden** – Spenden-System via Tippie (PayPal, Karte, Apple Pay, Klarna)
- **Mitgliederbereich** – Authentifizierter Dashboard mit:
  - Punktesystem („Gurkensegen“)
  - Täglicher Bonus (+20 Punkte)
  - KI-Zitate generieren (+5 Punkte)
  - Chat mit „Gürkchen“ (Streaming-KI, +3 Punkte pro Nachricht)
  - 300 Punkte gegen eine echte Gurke eintauschen (ntfy-Benachrichtigung)
  - Punkte-Historie

## Tech-Stack

| Technologie | Zweck |
|-------------|-------|
| **Next.js 16** (App Router) | Framework |
| **TypeScript** | Sprache |
| **Tailwind CSS v4** | Styling |
| **Hexclave** | Authentifizierung |
| **OpenRouter** | KI-Chat & Zitate (mit API-Key-Fallback) |
| **Tippie** | Zahlungs-Links |
| **ntfy.sh** | Benachrichtigungen |
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

### Entwicklungsserver starten

```bash
pnpm dev
# oder mit Hexclave-Proxy:
pnpm dev:hexclave
```

### Build

```bash
pnpm build
pnpm start
```

### Linting

```bash
pnpm lint
```

## Deployment

Die Seite läuft auf [Vercel](https://vercel.com).

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en)
