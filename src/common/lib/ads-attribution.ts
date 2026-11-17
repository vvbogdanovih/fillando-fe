import { useConsentStore, type ConsentStatus } from '@/common/store/useConsentStore'

/**
 * First-party data for Google Ads measurement (owner, 2026-11-16): the click identifier a
 * visitor arrived with, and the contact of the order just placed. Both follow one rule — nothing
 * is written to storage and nothing is sent without `consent === 'granted'`.
 */

export type ClickIds = { gclid?: string; gbraid?: string; wbraid?: string }

const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid'] as const
/** URL-safe base64, as Google issues them — the backend validates the same shape. */
const CLICK_ID = /^[A-Za-z0-9_-]{1,512}$/
const CLICK_IDS_KEY = 'fillando-click-ids'
/** Google Ads attributes a conversion to a click for at most 90 days. */
const CLICK_ID_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** Click ids seen in this page load, held in memory until the visitor answers the banner. */
let pending: ClickIds | null = null

export function parseClickIds(search: string): ClickIds | null {
	const params = new URLSearchParams(search)
	const ids: ClickIds = {}
	for (const name of CLICK_ID_PARAMS) {
		const value = params.get(name)
		if (value && CLICK_ID.test(value)) ids[name] = value
	}
	return Object.keys(ids).length > 0 ? ids : null
}

/** Called once per page load with the landing URL's query. */
export function captureClickIds(search: string) {
	pending = parseClickIds(search) ?? pending
}

/**
 * Applies the banner's answer: «Прийняти» moves the ids of this visit into `localStorage` (a
 * newer click replaces an older one), «Лише необхідні» removes whatever was kept — here and in
 * the tag's own cookies and storage.
 */
export function syncClickIdsWithConsent(status: ConsentStatus) {
	if (status === 'unknown') return
	try {
		if (status === 'denied') {
			pending = null
			window.localStorage.removeItem(CLICK_IDS_KEY)
			clearTagStorage()
			return
		}
		if (!pending) return
		window.localStorage.setItem(CLICK_IDS_KEY, JSON.stringify({ ...pending, at: Date.now() }))
		pending = null
	} catch {
		// Storage unavailable: the ids of this page load stay in memory, which still serves a
		// purchase made without leaving the tab.
	}
}

/** What gtag.js writes under consent: the click id (`_gcl_*`, `_gac_*`) and GA4's (`_ga*`). */
const TAG_ENTRY = /^(_gcl_|_gac_|_ga(_|$))/

/**
 * Removes what the tag stored when consent is withdrawn. gtag.js does not delete it itself: in
 * the stand check of 2026-11-17 a conversion sent after «Лише необхідні» still carried the click
 * id — first from the `_gcl_aw` cookie, then from the tag's `_gcl_ls` entry in `localStorage`.
 * «We do not keep them» is only true if both are removed here. gtag.js sets its cookies on the
 * widest domain it can, hence every parent domain is tried. Writes nothing when there is nothing
 * to remove, which is every page load of a visitor who declined.
 */
export function clearTagStorage() {
	for (const key of Object.keys(window.localStorage)) {
		if (TAG_ENTRY.test(key)) window.localStorage.removeItem(key)
	}
	const names = document.cookie
		.split(';')
		.map(cookie => cookie.split('=')[0].trim())
		.filter(name => TAG_ENTRY.test(name))
	if (names.length === 0) return
	const labels = window.location.hostname.split('.')
	const domains = labels
		.map((_, index) => labels.slice(index).join('.'))
		.filter(domain => domain.includes('.'))
	for (const name of names) {
		document.cookie = `${name}=; Max-Age=0; path=/`
		for (const domain of domains) {
			document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`
		}
	}
}

function storedClickIds(now: number): ClickIds {
	try {
		const raw = window.localStorage.getItem(CLICK_IDS_KEY)
		const stored: unknown = raw ? JSON.parse(raw) : null
		if (!stored || typeof stored !== 'object') return {}
		const { at, ...rest } = stored as { at?: unknown } & Record<string, unknown>
		if (typeof at !== 'number' || now - at > CLICK_ID_TTL_MS) return {}
		const ids: ClickIds = {}
		for (const name of CLICK_ID_PARAMS) {
			const value = rest[name]
			if (typeof value === 'string' && CLICK_ID.test(value)) ids[name] = value
		}
		return ids
	} catch {
		return {}
	}
}

export type OrderAttribution = { consent: ConsentStatus } & ClickIds

/** What `POST /orders` records about the visit; click ids only for a consenting buyer. */
export function orderAttribution(now = Date.now()): OrderAttribution {
	const consent = useConsentStore.getState().status
	if (consent !== 'granted') return { consent }
	return { consent, ...(pending ?? storedClickIds(now)) }
}

export type OrderContact = { email: string; phone_number: string }

const ORDER_CONTACT_KEY = 'fillando-order-contact'

/**
 * Keeps the buyer's contact for the success page, which reports it to Google Ads as enhanced
 * conversion data. `sessionStorage`, because the LiqPay path leaves the site and comes back as a
 * new page load in the same tab; written only for a consenting buyer.
 */
export function rememberOrderContact(
	orderNumber: string,
	customer: { email: string; phone: string }
) {
	if (useConsentStore.getState().status !== 'granted') return
	try {
		window.sessionStorage.setItem(
			ORDER_CONTACT_KEY,
			JSON.stringify({
				order: orderNumber,
				email: customer.email.trim().toLowerCase(),
				phone_number: customer.phone.trim()
			})
		)
	} catch {
		// Storage unavailable: the conversion is reported without the contact.
	}
}

/** The contact kept for `orderNumber`, removed as it is read; null without consent. */
export function takeOrderContact(orderNumber: string): OrderContact | null {
	try {
		const raw = window.sessionStorage.getItem(ORDER_CONTACT_KEY)
		if (!raw) return null
		const stored = JSON.parse(raw) as Partial<OrderContact> & { order?: unknown }
		if (stored.order !== orderNumber) return null
		window.sessionStorage.removeItem(ORDER_CONTACT_KEY)
		if (useConsentStore.getState().status !== 'granted') return null
		if (typeof stored.email !== 'string' || typeof stored.phone_number !== 'string') return null
		return { email: stored.email, phone_number: stored.phone_number }
	} catch {
		return null
	}
}

/** Test seam: forget the ids held in memory. */
export function resetPendingClickIds() {
	pending = null
}
