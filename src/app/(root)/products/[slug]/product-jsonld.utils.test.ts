import { describe, expect, it } from 'vitest'
import type { ProductDetailData } from '@/app/(root)/[category]/catalog.api'
import { SITE_URL } from '@/common/constants/seo.constants'
import { buildProductJsonLd, stripHtml } from './product-jsonld.utils'

const NOW = new Date('2026-09-06T12:00:00.000Z')

const base = (): ProductDetailData => ({
	variant: {
		id: 'v1',
		name: 'Sunlu PLA Silk — Золотий (Gold)',
		slug: 'sunlu-pla-silk-gold',
		sku: 'FL-000342',
		price: 549,
		price_updated_at: null,
		stock: 7,
		images: ['https://cdn.example.invalid/gold-1.jpg'],
		v_value: 'Gold',
		status: 'active',
		color: { name_uk: 'Золотий', name_en: 'Gold', family: 'yellow', hex_stops: ['#d4af37'] },
		weight_g: 1220
	},
	product: {
		id: 'p1',
		name: 'Sunlu PLA Silk',
		description: { html: '<p>Шовковий <b>PLA</b></p>', json: null },
		attributes: [
			{ k: 'vyrobnyk', l: 'Виробник', v: 'Sunlu' },
			{ k: 'polymer', l: 'Тип пластику', v: 'PLA' }
		],
		variant_type: { key: 'kolir', label: 'Колір' },
		manufacturer: 'Sunlu'
	},
	siblings: [
		{
			id: 'v1',
			name: 'Sunlu PLA Silk — Золотий (Gold)',
			slug: 'sunlu-pla-silk-gold',
			price: 549,
			price_updated_at: null,
			stock: 7,
			v_value: 'Gold',
			images: [],
			color: null
		},
		{
			id: 'v2',
			name: 'Sunlu PLA Silk — Чорний (Black)',
			slug: 'sunlu-pla-silk-black',
			price: 549,
			price_updated_at: null,
			stock: 3,
			v_value: 'Black',
			images: [],
			color: null
		}
	],
	category_slug: 'filament',
	category_name: 'Філамент'
})

/** The Product node of this SKU: top level, or the first variant of the page's ProductGroup. */
const node = (schema: Record<string, unknown>) =>
	schema['@type'] === 'ProductGroup'
		? (schema.hasVariant as Record<string, unknown>[])[0]
		: schema
const offers = (schema: Record<string, unknown>) => node(schema).offers as Record<string, unknown>

describe('buildProductJsonLd', () => {
	it('builds the full markup for a rich variant inside its colour ProductGroup', () => {
		const schema = buildProductJsonLd(base(), 'Sunlu PLA Silk — Золотий (Gold)', NOW, {
			group: 'Sunlu PLA Silk',
			variant: 'Золотий (Gold)'
		})

		// Multi-page variants (TD-0013 SEO matrix): a self-contained group, no ProductGroup.url.
		expect(schema).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'ProductGroup',
			name: 'Sunlu PLA Silk',
			productGroupID: 'p1',
			description: 'Шовковий PLA',
			brand: { '@type': 'Brand', name: 'Sunlu' },
			variesBy: ['https://schema.org/color']
		})
		expect(schema).not.toHaveProperty('url')
		expect((schema.hasVariant as unknown[]).slice(1)).toEqual([
			{ '@type': 'Product', url: `${SITE_URL}/products/sunlu-pla-silk-black` }
		])
		expect(node(schema)).toMatchObject({
			'@type': 'Product',
			name: 'Sunlu PLA Silk — Золотий (Gold)',
			url: `${SITE_URL}/products/sunlu-pla-silk-gold`,
			sku: 'FL-000342',
			description: 'Шовковий PLA',
			brand: { '@type': 'Brand', name: 'Sunlu' },
			color: 'Золотий',
			material: 'PLA',
			weight: { '@type': 'QuantitativeValue', value: 1.22, unitCode: 'KGM' }
		})
		expect(node(schema)).not.toHaveProperty('@context')
		expect(node(schema)).not.toHaveProperty('inProductGroupWithID')
		expect(offers(schema)).toMatchObject({
			url: `${SITE_URL}/products/sunlu-pla-silk-gold`,
			price: 549,
			priceCurrency: 'UAH',
			priceValidUntil: '2026-12-05',
			availability: 'https://schema.org/InStock',
			itemCondition: 'https://schema.org/NewCondition'
		})
		expect(offers(schema).shippingDetails).toBeDefined()
		expect(offers(schema).hasMerchantReturnPolicy).toMatchObject({
			itemDefectReturnFees: 'https://schema.org/FreeReturn'
		})
	})

	it('never puts productGroupID on a Product node — it belongs to the ProductGroup', () => {
		const schema = buildProductJsonLd(base(), 'x', NOW)
		expect(node(schema)).not.toHaveProperty('productGroupID')
		expect(schema.productGroupID).toBe('p1')
	})

	it('omits brand entirely when there is no manufacturer — no shop-name fallback', () => {
		const data = base()
		data.product.manufacturer = null
		const schema = buildProductJsonLd(data, 'x', NOW)
		expect(node(schema)).not.toHaveProperty('brand')
	})

	it('emits a plain Product without a group for a single-variant product', () => {
		const data = base()
		data.siblings = [data.siblings[0]]
		const schema = buildProductJsonLd(data, 'x', NOW)
		expect(schema['@type']).toBe('Product')
		expect(schema['@context']).toBe('https://schema.org')
		expect(schema).not.toHaveProperty('inProductGroupWithID')
		expect(schema).not.toHaveProperty('hasVariant')
	})

	it('does not pass a non-standard v2 axis off as a variant property', () => {
		const data = base()
		data.variant.color = null
		data.product.variant_type = { key: 'current', label: 'Струм', semantic: 'generic' }
		data.semantic_values = { size: null, material: null }
		const schema = buildProductJsonLd(data, 'АВР 63 А', NOW, { group: 'АВР', variant: '63 А' })
		expect(schema).toMatchObject({
			'@type': 'Product',
			inProductGroupWithID: 'p1',
			additionalProperty: [{ '@type': 'PropertyValue', name: 'Струм', value: '63 А' }]
		})
		expect(schema).not.toHaveProperty('variesBy')
		// No filament `polymer` rule on a v2 page: material comes from the category semantics only.
		expect(schema).not.toHaveProperty('material')
	})

	it('groups a v2 size axis by size and takes size/material from the category semantics', () => {
		const data = base()
		data.variant.color = null
		data.product.variant_type = { key: 'dims', label: 'Розмір', semantic: 'size' }
		data.semantic_values = { size: '160×120 см', material: 'Бавовна' }
		const schema = buildProductJsonLd(data, 'Ковдра 160×120 см', NOW, {
			group: 'Ковдра',
			variant: '160×120 см'
		})
		expect(schema).toMatchObject({
			'@type': 'ProductGroup',
			variesBy: ['https://schema.org/size']
		})
		expect(node(schema)).toMatchObject({ size: '160×120 см', material: 'Бавовна' })
	})

	it('omits weight and shippingDetails when the weight is unknown', () => {
		const data = base()
		data.variant.weight_g = null
		const schema = buildProductJsonLd(data, 'x', NOW)
		expect(node(schema)).not.toHaveProperty('weight')
		expect(offers(schema)).not.toHaveProperty('shippingDetails')
	})

	it('omits color and material when the dictionary and the polymer attribute are absent', () => {
		const data = base()
		data.variant.color = null
		data.product.attributes = [{ k: 'material', l: 'Матеріал', v: 'PLA Silk' }]
		const schema = buildProductJsonLd(data, 'x', NOW)
		expect(node(schema)).not.toHaveProperty('color')
		expect(node(schema)).not.toHaveProperty('material')
	})

	it('marks an archived variant Discontinued regardless of stock', () => {
		const data = base()
		data.variant.status = 'archived'
		data.variant.stock = 5
		expect(offers(buildProductJsonLd(data, 'x', NOW)).availability).toBe(
			'https://schema.org/Discontinued'
		)
	})

	it('reports OutOfStock from the quantity when the stock is exhausted', () => {
		const data = base()
		data.variant.stock = 0
		expect(offers(buildProductJsonLd(data, 'x', NOW)).availability).toBe(
			'https://schema.org/OutOfStock'
		)
	})

	it('drops the description key when there is no description', () => {
		const data = base()
		data.product.description = null
		expect(buildProductJsonLd(data, 'x', NOW)).not.toHaveProperty('description')
	})
})

describe('stripHtml — the plain text Google shows in the snippet', () => {
	it('decodes the &nbsp; Quill writes for every space', () => {
		// Verbatim shape of a production description (2026-09-25).
		expect(
			stripHtml(
				'<h2>Kingroon&nbsp;PETG&nbsp;(CoPET)&nbsp;—&nbsp;філамент</h2><p>Kingroon&nbsp;PETG&nbsp;—&nbsp;один</p>'
			)
		).toBe('Kingroon PETG (CoPET) — філамент Kingroon PETG — один')
	})

	it('keeps a space between blocks and after a line break', () => {
		expect(stripHtml('<p>Перший</p><p>Другий<br>Третій</p><ul><li>а</li><li>б</li></ul>')).toBe(
			'Перший Другий Третій а б'
		)
	})

	it('decodes numeric and common named entities', () => {
		expect(
			stripHtml('<p>&laquo;PLA&raquo; &#8212; 1&#x2C;75 мм &lt;3&gt; &quot;x&quot;</p>')
		).toBe('«PLA» — 1,75 мм <3> "x"')
	})

	it('decodes &amp; last, so escaped entity text stays literal', () => {
		expect(stripHtml('<p>A &amp; B, &amp;nbsp;</p>')).toBe('A & B, &nbsp;')
	})

	it('leaves an unknown entity as written', () => {
		expect(stripHtml('<p>&foo; bar</p>')).toBe('&foo; bar')
	})

	it('strips a cleared editor to an empty string', () => {
		expect(stripHtml('<p><br></p>')).toBe('')
	})
})

describe('buildProductJsonLd — promotions (TD-0012)', () => {
	const onSale = (promo_ends_at: string | null) => {
		const data = base()
		data.variant = { ...data.variant, sale_price: 467, promo_percent: 15, promo_ends_at }
		return data
	}

	it('quotes the sale price, lists the regular one as ListPrice and holds the price until the end date', () => {
		const offer = offers(buildProductJsonLd(onSale('2026-11-01T00:00:00.000Z'), 'x', NOW))
		expect(offer.price).toBe(467)
		expect(offer.priceSpecification).toEqual([
			{
				'@type': 'UnitPriceSpecification',
				priceType: 'https://schema.org/ListPrice',
				price: 549,
				priceCurrency: 'UAH'
			}
		])
		expect(offer.priceValidUntil).toBe('2026-11-01')
	})

	it('keeps the rolling 90-day window for an open-ended promotion', () => {
		const offer = offers(buildProductJsonLd(onSale(null), 'x', NOW))
		expect(offer.price).toBe(467)
		expect(offer.priceValidUntil).toBe('2026-12-05')
	})

	it('emits no priceSpecification without a promotion — degrade by absence', () => {
		const offer = offers(buildProductJsonLd(base(), 'x', NOW))
		expect(offer.price).toBe(549)
		expect(offer).not.toHaveProperty('priceSpecification')
	})

	it('quotes the regular price for an archived variant, as the page does — a sale on nothing is not a sale', () => {
		const data = onSale('2026-11-01T00:00:00.000Z')
		data.variant.status = 'archived'
		const offer = offers(buildProductJsonLd(data, 'x', NOW))
		expect(offer.price).toBe(549)
		expect(offer).not.toHaveProperty('priceSpecification')
		expect(offer.priceValidUntil).toBe('2026-12-05')
		expect(offer.availability).toBe('https://schema.org/Discontinued')
	})

	it('keeps the server-priced snapshot even when rendered after its end date', () => {
		const offer = offers(buildProductJsonLd(onSale('2026-09-01T00:00:00.000Z'), 'x', NOW))
		expect(offer.price).toBe(467)
		expect(offer.priceSpecification).toEqual([
			expect.objectContaining({ price: 549, priceType: 'https://schema.org/ListPrice' })
		])
		expect(offer.priceValidUntil).toBe('2026-09-01')
	})
})
