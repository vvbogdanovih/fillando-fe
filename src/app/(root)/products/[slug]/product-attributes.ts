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
 * `material` and `vyrobnyk` are dropped — see `SKIPPED`.
 */
const ORDER = ['spool_included', 'polymer', 'finish', 'reinforcement', 'series']

/**
 * Keys the table never prints, for two different reasons.
 *
 * `material` is superseded: it is the string the four dimensions above were derived from, so
 * leaving it in prints the same fact twice, once in a form nobody filters by.
 *
 * `vyrobnyk` is already on the page — the brand chip above the H1 and the JSON-LD `brand` — and
 * the mock's specification table has no «Виробник» row (Plan-0005 I-29).
 */
const SKIPPED = new Set(['material', 'vyrobnyk'])

/**
 * Dimensions whose value means nothing on its own.
 *
 * This catalogue stores the filament weight in kilograms as a bare `1` or `3`, so the row used
 * to read «Вага | 1». The unit lives on the category's `required_attributes[].unit` and reaches
 * the page only once the public product endpoint carries it; until then such a row is dropped
 * rather than guessed at — an invented «г» would be off by a factor of a thousand (Plan-0005
 * I-27).
 */
const UNIT_REQUIRED = new Set(['vaha'])

/** A value that carries no context of its own: `1`, `0.5`, `1,75`. */
const BARE_NUMBER = /^\d+([.,]\d+)?$/

/** Values worth setting apart — a refill is not a defect, but it is not what most shoppers expect. */
export const EMPHASISED_VALUES = new Set(['Ні (рефіл)'])

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
	emphasised: boolean
}

export const buildSpecRows = (
	attributes: ProductAttribute[],
	overrides: Record<string, string> = {}
): SpecRow[] => {
	const merged = new Map<string, { label: string; values: string[]; unit: string | null }>()

	for (const attr of attributes) {
		if (SKIPPED.has(attr.k)) continue
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

	const rank = (key: string) => {
		const index = ORDER.indexOf(key)
		return index === -1 ? ORDER.length : index
	}

	return [...merged.entries()]
		.sort(([a], [b]) => rank(a) - rank(b))
		.filter(([key, row]) => {
			if (overrides[key] !== undefined || row.unit) return true
			return !(UNIT_REQUIRED.has(key) && row.values.every(v => BARE_NUMBER.test(v)))
		})
		.map(([key, row]) => {
			const value =
				overrides[key] ??
				row.values.map(v => (row.unit ? `${v} ${row.unit}` : v)).join(', ')
			return {
				key,
				label: row.label,
				value,
				emphasised: row.values.some(v => EMPHASISED_VALUES.has(v))
			}
		})
}
