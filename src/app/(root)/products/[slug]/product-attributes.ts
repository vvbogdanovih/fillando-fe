/**
 * The specification table, curated (Plan-0005 C6).
 *
 * Two things the raw attribute array cannot give the shopper:
 *
 * 1. **Order.** Stored order is whatever the admin typed or a migration appended. The mock reads
 *    top-down as a buying decision — is a spool included, what plastic is it, how does it look,
 *    is it reinforced, which series — so that order is fixed here and anything unrecognised
 *    follows in the order it was stored.
 * 2. **One row per characteristic.** `derive-material-taxonomy.js` makes dimensions multi-valued
 *    on purpose: `PLA Silk Rainbow` yields two `finish` entries. Printed straight, the table says
 *    «Ефект поверхні: Silk» and «Ефект поверхні: Rainbow» on two lines — and, because the key is
 *    the React key, two rows claiming to be the same row.
 *
 * `material` is dropped: it is the string the four dimensions above were derived from, so
 * leaving it in prints the same fact twice, once in a form nobody filters by.
 */
const ORDER = ['spool_included', 'polymer', 'finish', 'reinforcement', 'series']

/** Superseded by the dimensions derived from it. */
const SUPERSEDED = new Set(['material'])

/** Values worth setting apart — a refill is not a defect, but it is not what most shoppers expect. */
export const EMPHASISED_VALUES = new Set(['Ні (рефіл)'])

export interface ProductAttribute {
	k: string
	l: string
	v: string | number | boolean
}

export interface SpecRow {
	key: string
	label: string
	value: string
	emphasised: boolean
}

export const buildSpecRows = (
	attributes: ProductAttribute[],
	overrides: Record<string, string> = {}
): SpecRow[] => {
	const merged = new Map<string, { label: string; values: string[] }>()

	for (const attr of attributes) {
		if (SUPERSEDED.has(attr.k)) continue
		const row = merged.get(attr.k)
		const value = String(attr.v)
		if (row) {
			// A repeated value is a data wart, not a second characteristic.
			if (!row.values.includes(value)) row.values.push(value)
		} else {
			merged.set(attr.k, { label: attr.l, values: [value] })
		}
	}

	const rank = (key: string) => {
		const index = ORDER.indexOf(key)
		return index === -1 ? ORDER.length : index
	}

	return [...merged.entries()]
		.sort(([a], [b]) => rank(a) - rank(b))
		.map(([key, row]) => {
			const value = overrides[key] ?? row.values.join(', ')
			return {
				key,
				label: row.label,
				value,
				emphasised: row.values.some(v => EMPHASISED_VALUES.has(v))
			}
		})
}
