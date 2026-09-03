# Storefront e2e (Playwright)

Browser tests for the checkout → payment → success funnel, run against a **mock backend** —
no real API, database, or LiqPay account involved.

```bash
yarn test:e2e:install   # once: downloads Chromium
yarn test:e2e           # starts the mock API (9001) + `next dev` on 9100, runs the specs
npx playwright show-report
```

`playwright.config.ts` starts both servers itself and wires them together: the dev server runs
as `yarn next dev -p 9100` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:9001` in its
environment (already-set env wins over `.env`, so `.env` is not involved and needs no editing),
and the mock gets `MOCK_API_ALLOW_ORIGIN=http://localhost:9100` for CORS. `reuseExistingServer:
true` means a server already listening on 9100 (or a mock on 9001) is picked up instead; the daily
`yarn dev` on 9000 is untouched. If you start the servers by hand, keep the same env — a
storefront built against another API URL will not talk to the mock.

`vitest.config.ts` excludes `e2e/**`, so `yarn test` never loads these specs (a Playwright spec
loaded by Vitest fails with _"Playwright Test did not expect test() to be called here"_).

## Files

| File                      | What                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `mock-api.mjs`            | Node `http` server on 9001; CORS for `MOCK_API_ALLOW_ORIGIN` (default `http://localhost:9100`)     |
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
|                                        | `body.comment === 'FAIL_STOCK'` → `400 { message: 'Only 3 units available for SKU FIL-0001' }`                                             |
|                                        | `body.coupon_code === 'BADCOUPON1'` → `400 { message: 'Invalid coupon code' }`                                                             |
| `POST /liqpay/checkout`                | `{ data, signature, action_url: 'http://localhost:9001/liqpay-sink' }`                                                                     |
|                                        | `400 { message: 'Order is already paid' }` when the order was last looked up with a `…p` token (the body only carries the order number)    |
| `POST /liqpay-sink`                    | `200 text/html <h1>LIQPAY SINK</h1>` — stands in for liqpay.ua                                                                             |
| `GET /orders/lookup/:n?token=`         | By the token's **last char**: `a` → PAID, `f` → FAILED, `p` → FAILED (retry then refused, see above), `e` → PENDING, anything else → `404` |
| `GET/DELETE /__e2e/requests`           | Test-only: read / reset the in-memory request log (`DELETE` also forgets the per-order lookup tokens)                                      |

Every request is also logged to stdout (`[mock-api] GET /auth/me -> 401`); the config pipes it
into the Playwright output. Routes the suite actually exercises today: `/auth/me`,
`/auth/refresh`, `/auth/logout`, `/payment-providers/active/LIQPAY`, `/discount-coupons/validate`,
`/orders`, `/liqpay/checkout`, `/liqpay-sink`, `/orders/lookup/:n`. `/cart`, `/categories` and
the Nova Post routes are defined for completeness (guest session, self-pickup) and are not hit.

Env: `MOCK_API_PORT` (default `9001`), `MOCK_API_ALLOW_ORIGIN` (default `http://localhost:9100`).

## Conventions

- **Storage seeding** goes through `seedStorage(context, …)` → `addInitScript` writing the
  zustand `persist` envelopes (`{ state, version: 0 }`) for `fillando-cart` and
  `fillando-consent`. It runs once per tab/origin (sessionStorage guard) so the app's own later
  writes — the emptied cart after an order — are not overwritten on the next navigation.
- **Consent is seeded as `denied`**: the banner stays hidden and gtag.js is never loaded, so
  `window.dataLayer` remains a plain array the specs can read. Conversions are queued there
  regardless of consent (`common/lib/gtag.ts`).
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
