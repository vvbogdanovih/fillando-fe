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
 * A transitional shim: a catalogue row's name with the colour spelled the way the product page
 * spells it.
 *
 * Both writers — `ProductService.variantName` and `normalize-variant-colors.js` — now store
 * «<product> — Чорний (Black)» themselves, so on freshly written data this function does
 * nothing at all: such a name does not end in the bare Ukrainian colour and falls straight
 * through. It exists for the rows left behind by the previous version of those two, which is
 * every environment migrated before that change, and the release procedure deliberately puts
 * this frontend in production *before* the colour migration runs.
 *
 * It can be deleted once the migration has run everywhere. Until then, do not treat the old
 * form as the contract: the shim rewrites, it does not define.
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
