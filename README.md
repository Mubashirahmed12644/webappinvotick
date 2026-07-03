# Invotick Webapp

Web version of the Invotick invoicing app (Next.js 16 + React 19 + TypeScript + Tailwind v4).
It consumes the **existing** Invotick backend (`v1` auth + per-user REST, `v2` sync) — it does not add a new backend. The theme, invoice math, and rendering mirror the mobile app so both feel identical.

## Setup (e.g. on MacBook)

```bash
git clone <this-repo-url>
cd invotick-webapp
npm install
cp .env.local.example .env.local   # then review values
npm run dev                          # http://localhost:3000
```

Log in with the approved test account (see `TEST_MODE` / `ALLOWED_EMAILS` in `.env.local`).

## Scripts
- `npm run dev` — dev server
- `npm run build` — production build (type-check + lint)
- `npm start` — run the production build

## Key docs
- `docs/MOBILE-APP-REQUIREMENTS.md` — what the mobile app must push/implement for full web parity (living list).
- `docs/SERVER-SIDE-CHANGES.md` — proposed/actual backend changes (additive, safe for the ~4000 live users).

## Notes
- `.env.local`, `node_modules`, `.next` are gitignored — recreate `.env.local` from the example after cloning.
- `src/lib/givens.ts` — forward-compatible fallbacks: values not yet synced from the server use documented defaults and auto-apply once the real field starts arriving.
- `public/system-assets/` — system-default header/background/logo images bundled from the mobile app (not synced by the server).
