import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Crumb } from '@/common/components/Breadcrumbs'
import type { PublicCategory } from './typed-catalog.types'
import { HUB_SECTIONS } from './catalog-hub'

/**
 * Category and group breadcrumbs when the ancestor path is too long to embed (Plan-0010 D06.4,
 * P07): the page reads the whole path page by page and the trail and `BreadcrumbList` carry all
 * of it; a category hidden since its detail was read is a 404. The listing itself is not under
 * test here — `TypedCatalogPage` renders just the trail it is given. The whole catalogue and
 * groups render the real hub (Plan-0010 P20) over a mocked tree and API.
 */
const { loadCatalogTree, loadCategoryAncestors, loadTypedListing, notFound, serverFetch } =
	vi.hoisted(() => ({
		loadCatalogTree: vi.fn(),
		loadCategoryAncestors: vi.fn(),
		loadTypedListing: vi.fn(),
		notFound: vi.fn(() => {
			throw new Error('NEXT_NOT_FOUND')
		}),
		serverFetch: vi.fn()
	}))
vi.mock('next/navigation', () => ({ notFound, permanentRedirect: vi.fn() }))
vi.mock('@/common/utils/catalog-tree.server', () => ({ loadCatalogTree, loadCategoryAncestors }))
vi.mock('@/common/utils/server-fetch.utils', () => ({ serverFetch }))
vi.mock('./catalog-intro', () => ({ CATALOG_INTRO_HTML: '<p>Філамент для 3D-друку</p>' }))
vi.mock('./typed-listing.server', async importOriginal => ({
	...(await importOriginal<typeof import('./typed-listing.server')>()),
	loadTypedListing
}))
vi.mock('./TypedCatalogPage', async () => {
	const { Breadcrumbs } = await vi.importActual<typeof import('@/common/components/Breadcrumbs')>(
		'@/common/components/Breadcrumbs'
	)
	return {
		TypedCatalogPage: ({ scope }: { scope: { crumbs: Crumb[]; introHtml: string | null } }) => (
			<div data-testid='listing'>
				<Breadcrumbs items={scope.crumbs} />
				{scope.introHtml && <p data-testid='intro'>{scope.introHtml}</p>}
			</div>
		)
	}
})
const { TypedRoute } = await import('./typed-route')

afterEach(cleanup)
beforeEach(() => {
	loadCatalogTree.mockReset().mockResolvedValue([])
	serverFetch.mockReset().mockResolvedValue(null)
	loadCategoryAncestors.mockReset()
	notFound.mockClear()
	loadTypedListing.mockReset().mockResolvedValue({
		path: '/deep-category',
		state: null,
		response: { items: [], total: 0, page: 1, limit: 24, facets: {} },
		query: 'category_id=c9',
		decision: { kind: 'ok' }
	})
})

const category = (over: Partial<PublicCategory> = {}): PublicCategory => ({
	_id: 'c9',
	name: 'Глибока категорія',
	slug: 'deep-category',
	kind: 'product',
	parent_id: 'g3',
	attribute_contract_version: 2,
	revision: 1,
	order: 0,
	image: null,
	ancestors: [],
	attribute_definitions: [],
	seo: { title: null, description: null, h1: null, intro_html: null, bottom_html: null },
	...over
})
const levels = (count: number) =>
	Array.from({ length: count }, (_, n) => ({
		_id: `g${n}`,
		name: `Рівень ${n + 1}`,
		slug: `level-${n + 1}`
	}))

async function trail(of: PublicCategory) {
	const { container } = render(
		(await TypedRoute({ category: of, searchParams: {} })) as ReactElement
	)
	const structured = [...container.querySelectorAll('script[type="application/ld+json"]')]
		.map(
			node =>
				JSON.parse(node.textContent ?? '{}') as {
					'@type'?: string
					itemListElement?: { name: string }[]
				}
		)
		.find(item => item['@type'] === 'BreadcrumbList')
	return {
		visible: [...container.querySelectorAll('nav a, nav span[aria-current]')].map(
			node => node.textContent
		),
		structured: structured?.itemListElement?.map(item => item.name) ?? []
	}
}

describe('TypedRoute breadcrumbs (D06.4)', () => {
	it('reads a paged path whole: the trail and BreadcrumbList carry every ancestor', async () => {
		loadCategoryAncestors.mockResolvedValue(levels(1500))
		const crumbs = await trail(category({ ancestors_paged: true, ancestors_total: 1500 }))
		expect(loadCategoryAncestors).toHaveBeenCalledWith('c9')
		const expected = [
			'Головна',
			'Каталог',
			...levels(1500).map(row => row.name),
			'Глибока категорія'
		]
		expect(crumbs.structured).toEqual(expected)
		expect(crumbs.visible).toEqual(expected)
	})

	it('uses the embedded path at an ordinary depth, without a read', async () => {
		const crumbs = await trail(category({ ancestors: levels(2) }))
		expect(loadCategoryAncestors).not.toHaveBeenCalled()
		expect(crumbs.structured).toEqual([
			'Головна',
			'Каталог',
			'Рівень 1',
			'Рівень 2',
			'Глибока категорія'
		])
	})

	it('answers 404 when the category was hidden after its detail was read', async () => {
		loadCategoryAncestors.mockResolvedValue(null)
		await expect(trail(category({ ancestors_paged: true }))).rejects.toThrow('NEXT_NOT_FOUND')
	})
})

const filament = {
	id: 'f1',
	name: 'Філамент',
	slug: 'filament',
	href: '/filament',
	kind: 'product' as const,
	count: 301,
	children: []
}
const landingRows = [
	...Array.from({ length: 9 }, (_, n) => ({
		slug: `type-${n + 1}`,
		h1: `Тип ${n + 1} філамент`,
		image: null,
		product_count: 3
	})),
	{ slug: 'empty', h1: 'Порожній філамент', image: null, product_count: 0 }
]
const answer = (url: string) => {
	if (url === '/landings?category_id=f1') return landingRows
	if (url === '/categories/slug/filament') return { image: 'https://example.com/filament.png' }
	return null
}

describe('TypedRoute hub (Plan-0010 P20)', () => {
	it('gives /catalog entry tiles, landing pills and the code intro instead of a product grid', async () => {
		loadCatalogTree.mockResolvedValue([filament])
		serverFetch.mockImplementation(async (url: string) => answer(url))
		const page = render(
			(await TypedRoute({ category: null, searchParams: {} })) as ReactElement
		)
		expect(page.queryByTestId('listing')).toBeNull()
		expect(page.getByText('Філамент для 3D-друку')).toBeTruthy()
		// The tiles are the navigation — one column, no second copy of them beside (owner, 14.11);
		// a product category's landings are never its sub-categories (owner, 10.11).
		const nav = page.getByRole('navigation', { name: 'Категорії' })
		expect([...nav.querySelectorAll('a')].map(link => link.getAttribute('href'))).toEqual([
			'/filament'
		])
		expect(page.getByRole('link', { name: /Філамент.*301 товар/ })).toBeTruthy()
		expect(page.container.querySelector('aside')).toBeNull()
		// «Прайс-лист» and «Опт» stand beside the heading.
		expect(page.getByRole('link', { name: 'Прайс-лист' })).toHaveAttribute(
			'href',
			'/price-sheet'
		)
		expect(page.getByRole('link', { name: 'Опт' })).toHaveAttribute('href', '/wholesale')
		// The landings are pills: every one with products, the empty one never.
		const picks = page.getByRole('navigation', { name: 'Популярні добірки' })
		const pills = [...picks.querySelectorAll('a')].map(link => link.getAttribute('href'))
		expect(pills).toHaveLength(9)
		expect(pills).toContain('/filament/type-1')
		expect(pills).not.toContain('/filament/empty')
		// One display face for the page's headings.
		expect(page.getByRole('heading', { level: 1 }).className).toContain('font-display')
		expect(page.getByRole('heading', { name: 'Популярні добірки' }).className).toContain(
			'font-display'
		)
	})

	it('anchors «Акції» and «Новинки», where the home page menu leads (TD-0015)', async () => {
		// The strips' reveal animation watches the viewport; jsdom has no IntersectionObserver.
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
				takeRecords() {
					return []
				}
			}
		)
		loadCatalogTree.mockResolvedValue([filament])
		const strip = {
			items: [
				{
					id: 'v1',
					slug: 'pla-black',
					name: 'PLA — Чорний',
					price: 500,
					stock: 3,
					group: {
						name: 'PLA',
						count: 1,
						in_stock: 1,
						on_sale: 0,
						price_min: 500,
						price_max: 500,
						colors_count: 0,
						colors: []
					}
				}
			]
		}
		serverFetch.mockImplementation(async (url: string) =>
			url.startsWith('/products/catalog/v2') ? strip : answer(url)
		)
		const page = render(
			(await TypedRoute({ category: null, searchParams: {} })) as ReactElement
		)
		const sale = page.container.querySelector(`#${HUB_SECTIONS.onSale}`)
		const newest = page.container.querySelector(`#${HUB_SECTIONS.newest}`)
		expect(sale?.querySelector('h2')?.textContent).toBe('Акції')
		expect(newest?.querySelector('h2')?.textContent).toBe('Новинки')
		// «Новинки» first, «Акції» after it (owner, 2026-11-11).
		expect(
			newest!.compareDocumentPosition(sale!) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy()
		vi.unstubAllGlobals()
	})

	it('renders a group as a hub of its children, with its own SEO text', async () => {
		loadCatalogTree.mockResolvedValue([
			{
				...filament,
				id: 'g1',
				name: 'Друк',
				slug: 'print',
				href: '/print',
				kind: 'group',
				children: [filament]
			}
		])
		serverFetch.mockImplementation(async (url: string) => answer(url))
		const group = category({
			_id: 'g1',
			name: 'Друк',
			slug: 'print',
			kind: 'group',
			seo: {
				title: null,
				description: null,
				h1: null,
				intro_html: '<p>Усе для друку</p>',
				bottom_html: null
			}
		})
		const page = render(
			(await TypedRoute({ category: group, searchParams: {} })) as ReactElement
		)
		const sections = page.getByRole('navigation', { name: 'Розділи: Друк' })
		expect([...sections.querySelectorAll('a')].map(link => link.getAttribute('href'))).toEqual([
			'/filament'
		])
		// «Прайс-лист» and «Опт» belong to the whole catalogue only.
		expect(page.queryByRole('link', { name: 'Опт' })).toBeNull()
		expect(page.getByText('Усе для друку')).toBeTruthy()
		expect(page.queryByText('Філамент для 3D-друку')).toBeNull()
	})

	it('answers 404 for a listing parameter on a hub; a product category stays a listing', async () => {
		loadCatalogTree.mockResolvedValue([filament])
		await expect(
			TypedRoute({ category: null, searchParams: { sort: 'price_asc' } })
		).rejects.toThrow('NEXT_NOT_FOUND')
		const own = render(
			(await TypedRoute({ category: category(), searchParams: {} })) as ReactElement
		)
		expect(own.getByTestId('listing')).toBeTruthy()
		expect(own.queryByTestId('intro')).toBeNull()
	})
})
