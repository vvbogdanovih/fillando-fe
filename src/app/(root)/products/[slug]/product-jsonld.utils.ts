import type { ProductDetailData } from '@/app/(root)/[category]/catalog.api'
import { MERCHANT_RETURN_POLICY, SITE_URL } from '@/common/constants/seo.constants'
import { effectivePrice, isPromoActive } from '@/common/utils/price.utils'
import { buildShippingDetails } from '@/common/utils/shipping.utils'

/** Rolling validity window, anchored to the server render so hydration cannot change its day. */
const PRICE_VALID_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

const NAMED_ENTITIES: Record<string, string> = {
	nbsp: ' ',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	laquo: '«',
	raquo: '»',
	mdash: '—',
	ndash: '–',
	hellip: '…',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”'
}

/**
 * Plain text of the stored Quill HTML, for the meta description and the `Product` JSON-LD.
 * Quill writes every space it keeps as `&nbsp;`, so dropping only the tags shipped
 * `Kingroon&nbsp;PETG` into the search snippet. Block boundaries become spaces — otherwise a
 * heading and the paragraph under it glue into one word. `&amp;` is decoded last so an
 * escaped `&amp;nbsp;` stays the literal text `&nbsp;` instead of turning into a space.
 */
export const stripHtml = (html: string) =>
	html
		.replace(/<br\s*\/?>|<\/(p|h[1-6]|li|div|blockquote)>/gi, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
		.replace(
			/&([a-z]+);/gi,
			(entity, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? entity
		)
		.replace(/&amp;/gi, '&')
		.replace(/\s+/g, ' ')
		.trim()

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
	renderedAt: Date
): Record<string, unknown> => {
	const { variant, product, siblings } = data
	const description = product.description?.html ? stripHtml(product.description.html) : ''
	const polymer = product.attributes.find(attr => attr.k === 'polymer')
	// Use the same server-priced snapshot as PriceTag. Re-checking expiry against the browser's
	// clock would change only the markup while the visible price still shows that snapshot.
	// Archived variants show the regular price on both surfaces.
	const onPromo = variant.status !== 'archived' && isPromoActive(variant)
	const priceValidUntil = (
		onPromo && variant.promo_ends_at
			? new Date(variant.promo_ends_at)
			: new Date(renderedAt.getTime() + PRICE_VALID_DAYS * DAY_MS)
	)
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
			// What the shopper pays — the same pair the Merchant feed sends (`g:price` regular,
			// `g:sale_price` sale), so Google never sees the page and the feed disagree (TD-0012).
			price: onPromo ? effectivePrice(variant) : variant.price,
			priceCurrency: 'UAH',
			...(onPromo
				? {
						priceSpecification: [
							{
								'@type': 'UnitPriceSpecification',
								priceType: 'https://schema.org/ListPrice',
								price: variant.price,
								priceCurrency: 'UAH'
							}
						]
					}
				: {}),
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
