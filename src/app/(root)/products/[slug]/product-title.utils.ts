/**
 * The `<title>` of a v1 (legacy) product page: the category name extends the base product name
 * unless the name already says it; the variation always comes last.
 */
export function productPageTitle(
	productName: string,
	variantValue: string | null,
	categoryName?: string | null
): string {
	const addition = categoryName?.trim()
	const name =
		!addition || productName.toLocaleLowerCase('uk').includes(addition.toLocaleLowerCase('uk'))
			? productName
			: `${productName} — ${addition}`
	return productDisplayName(name, variantValue)
}

/**
 * The H1, the cart line and the JSON-LD name — and the whole `<title>` of a v2 page: the product
 * name as written, then the variation. No category text is inserted (owner, 2026-11-05: the
 * category name suffix is gone).
 */
export function productDisplayName(base: string, variantValue?: string | null): string {
	return variantValue ? `${base} — ${variantValue}` : base
}
