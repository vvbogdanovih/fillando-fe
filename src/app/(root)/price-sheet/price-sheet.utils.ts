import type { AdminVariant, PriceSheetCategory } from './price-sheet.schema'

/** One category of the sheet: its heading, its columns and its rows. */
export interface PriceSheetSection {
	id: string
	/** `null` for an older backend that answers one flat list without categories. */
	name: string | null
	columns: PriceSheetCategory['columns']
	variant_column: boolean
	items: AdminVariant[]
}

/**
 * The loaded pages as sections, one per category (owner, 2026-11-06): the backend sorts by
 * category, so consecutive rows of one category form its section, continuing across pages. A
 * category is described by every page that lists it — «Варіант» shows when any of them asks.
 * An older backend sends no categories: one unnamed section with the «Варіант» column.
 */
export function priceSheetSections(
	items: AdminVariant[],
	categories: PriceSheetCategory[]
): PriceSheetSection[] {
	const known = new Map<string, PriceSheetCategory>()
	for (const category of categories) {
		const seen = known.get(category.id)
		known.set(
			category.id,
			seen
				? { ...seen, variant_column: seen.variant_column || category.variant_column }
				: category
		)
	}
	const sections: PriceSheetSection[] = []
	for (const item of items) {
		const id = item.category_id ?? ''
		const last = sections.at(-1)
		if (last?.id === id) {
			last.items.push(item)
			continue
		}
		const category = known.get(id)
		sections.push({
			id,
			name: category?.name ?? null,
			columns: category?.columns ?? [],
			variant_column: category?.variant_column ?? true,
			items: [item]
		})
	}
	return sections
}

/** The phone card's line: «label: value» per column with a value, then the variation. */
export function priceSheetSummary(item: AdminVariant, section: PriceSheetSection): string {
	return (
		[
			...section.columns.map(column => {
				const value = item.values?.[column.key]
				return value ? `${column.label}: ${value}` : null
			}),
			section.variant_column ? (item.variant_label ?? item.color ?? null) : null
		]
			.filter(Boolean)
			.join(' · ') || '—'
	)
}
