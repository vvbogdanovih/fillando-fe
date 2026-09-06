/**
 * The `<title>` of a product page. After migration 3k the product name is short («Kingroon PLA
 * Silk») and no longer says what the thing is, so the title adds the category word and the one
 * diameter the shop sells — unless the name still carries them (a long name before the
 * migration, or a product that mentions the diameter itself), so nothing is said twice.
 */
export const TITLE_SUFFIX = 'філамент 1,75 мм'

export function productPageTitle(productName: string, variantValue: string | null): string {
	const base = variantValue ? `${productName} — ${variantValue}` : productName
	const lower = productName.toLowerCase()
	if (lower.includes('філамент') || /\d,\d+\s*мм/.test(lower)) return base
	return `${base} — ${TITLE_SUFFIX}`
}
