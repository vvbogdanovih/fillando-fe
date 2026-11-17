import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The home page as a marketplace's (TD-0015, owner 2026-11-09): the category menu from the public
 * tree, the banner and the side card from «Вітрина» copy — nothing about a product in the code —
 * «Новинки» in one row, the band and the collections as shelves (owner, 2026-11-14): a cover with
 * the photo and the count of what the collection points at, and no product twice on the page. A
 * category or landing collection reads its listing, a product-list collection reads `product_ids`
 * over the whole catalogue, and one failing collection costs only itself. Without the settings (a
 * backend that has none) the page keeps an H1 and the catalogue; a failed settings read fails the
 * render, so a prerendered page is never replaced by one without its copy.
 */
const { serverFetch, readStorefrontSettings, getCategoryNavLinks, loadCatalogTree } = vi.hoisted(
	() => ({
		serverFetch: vi.fn(),
		readStorefrontSettings: vi.fn(),
		getCategoryNavLinks: vi.fn(),
		loadCatalogTree: vi.fn()
	})
)
vi.mock('@/common/utils/catalog-tree.server', () => ({ loadCatalogTree }))
vi.mock('@/common/utils/server-fetch.utils', () => ({ serverFetch }))
vi.mock('@/common/utils/storefront-settings.server', () => ({ readStorefrontSettings }))
vi.mock('@/common/utils/navigation.utils', () => ({ getCategoryNavLinks }))
vi.mock('./_home/AuroraBackground', () => ({ AuroraBackground: () => null }))
vi.mock('./_home/CardAurora', () => ({ CardAurora: () => null }))
vi.mock('@/common/components/wholesale/WholesaleFormButton', () => ({
	WholesaleFormButton: ({ children }: { children: string }) => <button>{children}</button>
}))
vi.mock('./_home/FeaturedProducts', () => ({
	FeaturedProducts: (props: {
		title?: string
		items: unknown[]
		href?: string
		layout?: string
		eagerCards?: number
	}) => (
		<section aria-label={props.title ?? 'Новинки'}>
			{props.items.length} → {props.href ?? '/catalog'} · {props.layout ?? 'grid'} · eager{' '}
			{props.eagerCards ?? 0}
		</section>
	)
}))
vi.mock('./_home/CollectionShelf', () => ({
	CollectionShelf: (props: {
		title: string
		href: string
		label: string
		image: string | null
		count: number | null
		items: { product_id: string }[]
		rail?: boolean
	}) => (
		<section aria-label={props.title}>
			{props.items.map(item => item.product_id).join(',')} → {props.href} · {props.label} ·{' '}
			{props.image ?? 'no photo'} · {props.count ?? 'no count'} ·{' '}
			{props.rail ? 'a row that scrolls' : 'a shelf of five'}
		</section>
	)
}))
const { Home } = await import('./Home')
afterEach(cleanup)

/** `n` products from `from` on: `p0`, `p1`… — one card each, as the strip endpoint answers. */
const listing = (n: number, from = 0) => ({
	items: Array.from({ length: n }, (_, i) => ({ id: `v${from + i}`, product_id: `p${from + i}` }))
})
const filamentNode = {
	id: 'c1',
	name: 'Філамент',
	slug: 'filament',
	href: '/filament',
	kind: 'product' as const,
	count: 301,
	children: []
}
const content = {
	strip: ['Відправляємо Новою Поштою щодня'],
	banner: {
		eyebrow: 'Fillando',
		title: 'Усе для того, що ви створюєте',
		accent: 'створюєте',
		text: 'Ціни й наявність видно одразу.',
		button_label: 'До каталогу',
		button_href: '/catalog'
	},
	side_promo: {
		title: 'Купуєте оптом?',
		text: 'Залиште заявку.',
		button_label: 'Заповнити форму',
		action: 'wholesale-form',
		button_href: null
	},
	band: {
		title: 'Прайс-лист',
		text: 'Усі товари на одній сторінці.',
		button_label: 'Відкрити прайс-лист',
		button_href: '/price-sheet'
	}
}

describe('Home', () => {
	it('lays out the menu, the «Вітрина» copy, «Новинки» in one row and every collection from its own read', async () => {
		loadCatalogTree.mockResolvedValue([filamentNode])
		getCategoryNavLinks.mockResolvedValue([
			{ href: '/filament', label: 'Філамент' },
			{ href: '/elektryka', label: 'Електрика' }
		])
		serverFetch.mockImplementation(async (path: string) => {
			if (path === '/categories/slug/filament')
				return { image: 'https://cdn.test/filament.webp' }
			if (path.startsWith('/categories/slug/')) throw new Error('Upstream 503')
			if (path.startsWith('/landings?category_id=c1'))
				return [
					{
						slug: 'pla',
						h1: 'PLA',
						image: 'https://cdn.test/pla.webp',
						product_count: 64
					}
				]
			if (path.includes('on_sale')) return listing(2)
			if (path.includes('product_ids')) return listing(3)
			if (path.includes('category_id=c2')) throw new Error('Upstream 503')
			// The collection over the category: its newest products, half of them «Новинки».
			if (path.includes('category_id=c1')) return listing(8, 4)
			return listing(8)
		})
		readStorefrontSettings.mockResolvedValue({
			...content,
			collections: [
				{ id: 'a', title: 'PLA', category_id: 'c1', filters: null, path: '/filament/pla' },
				{ id: 'b', title: 'Падає', category_id: 'c2', filters: null, path: '/broken' },
				{
					id: 'c',
					title: 'Обрані',
					category_id: null,
					filters: { product_ids: ['p1', 'p2'] },
					path: null
				}
			]
		})
		render((await Home()) as ReactElement)

		// The banner's title is the page's H1, its accent highlighted inside it.
		const h1 = screen.getByRole('heading', { level: 1 })
		expect(h1).toHaveTextContent('Усе для того, що ви створюєте')
		expect(screen.getByText('створюєте').tagName).toBe('SPAN')
		expect(screen.getByRole('link', { name: 'До каталогу' })).toHaveAttribute(
			'href',
			'/catalog'
		)
		// The menu as in the sketch: the hub's «Акції» and «Новинки», the tree's first level with the
		// categories' own photos, then the catalogue and the price sheet.
		const menu = screen.getByRole('navigation', { name: 'Категорії' })
		expect(
			[...menu.querySelectorAll('a')].map(link => [
				link.textContent,
				link.getAttribute('href')
			])
		).toEqual([
			['Акції', '/catalog#akcii'],
			['Новинки', '/catalog#novynky'],
			['Філамент', '/filament'],
			['Електрика', '/elektryka'],
			['Усі товари', '/catalog'],
			['Прайс-лист', '/price-sheet']
		])
		// A photo where the admin set one; a failed read only leaves a plain tile.
		const photos = [...menu.querySelectorAll('img')]
		expect(photos).toHaveLength(1)
		expect(photos[0].getAttribute('src')).toContain('filament.webp')
		expect(screen.getByRole('button', { name: 'Заповнити форму' })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Відкрити прайс-лист' })).toHaveAttribute(
			'href',
			'/price-sheet'
		)
		// Only the row above the fold preloads, and only its first photo — the desktop LCP.
		expect(screen.getByRole('region', { name: 'Новинки' })).toHaveTextContent(
			'8 → /catalog · rail · eager 1'
		)
		// A shelf: no product of «Новинки» (p0–p7) again; the cover carries the landing's own photo
		// and count.
		expect(screen.getByRole('region', { name: 'PLA' })).toHaveTextContent(
			'p8,p9,p10,p11 → /filament/pla · Дивитися всі · https://cdn.test/pla.webp · 64 · a shelf of five'
		)
		// A list picked by hand is shown as picked, repeats and all; it has no page of its own —
		// its cover is plain and leads to the whole catalogue.
		expect(screen.getByRole('region', { name: 'Обрані' })).toHaveTextContent(
			'p0,p1,p2 → /catalog · До каталогу · no photo · no count · a row that scrolls'
		)
		expect(screen.queryByRole('region', { name: 'Падає' })).toBeNull()
		// A shelf reads more than it shows (it skips what stands above); «Новинки» reads its eight.
		const limits = serverFetch.mock.calls
			.map(([path]) => new URL(String(path), 'http://local'))
			.filter(url => url.pathname === '/products/catalog/v2/strip')
			.map(url => [
				url.searchParams.get('category_id') ?? 'all',
				url.searchParams.get('limit')
			])
		expect(limits).toContainEqual(['all', '8'])
		expect(limits).toContainEqual(['c1', '24'])
		const listQuery = serverFetch.mock.calls
			.map(([path]) => String(path))
			.find(path => path.includes('product_ids'))!
		const query = new URL(listQuery, 'http://local').searchParams
		expect(query.get('category_id')).toBeNull()
		expect(JSON.parse(query.get('filters')!)).toEqual({ product_ids: ['p1', 'p2'] })
		// No filament knowledge left on the home page.
		expect(document.body.textContent).not.toMatch(/3D-друку|PLA, PETG|Чому Fillando/)
	})

	it("takes a category collection's photo and count from the category, and lives without the tree", async () => {
		getCategoryNavLinks.mockResolvedValue([])
		serverFetch.mockReset().mockImplementation(async (path: string) => {
			if (path === '/categories/slug/filament') return { image: 'https://cdn.test/f.webp' }
			if (path.includes('category_id=c1')) return listing(3, 20)
			return listing(0)
		})
		readStorefrontSettings.mockResolvedValue({
			...content,
			collections: [
				{ id: 'a', title: 'Витратні', category_id: 'c1', filters: null, path: '/filament' }
			]
		})
		loadCatalogTree.mockResolvedValue([filamentNode])
		render((await Home()) as ReactElement)
		expect(screen.getByRole('region', { name: 'Витратні' })).toHaveTextContent(
			'p20,p21,p22 → /filament · Дивитися всі · https://cdn.test/f.webp · 301'
		)
		cleanup()

		// The tree is decoration here: an outage costs the cover its count, not the page.
		loadCatalogTree.mockRejectedValue(new Error('Upstream 503'))
		render((await Home()) as ReactElement)
		expect(screen.getByRole('region', { name: 'Витратні' })).toHaveTextContent(
			'p20,p21,p22 → /filament · Дивитися всі · https://cdn.test/f.webp · no count'
		)
	})

	// Owner, 2026-11-15: «на головній видно всі обрані». A picked list has no page of its own, so
	// its shelf is one row that scrolls and holds every product the admin picked — not the five
	// a category's shelf shows before «Дивитися всі».
	it('hands a list picked by hand to its shelf whole, and a category shelf its five', async () => {
		loadCatalogTree.mockResolvedValue([filamentNode])
		getCategoryNavLinks.mockResolvedValue([])
		serverFetch.mockReset().mockImplementation(async (path: string) => {
			if (path.includes('product_ids')) return listing(9, 40)
			if (path.includes('category_id=c1')) return listing(9, 20)
			return listing(0)
		})
		readStorefrontSettings.mockResolvedValue({
			...content,
			collections: [
				{
					id: 'picked',
					title: 'Обрані',
					category_id: null,
					filters: { product_ids: ['p40'] },
					path: null
				},
				{ id: 'all', title: 'Усі', category_id: 'c1', filters: null, path: '/filament' }
			]
		})
		render((await Home()) as ReactElement)
		expect(screen.getByRole('region', { name: 'Обрані' })).toHaveTextContent(
			'p40,p41,p42,p43,p44,p45,p46,p47,p48 → /catalog · До каталогу · no photo · no count · a row that scrolls'
		)
		expect(screen.getByRole('region', { name: 'Усі' })).toHaveTextContent(
			'p20,p21,p22,p23,p24 → /filament · Дивитися всі · no photo · 301 · a shelf of five'
		)
	})

	it('keeps an H1 and the way into the catalogue without the settings', async () => {
		loadCatalogTree.mockResolvedValue([])
		getCategoryNavLinks.mockResolvedValue([])
		serverFetch.mockResolvedValue(listing(0))
		readStorefrontSettings.mockResolvedValue(null)
		render((await Home()) as ReactElement)
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fillando')
		expect(screen.getByRole('link', { name: 'До каталогу' })).toHaveAttribute(
			'href',
			'/catalog'
		)
		expect(screen.queryByRole('button', { name: 'Заповнити форму' })).toBeNull()
		// Nothing on sale, nothing new: neither item leads to an empty strip.
		const menu = screen.getByRole('navigation', { name: 'Категорії' })
		expect(menu).not.toHaveTextContent('Акції')
		expect(menu).not.toHaveTextContent('Новинки')
	})

	// The page is prerendered and kept for an hour. Caught, one failed settings read during a
	// regeneration was cached as a page with «Fillando» for an H1 and no copy, band or shelves;
	// thrown — like the first «Новинки» read — the regeneration fails and the previous page stays.
	it('fails the render when the settings read fails, instead of a page without its copy', async () => {
		loadCatalogTree.mockResolvedValue([])
		getCategoryNavLinks.mockResolvedValue([])
		serverFetch.mockReset().mockResolvedValue(listing(0))
		readStorefrontSettings.mockRejectedValueOnce(
			new Error('Upstream 503 for /storefront-settings')
		)
		await expect(Home()).rejects.toThrow('Upstream 503')
	})

	it('keeps the menu to its first ten categories, the rest behind «Усі товари»', async () => {
		getCategoryNavLinks.mockResolvedValue(
			Array.from({ length: 14 }, (_, i) => ({ href: `/c${i}`, label: `Категорія ${i}` }))
		)
		serverFetch.mockReset().mockResolvedValue(listing(0))
		readStorefrontSettings.mockResolvedValue({ ...content, collections: [] })
		render((await Home()) as ReactElement)
		const links = [
			...screen.getByRole('navigation', { name: 'Категорії' }).querySelectorAll('a')
		].map(link => link.textContent)
		expect(links).toHaveLength(12)
		expect(links[9]).toBe('Категорія 9')
		expect(links[10]).toBe('Усі товари')
		// Photos are read for the shown categories only.
		const photoReads = serverFetch.mock.calls.filter(([path]) =>
			String(path).startsWith('/categories/slug/')
		)
		expect(photoReads).toHaveLength(10)
	})

	it('shows no band when «Вітрина» switched it off', async () => {
		getCategoryNavLinks.mockResolvedValue([])
		serverFetch.mockResolvedValue(listing(0))
		readStorefrontSettings.mockResolvedValue({ ...content, band: null, collections: [] })
		render((await Home()) as ReactElement)
		expect(screen.queryByRole('link', { name: 'Відкрити прайс-лист' })).toBeNull()
	})
})
