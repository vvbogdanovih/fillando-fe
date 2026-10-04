/** The one zone the shop lives in; every date shown to people is printed in it. */
export const SHOP_TIME_ZONE = 'Europe/Kyiv'

/** Product price in ₴, grouped the Ukrainian way and without kopecks: `2 610 ₴`. */
export const formatUah = (value: number): string => `${value.toLocaleString('uk-UA')} ₴`

/**
 * Caption for the price of a product that is out of stock.
 *
 * Prices come from the vendor's Prom listing, and an unavailable item is priced from the last
 * discount Prom reported for it — so the figure is a real price, just not one that can be checked
 * against the vendor right now. Naming the date it was last confirmed keeps that honest instead of
 * presenting a stale number as current.
 */
export const formatPriceAsOf = (value: string | Date | null | undefined): string | null => {
	if (!value) return null

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null

	return `ціна на ${date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}`
}

/**
 * The price fields every public variant, catalogue item and cart line carries (TD-0012). The
 * three promo fields are null — or, from an older backend, absent — without an active promotion;
 * the sale price is derived server-side and never stored, so it is the server's number to trust.
 */
export interface PromoPriced {
	price: number
	sale_price?: number | null
	promo_percent?: number | null
	promo_ends_at?: string | null
}

/**
 * Whether the promotion is on. Without a clock this trusts the server: it already nulls the
 * trio once a promo ends, and the storefront renders on the server and hydrates in the browser
 * — two clocks that disagree around the end minute would print two different prices and trip a
 * hydration mismatch. The product's JSON-LD trusts the same snapshot as its visible price.
 * Pass `now` for a guest cart line captured into localStorage before the end date and read
 * after it; guest data is only restored after hydration.
 */
export const isPromoActive = (item: PromoPriced, now?: number): boolean =>
	item.sale_price != null &&
	item.sale_price < item.price &&
	(now === undefined || !item.promo_ends_at || Date.parse(item.promo_ends_at) > now)

/** The one figure a shopper pays. Every storefront price goes through here, never `price` alone. */
export const effectivePrice = (item: PromoPriced, now?: number): number =>
	isPromoActive(item, now) ? (item.sale_price as number) : item.price

/** «−15 %» — a real minus sign (U+2212). Null without an active promotion. */
export const promoPercentLabel = (item: PromoPriced, now?: number): string | null =>
	isPromoActive(item, now) && item.promo_percent != null ? `−${item.promo_percent} %` : null

/**
 * «до 14.08» — when the promotion ends; null for an open-ended one or a bad date. Always in the
 * shop's zone: these components render on the server (UTC) and hydrate in the browser, and the
 * two must print the same day, which is also the day the admin entered.
 */
export const formatPromoEndsAt = (value: string | null | undefined): string | null => {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return `до ${date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', timeZone: SHOP_TIME_ZONE })}`
}
