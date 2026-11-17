import { GOOGLE_ANALYTICS_ID } from '@/common/constants/analytics.constants'
import { gtag } from './gtag'

/**
 * GA4 ecommerce events for Performance Max (TD-0006 §5.5). Thin, typed wrappers over the
 * queued `gtag()` — never `window.gtag` — so an event fired before the tag loads is kept.
 *
 * Every helper is a no-op until a GA4 property id is configured: without one the events would
 * only reach the Ads tag, which does not understand them and would log noise.
 *
 * `purchase` is aggregated on purpose (no `items[]`): the success page is reached by two
 * different redirects and the cart is already cleared by then, so the line items are not
 * reliably available. Value, currency and transaction id are what value-based bidding needs.
 */

export type Ga4Item = {
	/**
	 * The SKU — the Merchant feed's `g:id` — on every event, so GA4 joins the funnel and Ads
	 * matches the catalogue. Omitted (GA4 then keys on `item_name`) only for a guest cart line
	 * stored before lines carried their SKU; never the Mongo variant id.
	 */
	item_id?: string
	item_name: string
	price: number
	quantity?: number
	item_brand?: string
	item_category?: string
}

const CURRENCY = 'UAH'

const enabled = () => Boolean(GOOGLE_ANALYTICS_ID)

const round = (value: number) => Math.round(value * 100) / 100

export const trackViewItem = (item: Ga4Item) => {
	if (!enabled()) return
	gtag('event', 'view_item', {
		currency: CURRENCY,
		value: round(item.price),
		items: [{ ...item, quantity: item.quantity ?? 1 }]
	})
}

export const trackAddToCart = (item: Ga4Item) => {
	if (!enabled()) return
	const quantity = item.quantity ?? 1
	gtag('event', 'add_to_cart', {
		currency: CURRENCY,
		value: round(item.price * quantity),
		items: [{ ...item, quantity }]
	})
}

export const trackBeginCheckout = (params: { value: number; items: Ga4Item[] }) => {
	if (!enabled()) return
	gtag('event', 'begin_checkout', {
		currency: CURRENCY,
		value: round(params.value),
		items: params.items
	})
}

export const trackPurchase = (params: { transaction_id: string; value?: number }) => {
	if (!enabled()) return
	gtag('event', 'purchase', {
		transaction_id: params.transaction_id,
		currency: CURRENCY,
		...(params.value !== undefined ? { value: round(params.value) } : {})
	})
}

const TRACKED_ORDERS_KEY = 'fillando-tracked-orders'

/**
 * Whether this browser already reported the purchase of `orderNumber`, recording it if not.
 * A reload, the back button or the e-mail link back to `/checkout/success` would otherwise send
 * the Ads conversion and the GA4 purchase again; `transaction_id` deduplication is a safety net
 * on Google's side, not a reason to send twice. Storage that throws (private mode, blocked site
 * data) answers «not yet», so the event is never lost — at worst it repeats, as before.
 */
export const claimPurchaseTracking = (orderNumber: string): boolean => {
	try {
		const raw = window.localStorage.getItem(TRACKED_ORDERS_KEY)
		const seen: unknown = raw ? JSON.parse(raw) : []
		const list = Array.isArray(seen) ? seen.filter(item => typeof item === 'string') : []
		if (list.includes(orderNumber)) return false
		window.localStorage.setItem(
			TRACKED_ORDERS_KEY,
			JSON.stringify([...list, orderNumber].slice(-50))
		)
	} catch {
		// Storage unavailable: report, as before this guard existed.
	}
	return true
}
