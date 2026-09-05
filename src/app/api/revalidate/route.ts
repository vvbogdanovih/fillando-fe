import { timingSafeEqual } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS, REVALIDATE_RESOURCES, type RevalidateResource } from '@/common/constants'

/**
 * Drops the storefront's cached copies of an admin-edited resource, so a save shows on the next
 * reload instead of up to an hour later (`serverFetch` defaults to `revalidate: 3600`).
 *
 * The caller names a **resource** from a closed enum — never a tag, never a path, never a slug.
 * The map below is the entire capability, so nothing a request contains can widen the blast
 * radius; in particular `revalidatePath('/', 'layout')` is unreachable from the outside.
 *
 * Why `{ expire: 0 }` and nothing else, in Next 16.1.4:
 *   revalidateTag(tag)             — `profile` is required by the types; fails `yarn build`
 *                                    under `strict`, and warns at runtime.
 *   revalidateTag(tag, 'max')      — the `max` profile expires a year out, so `areTagsExpired`
 *                                    never fires and only `areTagsStale` does: the next request
 *                                    still serves the OLD body and refreshes behind it. That is
 *                                    the exact symptom this endpoint exists to remove.
 *   updateTag(tag)                 — throws E872 outside a Server Action.
 *   revalidateTag(tag, {expire:0}) — sets `expired = now`; the next render is a hard miss.
 */
const INVALIDATIONS: Record<RevalidateResource, { tags: string[]; paths: string[] }> = {
	landings: {
		tags: [CACHE_TAGS.LANDINGS, CACHE_TAGS.SITEMAP],
		// /sitemap.xml needs both halves: the tag expires the memoised entry list (keyed on the
		// product-variant count, which a landing edit never moves), and the path expires the
		// force-static route's own daily render. Purging one leaves the sitemap up to ~48h stale.
		paths: ['/sitemap.xml']
	}
}

const isResource = (value: unknown): value is RevalidateResource =>
	typeof value === 'string' && (REVALIDATE_RESOURCES as readonly string[]).includes(value)

const json = (body: unknown, status: number) =>
	Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST only. Next answers 405 for the other verbs on its own, and that matters: a GET purge
 * would be triggerable by an `<img src>` on any page on the internet.
 */
export async function POST(request: Request) {
	// Read per request, not at module scope: an unset secret has to fail closed on the request
	// itself, and the tests can then stub the env per case.
	const secret = process.env.REVALIDATE_SECRET?.trim() || undefined
	const isProduction = process.env.NODE_ENV === 'production'

	// Cross-origin JavaScript cannot send `application/json` without a preflight, and this route
	// answers none — there is no `Access-Control-*` header and no `OPTIONS` export in this file.
	// Adding either silently removes the protection.
	if (!request.headers.get('content-type')?.includes('application/json')) {
		return json({ error: 'Expected application/json' }, 415)
	}

	// Friction, not a boundary — curl sends no Origin and is meant to work. Compared against the
	// request's own Host and not against SITE_URL, because `.env` sets SITE_URL to
	// https://fillando.com even locally, so a SITE_URL comparison would reject every dev request.
	const origin = request.headers.get('origin')
	if (origin) {
		const host = request.headers.get('host')
		let originHost: string | null = null
		try {
			originHost = new URL(origin).host
		} catch {
			originHost = null
		}
		if (!host || originHost !== host) {
			console.warn('[revalidate] rejected: foreign origin')
			return json({ error: 'Forbidden' }, 403)
		}
	}

	if (secret) {
		const provided = Buffer.from(request.headers.get('x-revalidate-secret') ?? '')
		const expected = Buffer.from(secret)
		// `timingSafeEqual` throws on unequal lengths, so the length is compared first.
		if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
			console.warn('[revalidate] rejected: bad secret')
			return json({ error: 'Unauthorized' }, 401)
		}
	} else if (isProduction) {
		// No secret configured and no way for a browser to hold one: refuse rather than leave an
		// unauthenticated cache-buster open on fillando.com.
		console.error('[revalidate] REVALIDATE_SECRET is not set — endpoint disabled')
		return json({ error: 'Revalidation is not configured' }, 503)
	}

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return json({ error: 'Malformed JSON body' }, 400)
	}

	const resource = (body as { resource?: unknown } | null)?.resource
	if (!isResource(resource)) {
		return json({ error: 'Unknown resource' }, 400)
	}

	const { tags, paths } = INVALIDATIONS[resource]
	for (const tag of tags) revalidateTag(tag, { expire: 0 })
	for (const path of paths) revalidatePath(path)

	console.info(`[revalidate] ${resource} → tags ${tags.join(', ')} + paths ${paths.join(', ')}`)
	return json({ revalidated: true, resource, tags, paths }, 200)
}
