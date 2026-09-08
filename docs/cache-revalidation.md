# On-demand cache revalidation

`serverFetch` caches backend responses for an hour (`revalidate: 3600`). That is right for a
shop, and wrong for the person editing it: text saved in `/admin/landings` did not appear on the
storefront until the window lapsed, and the only workaround was restarting the dev server. Reading
through fourteen landings that way is not possible.

`POST /api/revalidate` drops the cached copies so the next reload is fresh.

---

## The flow

```
admin saves a landing                          (or the backend saves a product / a category)
  → LandingForm.onSuccess          (or LandingTable's delete onSuccess)
  → revalidateStorefront('landings')            common/services/revalidate.service.ts
  → POST /api/revalidate {"resource":"landings"}
  → revalidateTag('landings', { expire: 0 })    the landing fetches
    revalidateTag('sitemap',  { expire: 0 })    the sitemap's memoised entry list
    revalidatePath('/sitemap.xml')              the sitemap route's own daily render
```

The caller names a **resource**, never a tag, a path or a slug. `INVALIDATIONS` in
`src/app/api/revalidate/route.ts` is the entire capability, so nothing a request contains can
widen the blast radius — in particular `revalidatePath('/', 'layout')` is unreachable from
outside.

That is also why one coarse tag beats a per-slug one. Create, edit, rename, category move,
publish, unpublish, archive and delete all arrive through the same save mutation, so a single
string covers all of them: no old-slug/new-slug tuple to carry, and no dependency on the
`['categories']` query that still renders «…» while it resolves.

### The three resources, and what each one drops

| Resource     | Tags                   | Paths          | Why those and nothing more                                                                                                                                                                                                                              |
| ------------ | ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `landings`   | `landings`, `sitemap`  | `/sitemap.xml` | Unchanged from the first version of this endpoint.                                                                                                                                                                                                      |
| `products`   | `products`, `landings` | `/sitemap.xml` | `landings` as well, because the «Популярні види» tiles print `product_count`, which is read from `/landings?category_id=` and not from any product entry. The sitemap memo carries `products` itself, for a created or archived variant's URL.          |
| `categories` | `categories`           | `/sitemap.xml` | One tag covers the category doc read by `/[category]`, the `/categories` list the storefront menu is built from, and the sitemap memo's category URLs. It does **not** touch `products`: renaming a category does not change a price or a stock figure. |

Why the boundary sits there. A `products` purge has to reach everything a crawler and Google
Merchant read as rendered HTML — the price, the availability, the archive flag and the name in
the SSR body, in the `Product` JSON-LD and in the metadata (including an archived variant's
`noindex`) — because the browser repairs those with a client re-fetch and neither of those two
does. Merchant drops offers over exactly that mismatch between a page and the feed. It stops
short of the colour dictionary and of anything under `/orders`: a colour rename reaches a card
title through the product read that renders it, and the dictionary itself is not fetched on the
server.

### A bulk write arrives as one call

A purge carries no identifier and is idempotent, so the backend coalesces a batch — a Prom
sync, a price import, a category reorder — into a **single** POST per resource. This handler may
legitimately be asked to purge `products` once for three hundred changed variants, and must not
grow a per-id parameter to "optimise" that: a tag purge costs one map write, and the batch is
the case the coarse tag was chosen for.

---

## `{ expire: 0 }`, and nothing else

Next 16.1.4. Three of the four ways to write this call are wrong, and two of them fail silently.

| Call                                | What happens                                                                                                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `revalidateTag(tag)`                | `profile` is **required** by the types — TS2554, so `yarn build` fails regardless of `strict`. It also warns at runtime.                                                                                                                            |
| `revalidateTag(tag, 'max')`         | The `max` profile expires a year out, so `areTagsExpired` never fires and only `areTagsStale` does — stale-while-revalidate. **The first reload after a save still shows the old copy**, which is the exact symptom this endpoint exists to remove. |
| `updateTag(tag)`                    | Throws `E872` outside a Server Action.                                                                                                                                                                                                              |
| `revalidateTag(tag, { expire: 0 })` | Sets `expired = now`; the next render is a hard, blocking miss. **This one.**                                                                                                                                                                       |

Verified on a production build with `NEXT_PRIVATE_DEBUG_CACHE=1`: a plain request logs
`FileSystemCache: get <key> [ 'landings' ] FETCH true` and nothing else, and a request after a
purge logs `expired tags` followed by `set` — the backend really is re-queried, in-request.

---

## The tags

| Tag          | Attached at                                                                                                | Feeds                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `landings`   | `(root)/[category]/[landing]/page.tsx` — `loadLanding`, covering both `generateMetadata` and the page body | the landing H1, intro, SEO text and FAQ                                                     |
| `landings`   | `(root)/[category]/page.tsx` `generateMetadata` — `/landings?category_id=`                                 | the canonical that points a filtered listing at the landing covering it                     |
| `landings`   | `(root)/[category]/page.tsx` page body — `/landings?category_id=`                                          | the «Популярні види» tiles, including their `product_count`                                 |
| `products`   | `(root)/products/[slug]/page.tsx` — **both** `serverFetch` calls, one URL                                  | the price, the stock, the name, the `Product` JSON-LD, the title and the archived `noindex` |
| `products`   | `(root)/[category]/page.tsx` page body — `/products/catalog?…`                                             | the SSR grid, its prices and the facet counts                                               |
| `categories` | `(root)/[category]/page.tsx` — **both** `/categories/slug/<slug>` calls, one URL                           | the category name in the H1 and the title, and the dimension set the sidebar renders        |
| `sitemap`    | `sitemap.ts` — the **`unstable_cache` options object**, third argument                                     | the memoised entry list; `landings`' handle on it                                           |
| `products`   | `sitemap.ts` — same options object                                                                         | the product URLs a created or archived variant adds or drops                                |
| `categories` | `sitemap.ts` — same options object                                                                         | the category URLs                                                                           |

The sitemap memo lists one tag per data source it embeds, so the handler purges its own resource
tag and never has to know which memos exist. Its inner `serverFetch` calls pass `revalidate: 0`
and never reach the Data Cache, so a tag on them would be inert — it has to sit on the
`unstable_cache` options, because `keyParts` are not tags.

Deliberately untagged: the colour dictionary (`/colors*` — never read on the server; a colour
rename reaches a card through the product read that renders it), `/orders*` and everything the
admin fetches client-side through `httpService`, which does not touch the Data Cache at all.

### Identical URLs must carry identical tag arrays

`next.tags` is **not** part of the fetch cache key. Two `serverFetch` calls to the same URL share
one Data Cache entry; whichever renders first writes it with its own tags, and the second call's
tags are silently discarded. There is no warning and no test that can catch it.

Four groups are affected today, and every member of a group must carry the **same** array:

| URL                        | Call sites                                                                                                  | The array      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| `/landings?category_id=`   | `[category]/page.tsx` — `generateMetadata` and the page body                                                | `[LANDINGS]`   |
| `/products/by-slug/<slug>` | `products/[slug]/page.tsx` — `generateMetadata` and the page body                                           | `[PRODUCTS]`   |
| `/categories/slug/<slug>`  | `[category]/page.tsx` ×2, **and `[category]/[landing]/page.tsx`** for the same category                     | `[CATEGORIES]` |
| `/products/catalog?…`      | `[category]/page.tsx`, the landing route, `Home.tsx` — the query strings coincide more often than they look | `[PRODUCTS]`   |
| `/categories`              | `common/utils/navigation.utils.ts` (`getCategoryNavLinks`), `Home.tsx`                                      | `[CATEGORIES]` |

The last three cross file boundaries, which is what makes them dangerous: an untagged call to a
URL a tagged call also makes is not a missed refresh, it is a **silent hole** — whichever render
happens first writes the shared entry, and if that one passed no tags the purge has nothing to
match and the tagged page stays stale for the full hour. The two `/products/catalog` cases are
easy to dismiss and should not be: `[category]/page.tsx` emits
`category_id=…&limit=8&sort=newest` for `/filament?limit=8&sort=newest`, byte-identical to what
`Home.tsx` builds, and a landing pinning the only filter in the query string produces the same
string as the bare category page with that filter. Do not "improve" one member of a group.

> The three cross-file members — `[category]/[landing]/page.tsx`, `Home.tsx` and
> `getCategoryNavLinks` in `common/utils/navigation.utils.ts` — are the open half of this change
> (Plan-0005 I-h). Until each carries the array its group names, a `categories` purge does not
> reach the storefront menu, and a first render through the landing route or the home page can
> claim the shared entry untagged.

`/sitemap.xml` needs both halves of its purge: the tag expires the memoised entry list (keyed on
the product-variant count, which a landing edit never moves) and the path expires the
`force-static` route's own 86400s render. Purging one leaves the sitemap up to ~48h stale.

---

## Auth, and why it is shaped like this

The backend sets both auth cookies with **no `domain` option**
(`fillando-be/src/modules/auth/auth.controller.ts`), so they are host-only on the API host. The
Next server therefore has no way to recognise an admin — there is no session for it to read. The
endpoint is capability-narrow first and secret-authenticated second:

| Situation               | Behaviour                                                                    |
| ----------------------- | ---------------------------------------------------------------------------- |
| `REVALIDATE_SECRET` set | `x-revalidate-secret` must match (timing-safe). Otherwise 401.               |
| Unset, not production   | Allowed. This is the localhost case, and it needs no setup.                  |
| Unset, production       | **503.** Fail closed rather than leave an unauthenticated cache-buster open. |

The browser caller is development-only and compiled out of production builds
(`process.env.NODE_ENV` is inlined), because a browser cannot hold a server-only secret. So on
`fillando.com` today, landing copy still takes up to an hour — the same as before this change, not
a regression.

The `Content-Type: application/json` requirement is the CSRF control: cross-origin JavaScript
cannot send it without a preflight, and this route answers none. Adding an `OPTIONS` export or any
`Access-Control-*` header silently removes that protection. The `Origin`-vs-`Host` comparison is
friction, not a boundary — curl sends no `Origin` and is meant to work. It is compared against the
request's own `Host` rather than `SITE_URL`, because `.env` sets `SITE_URL` to
`https://fillando.com` even locally.

There is **no rate limiter**, deliberately: in production the endpoint answers 503 or 401 before
touching any cache, and in development it is localhost.

### Turning it on in production

The production trigger is server-to-server, not the browser, and **the backend now makes the
call**: `LandingService` in `fillando-be` POSTs this endpoint after every landing create, update
and delete, with `x-revalidate-secret` taken from its own `REVALIDATE_SECRET` (see
`fillando-be/src/docs/STOREFRONT_REVALIDATION.md`). The product and category services send
`products` and `categories` the same way — one call per write, and one call per batch for a bulk
import. The call is fire-and-forget on its side — a
failure is a warning in the backend log, never a failed save. To turn it on: set the **same**
`REVALIDATE_SECRET` (≥32 chars) in `.env.prod` here and in the backend's environment. Nothing
else on the frontend changes.

Never name it `NEXT_PUBLIC_*`. `PrivateRoute` is a client-side UX guard, so admin chunks are
served to unauthenticated visitors — a `NEXT_PUBLIC_` secret is not a secret. It must not go into
`Dockerfile.prod` (`ARG`/`ENV` bakes it into an image layer) or into `docker-compose.prod.yml`
`build.args`.

---

## Known limits

- **One replica only.** `tagsManifest` is a per-process in-memory `Map` and no `cacheHandler` is
  configured, so a purge reaches only the replica that served the POST. Production is a single
  container today; **if the Railway migration scales past one replica this silently stops
  working**, and the fix is a shared `cacheHandler`, not more purge calls.
- **Not durable across restarts.** The manifest is memory-only; a restart reverts entries to the
  1h TTL. Self-healing and harmless.
- **Does not touch Cloudflare's edge cache**, and does not make Google re-crawl.
- **Colours are out of scope**, and orders always were. The colour dictionary is never read
  through `serverFetch`, so there is no entry to tag; a renamed colour surfaces through the
  `products` purge, because `variantLabel` resolves the name from the product read.
- **A purge reaches the Data Cache, not the browser.** A shopper already on a stale page keeps it
  until they reload; React Query's client re-fetch is what corrects them, and it is also why
  this endpoint exists for the two readers that have no client — the crawler and Merchant.
- **Fast Refresh is not a reload.** Next consults a separate HMR cache in dev; proofread with a
  real browser reload.

## Adding a resource

Edit four places together, or the tag will not bite:

1. `cache-tags.constants.ts` — the tag string, and the name in `REVALIDATE_RESOURCES`.
2. **Every** `serverFetch` call site that reads it (`next.tags`), plus any `unstable_cache` memo
   that embeds it (tags on the options object).
3. `INVALIDATIONS` in the route handler — the purge.
4. The identical-URL table above, if the new tag lands on a URL another call site also fetches.

Step 2 is the one that fails silently. `grep` the URL, not the tag: a call site you missed shares
the cache entry and can write it without tags.
