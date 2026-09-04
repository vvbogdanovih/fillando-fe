# Checkout Flow

End-to-end documentation of order placement and payment on the storefront: `/checkout` → order
creation → (LiqPay hosted payment) → `/checkout/success`.

Files:

- `src/app/(root)/checkout/CheckoutPage.tsx` — form, cart summary, `orderMutation`, error placement
- `src/app/(root)/checkout/checkout.api.ts` — `createOrder`, `initLiqpayCheckout`,
  `fetchOrderPaymentStatus`, `fetchActivePaymentProvider`, `validateCouponCode`
- `src/app/(root)/checkout/checkout.api.schemas.ts` — `createOrderResponseSchema`,
  `orderPaymentStatusSchema`
- `src/app/(root)/checkout/liqpay.utils.ts` — `submitLiqpayForm`, `startLiqpayCheckout`
- `src/app/(root)/checkout/success/page.tsx` — `<Suspense>` shell (the content reads
  `useSearchParams`)
- `src/app/(root)/checkout/success/CheckoutSuccessContent.tsx` — success page state machine and
  the purchase conversion
- `src/common/store/useCartStore.ts` — `clearAfterOrder`, `hasFetched` (§7)
- `src/common/lib/gtag.ts`, `src/common/constants/analytics.constants.ts` — conversion plumbing
- Tests: `checkout/CheckoutPage.test.tsx`, `checkout/success/CheckoutSuccessContent.test.tsx`;
  browser: `e2e/` (Playwright against `e2e/mock-api.mjs`, see `e2e/README.md`)

---

## 1. Backend contract

| Call                                             | Behaviour                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /orders`                                   | Body from `buildCreateOrderPayload`. `200 { order_number, subtotal_price?, total_price?, applied_discount?, payment_access_token? }`. `payment_access_token` is present **only** for `payment_method === 'LIQPAY'`. Coupon failures come back as the English messages `Invalid coupon code` / `Coupon is expired`. Rate-limited (`429`). |
| `POST /liqpay/checkout { order_number }`         | `200 { data, signature, action_url }` — the signed payload the browser form-POSTs to LiqPay. `400` when the order is already `PAID`.                                                                                                                                                                                                     |
| `GET /orders/lookup/:orderNumber?token=<32 hex>` | Public — no login, authorised by the token alone. `200 { order_number, payment_method, payment_status, total_price }`. `404` for an unknown order **or** a wrong token — the two are indistinguishable on purpose.                                                                                                                       |
| LiqPay `result_url` (set by the backend)         | `{FRONTEND_URL}/checkout/success?order=FO-0000123&payment=LIQPAY&token=<32 hex>`. No amounts in the URL — the success page fetches them through the lookup.                                                                                                                                                                              |

`payment_method` is one of `CASH | CARD | LIQPAY | MONOPAY | IBAN | COD` and `payment_status` one
of `PENDING | PAID | FAILED | REFUNDED | VOIDED` (`paymentMethodValues` / `paymentStatusValues` in
`profile/orders/orders.schema.ts`). The lookup response is validated by `orderPaymentStatusSchema`,
so an unexpected enum value is a thrown Zod error, not a silently unknown state.

**Order numbers are strings** (`'FO-0000123'`), not numbers. Never `Number()` them, never pad them —
`formatOrderNumber` passes a non-numeric string through unchanged, so `#FO-0000123` is what the
visitor sees. `createOrderResponseSchema` still accepts `string | number` for backwards
compatibility; everything downstream calls `String(order_number)`.

Errors from every call above reach the page as `Error & { status?: number }` — the Axios
interceptor in `http.service.ts` flattens `response.data.message` into `message` (falling back to
`'Unknown error'`) and copies the HTTP status onto `status`. `createOrder`, `initLiqpayCheckout` and
`fetchOrderPaymentStatus` all pass `skipErrorToast: true`, so the checkout pages own every piece of
error presentation (see [§6](#6-error-placement-on-the-checkout-form)).

**Deploy order.** This frontend ships **after (or together with)** the backend branch
`feature/order-payment-lookup` — `GET /orders/lookup`, `payment_access_token` in the `POST /orders`
response, and the `token` in `result_url`. Against an older backend nothing breaks, but every LiqPay
buyer lands on the neutral «Замовлення прийнято» card (no token → no lookup) and **no purchase
conversion fires** for card payments until the backend is live.

---

## 2. Placing an order (every payment method)

```
User submits the form
  → React Hook Form validates with Zod (checkoutFormSchema)
      └─ invalid → onInvalid → scrollFirstInvalidIntoView()   (§6)
  → orderMutation.mutate(values)
      → buildCreateOrderPayload(values, cart items) → POST /orders
          ├─ error → onError (§6)
          └─ 200 → orderPlacedRef.current = true          ← first thing, synchronously (§7)
                 → setIsRedirecting(true)                 ← submit button stays busy until we leave
                 → branch on values.payment_method
                     ├─ CASH / COD / IBAN → §3
                     └─ LIQPAY            → §4
```

---

## 3. Offline methods (CASH, COD, IBAN)

```
→ await clearAfterOrder()
     logged-in: DELETE /cart (errors swallowed → local items = [])
     guest:     guestItems = []
→ router.push('/checkout/success?order=FO-…&payment=CASH&total=…&subtotal=…
               &discountCode=…&discountPercent=…&discountAmount=…')
```

`subtotal` / `total` are added only when the response carried them, the three `discount*` params
only when `applied_discount` is non-null. The success page renders entirely from the query string
and fires the Google Ads conversion on mount ([§8](#8-purchase-conversion)). Nothing else happens on
the client: the order is committed the moment `POST /orders` returned.

---

## 4. LiqPay

```
POST /orders → 200 { order_number, payment_access_token }
  → POST /liqpay/checkout { order_number }                     (initLiqpayCheckout)
      ├─ 200 { data, signature, action_url }
      │     → await clearAfterOrder()
      │     → submitLiqpayForm(action_url, data, signature)
      │         builds a transient hidden <form method="POST">, submits it, removes it —
      │         the browser leaves the site for LiqPay
      │     → … visitor pays / fails / cancels on LiqPay …
      │     → LiqPay server→server callback flips payment_status (PENDING → PAID | FAILED)
      │     → LiqPay redirects the browser to result_url:
      │         /checkout/success?order=FO-…&payment=LIQPAY&token=<32 hex>
      │
      └─ error (network, 5xx, provider not configured, …) — caught, onSuccess does not throw
            → toast.error('Замовлення створено, але не вдалося відкрити сторінку оплати. …')
            → await clearAfterOrder()
            → router.push('/checkout/success?order=FO-…&payment=LIQPAY[&token=<payment_access_token>]')
              `token` is appended only if POST /orders returned payment_access_token.
```

### Why the cart is cleared only after init has settled

The order of operations is **create → init → clear → leave** (form POST, or the redirect to the
success page when init failed). The cart is never touched before `initLiqpayCheckout` has resolved
or rejected — `CheckoutPage.test.tsx` asserts the call order on both branches.

The previous order was **create → clear → init**, and init was not caught. When
`POST /liqpay/checkout` failed the visitor was left on a checkout page whose cart had just vanished —
its empty-cart effect bounced them to the catalog — with a PENDING order they had no link to and no
way to pay. Now the cart goes away only once we know where the visitor is going next, and the
visitor always lands somewhere that names the order.

Clearing on the failure branch is deliberate: the items now belong to an order. Leaving them in the
cart would invite a second checkout and a duplicate PENDING order for the same goods.

### What the visitor sees after an init failure

The order exists as `PENDING` and nobody has paid. On the success page:

- **With a token** the lookup returns `PENDING`, so the card shows «Очікуємо підтвердження
  оплати…», polls for the 60 s window, then settles on «Статус оплати ще не підтверджено»
  ([§5](#5-success-page-state-machine-checkoutsuccesscontent)). The page cannot tell "init failed,
  LiqPay was never reached" from "paid, callback still in flight" — both are `PENDING`.
- **Without a token** (the backend did not return one) the card is the neutral «Замовлення
  прийнято» with no lookup at all.

**Known gap:** the «Повторити оплату карткою» button is rendered only in the `failed` view
(`FAILED` / `VOIDED`), so a `PENDING` order from a failed init has **no in-page way to pay** yet.
The toast promises payment "зі сторінки замовлення", which today means: once the order is `FAILED`
or `VOIDED` the retry appears; until then the confirmation e-mail / manager is the recovery path.
Offering the retry on a long-`PENDING` order is deliberately not done — see "Why stop at 60 s"
below.

### Retrying a payment

`startLiqpayCheckout(orderNumber)` (`liqpay.utils.ts`) re-runs the same two steps —
`initLiqpayCheckout` then `submitLiqpayForm` — against the existing order; no new order is created
and the cart is not involved. The success page exposes it as the **«Повторити оплату карткою»**
button (`retryMutation`), shown only in the `failed` view next to a link to `/contacts` for choosing
another payment method. On any error the server message is toasted (fallback «Не вдалося перейти до
оплати. Спробуйте ще раз.») and the lookup is refetched — a `400` here usually means the order
became `PAID` in the meantime (another tab, a late callback), and the refetch lets the card catch up.

---

## 5. Success page state machine (`CheckoutSuccessContent`)

Inputs from the URL: `order`, `payment`, `token` (LiqPay only), plus the offline-method amounts
(`total`, `subtotal`, `discountCode`, `discountPercent`, `discountAmount`).

`canLookup = payment === 'LIQPAY' && order && token`. Only then does the page call
`GET /orders/lookup/:order?token=` (React Query, key `['order-payment-status', order, token]`).
Transient failures (network, 5xx) are retried twice with React Query's default back-off; a `404`
(wrong token / unknown order) or `400` is definitive and is **not** retried —
`retry: (count, err) => err.status !== 404 && err.status !== 400 && count < 2`.

```
mount
  ├─ payment !== 'LIQPAY' ──────────────────────────────→ [success]  "Дякуємо за замовлення!"
  │     Rendered from the query string; totals from the URL. Conversion fires on mount.
  │
  ├─ LIQPAY, but no order or no token ───────────────────→ [neutral]  ORDER_ACCEPTED
  │     "Замовлення прийнято — статус оплати ми перевіряємо". No lookup, no conversion, no retry.
  │
  └─ LIQPAY + order + token → [loading]  "Перевіряємо статус оплати…"  (spinner)
        │  fetchOrderPaymentStatus; transient errors retried twice, 404/400 not at all
        ├─ error (404 wrong token / unknown order, network) → [neutral]  PAYMENT_NOT_CONFIRMED
        │     "Статус оплати ще не підтверджено — щойно банк підтвердить, надішлемо лист".
        ├─ payment_status 'PAID' ─────────────────────────→ [success]
        │     Conversion fires once, value = total_price from the lookup.
        ├─ 'FAILED' | 'VOIDED' ───────────────────────────→ [failed]   "Оплата не пройшла"
        │     «Повторити оплату карткою» (startLiqpayCheckout) + «Обрати інший спосіб оплати».
        ├─ 'REFUNDED' ────────────────────────────────────→ [neutral]  "Кошти повернено"
        └─ 'PENDING' ─────────────────────────────────────→ [pending]  "Очікуємо підтвердження оплати…"
              refetchInterval = 3 000 ms while data is PENDING and the window is open
              ├─ → 'PAID'              → [success]  (conversion fires now)
              ├─ → 'FAILED' | 'VOIDED' → [failed]
              └─ 60 s wall-clock timer fires → pollingExpired = true → [neutral] PAYMENT_NOT_CONFIRMED
```

The mapping lives in the pure `resolveLiqpayView()`; the component only feeds it `canLookup`,
`lookup`, `isError` and `pollingExpired`.

Constants: `LIQPAY_POLL_INTERVAL_MS = 3_000`, `LIQPAY_POLL_WINDOW_MS = 60_000`. The window is a
single `setTimeout` started on mount (when `canLookup`), not a poll counter — a slow network does not
extend it. `pollingExpired` is **state**, not a ref, so that its flip re-renders the card and
re-evaluates `refetchInterval` in one step, which is what stops the poller.

The total block (`Разом`) shows the URL `total` when present (offline methods) and otherwise falls
back to `lookup.total_price` (LiqPay return, whose URL carries no amounts).

**Why poll.** LiqPay's server→server callback and the browser redirect to `result_url` race each
other, and the browser usually wins — the first lookup after a successful payment is very often
still `PENDING`. Polling for a short window turns that into `PAID` without a manual reload.

**Why stop at 60 s.** The lookup is a public endpoint; an abandoned tab must not keep hitting it
forever. After the window the email confirmation (sent by the backend on the callback) is the source
of truth, and the card says so. The neutral view has no retry button: a still-PENDING order is not a
failed one, and starting a second LiqPay session while the first may still complete is how double
charges happen.

**The token is a capability, not a session.** 32 lowercase hex chars = 128 random bits; whoever
has the URL can read the order number, payment method, payment status and total — nothing else, no
PII. It lives only in the URL: never write it to `localStorage`/cookies, never attach it to
analytics events, never log it. The `payment_access_token` returned by `POST /orders` is the very
same token the backend embeds into `result_url`; the client only uses it to build the fallback URL on
the init-failure path.

---

## 6. Error placement on the checkout form

`orderMutation.onError` receives the flattened `Error & { status?: number }` and decides **where**
the message goes:

| Condition                                                                               | Where it is shown                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/coupon/i.test(message)` — in practice `'Invalid coupon code'` / `'Coupon is expired'` | `setError('coupon_code', { type: 'server', message })` + `setFocus('coupon_code')`, **and** a toast with the same text. `mapServerCouponError` translates the two known strings to Ukrainian. |
| `status === 429`                                                                        | Toast: «Занадто багато спроб. Зачекайте хвилину і спробуйте ще раз.» — never the raw throttler message.                                                                                       |
| anything else with a real `message` (stock, validation, 5xx with a body)                | Toast with the server's message verbatim (e.g. `Only 3 units available for SKU …`).                                                                                                           |
| no usable message (`'Unknown error'` from the interceptor, network)                     | Toast: «Не вдалося оформити замовлення. Спробуйте ще раз.»                                                                                                                                    |

The rule: **a field-level error is shown only when changing that field can fix it.** The previous
`onError` called `setError('coupon_code', …)` unconditionally, so an out-of-stock line or a network
blip appeared as red text under the coupon input and sent visitors off to "fix" a coupon that was
fine.

Coupons are also pre-validated live (`POST /discount-coupons/validate`, debounced, mapped by
`mapCouponReason`), but order creation re-validates server-side, so the two backend strings can still
arrive at submit time (the coupon expired between typing and submitting, or was used up by another
order). The translations differ on purpose: `mapCouponReason` speaks about the code being typed,
`mapServerCouponError` about the order that was just rejected.

**Client-side validation failures** never reach `onError`. `handleSubmit(onSubmit, onInvalid)`
routes them to `scrollFirstInvalidIntoView()`, which (after a `setTimeout(…, 0)` so the error state
has painted) scrolls the first `[aria-invalid="true"], [data-invalid]` element into view. This
exists because RHF's `shouldFocusError` only reaches registered native inputs — the Nova Post
city/warehouse fields are set through `setValue` and have no ref.

---

## 7. Empty-cart redirect: the `cartReady` gate and the `orderPlacedRef` race guard

The checkout page sends a visitor with an empty cart to the catalog — correct for someone who
deep-links to `/checkout` with nothing in it. Two other situations produce **the same observable
state** (`displayItems.length === 0`) and must not redirect: the cart has not been _loaded_ yet
(hard load), and the cart was just _emptied by the order_ (success path).

```ts
const orderPlacedRef = useRef(false)

// The cart store uses skipHydration and is rehydrated by <Providers> after mount. Child
// effects run first, so on a hard load guestItems is still [] here — without this gate a
// guest with a full cart was bounced to the catalogue. `persist` is optional on purpose:
// zustand skips the middleware on the server (no localStorage), so during SSR the API is
// undefined and we simply render the loading state.
const [cartHydrated, setCartHydrated] = useState(
	() => useCartStore.persist?.hasHydrated() ?? false
)
useEffect(() => {
	const persistApi = useCartStore.persist
	if (!persistApi || persistApi.hasHydrated()) {
		setCartHydrated(true)
		return
	}
	return persistApi.onFinishHydration(() => setCartHydrated(true))
}, [])

// A logged-in user's cart lives on the server: after a hard load `items` is [] until
// Providers finishes checkAuth() → fetchCart(), so wait for the first cart response too.
const cartReady = cartHydrated && (!isAuth || hasFetchedCart)

useEffect(() => {
	if (!cartReady) return
	if (!isLoadingCart && displayItems.length === 0 && !orderPlacedRef.current) {
		router.replace(UI_URLS.CATALOG.FILAMENT)
	}
}, [cartReady, displayItems.length, isLoadingCart, router])

// …

if (!orderPlacedRef.current && (!cartReady || isLoadingCart || displayItems.length === 0)) {
	return <Loader />
}
```

### Cart not loaded yet: `cartReady`

Until `cartReady` is true the page renders the loader — never the form, never the redirect. It is
the conjunction of two facts that arrive at different times on a hard load:

- **Guest — persist hydration.** `guestItems` live in `localStorage` (`fillando-cart`) and the store
  uses `skipHydration: true`; `Providers` calls `useCartStore.persist.rehydrate()` in an effect.
  React runs child effects before parent effects, so `CheckoutPage`'s effect ran first, saw
  `guestItems = []` and bounced a guest with a full cart to `/filament` (the badge then showed the
  items on the catalog page). `cartHydrated` starts from `persist.hasHydrated()` — already true on
  a client-side navigation, so nothing flickers — and otherwise flips in `onFinishHydration`.
- **Logged in — first server cart response.** The server cart is `items`, and it is `[]` until
  `Providers` → `checkAuth()` → `fetchCart()` has answered; `isLoading` is still `false` in that gap
  because nothing has started yet. `useCartStore.hasFetched` closes it: set to `true` in
  `applyCartResponse` (any cart response) and in `fetchCart`'s `finally`. A failed fetch counts too
  — otherwise a backend hiccup would pin the loader forever; instead the shopper is sent to the
  catalog like anyone with an empty cart.

Persist hydration is also awaited for a logged-in user (the store is one persist store), which is
why `cartReady` is `cartHydrated && (!isAuth || hasFetchedCart)` and not an either/or.

`CheckoutPage.test.tsx` («готовність кошика») covers the four combinations — guest before/after
hydration with and without items, logged-in before/after the first cart response — and
`e2e/checkout-errors.spec.ts` hard-loads `/checkout` with a seeded guest cart as the browser
regression test.

### Cart emptied by the order: `orderPlacedRef`

Clearing the cart after a successful order also drops `displayItems.length` to `0`.

Without the guard the effect races the success navigation. `await clearAfterOrder()` yields to the
event loop; React commits the empty cart and runs the effect; `router.replace(catalog)` fires; only
then does `onSuccess` resume and call `router.push(success)`. Depending on timing the visitor lands
on the catalog, or sees the success page flash and get replaced. On the LiqPay path it is worse: a
client-side navigation issued while the hidden `<form>` POST navigation is in flight can cancel the
hand-off to LiqPay.

Hence the ref:

- It is set **synchronously, first thing** in `onSuccess` — before `clearAfterOrder`, before
  `initLiqpayCheckout`, before any `await` — so the guard is in place before the cart mutation can
  render.
- It is a **ref, not state**: the effect must read it synchronously without waiting for a
  re-render, and a state update here would itself re-run the effect it is guarding.
- It also gates the early-return loader, so the form stays mounted in its busy state (`pending`
  includes `isRedirecting`) instead of flashing `Завантаження…` while we leave the page.
- It is **never reset**. After an order the page is left; a fresh mount gets a fresh `false`.

`CheckoutPage.test.tsx` covers all three exits (offline, LiqPay form POST, LiqPay init failure) and
asserts `router.replace` was never called.

---

## 8. Purchase conversion

Always through `gtag()` from `common/lib/gtag.ts`, which pushes onto `window.dataLayer` — the tag is
consent-gated and may not have loaded (see the Analytics paragraph in `CLAUDE.md`).

```ts
const shouldConvert = isLiqpay ? lookup?.payment_status === 'PAID' : true
const conversionValue = isLiqpay ? lookup?.total_price : hasTotal ? total : undefined

gtag('event', 'conversion', {
	send_to: GOOGLE_ADS_PURCHASE_CONVERSION,
	transaction_id: raw ?? '', // 'FO-0000123' — lets Google Ads dedupe repeat page loads
	...(conversionValue !== undefined ? { value: conversionValue, currency: 'UAH' } : {})
})
```

| Payment method        | When the conversion fires                                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CASH`, `COD`, `IBAN` | Once, on mount of the success page. The order is a committed purchase the moment `POST /orders` returned. Value = `total` from the URL (omitted when the URL has none).                                                                                        |
| `LIQPAY`              | Once, the first time the lookup reports `payment_status === 'PAID'` — on the initial fetch or during polling. **Never** on mount, never on `PENDING`, `FAILED`, `VOIDED`, `REFUNDED`, lookup error, or without a token. Value = `total_price` from the lookup. |

**Why LiqPay is different.** LiqPay sends the browser to `result_url` regardless of the outcome —
a cancelled or declined payment lands on exactly the same success page as a paid one. Firing on mount
counted every abandoned payment as revenue. `PAID` from the lookup is the only client-observable
signal that money actually moved.

**Why the value comes from the lookup.** `result_url` carries no amounts, and amounts in a URL are
user-editable anyway. `total_price` from the lookup is server truth.

The `conversionSent` ref guarantees a single fire per mount, including under React Strict Mode's
double effect run and across the PENDING → PAID re-render. It is set **before** the `gtag` call, not
after a `typeof window.gtag === 'function'` check — the previous guard returned early without setting
the ref, and with stable deps the effect never re-ran, silently dropping the conversion whenever the
tag was slow.

---

## Constants & routes

- `UI_URLS.CHECKOUT`, `UI_URLS.CHECKOUT_SUCCESS`, `UI_URLS.CONTACTS` —
  `common/constants/ui-routes.constants.ts`
- `API_URLS.ORDERS.BASE`, `API_URLS.ORDERS.LOOKUP(orderNumber)`, `API_URLS.LIQPAY.CHECKOUT`,
  `API_URLS.COUPONS.VALIDATE` — `common/constants/api-routes.constants.ts`
- `GOOGLE_ADS_PURCHASE_CONVERSION` — `common/constants/analytics.constants.ts`
- `LIQPAY_POLL_INTERVAL_MS`, `LIQPAY_POLL_WINDOW_MS` — `checkout/success/CheckoutSuccessContent.tsx`
- `COD_MIN_PREPAYMENT_UAH`, `COD_ALLOWED_DELIVERY`, `isPaymentMethodAllowed` —
  `checkout/checkout.constants.ts`
