# AGENTS.md

Next.js 16 (App Router) + TypeScript + Tailwind v4. Package manager is **pnpm** (`package-lock.json` is stale — ignore it). No tests, no CI workflows, no typecheck script.

## Commands

```bash
pnpm install
pnpm dev                  # plain dev; Turnstile/Upstash missing = dev fallbacks active
pnpm dev:hexclave         # dev with Hexclave auth proxy (needed for /mitglieder)
pnpm build && pnpm start  # only real verification (no tests)
pnpm lint                 # eslint (next core-web-vitals + typescript)
```

`workers/gurkenmail-inbound` is a separate package (own `package.json`, excluded from root `tsconfig.json`):
```bash
cd workers/gurkenmail-inbound && npm run db:migrate && npm run deploy  # wrangler + D1
```

## Env (`.env.local.example` is source of truth)

- Missing `TURNSTILE_SECRET_KEY` = bypass in dev, **fail-closed (reject) in production** (`src/lib/turnstile.ts`).
- `SITE_URL` is the canonical origin for email links and Mangoe `successUrl`/`cancelUrl`. Never build these from the request host (host-header poisoning).
- Upstash Redis envs have aliases — read via the mapping in `src/lib/ratelimit.ts` (`UPSTASH_REDIS_REST_*`, `*_KV_REST_API_*`, `KV_REST_API_*`). Local dev without them uses in-memory fallback (per-instance only).
- Mangoe/GurkenMail secrets (`MANGOE_API_KEY`, `GURKENMAIL_INBOUND_SECRET`, `RESEND_API_KEY`) are server-only — never import `src/lib/mangoe.ts` secrets into client code.

## Architecture

- `src/app/` — routes. Real areas: `/mitglieder` (auth dashboard), `/spenden`, `/demo/**` (auth-free mirrors for previews), `/handler/[...stack]` (Hexclave auth handler, must stay). API: `api/guerkchen` (chat+quote), `api/mitglieder/punkte` (+`casino`, `roulette`, `leaderboard`, `duell`, `referral`), `api/spenden` (`checkout`, `status`, `webhook`), `api/gurkenmail`.
- `src/lib/` — `punkte.ts` (booking), `ratelimit.ts` (limits + distributed lock), `turnstile.ts` (captcha), `mangoe.ts` (browser SDK types only), `gurkenmailServer.ts` (worker calls, fail-open).
- `src/hexclave/client.ts|server.ts` — auth config. Login/signup URLs are `/mitglieder/login|signup`; server user fetch pattern is `hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" })`.
- `workers/gurkenmail-inbound` — Cloudflare Worker (D1) receiving mail; Next.js talks to it via `GURKENMAIL_INBOUND_URL/SECRET` (`/sync-mailbox`, `/sent`).
- Path alias `@/*` → `./src/*`. Security headers live in `next.config.ts`. Tailwind v4 via `@tailwindcss/postcss`.

## Gotchas agents get wrong

- **Points booking**: state lives in Hexclave `clientReadOnlyMetadata`. Always use `mitFrischemBenutzer()` (`src/lib/punkte.ts`) — pre-checks on stale metadata, then lock + re-read + write. Raw `getUser` + `setClientReadOnlyMetadata` without the lock causes double-spend. Reads must use `lesePunkte`/`lesePunkteGesamt`/`leseVerlauf` guards (metadata can hold corrupt non-numbers). Lock contention surfaces as `SperreBelegtFehler` → answer 409, never retry silently. Constants: `PUNKTE_CHAT/PUNKTE_ZITAT = 5`, `ZITAT_MAX_PRO_TAG = 3`.
- **Turnstile**: `pruefeTurnstile(req, { token, userId, frischesToken })`. Chat, casino, roulette require `frischesToken: true` — tokens are single-use, one solution must never cover 30 min of farming and a token must never be verified at two routes. Logged-in users key on `user:<id>` only, never IP fallback (NAT/spoofing).
- **Rate limits**: `rateLimit(key, limit, windowMs, { failClosed: true })` for LLM-cost routes (chat/quote); fail-open default elsewhere. GurkenMail address allocation **requires Upstash in production** (global `SET NX`) — without it the route returns 503 by design.
- **Mangoe donations**: embed via `window.MangoePay.embed(...)`, success arrives as `postMessage { type: "mangoe:payment.succeeded" }`. For integration details load the `mangoe-setup` skill; for auth/mail the `hexclave` skill; for captcha the `turnstile-spin` skill.
