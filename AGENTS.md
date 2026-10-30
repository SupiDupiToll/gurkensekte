# AGENTS.md

Next.js 16 (App Router) + TypeScript + Tailwind v4. Package manager is **pnpm** (`package-lock.json` is stale — ignore it). No tests, no CI workflows, no typecheck script.

## Commands

```bash
pnpm install
pnpm dev                  # plain dev; Cap/Turnstile/Upstash missing = dev fallbacks active
pnpm dev:hexclave         # dev with Hexclave auth proxy (needed for /mitglieder)
pnpm build && pnpm start  # plain Next build (Node) — fastest sanity check
pnpm preview              # OpenNext build + real Workers runtime locally (workerd)
pnpm deploy               # OpenNext build + deploy to Cloudflare Workers
pnpm lint                 # eslint (next core-web-vitals + typescript)
```

Deployment target is **Cloudflare Workers** via `@opennextjs/cloudflare` (see `wrangler.jsonc`, `open-next.config.ts`). `pnpm preview` is the only check that exercises the real runtime — Node-only APIs that work under `pnpm build` can still fail in workerd.

`workers/gurkenmail-inbound` is a separate package (own `package.json`, excluded from root `tsconfig.json`):
```bash
cd workers/gurkenmail-inbound && npm run db:migrate && npm run deploy  # wrangler + D1
```

## Env (`.env.local.example` is source of truth)

- **Cap is primary**, Turnstile is the fallback (`src/lib/captcha.ts`). Cap needs `NEXT_PUBLIC_CAP_SITE_KEY` + `CAP_SECRET_KEY` (server) and optionally `CAP_SITE_KEY`; without a site key Cap stays off and Turnstile handles everything. Missing both secrets = bypass in dev, **fail-closed (reject) in production**. If Cap is set but unreachable/5xx, a supplied Turnstile token is verified instead.
- `SITE_URL` is the canonical origin for email links and Mangoe `successUrl`/`cancelUrl`. Never build these from the request host (host-header poisoning).
- Upstash Redis envs have aliases — read via the mapping in `src/lib/ratelimit.ts` (`UPSTASH_REDIS_REST_*`, `*_KV_REST_API_*`, `KV_REST_API_*`). Local dev without them uses in-memory fallback (per-instance only).
- Mangoe/GurkenMail secrets (`MANGOE_API_KEY`, `GURKENMAIL_INBOUND_SECRET`, `RESEND_API_KEY`) are server-only — never import `src/lib/mangoe.ts` secrets into client code.
- On Workers, runtime vars/secrets live in the Worker, not in `.env.local`. **Non-secret** runtime vars belong in the `vars` block of `wrangler.jsonc` (deploy overwrites the Worker config; dashboard-only plaintext vars are deleted). Secrets via `npx wrangler secret put <NAME>` survive deploys. `--keep-vars` does **not** work through the OpenNext delegation. `NEXT_PUBLIC_*` values are inlined at **build** time, so they must be present when `pnpm deploy` runs (locally via `.env*`, in Workers Builds via build variables) — a dashboard runtime var does nothing for the client bundle.
- The SDK client is constructed at module scope, so `HEXCLAVE_PROJECT_ID` is needed at **build** time; Next collects page data during the build. The public values (project IDs, `NEXT_PUBLIC_*`) live in the **committed** `.env.production` so a fresh clone/Workers Build works without dashboard build vars. `src/hexclave/server.ts` passes a placeholder `secretServerKey` only while `NEXT_PHASE === "phase-production-build"` — the real `HEXCLAVE_SECRET_SERVER_KEY` stays a runtime Worker secret and is still required there (missing = SDK error at first auth call). Never put secrets in `.env.production`.
- `opennextjs-cloudflare build` bakes **all** local `.env*` files (incl. `.env.local`, every mode) into `.open-next/cloudflare/next-env.mjs` → uploaded verbatim on a local `pnpm deploy`/`pnpm upload`. Workers Builds (fresh clone) therefore bakes the committed public `.env.production`; dashboard build vars stay `process.env`-only and win at runtime via `??=`. Never put real secrets in any `.env*` file.
- Local-only vars for `pnpm preview` go into `.dev.vars` (committed, contains only `NEXTJS_ENV`); `.env*` files are not loaded by `wrangler dev`.

## Architecture

- `src/app/` — routes. Real areas: `/mitglieder` (auth dashboard), `/spenden`, `/demo/**` (auth-free mirrors for previews), `/handler/[...stack]` (Hexclave auth handler, must stay). API: `api/guerkchen` (chat+quote), `api/mitglieder/punkte` (+`casino`, `roulette`, `leaderboard`, `duell`, `referral`), `api/spenden` (`checkout`, `status`, `webhook`), `api/gurkenmail`.
- `src/lib/` — `punkte.ts` (booking), `ratelimit.ts` (limits + distributed lock), `captcha.ts` (Cap + Turnstile fallback, server-only), `captchaClient.ts` (client token/provider types), `mangoe.ts` (browser SDK types only), `gurkenmailServer.ts` (worker calls, fail-open).
- `src/components/CaptchaWidget.tsx` — visible Cap widget with automatic Turnstile fallback (script error, widget `error` event, 10 s watchdog, manual switch). `TurnstileWidget.tsx` is only the fallback renderer.
- `src/hexclave/client.ts|server.ts` — auth config. Login/signup URLs are `/mitglieder/login|signup`; server user fetch pattern is `hexclaveServerApp.getUser({ tokenStore: req, or: "return-null" })`.
- `workers/gurkenmail-inbound` — Cloudflare Worker (D1) receiving mail; Next.js talks to it via `GURKENMAIL_INBOUND_URL/SECRET` (`/sync-mailbox`, `/sent`).
- Path alias `@/*` → `./src/*`. Security headers live in `next.config.ts` **and** `public/_headers` (static assets bypass the Worker, so both must stay in sync). Tailwind v4 via `@tailwindcss/postcss`.
- Cloudflare wiring: `wrangler.jsonc` (worker name, `nodejs_compat`, assets binding, self-reference service binding), `open-next.config.ts` (incremental cache), `public/_headers`, `.dev.vars` (`NEXTJS_ENV`). `next.config.ts` calls `initOpenNextCloudflareForDev()`.
- No ISR / `revalidatePath` / `revalidateTag` is used, so `open-next.config.ts` uses the read-only static-assets incremental cache. Adding revalidation requires switching to R2 + DO queue (instructions in that file) — otherwise revalidated pages silently keep serving stale build output.
- Worker runtime is workerd: no filesystem, no `process.cwd()` assets, 3 MiB (free) / 10 MiB (paid) compressed bundle limit. Prefer `globalThis.crypto` over `node:crypto` in new code; `node:crypto`/`Buffer` work via `nodejs_compat` (used by the Mangoe webhook HMAC).

## Gotchas agents get wrong

- **Points booking**: state lives in Hexclave `clientReadOnlyMetadata`. Always use `mitFrischemBenutzer()` (`src/lib/punkte.ts`) — pre-checks on stale metadata, then lock + re-read + write. Raw `getUser` + `setClientReadOnlyMetadata` without the lock causes double-spend. Reads must use `lesePunkte`/`lesePunkteGesamt`/`leseVerlauf` guards (metadata can hold corrupt non-numbers). Lock contention surfaces as `SperreBelegtFehler` → answer 409, never retry silently. Constants: `PUNKTE_CHAT/PUNKTE_ZITAT = 5`, `ZITAT_MAX_PRO_TAG = 3`, `PUNKTE_GURKENMAIL_SENDEN = 10` / `PUNKTE_GURKENMAIL_EMPFANGEN = 5` / `PUNKTE_GURKENMAIL_MAX_PRO_STUNDE = 10` (hourly rolling window; receive strictly whole units via `gurkenmailEmpfangsBonus` = max. 2 paid mails/hour, all seen IDs marked via `gurkenmailPunkteMailIds`). GurkenMail send/receive bookings share the `gurkenmail:<userId>` lock (not `punkte:<userId>`) so quota + points write atomically.
- **GurkenMail inbox**: worker `/inbox` supports `since` (ISO) for incremental refresh and always returns `ungelesen`; worker `/unread` is the lightweight counter for the dashboard badge. New Next route: `api/gurkenmail/unread`. No push/PWA notifications (removed on request).
- **Captcha**: `pruefeCaptcha(req, { capToken, turnstileToken, userId, frischesToken })`. Verify Cap via `POST <CAP_SERVER_URL>/<siteKey>/siteverify` with `{ secret, response }`; only fall back to Turnstile when Cap is missing/unreachable or the client sent a Turnstile token. Chat, casino, roulette require `frischesToken: true` — tokens are single-use, one solution must never cover 30 min of farming and a token must never be verified at two routes. Logged-in users key on `user:<id>` only, never IP fallback (NAT/spoofing). Responses still carry `requiresTurnstile: true` (legacy field) so the frontend re-shows the widget.
- **Rate limits**: `rateLimit(key, limit, windowMs, { failClosed: true })` for LLM-cost routes (chat/quote); fail-open default elsewhere. GurkenMail address allocation **requires Upstash in production** (global `SET NX`) — without it the route returns 503 by design.
- **Mangoe donations**: embed via `window.MangoePay.embed(...)`, success arrives as `postMessage { type: "mangoe:payment.succeeded" }`. For integration details load the `mangoe-setup` skill; for auth/mail the `hexclave` skill; for the Turnstile fallback the `turnstile-spin` skill. Cap widget/server docs: <https://capjs.js.org/guide/standalone/>.
- **pnpm-Version**: `"packageManager": "pnpm@12.14.0"` in `package.json` pinnt pnpm für Workers Builds — ohne Pin nutzt der Build eine alte pnpm-Version (9.x) und bricht mit `ERROR packages field missing or empty` ab, weil `pnpm-workspace.yaml` kein `packages`-Feld hat (ab pnpm 10 optional). Deshalb enthält `pnpm-lock.yaml` ein zweites Lockfile-Dokument (`packageManagerDependencies`) — pnpm ≤ 9 kann die Datei nicht mehr lesen (`ERR_PNPM_BROKEN_LOCKFILE`). Version nie ändern, ohne den Lockfile mit `pnpm install` neu zu schreiben. Kein `devEngines.packageManager` ergänzen: npm 10.9 (Deploy via `npx wrangler deploy`) kennt das Feld nicht und bricht mit `EBADDEVENGINES` ab.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
