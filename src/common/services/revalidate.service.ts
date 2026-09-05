import { UI_URLS, type RevalidateResource } from '@/common/constants'

/**
 * Asks the Next server to drop its cached storefront copies of `resource`, so an admin save is
 * visible on the next reload instead of up to an hour later.
 *
 * Bare same-origin `fetch`, never `httpService` — the same documented bypass as the S3 PUT in
 * `entity-image.service.ts`, for three separate reasons: `httpService`'s `baseURL` is the
 * absolute NestJS URL, so a root-relative path would land on the API host and 404; its
 * 401 → /auth/refresh → retry interceptor is wrong for a Next route, where a 401 means «no
 * secret configured», not «session expired»; and `withCredentials: true` would ship the backend
 * session cookie to the Next origin for no reason.
 *
 * Development only, deliberately. In production the endpoint requires a secret that a browser
 * cannot hold, so the call is compiled out rather than sent and refused — `process.env.NODE_ENV`
 * is inlined at build time. The production trigger is meant to be server-to-server; see
 * docs/cache-revalidation.md.
 *
 * Never rejects. The entity is already saved by the time this runs, and a missed purge costs
 * only the old one-hour wait — it must never be able to turn a successful save into a failed one.
 */
export async function revalidateStorefront(resource: RevalidateResource): Promise<void> {
	if (process.env.NODE_ENV === 'production') return
	try {
		const res = await fetch(UI_URLS.API.REVALIDATE, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ resource }),
			credentials: 'omit',
			// Nothing awaits this, so `keepalive` is what lets the purge still go out if the
			// admin closes the tab or hard-navigates right after saving. The body is a few dozen
			// bytes, far under the 64 KB keepalive cap.
			keepalive: true
		})
		if (!res.ok) console.warn(`[revalidate] refused: ${res.status}`)
	} catch (error) {
		console.warn('[revalidate] failed', error)
	}
}
