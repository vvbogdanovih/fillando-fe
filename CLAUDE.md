# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev        # Start dev server on port 9000
yarn build      # Build for production
yarn start      # Start production server
```

Use **Yarn** (not npm or bun). Tests run on **Vitest** (`yarn test` / `yarn test:watch`, config in `vitest.config.ts`); coverage is limited to pure utility modules so far.

## Architecture

**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Zustand, React Query, React Hook Form + Zod, Axios, Radix UI.

**Path alias:** `@/*` → `src/*`

### Directory Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── (root)/           # Main app routes
│   ├── auth/             # Auth routes (login, register, success)
│   │   ├── AuthForm.tsx  # Shared auth form shell (title, submit, Google OAuth)
│   │   ├── auth.api.ts   # Auth API calls
│   │   ├── auth.schema.ts
│   │   └── error.tsx     # Auth-segment error boundary
│   ├── error.tsx         # Root error boundary
│   ├── layout.tsx        # Root layout (light theme; Inter + Geist fonts)
│   └── provider.tsx      # Client providers (React Query, Toast) + auth init gate
├── env.ts                # Zod-validated env vars (throws on missing/invalid)
└── common/
    ├── components/
    │   ├── ui/           # Styled primitives (Button, Input, Card, Badge, PasswordInput, etc.)
    │   └── guards/       # PrivateRoute for role-based access control
    ├── constants/        # API_URLS, UI_URLS, Role enum, FORM_ERRORS
    ├── schemas/          # Zod schemas (composable primitives: email, password, name)
    ├── services/
    │   └── http.service.ts  # Axios singleton with interceptors + token refresh
    ├── store/
    │   └── useAuthStore.ts  # Zustand auth store (persists to localStorage)
    ├── types/
    └── utils/
        ├── server-fetch.utils.ts  # serverFetch() for RSC / metadata / sitemap (null == 404 only)
        └── shad-cn.utils.ts  # cn() class merging utility
```

### Key Patterns

**HTTP Service:** `httpService` is an Axios singleton. Every call accepts an optional Zod schema to validate the response. 401s trigger automatic token refresh with promise deduplication. Server Components / `generateMetadata` / `sitemap.ts` use `serverFetch` (`common/utils/server-fetch.utils.ts`) instead: `null` means **404 only** — any other failure throws to the route error boundary, so an API outage can never be ISR-cached as an empty page. Do not `try/catch` it "to be safe" — the only two deliberate catches (`[category]` `generateMetadata`, the sitemap count key) are explained in [docs/http-service.md](./docs/http-service.md#server-side-fetching-serverfetch), and a new one needs the same kind of justification.

**Auth Flow:** App boot → children render immediately (no boot-time loader gate) → `Providers` rehydrates persisted stores, then `checkAuth()` hits `/auth/me` → Zustand updates (`isAuthChecked=true`) once the result is known. Login/register → Zod validates response → Zustand store updates → cookie-based session. `PrivateRoute` wraps protected pages and checks `useAuthStore`. See `docs/auth-flow.md` for the full breakdown.

**Forms:** React Hook Form + `zodResolver`. Schemas live in feature-level `*.schema.ts` files and reuse primitives from `common/schemas/`.

**Importing zod:** always

```ts
import '@/common/lib/zod-locale'
import * as z from 'zod'
```

Never `import { z } from 'zod'` — that pulls zod's namespace object, which no bundler can tree-shake, shipping all 53 locales plus the JSON-Schema converter (~35 KB gz) on every page. The `zod-locale` side-effect import is **not optional**: `import * as z` also shakes away the `config(en())` call inside zod's `external.js`, and without a locale every default message collapses to the literal `"Invalid input"`. It sets the Ukrainian locale, so default messages are localised too. For the same reason, do not create a `common/lib/zod.ts` that re-exports `z` — that reintroduces the namespace object.

**UI Components:** Follow shadcn/ui conventions but are custom-built. Use CVA for variants. Radix UI headless primitives (Slider, Switch, Dialog, etc.) are styled with Tailwind.

**Routing constants:** All frontend routes are in `common/constants/ui-routes.constants.ts`. All API endpoint paths are in `common/constants/api-routes.constants.ts`. Always use these rather than hardcoding strings.

**Products admin flow:** `/admin/products` lists products via `GET /products` and offers a wholesale price list export — `POST /products/price-list/pdf` (admin-only) returns a PDF **blob**, so `productsApi.downloadPriceList` uses bare `axios` rather than `httpService`. See [docs/http-service.md](./docs/http-service.md#blob--file-downloads).

**Orders admin flow:** `/admin/orders` loads paginated order list with `order_status` and `payment_status` filters via `GET /orders`. `/admin/orders/[id]` loads details via `GET /orders/:id` and supports full edit with `PATCH /orders/:id` plus quick updates via `PATCH /orders/:id/status`, `PATCH /orders/:id/payment-status`, `PATCH /orders/:id/ttn`.

**Checkout / LiqPay:** `/checkout` → `POST /orders` → for LiqPay `POST /liqpay/checkout` → hidden-form POST to LiqPay → back to `/checkout/success?order=FO-…&payment=LIQPAY&token=<32 hex>`, where the page polls the public `GET /orders/lookup/:orderNumber?token=` for `payment_status`. Three rules that are easy to get wrong: (1) on the LiqPay path the cart is cleared **only after** `initLiqpayCheckout` has settled — create → init → clear → leave (form POST, or on init failure a caught redirect to the success page carrying `payment_access_token`), never before init; (2) the Google Ads conversion for LiqPay fires **only** when the lookup reports `PAID` (offline methods still fire on mount); (3) in `orderMutation.onError` only coupon messages are pinned to the coupon field, everything else is a toast, and `429` gets its own wording; (4) the empty-cart redirect and the loader on `/checkout` wait for `cartReady` — persist hydration for guests (`useCartStore.persist`, which is `undefined` during SSR) and the first server cart response (`hasFetched`) for logged-in users — otherwise a hard load bounces a full cart to the catalogue. Order numbers are strings (`'FO-0000123'`), never `Number()` them. Full state machine and the `orderPlacedRef` race guard in [docs/checkout-flow.md](./docs/checkout-flow.md).

**Styling:** Tailwind CSS 4 with `@theme` inline tokens in `globals.css` (no `tailwind.config.*`). The site renders in a **single light theme** (`:root` tokens; there is no `.dark` block and `<html>` carries no theme class). Custom design tokens include filament-type colors (PLA, PETG, ABS, TPU, Nylon), gradients (`--gradient-primary/accent/border`), glow shadows, and utilities like `gradient-text`, `card-hover`, `glow-primary`, `animate-float`, `gradient-border`.

**Motion / smooth scroll:** `motion` (Framer, `motion/react`) + `lenis` power storefront animations. Reusable primitives live in `common/components/motion/` (`SmoothScrollProvider`, `ScrollReveal`, `StaggerGroup`/`StaggerItem`, `Parallax`, `MagneticButton`) — all `'use client'`. `SmoothScrollProvider` is mounted in `(root)/layout.tsx` only (admin/auth keep native scroll); under `prefers-reduced-motion` Lenis is skipped entirely. Radix dialogs/drawers pause Lenis via the `useLenisModalLock` hook (`common/hooks/`) plus `data-lenis-prevent` on their inner scroll containers. Guardrails: never parallax large rasters or the LCP hero; keep GPU-only transforms (translate/scale/opacity).

> **Import `SmoothScrollProvider` by its deep path, never from `components/motion`.** The barrel re-exports the animated primitives, so importing the provider through it drags `motion/react` into the shared layout chunk on _every_ storefront page (~50 KB gz on `/filament` and `/products`, which use no animation at all). For the same reason the provider reads `prefers-reduced-motion` via a local `useSyncExternalStore` rather than `useReducedMotion` from `motion/react`, and there is no `<MotionConfig>` wrapper — every consumer already calls `useReducedMotion()` and branches on it itself.

**Formatting:** Prettier with tabs (width 4), single quotes, no trailing commas, print width 100, Tailwind class sorting.

**Images:** the built-in Next optimizer is **off** — it downloads and decodes the full S3 object per request and can exhaust a 1–2 GB VPS. Instead the backend writes fixed width derivatives (`128/320/640/1280`) at upload time, and `image-loader.ts` rewrites each URL to the right tier.

`NEXT_PUBLIC_USE_IMAGE_DERIVATIVES` switches the two modes. It defaults to **off**, in which mode `unoptimized: true` applies and every `sizes=` prop in the app is inert (Next nulls out `srcSet`/`sizes`).

> Like every `NEXT_PUBLIC_*` var it is inlined at **build** time, so it must be a Docker **build arg** — declared in `Dockerfile.prod` and passed from `docker-compose.prod.yml`. Putting it in `.env.prod` does nothing: that `env_file` is only applied to the runtime container, and the value is already baked into the bundle by then. The failure is silent.

Before flipping it on, the S3 backfill must be run and verified — a missing derivative is a hard 404 with no fallback:

In `fillando-be`, edit the `MODE` constant at the top of
`scripts/migrations/generate-image-derivatives.js` and re-run it for each step —
`'dry-run'` → `'live'` → `'verify'`. The `'verify'` pass must exit 0.

`deviceSizes ∪ imageSizes` must equal the backend's `DERIVATIVE_WIDTHS` exactly, or srcset descriptors will misreport widths.

**LCP:** `priority` is deprecated in Next 16 — use `preload`, and note that passing both throws. `preload` does **not** imply `fetchpriority="high"` in 16.1.4; set `fetchPriority` explicitly on the LCP image. `ProductGrid` marks the first `EAGER_CARDS` cards; keep that constant in sync with the widest grid column count.

**Analytics / cookie consent:** the Google Ads tag is rendered by `common/components/Analytics.tsx` **only** once `useConsentStore.status === 'granted'`. Not rendering the `<Script>` is what removes the ~57 KB of gtag.js and the third-party cookies; Consent Mode alone would still load it. Always fire events through `common/lib/gtag.ts` (which queues onto `window.dataLayer`), never via `window.gtag(...)` directly — the tag may not have loaded, or may load minutes later when the visitor accepts, and a direct call is silently dropped. The purchase conversion on `/checkout/success` fires on mount for offline methods (CASH / COD / IBAN) but for LiqPay **only** once the order lookup reports `payment_status === 'PAID'` — LiqPay redirects to the success page on cancel and failure too, so for card payments mount ≠ purchase (see `docs/checkout-flow.md`).

## Documentation & Flow Integrity

Before marking a task done, check whether the changes affect any documented flow, API contract, or data structure.

- **If a documented flow changes** (auth, HTTP service, routing, store shape), update the relevant section in this file or in `/docs` before closing the task.
- **If a new flow is introduced** and no documentation exists for it, suggest creating a new file under `/docs` (e.g. `/docs/auth-flow.md`).
- **Inline comments** are required only where the logic is non-obvious — don't annotate self-evident code.

The rule: a task that changes behaviour is not done until the documentation reflects the new reality.
