# Storefront e2e (Playwright)

Browser tests for the checkout → payment → success funnel, run against a **mock backend** —
no real API, database, or LiqPay account involved.

```bash
yarn test:e2e:install   # once: downloads Chromium
yarn test:e2e           # starts the mock API (9001) + `yarn dev` (9000), runs the specs
npx playwright show-report
```

`playwright.config.ts` starts both servers itself (`reuseExistingServer: true`, so an already
running `yarn dev` or mock is picked up instead). `.env` must have
`NEXT_PUBLIC_API_BASE_URL=http://localhost:9001` — the storefront talks to whatever that points
at, and the specs assume it is the mock.

> **Vitest picks these files up too.** `vitest run` includes `**/*.spec.ts` by default, and a
> Playwright spec loaded by Vitest fails with _"Playwright Test did not expect test() to be
> called here"_. Add `exclude: [...configDefaults.exclude, 'e2e/**']` to `vitest.config.ts`
> (or run `npx vitest run --exclude 'e2e/**'` in the meantime).

## Files

| File                      | What                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `mock-api.mjs`            | Node `http` server on 9001 with CORS for `http://localhost:9000`          |
| `helpers.ts`              | Storage seeding, dataLayer reader, mock request log, form helpers         |
| `success-page.spec.ts`    | `/checkout/success` state machine + Google Ads conversion gating          |
| `checkout-errors.spec.ts` | Where `POST /orders` errors land: toast vs. coupon field (+ 1 `fixme`)    |
| `liqpay-redirect.spec.ts` | LiqPay hand-off survives the cart being cleared; guest cart ends up empty |

## Mock API

| Route                                  | Answer                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/me`, `POST /auth/refresh`   | `401` — guest session                                                                                                       |
| `POST /auth/logout`                    | `200` (must be 200: a 401 here makes the Axios interceptor loop refresh → logout)                                           |
| `GET /cart`                            | `401`                                                                                                                       |
| `GET /categories`                      | `[]`                                                                                                                        |
| `GET /nova-post/cities`, `/warehouses` | `[]`                                                                                                                        |
| `GET /payment-providers/active/LIQPAY` | `{ provider: 'LIQPAY', sandbox: true }` → the LiqPay radio is rendered                                                      |
| `POST /discount-coupons/validate`      | `{ valid: false, reason: 'NOT_FOUND' }`                                                                                     |
| `POST /orders`                         | `201 { order_number: 'FO-0000123', total_price: 700, … , payment_access_token? }` (token only for LIQPAY, like the backend) |
|                                        | `body.comment === 'FAIL_STOCK'` → `400 { message: 'Only 3 units available for SKU FIL-0001' }`                              |
|                                        | `body.coupon_code === 'BADCOUPON1'` → `400 { message: 'Invalid coupon code' }`                                              |
| `POST /liqpay/checkout`                | `{ data, signature, action_url: 'http://localhost:9001/liqpay-sink' }`                                                      |
| `POST /liqpay-sink`                    | `200 text/html <h1>LIQPAY SINK</h1>` — stands in for liqpay.ua                                                              |
| `GET /orders/lookup/:n?token=`         | By the token's **last char**: `a` → PAID, `f` → FAILED, `e` → PENDING, anything else → `404`                                |
| `GET/DELETE /__e2e/requests`           | Test-only: read / reset the in-memory request log                                                                           |

Every request is also logged to stdout (`[mock-api] GET /auth/me -> 401`); the config pipes it
into the Playwright output. Routes the suite actually exercises today: `/auth/me`,
`/auth/refresh`, `/auth/logout`, `/payment-providers/active/LIQPAY`, `/discount-coupons/validate`,
`/orders`, `/liqpay/checkout`, `/liqpay-sink`, `/orders/lookup/:n`. `/cart`, `/categories` and
the Nova Post routes are defined for completeness (guest session, self-pickup) and are not hit.

## Conventions

- **Storage seeding** goes through `seedStorage(context, …)` → `addInitScript` writing the
  zustand `persist` envelopes (`{ state, version: 0 }`) for `fillando-cart` and
  `fillando-consent`. It runs once per tab/origin (sessionStorage guard) so the app's own later
  writes — the emptied cart after an order — are not overwritten on the next navigation.
- **Consent is seeded as `denied`**: the banner stays hidden and gtag.js is never loaded, so
  `window.dataLayer` remains a plain array the specs can read. Conversions are queued there
  regardless of consent (`common/lib/gtag.ts`).
- **`/checkout` is reached client-side** (`openCheckout`: `/contacts` → cart drawer → «Оформити
  замовлення»), the way a shopper gets there. A _hard_ load of `/checkout` with a guest cart
  bounces to `/filament`: `CheckoutPage`'s empty-cart effect runs before `Providers` calls
  `useCartStore.persist.rehydrate()` (React runs child effects first), sees `guestItems = []` and
  calls `router.replace('/filament')` — the badge then shows the items on the catalog page. This
  is recorded as `test.fixme` in `checkout-errors.spec.ts`; flip it to `test` once the redirect
  is gated on store hydration.
- **Coupon scenario order matters**: type the coupon _before_ the contact fields. The live
  pre-validation pins the field via RHF `setError`, which also sets `isValid = false` and disables
  «Замовити»; the next change on any other registered field re-runs the resolver and re-enables it.
- Selectors are role/label based and use the Ukrainian strings from the components. The coupon
  error lives in `#coupon_code-error`; toasts are `role="status"`.
- Stay off server-rendered catalog pages (`/`, `/filament`, `/products/*`): `serverFetch` responses
  are cached in `.next/cache/fetch-cache`, so `next dev` can serve real data from an earlier
  session against a live backend instead of the mock.
