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
	category_name: 'Філамент',
	spooled_counterpart: null
})

const offers = (schema: Record<string, unknown>) => schema.offers as Record<string, unknown>

describe('buildProductJsonLd', () => {
	it('builds the full markup for a rich variant', () => {
		const schema = buildProductJsonLd(base(), 'Sunlu PLA Silk — Золотий (Gold)', NOW)

		expect(schema).toMatchObject({
			'@type': 'Product',
			name: 'Sunlu PLA Silk — Золотий (Gold)',
			sku: 'FL-000342',
			description: 'Шовковий PLA',
			brand: { '@type': 'Brand', name: 'Sunlu' },
			inProductGroupWithID: 'p1',
			color: 'Золотий',
			material: 'PLA',
			weight: { '@type': 'QuantitativeValue', value: 1.22, unitCode: 'KGM' }
		})
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

	it('never uses productGroupID — that property is silently ignored on a Product node', () => {
		const schema = buildProductJsonLd(base(), 'x', NOW)
		expect(schema).not.toHaveProperty('productGroupID')
	})

	it('omits brand entirely when there is no manufacturer — no shop-name fallback', () => {
		const data = base()
		data.product.manufacturer = null
		const schema = buildProductJsonLd(data, 'x', NOW)
		expect(schema).not.toHaveProperty('brand')
	})

	it('omits the group id for a single-variant product', () => {
		const data = base()
		data.siblings = [data.siblings[0]]
		expect(buildProductJsonLd(data, 'x', NOW)).not.toHaveProperty('inProductGroupWithID')
	})

	it('omits weight and shippingDetails when the weight is unknown', () => {
		const data = base()
		data.variant.weight_g = null
		const schema = buildProductJsonLd(data, 'x', NOW)
		expect(schema).not.toHaveProperty('weight')
		expect(offers(schema)).not.toHaveProperty('shippingDetails')
	})

	it('omits color and material when the dictionary and the polymer attribute are absent', () => {
		const data = base()
		data.variant.color = null
		data.product.attributes = [{ k: 'material', l: 'Матеріал', v: 'PLA Silk' }]
		const schema = buildProductJsonLd(data, 'x', NOW)
		expect(schema).not.toHaveProperty('color')
		expect(schema).not.toHaveProperty('material')
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
