# Storefront e2e (Playwright)

Browser tests for the checkout → payment → success funnel, run against a **mock backend** —
no real API, database, or LiqPay account involved.

```bash
yarn test:e2e:install   # once: downloads Chromium
yarn test:e2e           # starts the mock API (19001) + `next dev` on 9100, runs the specs
npx playwright show-report
```

`playwright.config.ts` starts both servers itself and wires them together: the dev server runs
as `yarn next dev -p 9100` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:19001` in its
environment (already-set env wins over `.env`, so `.env` is not involved and needs no editing),
and the mock gets `MOCK_API_ALLOW_ORIGIN=http://localhost:9100` for CORS. `reuseExistingServer: false` prevents accidentally reusing an unrelated local API. The daily
`yarn dev` on 9000 is untouched. The suite owns both processes and fails if either port is already occupied.

`vitest.config.ts` excludes `e2e/**`, so `yarn test` never loads these specs (a Playwright spec
loaded by Vitest fails with _"Playwright Test did not expect test() to be called here"_).

## Files

| File                      | What                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `mock-api.mjs`            | Node `http` server on 19001; CORS for `MOCK_API_ALLOW_ORIGIN` (default `http://localhost:9100`)     |
| `helpers.ts`              | Storage seeding, dataLayer reader, mock request log + `waitForBoot`/`waitForLookups`, form helpers |
| `success-page.spec.ts`    | `/checkout/success` state machine, Google Ads conversion gating, refused retry (already paid)      |
| `checkout-errors.spec.ts` | Where `POST /orders` errors land: toast vs. coupon field; hard-load regression for `cartReady`     |
| `liqpay-redirect.spec.ts` | LiqPay hand-off survives the cart being cleared; guest cart ends up empty                          |

## Mock API

| Route                                  | Answer                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /auth/me`, `POST /auth/refresh`   | `401` — guest session                                                                                                                      |
| `POST /auth/logout`                    | `200` (must be 200: a 401 here makes the Axios interceptor loop refresh → logout)                                                          |
| `GET /cart`                            | `401`                                                                                                                                      |
| `GET /categories`                      | `[]`                                                                                                                                       |
| `GET /nova-post/cities`, `/warehouses` | `[]`                                                                                                                                       |
| `GET /payment-providers/active/LIQPAY` | `{ provider: 'LIQPAY', sandbox: true }` → the LiqPay radio is rendered                                                                     |
| `POST /discount-coupons/validate`      | `{ valid: false, reason: 'NOT_FOUND' }`                                                                                                    |
| `POST /orders`                         | `201 { order_number: 'FO-0000123', total_price: 700, … , payment_access_token? }` (token only for LIQPAY, like the backend)                |
|                                        | `body.comment === 'FAIL_STOCK'` → `409 { code: 'INSUFFICIENT_STOCK', message: 'Доступно лише 3 шт. (FIL-0001) — …', sku, available, requested }` (без `variant_id`, тож перевіряється лише тост)                                             |
|                                        | `body.coupon_code === 'BADCOUPON1'` → `400 { message: 'Invalid coupon code' }`                                                             |
| `POST /liqpay/checkout`                | `{ data, signature, action_url: 'http://localhost:19001/liqpay-sink' }`                                                                     |
|                                        | `400 { message: 'Order is already paid' }` when the order was last looked up with a `…p` token (the body only carries the order number)    |
| `POST /liqpay-sink`                    | `200 text/html <h1>LIQPAY SINK</h1>` — stands in for liqpay.ua                                                                             |
| `GET /orders/lookup/:n?token=`         | By the token's **last char**: `a` → PAID, `f` → FAILED, `p` → FAILED (retry then refused, see above), `e` → PENDING, anything else → `404` |
| `GET/DELETE /__e2e/requests`           | Test-only: read / reset the in-memory request log (`DELETE` also forgets the per-order lookup tokens)                                      |

Every request is also logged to stdout (`[mock-api] GET /auth/me -> 401`); the config pipes it
into the Playwright output. Routes the suite actually exercises today: `/auth/me`,
`/auth/refresh`, `/auth/logout`, `/payment-providers/active/LIQPAY`, `/discount-coupons/validate`,
`/orders`, `/liqpay/checkout`, `/liqpay-sink`, `/orders/lookup/:n`. `/cart`, `/categories` and
the Nova Post routes are defined for completeness (guest session, self-pickup) and are not hit.
The storefront layout reads `/categories/tree` and `/products/catalog/v2/category-counts` (Plan-0010
D06), which the mock leaves unanswered (404): the header falls back to its static links, as it would
in an API outage — the checkout suite does not depend on the menu.

Env: `MOCK_API_PORT` (default `19001`), `MOCK_API_ALLOW_ORIGIN` (default `http://localhost:9100`).

## Conventions

- **Storage seeding** goes through `seedStorage(context, …)` → `addInitScript` writing the
  zustand `persist` envelopes (`{ state, version: 0 }`) for `fillando-cart` and
  `fillando-consent`. It runs once per tab/origin (sessionStorage guard) so the app's own later
  writes — the emptied cart after an order — are not overwritten on the next navigation.
- **Consent is seeded as `denied`**: the banner stays hidden. gtag.js is never loaded on a local
  host whatever the consent (`Analytics` — the fallback tag id is the production Ads account), so
  `window.dataLayer` remains a plain array the specs can read; it opens with the entries of the
  inline bootstrap script (`consent default`, `js`, `config`). Conversions are queued there
  regardless of consent (Consent Mode v2, 2026-11-16).
- **`/checkout` is reached client-side** (`openCheckout`: `/contacts` → cart drawer → «Оформити
  замовлення»), the way a shopper gets there. A _hard_ load of `/checkout` works as well:
  `CheckoutPage` waits for `cartReady` — the persisted guest cart hydrated, and for a logged-in
  user the first server cart response (`useCartStore.hasFetched`) — before its empty-cart effect
  may redirect to `/filament`. `checkout-errors.spec.ts` hard-loads `/checkout` with a seeded cart
  as the regression test for that gate (see `docs/checkout-flow.md` §7).
- **No fixed sleeps.** Negative assertions ("no conversion", "no redirect") wait for something
  observable instead: `waitForBoot` polls the mock request log for the end of the auth boot chain
  (`/auth/logout`), `waitForLookups` for the n-th answered `GET /orders/lookup/:n`, and the state
  card / form for hydration. Then the dataLayer or URL is read once.
- **Coupon scenario order matters**: type the coupon _before_ the contact fields. The live
  pre-validation pins the field via RHF `setError`, which also sets `isValid = false` and disables
  «Замовити»; the next change on any other registered field re-runs the resolver and re-enables it.
- Selectors are role/label based and use the Ukrainian strings from the components. The coupon
  error lives in `#coupon_code-error`; toasts are `role="status"`. On `/checkout` the item name is
  asserted inside `form` (`checkoutForm(page)`) — the closing cart drawer lists the same item.
- Stay off server-rendered catalog pages (`/`, `/filament`, `/products/*`): `serverFetch` responses
  are cached in `.next/cache/fetch-cache`, so `next dev` can serve real data from an earlier
  session against a live backend instead of the mock.

Адмінські API-токени: `yarn test:e2e partner-api-tokens.spec.ts`.
Playwright використовує `NEXT_DIST_DIR=.next-e2e`, щоб не конфліктувати
з каталогом збірки вже запущеного dev-сервера.


### Category tree with real local API

Run `yarn test:e2e --config playwright.categories.config.ts` after starting the backend's
disposable Mongo (`yarn test:db:up`, 27018). Requires `../fillando-be`. This isolated config
starts a real Nest category fixture on 127.0.0.1:19101 and Next on 127.0.0.1:19100. It uses
a dedicated test DB, never `.env` DATABASE_URL or a production dump. Only authentication
is a fixture; category HTTP writes/read/journal are real. Default playwright.config.ts
excludes this test because its normal mock server cannot exercise these guarantees.

The category rehearsal also verifies attribute copy with independent stable IDs and
real numeric/boolean filters over the fixture's typed 16/32/63 A variants. It includes
mobile overflow checks for the editor. These fixture products never enter a restored
production dump or a deployed environment.

### Release rehearsal with the real backend (Plan-0010 R01 §5)

`yarn test:e2e --config playwright.release.config.ts` (after `yarn test:db:up`; never together
with the backend integration suite or the categories config — the same Mongo 27018). The config
starts the **whole** backend — `AppModule`, every module that ships — from
`../fillando-be/test/release-e2e-server.ts` on 127.0.0.1:19201 against the disposable database
`fillando-test-release-e2e`, and a **production build** of the storefront (`next build` into
`.next-e2e/release`, `next start` on 127.0.0.1:19200): only a production build caches pages as
production does, and the purge test needs that cache. The build adds ~1 min to a run.

What the backend server replaces, and nothing else: authentication (the `x-test-role` header;
`/auth/me` and `/cart` answer for it, a request without it is a guest), the email service (a
recorder — an order sends no email, `GET /__e2e/emails` lists what would have been sent) and the
rate limits. Test-only routes: `GET /__e2e/purges` and `POST /__e2e/purges/hold {hold}` (storefront
purge requests, held for the cache control), `POST /__e2e/large-menu {on}` (151 one-SKU categories
that put the header menu into its lazy mode). `REVALIDATE_SECRET` and `INTERNAL_API_TOKEN` are test
values set in the config for both processes, not `.env`'s.

| File                                 | Plan-0010 §5 row                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `release/real-api.ts`                | Fixtures through the admin API (categories, characteristics, typed products, publication), feed  |
| `release/catalog-depth.spec.ts`      | «Категорія на 5+ рівні» — admin create/move to level 6, menu (full and lazy), breadcrumbs        |
| `release/category-conversion.spec.ts`| «Товарна категорія → група» — refusal without a plan, losing plan, stale plan, executed plan     |
| `release/checkout.spec.ts`           | «Товар без варіантів», «Ціна/акція/наявність» — card → page → JSON-LD → cart → order → feed     |
| `release/price-purge.spec.ts`        | «Ціна/акція/наявність» — admin price change → card, page, JSON-LD, feed equal after the purge    |

Checkout is self-pickup and cash: no Nova Post, no LiqPay. Tests in one file may share the
database with the others but create their own data; the large-menu test switches it back off.

### `tsconfig.e2e.json`

Every config builds into its own `NEXT_DIST_DIR` (`.next-e2e/…`). Next adds each dist dir to the
`include` of the tsconfig it type-checks with and rewrites the whole file, so `next.config.ts` points
test builds at `tsconfig.e2e.json` — git-ignored, created on first use, it only `extends`
`./tsconfig.json`. The committed `tsconfig.json` is untouched by test runs; the daily `yarn dev` /
`yarn build` (no `NEXT_DIST_DIR`) still use it.
