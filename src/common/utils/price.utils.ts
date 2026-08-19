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
