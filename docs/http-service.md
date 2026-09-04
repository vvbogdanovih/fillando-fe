# HTTP Service

`src/common/services/http.service.ts`

Axios-based singleton (`httpService`) used for all API communication. Wraps every response through optional Zod validation and handles token refresh automatically.

---

## Usage

```ts
import { httpService } from '@/common/services/http.service'

// Without validation
const data = await httpService.get('/some/endpoint')

// With Zod schema — response is validated and typed automatically
const data = await httpService.get('/some/endpoint', { schema: mySchema })

// Suppress the automatic error toast for a specific call
const data = await httpService.post('/some/endpoint', body, { skipErrorToast: true })
```

---

## Config type

```ts
type Config<T = unknown, D = unknown> = AxiosRequestConfig<D> & {
	schema?: z.ZodType<T> // Optional Zod schema to validate the response body
	skipErrorToast?: boolean // When true, errors are thrown but not shown in a toast
}
```

**`schema`** — If provided, the response body is run through `schema.parseAsync()`. On a Zod parse failure the error is toasted and re-thrown. Use this on every call where the response shape matters.

**`skipErrorToast`** — Use when the caller handles the error itself (e.g. a form that sets a field-level error) and the automatic toast would be redundant or confusing.

---

## Token refresh & deduplication

When any request returns `401`, the interceptor:

1. Marks the original request with `_retry = true` (prevents infinite loops).
2. Checks if a refresh is already in-flight (`refreshPromise` module-level singleton).
   If not, starts one and stores the promise. If one is already running, awaits the same promise.
   This ensures that N concurrent 401s trigger exactly one `/auth/refresh` call.
3. If refresh succeeds, retries the original request with the updated cookie.
4. If refresh fails, calls `logOut()` and returns `false`.

The `refreshPromise` variable is reset to `null` in the `.finally()` of every refresh attempt so the next 401 (in a future request cycle) starts a fresh refresh.

---

## Why native `fetch` in `refreshToken()`

`refreshToken()` is called from the Axios response interceptor. Using `apiClient` (Axios) inside the interceptor would cause the interceptor to trigger again on the refresh request, creating an infinite loop. Native `fetch` bypasses Axios entirely and avoids this.

---

## Zod validation failure behaviour

If schema validation fails:

- The error message is extracted from `ZodError.issues`.
- A toast is shown (not suppressed by `skipErrorToast`).
- An `Error` is thrown, rejecting the caller's promise.

This means a schema mismatch between frontend and backend is surfaced immediately as a visible error rather than silently producing `undefined` fields.

---

## Query parameter serialisation

The `get()` method serialises non-primitive query param values (objects, arrays) as JSON strings via `encodeURIComponent(JSON.stringify(value))`. The backend must expect this format.

---

## Blob / file downloads

Endpoints that return a binary body (PDF price list, order report, invoice) **must not** go through
`httpService`. Every `httpService` verb pipes the response through `handleAxiosResponse`, which runs
Zod `parseAsync` over the body — that destroys a blob.

Use bare `axios` with the base URL and credentials supplied explicitly:

```ts
const response = await axios.post(`${API_BASE_URL}${API_URLS.PRODUCTS.PRICE_LIST_PDF}`, payload, {
	responseType: 'blob',
	withCredentials: true
})
```

Two consequences of bypassing the interceptor, both of which the caller must handle:

1. **No automatic error toast.** `skipErrorToast` is irrelevant here — nothing toasts at all. Handle
   errors explicitly in the mutation's `onError`. A failed request still returns a JSON body, so read
   it off the blob (`await blob.text()` → `JSON.parse`) to surface the real server message; guard on
   `blob.type` not containing `pdf` to detect that case.
2. **No 401 → `/auth/refresh` → retry.** If the access token expired since the last `httpService`
   call the download simply fails and the user must retry. A shared `downloadBlob` helper that
   refreshes once on 401 would fix this for all three call sites — not done yet.

Do **not** wrap the response in `new Blob([response.data])`. `response.data` is already a `Blob`, and
re-wrapping drops its MIME type, which breaks both the content-type guard above and the browser's
preview handling.

### Reading the server filename requires CORS

The frontend and API are different origins, so the browser hides every non-safelisted response header
from JS. `Content-Disposition` is only readable because the backend sends
`Access-Control-Expose-Headers: Content-Disposition` (`fillando-be/src/main.ts`). Without it the
filename parse silently falls back to a generic name — the download still works, it is just named
wrong, which makes this an easy regression to miss.

---

## Server-side fetching (`serverFetch`)

`src/common/utils/server-fetch.utils.ts`

Server Components, `generateMetadata` and `sitemap.ts` cannot use `httpService`: it is an Axios
instance built for the browser (cookies, `react-hot-toast`, the 401 → `/auth/refresh` retry). They
use `serverFetch` instead — a thin wrapper over native `fetch` against `NEXT_PUBLIC_API_BASE_URL`
with `next: { revalidate: 3600 }` as the default cache policy.

```ts
import { serverFetch } from '@/common/utils/server-fetch.utils'

const category = await serverFetch<Category>(`/categories/slug/${slug}`)
if (!category) notFound()

// Override the cache policy (or any RequestInit field) through the second argument
const fresh = await serverFetch<Count>('/products/variants/count', { next: { revalidate: 0 } })
```

### `null` means 404 — and only 404

| Upstream result                           | `serverFetch` returns                              |
| ----------------------------------------- | -------------------------------------------------- |
| `2xx`                                     | parsed JSON body                                   |
| `404`                                     | `null` — the resource genuinely does not exist     |
| any other non-OK (`5xx`, `429`, `401`, …) | **throws** `Error('Upstream <status> for <path>')` |
| network error / DNS / timeout             | **throws** (the `fetch` rejection propagates)      |

The caller decides what an absent resource means — `notFound()` for a slug page, an empty list for
the home page's featured block — but it never has to decide what an outage means, because an outage
never reaches it as data.

**Why throwing is the point.** The previous version collapsed every failure into `null`. A page then
rendered its "not found" or empty branch with a `200`, and ISR cached that render for the whole
revalidate window — a ten-second API blip became an hour of an empty homepage or a soft-404 catalog
page, indexable by Google. A thrown error instead bubbles to the nearest route error boundary
(`src/app/error.tsx`, or a segment `error.tsx`), Next.js does **not** cache the failed render, and
the next request retries the fetch. An error page for a minute beats a cached empty page for an
hour.

Consequences for call sites:

- Do not wrap `serverFetch` in `try/catch` "to be safe" — that reintroduces the cached-empty-page
  bug. Let it throw.
- `?? []` / `?? null` fallbacks are fine: they only ever handle the 404 case now.
- Never use it for user-specific data. It forwards no cookies, so anything behind auth returns
  `401` and throws.

### The three deliberate catches

The first two exist because the caught value is **not** what gets rendered and cached:

1. **`generateMetadata` in `src/app/(root)/[category]/page.tsx`.** `[category]` is the catch-all
   for every unknown top-level path, so a `null` category is marked `robots: noindex` to keep the
   soft-404 out of the index. An upstream outage must not take that branch — the blip would be
   indexed (and ISR-cached) as "not found". `generateMetadata` therefore catches the throw and
   returns a neutral title **without** `noindex`; the page body below it calls `serverFetch` again
   uncaught, throws into the error boundary, and nothing is cached.
2. **The count fetch in `src/app/sitemap.ts`** (`.catch(() => null)` → `count = -1`). The count is
   only the cache key of `fetchSitemapEntries`; a wrong key at worst re-runs the entries fetch,
   which has its own uncaught `serverFetch` calls. Nothing renders from the swallowed value.

3. **`getCategoryNavLinks` in `src/common/utils/navigation.utils.ts`** (Plan-0004 PR-3). A
   different shape from the first two, and the reason is scope rather than caching: the call sits
   in `(root)/layout.tsx`, the one server component every storefront page renders through. Letting
   it throw would send `/faq`, `/contacts`, `/offer` and the rest — pages that need nothing from
   the API — into the error boundary because the category endpoint blinked. Navigation is
   decoration on those pages, so it falls back to `FALLBACK_CATEGORY_LINKS` and the menu degrades
   instead of the site failing. Pages that genuinely need the API still fetch it themselves,
   uncaught, and still fail loudly.

If you find yourself adding a fourth, write down which of these shapes it is: the caught value is
not what gets cached, or the call is decoration on pages that do not otherwise need the API.

### Second argument: `init`

`serverFetch(path, init?)` merges `init` into the request, so callers can override
`next.revalidate`, set headers, or pass `next.tags`. The default `revalidate: 3600` applies
when `init.next` is omitted. If you pass an explicit `cache` mode (e.g. `cache: 'no-store'`)
the default revalidate is **not** added — Next treats `cache` + `revalidate` as a conflict and
discards both with a warning.

### Sitemap: `revalidate: 0` inside `unstable_cache`, and `force-static`

`src/app/sitemap.ts` has two cache layers that must not fight each other, and one route-level flag
that keeps the second one alive.

**Entries.** `fetchSitemapEntries` is `unstable_cache(…, ['sitemap-entries'], { revalidate: 86400 })`,
called with the product-variant count as its only argument — the count is the cache key, so a new
product busts the entry while category/slug edits are picked up by the daily revalidation (a hard
`revalidate: false` would serve stale URLs forever). Inside it the two `serverFetch` calls pass
`{ next: { revalidate: 0 } }`: `unstable_cache` owns caching here — Next forces fetches inside it to
`no-store` anyway — so the explicit `0` states what actually happens instead of pretending the
default hour-long fetch cache is a second layer underneath.

The two fetches run in `Promise.all` and are **not** caught. If either throws, the cached entry
keeps being served while the failed re-run is logged; on a cold cache the route errors. Both beat the
previous behaviour of caching an empty sitemap for a day. `null` (a genuine 404) is the only case
that maps to "no entries" (`variants ?? []`, `categories ?? []`).

**Count.** The route function itself does one more `serverFetch` for `/products/variants/count`
with `revalidate: 0`, caught to `null` → `-1` (see
[the two deliberate catches](#the-two-deliberate-catches)).

**`export const dynamic = 'force-static'`.** That count fetch is a `revalidate: 0` fetch at route
level. Without `force-static` Next treats it as dynamic usage (`markCurrentScopeAsDynamic` in
`next/dist/server/lib/patch-fetch`) and drops the whole route out of ISR — every crawler hit would
re-run it. With `force-static` plus `export const revalidate = 86400` the fetch simply re-runs on
each daily regeneration, exactly as the bare `fetch` did before `serverFetch` replaced it. Keep the
two exports together; removing `dynamic` looks harmless and silently makes the sitemap dynamic.

### Call sites

| File                                      | Calls                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `src/app/(root)/Home.tsx`                 | `/categories`, `/products/catalog?…`                                  |
| `src/app/(root)/[category]/page.tsx`      | `/categories/slug/:slug` (metadata + page), `/products/catalog?…`     |
| `src/app/(root)/products/[slug]/page.tsx` | `/products/by-slug/:slug` (metadata + page)                           |
| `src/app/(root)/search/page.tsx`          | `/products/search?…`                                                  |
| `src/app/sitemap.ts`                      | `/products/variants/count`, `/products/variants/slugs`, `/categories` |
