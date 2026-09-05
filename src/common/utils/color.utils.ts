/** The colour payload the API attaches to a variant and to each catalogue item. */
export interface PublicColor {
	name_uk: string
	name_en: string
	family: string
	hex_stops: string[]
}

/**
 * "Чорний (Black)" — the Ukrainian name a shopper reads, plus the canonical name a
 * manufacturer uses (TD-0002 §5.2.2).
 *
 * The two are collapsed when they are the same word, so a colour like "Candy" does not come out
 * as "Candy (Candy)".
 */
export function colorLabel(color: PublicColor | null | undefined): string | null {
	if (!color) return null
	const uk = color.name_uk?.trim()
	const en = color.name_en?.trim()
	if (!uk) return en || null
	if (!en || en === uk) return uk
	return `${uk} (${en})`
}

/**
 * What to print for a variant on its axis.
 *
 * The dictionary comes first and `v_value` is only the fallback. That order is the whole point:
 * the colour migration rewrites `v_value` to the English name, so a storefront still reading it
 * directly would switch the entire Ukrainian shop to English colour names the moment the
 * migration runs (Plan-0004 §4, ordering rule 2).
 */
export function variantLabel(variant: {
	v_value?: string | null
	color?: PublicColor | null
}): string | null {
	return colorLabel(variant.color) ?? variant.v_value ?? null
}

/**
 * A catalogue row's name with the colour spelled the way the product page spells it.
 *
 * The stored variant name ends with the Ukrainian colour alone — `${product} — ${name_uk}` is
 * what both the migration and `ProductService.variantName` write — while the product page shows
 * «Чорний (Black)». That difference is not only cosmetic: adding the same variant to the cart
 * from a catalogue card and from its own page used to put two different strings in the basket.
 *
 * Only the exact stored suffix is rewritten. A name that does not end in its colour is left
 * alone rather than guessed at.
 */
export function catalogItemName(item: { name: string; color?: PublicColor | null }): string {
	const label = colorLabel(item.color)
	const uk = item.color?.name_uk?.trim()
	if (!label || !uk || label === uk) return item.name

	const suffix = ` — ${uk}`
	return item.name.endsWith(suffix)
		? `${item.name.slice(0, -suffix.length)} — ${label}`
		: item.name
}
