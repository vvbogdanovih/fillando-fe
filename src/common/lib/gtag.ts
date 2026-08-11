declare global {
	interface Window {
		dataLayer?: unknown[]
		gtag?: (...args: unknown[]) => void
	}
}

/**
 * Queue a gtag call without requiring gtag.js to have loaded.
 *
 * `window.dataLayer` is a plain array that gtag.js drains on startup, so pushing to
 * it is safe at any point — before the script loads, or while it is gated behind
 * cookie consent. Calling `window.gtag(...)` directly is not: if the tag has not
 * arrived yet the event is silently dropped.
 */
// The rest parameter exists only to type call sites; the body must push the real
// `arguments` object, which stays available alongside it.
export function gtag(..._args: unknown[]) {
	if (typeof window === 'undefined') return
	window.dataLayer = window.dataLayer ?? []
	// gtag.js inspects the `arguments` object's semantics, so the pushed value must
	// be an actual Arguments — a plain array is serialised differently and ignored.
	// eslint-disable-next-line prefer-rest-params
	window.dataLayer.push(arguments)
}
