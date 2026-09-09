import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { SITE_URL } from '@/common/constants/seo.constants'
import type { ProductDetailData } from '@/app/(root)/[category]/catalog.api'

// vitest does not load `.env`, and `SITE_URL` is read once when the constants module is
// evaluated — without a value here the canonical would be asserted as «undefined/products/…»,
// which is not the absolute URL a crawler is given.
vi.hoisted(() => {
	process.env.NEXT_PUBLIC_SITE_URL = 'https://fillando.test'
})

// The route body imports it; only `generateMetadata` is under test here.
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))
// Not under test, and rendering it would pull in `next/image` and the cart store.
vi.mock('./ProductPage', () => ({ ProductPage: () => null }))

/**
 * What `generateMetadata` reads on the server. The options argument is forwarded rather than
 * dropped: `next.tags` is not part of the fetch cache key, so an assertion on it is the only
 * thing that can hold this read and the page-body read to one byte-identical tag array.
 */
const serverFetch = vi.fn<(path: string, init?: unknown) => Promise<unknown>>()
vi.mock('@/common/utils/server-fetch.utils', () => ({
	serverFetch: (path: string, init?: unknown) => serverFetch(path, init)
}))

import { generateMetadata } from './page'

const SLUG = 'kingroon-pla-silk-rainbow-gold'
/** `variantLabel` + `productPageTitle` over the fixture below, spelled out not recomputed. */
const TITLE = 'Kingroon PLA Silk Rainbow — Золотий (Gold) — філамент 1,75 мм'
const CANONICAL = `${SITE_URL}/products/${SLUG}`
const PRODUCTS_READ = { next: { tags: [CACHE_TAGS.PRODUCTS] } }

const detail = (
	variant: Partial<ProductDetailData['variant']> = {},
	product: Partial<ProductDetailData['product']> = {}
): ProductDetailData => ({
	variant: {
		id: 'v1',
		name: 'Kingroon PLA Silk Rainbow — Золотий (Gold)',
		slug: SLUG,
		sku: 'FL-000042',
		price: 519,
		price_updated_at: null,
		stock: 7,
		images: ['https://cdn.example.invalid/gold.jpg'],
		v_value: 'Gold',
		status: 'active',
		color: { name_uk: 'Золотий', name_en: 'Gold', family: 'yellow', hex_stops: ['#D4AF37'] },
		weight_g: 1220,
		...variant
	},
	product: {
		id: 'p1',
		name: 'Kingroon PLA Silk Rainbow',
		description: null,
		attributes: [{ k: 'polymer', l: 'Тип пластику', v: 'PLA' }],
		variant_type: { key: 'kolir', label: 'Колір' },
		manufacturer: 'Kingroon',
		...product
	},
	siblings: [],
	category_slug: 'filament',
	category_name: 'Філамент'
})

const metadata = (slug: string = SLUG) => generateMetadata({ params: Promise.resolve({ slug }) })

beforeEach(() => {
	serverFetch.mockReset()
	serverFetch.mockImplementation(() => Promise.resolve(detail()))
})

describe('generateMetadata — what a crawler is told to do with the page', () => {
	it('takes an archived variant out of the index while its links keep passing on', async () => {
		// TD-0006 §5.4: a discontinued product answers 200 for live ads and backlinks, so the
		// only thing keeping it out of the index is this `robots` key. The rest of the page keeps
		// its identity — an archived variant that also lost its title or canonical would be a
		// different regression with the same green suite.
		serverFetch.mockImplementation(() => Promise.resolve(detail({ status: 'archived' })))

		const meta = await metadata()

		expect(meta.robots).toEqual({ index: false, follow: true })
		expect(meta.title).toBe(TITLE)
		expect(meta.alternates?.canonical).toBe(CANONICAL)
	})

	it('says nothing about robots for a variant on sale', async () => {
		// The mirror case: an unconditional `robots` would noindex the whole catalogue just as
		// silently as a missing one would index the archive.
		expect(await metadata()).not.toHaveProperty('robots')
	})

	it('keeps a missing product out of the index instead of leaving it a soft 404', async () => {
		// A streamed response commits a 200 before `notFound()` can set the status, so the
		// «not found» page has to say `noindex` itself or Google indexes it as a real page.
		serverFetch.mockImplementation(() => Promise.resolve(null))

		const meta = await metadata('vygadanyi-tovar')

		expect(meta.title).toBe('Товар не знайдено')
		expect(meta.robots).toEqual({ index: false, follow: false })
		expect(serverFetch).toHaveBeenCalledWith(
			API_URLS.PRODUCTS.BY_SLUG('vygadanyi-tovar'),
			PRODUCTS_READ
		)
	})
})

describe('generateMetadata — the title and the canonical', () => {
	it('spells the colour «Укр (EN)» and points the canonical at /products/<slug>', async () => {
		const meta = await metadata()

		// `variantLabel` prefers the dictionary colour over `v_value` ('Gold'), which the colour
		// migration rewrites to English; `productPageTitle` adds the category word because the
		// product name carries neither it nor the diameter.
		expect(meta.title).toBe(TITLE)
		expect(meta.alternates?.canonical).toBe(CANONICAL)
		// A canonical and an og:url naming different addresses is a silent SEO regression.
		expect(meta.openGraph?.url).toBe(meta.alternates?.canonical)
		// Nothing above would notice a read of some other product — the canonical is built from
		// `params`, not from the answer — and a tag array drifting from the page-body read
		// silently disables the purge that carries a new price, or an archived `noindex`, to a
		// crawler within the hour.
		expect(serverFetch).toHaveBeenCalledWith(API_URLS.PRODUCTS.BY_SLUG(SLUG), PRODUCTS_READ)
	})

	it('carries a non-colour axis into the title', async () => {
		// A category whose axis is weight rather than colour: with no dictionary colour to spell,
		// `variantLabel` has to fall through to `v_value`, or «1 кг» drops out of every such
		// title and the composed form collapses to the bare variant name.
		serverFetch.mockImplementation(() =>
			Promise.resolve(
				detail({ name: 'Kingroon PLA Silk Rainbow — 1 кг', v_value: '1 кг', color: null })
			)
		)

		expect((await metadata()).title).toBe('Kingroon PLA Silk Rainbow — 1 кг — філамент 1,75 мм')
	})

	it('falls back to the variant name when the axis has no value at all', async () => {
		// A category with no colour axis: the variant's own name is already the full one, so the
		// title must not be recomposed from the short product name.
		serverFetch.mockImplementation(() =>
			Promise.resolve(detail({ name: 'Соло-котушка Kingroon', v_value: null, color: null }))
		)

		expect((await metadata()).title).toBe('Соло-котушка Kingroon')
	})
})

describe('generateMetadata — the description under the title in a search result', () => {
	it('generates one from the title when the product carries no description', async () => {
		const meta = await metadata()

		expect(meta.description).toBe(`Купити ${TITLE} у Fillando`)
		// The social crawlers read their own copies; the three drifting apart is invisible on
		// the storefront.
		expect(meta.openGraph?.description).toBe(meta.description)
		expect(meta.twitter).toMatchObject({
			card: 'summary_large_image',
			description: `Купити ${TITLE} у Fillando`
		})
	})

	it('strips the editor markup and caps the length', async () => {
		// The description is stored as Quill HTML: unstripped tags reach the SERP as literal
		// «<p>», and past ~160 characters Google cuts the snippet off itself.
		const html = `<p><strong>${'а'.repeat(200)}</strong></p>`
		serverFetch.mockImplementation(() =>
			Promise.resolve(detail({}, { description: { html, json: null } }))
		)

		expect((await metadata()).description).toBe('а'.repeat(155))
	})

	it('generates one for a cleared editor instead of shipping an empty description', async () => {
		// Quill leaves `<p><br></p>` behind when the field is emptied; stripping the tags leaves
		// '', which is not nullish, so `??` handed that empty string to the crawler as the whole
		// meta description.
		serverFetch.mockImplementation(() =>
			Promise.resolve(detail({}, { description: { html: '<p><br></p>', json: null } }))
		)

		expect((await metadata()).description).toBe(`Купити ${TITLE} у Fillando`)
	})
})
