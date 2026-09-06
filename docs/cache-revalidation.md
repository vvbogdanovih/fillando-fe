# On-demand cache revalidation

`serverFetch` caches backend responses for an hour (`revalidate: 3600`). That is right for a
shop, and wrong for the person editing it: text saved in `/admin/landings` did not appear on the
storefront until the window lapsed, and the only workaround was restarting the dev server. Reading
through fourteen landings that way is not possible.

`POST /api/revalidate` drops the cached copies so the next reload is fresh.

---

## The flow

```
admin saves a landing
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
publish, unpublish and delete all arrive through the same save mutation, so a single string
covers all of them: no old-slug/new-slug tuple to carry, and no dependency on the `['categories']`
query that still renders «…» while it resolves.

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

| Tag        | Attached at                                                                                                | Feeds                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `landings` | `(root)/[category]/[landing]/page.tsx` — `loadLanding`, covering both `generateMetadata` and the page body | the landing H1, intro, SEO text and FAQ                                 |
| `landings` | `(root)/[category]/page.tsx` `generateMetadata` — `/landings?category_id=`                                 | the canonical that points a filtered listing at the landing covering it |
| `landings` | `(root)/[category]/page.tsx` page body — `/landings?category_id=`                                          | the «Популярні види» tiles                                              |
| `sitemap`  | `sitemap.ts` — the **`unstable_cache` options object**, third argument                                     | the memoised entry list                                                 |

Deliberately untagged: `/categories*` (a landing save cannot change a category), the landing
route's `/products/catalog?…` (the pinned filters are spliced into the query string, so a filter
edit produces a cold cache key and the grid is fresh by construction), and everything under
`/products`. The sitemap's inner `serverFetch` calls pass `revalidate: 0` and never reach the Data
Cache, so a tag on them would be inert — it has to sit on the `unstable_cache` options, because
`keyParts` are not tags.

### Identical URLs must carry identical tag arrays

`next.tags` is **not** part of the fetch cache key. Two `serverFetch` calls to the same URL share
one Data Cache entry; whichever renders first writes it with its own tags, and the second call's
tags are silently discarded. There is no warning and no test that can catch it.

One pair is affected today: the two `/landings?category_id=` fetches in `[category]/page.tsx`.
Both carry `[CACHE_TAGS.LANDINGS]` and nothing else. Do not "improve" one of them.

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
`fillando-be/src/docs/STOREFRONT_REVALIDATION.md`). The call is fire-and-forget on its side — a
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
- **Categories, products, colours are out of scope.** Each is a wider blast radius with a weaker
  hook, and each needs its own design.
- **Fast Refresh is not a reload.** Next consults a separate HMR cache in dev; proofread with a
  real browser reload.

## Adding a resource

Edit three places together, or the tag will not bite: `cache-tags.constants.ts` (the string),
the `serverFetch` call sites that read it (the `next.tags`), and `INVALIDATIONS` in the route
handler (the purge).
