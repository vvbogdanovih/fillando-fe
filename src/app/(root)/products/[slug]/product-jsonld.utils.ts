import type { ProductDetailData } from '@/app/(root)/[category]/catalog.api'
import { MERCHANT_RETURN_POLICY, SITE_URL } from '@/common/constants/seo.constants'
import { buildShippingDetails } from '@/common/utils/shipping.utils'

/** How long the quoted price is promised for. A rolling window survives any page caching. */
const PRICE_VALID_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim()

const availabilityOf = (variant: ProductDetailData['variant']) => {
	// An archived variant is "no longer stocked", which schema.org spells Discontinued. It is
	// the honest value for a page that stays up for a live ad or backlink (TD-0006 §5.4).
	if (variant.status === 'archived') return 'https://schema.org/Discontinued'
	const stock = variant.quantity ?? variant.stock ?? 0
	return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

/**
 * The only author of Product JSON-LD on the site. Every field degrades by absence: a product
 * without a manufacturer attribute has no `brand`, one without a weight has no `weight` and
 * no `shippingDetails`, a single-variant product has no group id. Nothing is invented and no
 * placeholder stands in — a wrong value is what gets a listing disapproved, an absent one is
 * merely less rich.
 */
export const buildProductJsonLd = (
	data: ProductDetailData,
	displayName: string,
	now: Date = new Date()
): Record<string, unknown> => {
	const { variant, product, siblings } = data
	const description = product.description?.html ? stripHtml(product.description.html) : ''
	const polymer = product.attributes.find(attr => attr.k === 'polymer')
	const priceValidUntil = new Date(now.getTime() + PRICE_VALID_DAYS * DAY_MS)
		.toISOString()
		.slice(0, 10)

	const schema: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: displayName,
		sku: variant.sku,
		image: variant.images,
		offers: {
			'@type': 'Offer',
			url: `${SITE_URL}/products/${variant.slug}`,
			price: variant.price,
			priceCurrency: 'UAH',
			priceValidUntil,
			availability: availabilityOf(variant),
			itemCondition: 'https://schema.org/NewCondition',
			hasMerchantReturnPolicy: MERCHANT_RETURN_POLICY,
			...(buildShippingDetails(variant.weight_g)
				? { shippingDetails: buildShippingDetails(variant.weight_g) }
				: {})
		}
	}

	if (description) schema.description = description
	// The «Виробник» attribute, never the shop name: a brand that is not the maker is a typical
	// reason for an item-level disapproval on a product without a GTIN.
	if (product.manufacturer) schema.brand = { '@type': 'Brand', name: product.manufacturer }
	// Same threshold as the variant switcher: a group of one is not a group.
	if (siblings.length > 1) schema.inProductGroupWithID = product.id
	if (variant.color?.name_uk) schema.color = variant.color.name_uk
	if (polymer !== undefined) schema.material = String(polymer.v)
	if (variant.weight_g !== null && variant.weight_g !== undefined) {
		schema.weight = {
			'@type': 'QuantitativeValue',
			value: variant.weight_g / 1000,
			unitCode: 'KGM'
		}
	}

	return schema
}
