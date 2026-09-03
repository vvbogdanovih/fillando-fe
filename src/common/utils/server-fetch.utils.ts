const API = process.env.NEXT_PUBLIC_API_BASE_URL!

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
 */
export async function serverFetch<T>(path: string, init?: ServerFetchInit): Promise<T | null> {
	// An explicit `cache` mode (e.g. 'no-store') conflicts with `next.revalidate` — Next drops
	// both with a warning — so the default revalidate is only applied when no mode is given.
	const res = await fetch(`${API}${path}`, {
		...init,
		next: init?.cache ? init.next : { revalidate: 3600, ...init?.next }
	})
	if (res.status === 404) return null
	if (!res.ok) throw new Error(`Upstream ${res.status} for ${path}`)
	return res.json() as Promise<T>
}
