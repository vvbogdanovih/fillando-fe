/**
 * Ukrainian plural selection.
 *
 * Three forms, chosen by the last digit with the teens carved out: 1, 21, 31 take `one`; 2–4,
 * 22–24 take `few`; everything else, including 5–20 and 11–14, takes `many`. Writing
 * `${n} товарів` unconditionally is wrong for most of the numbers a catalogue actually shows.
 */
export const pluralUk = (count: number, one: string, few: string, many: string): string => {
	const abs = Math.abs(count) % 100
	const last = abs % 10
	if (abs > 10 && abs < 20) return many
	if (last === 1) return one
	if (last >= 2 && last <= 4) return few
	return many
}

/** «1 товар» / «2 товари» / «5 товарів» — the catalogue's own counter. */
export const productsCount = (count: number): string =>
	`${count} ${pluralUk(count, 'товар', 'товари', 'товарів')}`
