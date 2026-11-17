import type { StripItem } from '../[category]/catalog.api'

/**
 * Cards the shelf of a category or a landing shows at its widest: five beside the cover (four
 * below `xl`) — the rest is behind «Дивитися всі».
 */
export const SHELF_CARDS = 5

interface ShelfRow<C> {
	collection: C
	items: StripItem[]
}

/** A collection the admin picked by hand: a list of products, no category or landing behind it. */
export const isPickedList = (collection: { filters: Record<string, unknown> | null }) =>
	Array.isArray(collection.filters?.product_ids)

/**
 * No product twice on the home page (owner, 2026-11-14). A collection over a category and
 * «Новинки» are the same rule — the newest products — so the second strip repeated the first: five
 * cards of six on the stand. Each shelf therefore skips what already stands higher on the page —
 * in «Новинки» or an earlier shelf — and shows the next ones. A collection the admin picked by
 * hand (`filters.product_ids`) is shown as picked: skipping one of its products would be the code
 * overruling the list — and whole (owner, 2026-11-15): it has no page of its own, so its shelf is a
 * row that scrolls and the only place its products stand; cut to five, the rest of the list stood
 * nowhere. A shelf with nothing left to show is not rendered.
 */
export function dedupeShelves<C extends { filters: Record<string, unknown> | null }>(
	above: StripItem[],
	rows: ShelfRow<C>[]
): ShelfRow<C>[] {
	const shown = new Set(above.map(item => item.product_id))
	const shelves: ShelfRow<C>[] = []
	for (const row of rows) {
		const items = isPickedList(row.collection)
			? row.items
			: row.items.filter(item => !shown.has(item.product_id)).slice(0, SHELF_CARDS)
		if (items.length === 0) continue
		for (const item of items) shown.add(item.product_id)
		shelves.push({ ...row, items })
	}
	return shelves
}
