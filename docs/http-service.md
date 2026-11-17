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
4. If refresh fails, signs out **locally** (`useAuthStore.setUser(null)`) — never `logOut()`, whose `POST /auth/logout` would revoke whatever refresh cookie the jar holds at that moment, in a two-tab race the other tab's fresh token (see [auth-flow.md § 6](./auth-flow.md#6-token-refresh-silent-mid-session)). The backend has already cleared the cookies with its 401. The original request is then still retried once: a route that admits guests (`GET /auth/me`, `POST /orders`) answers as for a guest, a protected route answers 401 again and, with `_retry` already set, that error is final.

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

### The deliberate catches

The first exists because the caught value is **not** what gets rendered and cached:

1. **`generateMetadata` in `src/app/(root)/[category]/page.tsx`.** `[category]` is the catch-all
   for every unknown top-level path, so a `null` category is marked `robots: noindex` to keep the
   soft-404 out of the index. An upstream outage must not take that branch — the blip would be
   indexed (and ISR-cached) as "not found". `generateMetadata` therefore catches the throw and
   returns a neutral title **without** `noindex`; the page body below it calls `serverFetch` again
   uncaught, throws into the error boundary, and nothing is cached.
2. **`getCategoryNavLinks` in `src/common/utils/navigation.utils.ts`** (Plan-0004 PR-3). A
   different shape from the first, and the reason is scope rather than caching: the call sits
   in `(root)/layout.tsx`, the one server component every storefront page renders through. Letting
   it throw would send `/faq`, `/contacts`, `/offer` and the rest — pages that need nothing from
   the API — into the error boundary because the category endpoint blinked. Navigation is
   decoration on those pages, so it falls back to `FALLBACK_CATEGORY_LINKS` and the menu degrades
   instead of the site failing. Pages that genuinely need the API still fetch it themselves,
   uncaught, and still fail loudly.

3. **`loadStorefrontSettings`** (`common/utils/storefront-settings.server.ts`, Plan-0010 F05/F11) —
   the second shape: `(root)/layout.tsx` reads the settings for the strip above the header, which simply
   is not rendered on an outage, and the catalogue hub for its collections. **The home page does not use
   this catch** (audit 14.11.2026): it calls `readStorefrontSettings`, which throws on an outage like the
   page's first «Новинки» read. The home page is prerendered and kept for an hour, and with the outage
   caught one failed read during a regeneration was cached as a page without its copy, H1 and shelves;
   thrown, the regeneration fails and the previous page stays. Only a 404 (an older backend without
   `/storefront-settings`) or an answer of an unknown shape still drops the blocks — the banner falls back
   to the shop's name and «До каталогу». The catalogue hub (`/catalog`, groups — Plan-0010 P20) has the same
   shape: its strips (`loadStrip`, `common/utils/catalog-strips.server.ts`), tile photos and landings
   (`catalog/catalog-hub.server.ts`) are caught, while the tree it is built from is read uncaught.

4. **`GET /api/catalog-nav/<id>`** (`app/api/catalog-nav/[id]/route.ts`, Plan-0010 D06.5, audit
   31.10) — the first shape in a route handler: the caught failure becomes a `503 {links: []}` with
   `Cache-Control: no-store`, which nothing caches; the menu shows its error and reads the branch again
   on «Спробувати ще» or when it is reopened.

Not a catch but related: the catalogue's cursor walks (`common/utils/catalog-tree.server.ts`) repeat a
walk once with `cache: 'no-store'` on a 409 or a mixed revision, then throw like any upstream failure.

If you find yourself adding another catch, write down which of these shapes it is: the caught value is
not what gets cached, or the call is decoration on pages that do not otherwise need the API.

### Second argument: `init`

`serverFetch(path, init?)` merges `init` into the request, so callers can override
`next.revalidate`, set headers, or pass `next.tags`. The default `revalidate: 3600` applies
when `init.next` is omitted. If you pass an explicit `cache` mode (e.g. `cache: 'no-store'`)
the default revalidate is **not** added — Next treats `cache` + `revalidate` as a conflict and
discards both with a warning.

### `X-Internal-Token`: a server render is not a visitor

The backend rate-limits `GET /products/catalog` at 120 requests per minute **per IP**
(`fillando-be/src/docs/API_AND_SWAGGER.md` §4a). Every server render of the catalogue calls that
endpoint, and every render leaves the container on the same address, so the limit lands on the
storefront's own rendering long before it lands on a scraper: one popular category is enough to
start serving `429`s to ourselves — which `serverFetch` correctly turns into an error page
(see above), so the failure is visible rather than silent, and total.

`serverFetch` therefore sends `X-Internal-Token: $INTERNAL_API_TOKEN` on every call whenever that
variable is set. The backend's `skipIf` (`src/common/guards/internal-request.util.ts`) compares it
against its own `INTERNAL_API_TOKEN` in constant time and exempts the request from every throttle.
Both sides read the same secret from their environment; with no token configured on either side
nothing is exempted and nothing breaks — the variable is optional, and its absence is the previous
behaviour exactly.

Four things about it are load-bearing:

- **It is a server-only variable — never `NEXT_PUBLIC_*`.** A `NEXT_PUBLIC_` name is inlined into
  the client bundle at build time, which would publish a secret that lifts rate limits for anyone
  who reads it. `serverFetch` is safe to hold it because it is imported from server contexts only
  (RSC pages, `generateMetadata`, `sitemap.ts`, `getCategoryNavLinks`); before adding an import,
  check the importer is not a `'use client'` module.
- **It is read per call, not at module load** — unlike `API`, a `NEXT_PUBLIC_` value baked into
  the build. `INTERNAL_API_TOKEN` is injected into the running container (`.env.prod` via
  `env_file`, the same way `REVALIDATE_SECRET` is), so a module-scope read risks being resolved
  against the build environment instead of the runtime one. A blank or whitespace-only value counts
  as unset rather than as an empty token.
- **The caller's own headers survive.** The token is merged through `new Headers(init.headers)`, not
  an object spread, because `init.headers` may be a `Headers` instance or an array of tuples and
  spreading either of those would drop them silently.
- **It changes nothing else.** `null` still means 404 and only 404, the default `revalidate: 3600`
  still applies, and a `429` from anywhere else still throws.

The frontend needs `INTERNAL_API_TOKEN` in `.env` (local) and `.env.prod` (production runtime,
_not_ a `Dockerfile.prod` build arg), matching the backend's value.

### Sitemap: one verified export and one artifact cache

**Since 2026-10-29 (Plan-0010 B05/F10) the sitemap is files.** `src/common/utils/sitemap-files.ts`
reads the backend's index `GET /catalog/sitemap` (`{revision, epoch, parts: [{from, to, urls}]}`) and
each part `GET /catalog/sitemap/part?revision&epoch[&from][&to]` with the index's revision, both with
no-store inside `unstable_cache` (`catalog-sitemap-index-v2`, `catalog-sitemap-part-v2` keyed by the
index and the part number), daily, tagged SITEMAP/PRODUCTS/CATEGORIES as before. Routes:
`src/app/sitemap.xml/route.ts` — while the backend has one part (today's catalogue, below ~20 000 URLs)
the `<urlset>` itself, rendered by Next's own sitemap serializer exactly as the former `sitemap.ts`
metadata route did; with more parts a `<sitemapindex>` of `src/app/sitemap/[part]/route.ts` files
(`/sitemap/<n>.xml`). robots.txt keeps naming `/sitemap.xml`. Home and static pages go into the first
file only, `/catalog` with the categories (also the first), so the files list every URL once. A part
the backend refuses as of another revision (409, the catalogue changed after the cached index) is
served from a fresh index and the cached one is expired. Each backend part stays below 50 000 URLs
and 2 MiB. The paragraphs below describe the single-export version this replaced; validation,
failure and `lastModified` rules are unchanged.

`src/app/sitemap.ts` now fetches `GET /catalog/sitemap` once, with no-store, inside
`unstable_cache` keyed `catalog-sitemap-snapshot-v1`. The backend brackets all three
URL sources with one revision/epoch barrier. The memo remains daily (86400) and
carries SITEMAP/PRODUCTS/CATEGORIES tags. There is no count-key fetch or count fallback.

`buildSitemapEntries` validates the complete export before constructing routes.
Missing endpoint (404), unavailable backend, absent source arrays or malformed
rows throw; none becomes an empty list. An explicitly empty complete export is
valid. Failed regeneration cannot replace the prior complete artifact.

The route is force-dynamic: the Data Cache owns the artifact, without a second
force-static route snapshot or build-time API dependency. Existing invalidation
still expires the memo's tags and the sitemap path. This does not implement the
future purge-ACK gate for visibility changes: a previously verified stale artifact
may be served while a regeneration fails. No automatic HTTP 503 mapping for a cold
Next metadata-route failure is claimed.

URLs retain their legacy structure until redirect-backed migration. lastModified
is emitted only for a valid stored updatedAt; neither absent dates nor static
pages use generation time as a fictitious content edit. Deploy the backend endpoint
before this frontend. Pagination/sitemap splitting and v2 visibility exports remain
pending; this release preserves the existing all-URLs-in-one-document scope.

### On-demand revalidation

A landing-reading fetch carries `CACHE_TAGS.LANDINGS` so `POST /api/revalidate` can drop it when
the admin saves, instead of leaving the editor to wait out the hour. The purge is always
`revalidateTag(tag, { expire: 0 })` — `'max'` is stale-while-revalidate (the first reload still
shows the old copy) and the single-argument form is a build error (the second argument is required). Full mechanism,
tag table, auth posture and limits in [cache-revalidation.md](./cache-revalidation.md).

Two rules that live with the tags rather than with the endpoint:

- **`next.tags` is not part of the fetch cache key.** Two calls to the same URL share one Data
  Cache entry, and whichever renders first writes it with its own tags; the other's are dropped
  without a warning. The two `/landings?category_id=` calls in `[category]/page.tsx` must keep
  identical tag arrays.
- **`unstable_cache` takes its tags on the options object**, not from `keyParts` and not from the
  fetches inside it — those pass `revalidate: 0` and never reach the Data Cache.

### Call sites

| File                                              | Calls                                                                             | Tags       |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- |
| `src/app/(root)/Home.tsx`                         | `/categories`, `/products/catalog?…`                                              | —          |
| `src/app/(root)/[category]/page.tsx`              | `/categories/slug/:slug` (metadata + page), `/products/catalog?…`                 | —          |
| `src/app/(root)/[category]/page.tsx`              | `/landings?category_id=` (metadata canonical **and** page tiles — same URL)       | `landings` |
| `src/app/(root)/[category]/[landing]/page.tsx`    | `/landings/slug/:category/:landing` (metadata + page, via `loadLanding`)          | `landings` |
| `src/app/(root)/[category]/[landing]/page.tsx`    | `/categories/slug/:slug`, `/products/catalog?…`                                   | —          |
| `src/app/(root)/products/[slug]/page.tsx`         | `/products/by-slug/:slug` (metadata + page)                                       | —          |
| `src/app/(root)/search/page.tsx`                  | `/products/search?…`                                                              | —          |
| `src/common/utils/navigation.utils.ts`            | `/categories`                                                                     | —          |
| `src/common/utils/sitemap-files.ts` (`/sitemap.xml`, `/sitemap/<n>.xml`) | `/catalog/sitemap`, `/catalog/sitemap/part` | — (the `unstable_cache` memos carry `sitemap`) |
