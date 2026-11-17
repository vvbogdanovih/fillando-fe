import {
	typedProductBodySchema,
	type TypedProduct,
	type TypedProductBody
} from './typed-product.schema'

type Details = NonNullable<TypedProductBody['details']>
export type DetailRow = Details['variants'][number]

/**
 * A save of a typed product as it is stored, with `patch` on top: every write resends the name,
 * characteristics and axis values, so a panel that edits one part (a variant, the description,
 * a promotion) changes only that part.
 */
export function productBody(
	product: TypedProduct,
	patch: Partial<Omit<TypedProductBody, 'expected_revision'>> = {}
): TypedProductBody {
	return typedProductBodySchema.parse({
		expected_revision: product.revision,
		name: product.name,
		attributes_v2: product.attributes_v2,
		variant_axis: product.variant_axis,
		variants: product.variants.map(row => ({ id: row.id, variant_value: row.variant_value })),
		...patch
	})
}

/**
 * Price, stock, weight, supplier ids and photos of every SKU as stored. The promotion fields are
 * left out on purpose: omitted keeps the stored promotion (an ended one's past date is never resent).
 */
export function storedDetailRows(product: TypedProduct): DetailRow[] {
	return (product.details?.variants ?? []).map(row => ({
		id: row.id,
		price: row.price,
		stock: row.stock,
		weight_g: row.weight_g ?? null,
		vendor_product_sku: row.vendor_product_sku ?? null,
		prom_id: row.prom_id ?? null,
		images: row.images
	}))
}

/** The stored description, resent unchanged by panels that do not edit it. */
export function storedDescription(product: TypedProduct): Details['description'] {
	const stored = product.details?.description
	return stored ? { html: stored.html, json: { ...stored.json } } : null
}
