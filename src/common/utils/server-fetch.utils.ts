const API = process.env.NEXT_PUBLIC_API_BASE_URL!

/**
 * The header the backend's rate limiter exempts — `isInternalRequest` in
 * `fillando-be/src/common/guards/internal-request.util.ts` compares it against
 * `INTERNAL_API_TOKEN` in constant time (see that repo's `src/docs/API_AND_SWAGGER.md` §4a).
 */
const INTERNAL_TOKEN_HEADER = 'X-Internal-Token'

type ServerFetchInit = RequestInit & {
	next?: { revalidate?: number | false; tags?: string[] }
}

/**
 * Server-side fetch against the backend for RSC pages and metadata routes.
 *
 * Resolves to `null` **only** when upstream answers 404 — the resource is
 * genuinely absent and the caller may `notFound()` / render an empty state.
 * Anything else (429, 5xx, network error) throws, so the route's error boundary
 * renders instead of a 200 "not found" page that ISR would then cache for the
 * whole revalidate window. Don't catch-and-null the throw at a call site unless
 * that page really should render (and be cached) without the data.
 *
 * Defaults to `next: { revalidate: 3600 }`; `init.next` is merged over that and
 * the rest of `init` is passed through untouched.
 *
 * Identifies itself to the backend with `X-Internal-Token` when `INTERNAL_API_TOKEN` is set, so
 * server renders are not counted against the per-IP rate limits. Optional: without it every call
 * behaves exactly as before.
 */
export async function serverFetch<T>(path: string, init?: ServerFetchInit): Promise<T | null> {
	// An explicit `cache` mode (e.g. 'no-store') conflicts with `next.revalidate` — Next drops
	// both with a warning — so the default revalidate is only applied when no mode is given.
	const request: ServerFetchInit = {
		...init,
		next: init?.cache ? init.next : { revalidate: 3600, ...init?.next }
	}

	// Every server render leaves the container on one address, so the 120/min per-IP limit on
	// `GET /products/catalog` would throttle the storefront's own renders of a popular category
	// long before it throttled a scraper. `INTERNAL_API_TOKEN` is the backend's `skipIf` bypass.
	// Read per call (like `REVALIDATE_SECRET`), not at module scope: production injects it into
	// the running container rather than into the build. It must never be `NEXT_PUBLIC_*` — this
	// module is imported from server contexts only (RSC, `generateMetadata`, `sitemap.ts`), so
	// the value never reaches the browser bundle.
	const internalToken = process.env.INTERNAL_API_TOKEN?.trim() || undefined
	if (internalToken) {
		// `Headers` rather than an object spread: `init.headers` may be a `Headers` instance or
		// an array of tuples, and spreading either of those would silently drop the caller's.
		const headers = new Headers(init?.headers)
		headers.set(INTERNAL_TOKEN_HEADER, internalToken)
		request.headers = headers
	}

	const res = await fetch(`${API}${path}`, request)
	if (res.status === 404) return null
	if (!res.ok) throw new Error(`Upstream ${res.status} for ${path}`)
	return res.json() as Promise<T>
}
