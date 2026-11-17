export interface ProductAttribute {
	k: string
	l: string
	v: string | number | boolean
	/** From the category's `required_attributes[].unit` — «кг», «мм», «°C». */
	unit?: string | null
}

export interface SpecRow {
	key: string
	label: string
	value: string
}

/**
 * The specification table, row for row as the backend sends it (owner, 2026-11-05): a v2 page
 * arrives ordered by the category's definitions and holds only those marked «У таблиці
 * характеристик на сторінці товару»; a v1 page keeps its stored order. Nothing is reordered,
 * hidden or emphasised here — only repeated values are merged and units appended.
 */
export const buildSpecRows = (
	attributes: ProductAttribute[],
	overrides: Record<string, string> = {}
): SpecRow[] => {
	const merged = new Map<string, { label: string; values: string[]; unit: string | null }>()

	for (const attr of attributes) {
		const row = merged.get(attr.k)
		const value = String(attr.v)
		if (row) {
			// A repeated value is a data wart, not a second characteristic.
			if (!row.values.includes(value)) row.values.push(value)
			row.unit ??= attr.unit ?? null
		} else {
			merged.set(attr.k, { label: attr.l, values: [value], unit: attr.unit ?? null })
		}
	}

	return [...merged.entries()].map(([key, row]) => ({
		key,
		label: row.label,
		value: overrides[key] ?? row.values.map(v => (row.unit ? `${v} ${row.unit}` : v)).join(', ')
	}))
}
