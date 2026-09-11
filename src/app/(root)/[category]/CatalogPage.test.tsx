import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SITE_URL } from '@/common/constants/seo.constants'
import type { Category } from '@/app/admin/categories/categories.schema'
import type { CatalogResponse } from './catalog.api'
import type { LandingContent } from './CatalogPage'

afterEach(cleanup)

/**
 * The URL is the only filter state, so a "click" is a change of `useSearchParams` followed by a
 * re-render — exactly what `router.push` produces in the app.
 */
let currentSearch = ''
const push = vi.fn<(url: string) => void>()
vi.mock('next/navigation', () => ({
	// Wrapped rather than passed: the factory runs before the `const` above is initialised.
	useRouter: () => ({ push: (url: string) => push(url), replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams(currentSearch),
	usePathname: () => '/filament',
	// The route bodies import it; only their `generateMetadata` is under test here.
	notFound: vi.fn()
}))

const getCatalogProducts = vi.fn<(params: Record<string, string>) => Promise<CatalogResponse>>()
vi.mock('./catalog.api', async importOriginal => ({
	...(await importOriginal<typeof import('./catalog.api')>()),
	getCatalogProducts: (params: Record<string, string>) => getCatalogProducts(params),
	getCategoryBySlug: () => Promise.resolve(CATEGORY)
}))

/** What `generateMetadata` reads on the server. */
const serverFetch = vi.fn<(path: string) => Promise<unknown>>()
vi.mock('@/common/utils/server-fetch.utils', () => ({
	serverFetch: (path: string) => serverFetch(path)
}))

// Not under test; they would pull in `next/image` and the cart store. The grid still forwards
// `emptyAction`, which is the only thing it renders for an empty result.
vi.mock('./components/ProductGrid', () => ({
	ProductGrid: ({ items, emptyAction }: { items: unknown[]; emptyAction?: ReactNode }) => (
		<div data-testid='grid'>{items.length === 0 ? emptyAction : null}</div>
	)
}))
vi.mock('./components/PopularLandings', () => ({ PopularLandings: () => null }))
vi.mock('@/common/components/Breadcrumbs', () => ({ Breadcrumbs: () => null }))
vi.mock('@/common/components/JsonLd', () => ({
	JsonLd: ({ data }: { data: unknown }) => (
		<script type='application/ld+json' data-testid='json-ld'>
			{JSON.stringify(data)}
		</script>
	)
}))

import { CatalogPage } from './CatalogPage'
import { generateMetadata as categoryMetadata } from './page'
import { generateMetadata as landingMetadata } from './[landing]/page'

const CATEGORY: Category = {
	_id: 'cat1',
	name: 'Філамент',
	slug: 'filament',
	image: null,
	order: 0,
	required_attributes: [
		{
			key: 'polymer',
			label: 'Тип пластику',
			filter_type: 'multi-select',
			is_required: true,
			unit: null
		}
	],
	google_product_category: null,
	createdAt: '',
	updatedAt: ''
}

const catalog = (total: number): CatalogResponse => ({
	items: [],
	pagination: { total, page: 1, limit: 12, totalPages: 1 },
	price_range: { min: 100, max: 900 },
	facets: {
		polymer: [
			{ value: 'PLA', count: 180 },
			{ value: 'PETG', count: 72 },
			{ value: 'ABS', count: 26 }
		]
	},
	color_options: []
})

const SSR = catalog(301)
const EMPTY = catalog(0)

const LANDING: LandingContent = {
	h1: 'PLA Silk філамент',
	intro_html: '',
	bottom_html: '',
	faq: [
		{ q: 'Чи міцний PLA Silk?', a: 'Дещо крихкіший за звичайний PLA через добавки блиску.' },
		{ q: 'Яка температура друку?', a: 'Сопло 190–220 °C, стіл 50–60 °C.' }
	],
	slug: 'pla-silk'
}

/** What the landing endpoint answers for `/filament/pla-silk`. */
const LANDING_RESPONSE = {
	_id: 'l1',
	slug: 'pla-silk',
	h1: LANDING.h1,
	title: 'PLA Silk філамент — купити у Fillando',
	meta_description: 'Шовковий PLA із глянцевим блиском — усі кольори в наявності.',
	intro_html: '',
	bottom_html: '',
	faq: [],
	filters: { finish: ['Silk'] },
	category_slug: 'filament',
	category_name: 'Філамент'
}

/** What the backend answers per `?polymer=` value; a key in `pending` answers only when told. */
const RESPONSES: Record<string, CatalogResponse> = { '': SSR, PETG: catalog(72) }
const pending = new Map<string, Promise<CatalogResponse>>()

interface RenderOptions {
	initialCatalog?: CatalogResponse
	pinnedFilters?: Record<string, string[]>
	landing?: LandingContent
}

const renderPage = ({ initialCatalog = SSR, ...rest }: RenderOptions = {}) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const Page = () => (
		<QueryClientProvider client={client}>
			<CatalogPage
				categorySlug='filament'
				initialCategory={CATEGORY}
				initialCatalog={initialCatalog}
				{...rest}
			/>
		</QueryClientProvider>
	)
	const view = render(<Page />)
	return { rerender: () => view.rerender(<Page />), container: view.container }
}

/** The footer line «Показано … з N» — the listing's own total, not the H1's scope count. */
const footerTotal = (total: number) => screen.queryByText(new RegExp(`з ${total}$`))

beforeEach(() => {
	currentSearch = ''
	pending.clear()
	push.mockClear()
	getCatalogProducts.mockReset()
	getCatalogProducts.mockImplementation(params => {
		const key = params.polymer ?? ''
		return pending.get(key) ?? Promise.resolve(RESPONSES[key] ?? SSR)
	})
	serverFetch.mockReset()
	serverFetch.mockImplementation(path => {
		if (path.startsWith('/landings/slug/')) return Promise.resolve(LANDING_RESPONSE)
		if (path.startsWith('/categories/slug/')) return Promise.resolve(CATEGORY)
		return Promise.resolve([])
	})
})

describe('CatalogPage — the SSR catalogue seeds only the query it was fetched for', () => {
	it('renders the SSR response synchronously for the initial parameters', () => {
		renderPage()

		expect(footerTotal(301)).toBeInTheDocument()
	})

	it('keeps the previous narrowing on screen while the next loads, never the unfiltered SSR page', async () => {
		const page = renderPage()

		// First click: `?polymer=PETG` → 72.
		currentSearch = 'polymer=PETG'
		page.rerender()
		await waitFor(() => expect(footerTotal(72)).toBeInTheDocument())

		// Second click: `?polymer=PETG,ABS`, answer withheld. The page must still say 72 — the
		// narrowing the shopper is looking at — and not fall back to the SSR catalogue's 301,
		// which is what `initialData` did for every new key before the guard.
		let answer!: (value: CatalogResponse) => void
		pending.set('PETG,ABS', new Promise(resolve => (answer = resolve)))
		currentSearch = 'polymer=PETG,ABS'
		page.rerender()

		expect(footerTotal(72)).toBeInTheDocument()
		expect(footerTotal(301)).not.toBeInTheDocument()

		answer(catalog(98))
		await waitFor(() => expect(footerTotal(98)).toBeInTheDocument())
	})
})

describe('CatalogPage — «Знайдено N за фільтром …»', () => {
	it('names a narrowing by price alone, in words', async () => {
		currentSearch = 'price_min=240&price_max=900'
		renderPage()

		await waitFor(() =>
			expect(
				screen.getByText('Знайдено 301 товар за фільтром «ціна 240 ₴ – 900 ₴»')
			).toBeInTheDocument()
		)
	})

	it('names a key the category does not list as a dimension', async () => {
		// An old `?material=PLA` link: the backend filters by any unreserved key, so the grid is
		// narrowed and a silent line would leave a filtered listing looking unfiltered.
		currentSearch = 'material=PLA'
		renderPage()

		await waitFor(() =>
			expect(screen.getByText('Знайдено 301 товар за фільтром «PLA»')).toBeInTheDocument()
		)
	})

	it('drops the count while the next narrowing loads instead of showing the previous one', async () => {
		const page = renderPage()

		currentSearch = 'polymer=PETG'
		page.rerender()
		await waitFor(() =>
			expect(screen.getByText('Знайдено 72 товари за фільтром «PETG»')).toBeInTheDocument()
		)

		// The name of the filter is already the new one; the number would still be PETG's 72.
		let answer!: (value: CatalogResponse) => void
		pending.set('PETG,ABS', new Promise(resolve => (answer = resolve)))
		currentSearch = 'polymer=PETG,ABS'
		page.rerender()

		expect(screen.queryByText(/Знайдено/)).not.toBeInTheDocument()
		expect(screen.getByText('Шукаємо товари за фільтром «PETG, ABS»')).toBeInTheDocument()

		answer(catalog(98))
		await waitFor(() =>
			expect(
				screen.getByText('Знайдено 98 товарів за фільтром «PETG, ABS»')
			).toBeInTheDocument()
		)
	})
})

describe('CatalogPage — an empty result', () => {
	beforeEach(() => {
		getCatalogProducts.mockImplementation(() => Promise.resolve(EMPTY))
	})

	it('renders neither «Показано 0–0 з 0» nor the footer «на сторінці» selector', async () => {
		currentSearch = 'polymer=PETG'
		renderPage({ initialCatalog: EMPTY })

		await waitFor(() => expect(screen.getByText(/^Знайдено 0 товарів/)).toBeInTheDocument())
		expect(screen.queryByText(/Показано/)).not.toBeInTheDocument()
		// Only the one above the grid is left; the footer's copy went with the footer.
		expect(screen.getAllByLabelText('Кількість товарів на сторінці')).toHaveLength(1)
	})

	it('offers «Скинути фільтри», which drops the narrowing', () => {
		currentSearch = 'polymer=PETG'
		renderPage({ initialCatalog: EMPTY })

		fireEvent.click(screen.getByRole('button', { name: 'Скинути фільтри' }))

		expect(push).toHaveBeenCalledTimes(1)
		expect(push.mock.calls[0][0]).not.toContain('polymer')
	})

	it('sends a landing to itself rather than pretending its pinned filters can be dropped', () => {
		currentSearch = 'color_family=black'
		renderPage({
			initialCatalog: EMPTY,
			pinnedFilters: { finish: ['Silk'] },
			landing: LANDING
		})

		expect(screen.getByRole('link', { name: 'Скинути додаткові фільтри' })).toHaveAttribute(
			'href',
			'/filament/pla-silk'
		)
		expect(screen.queryByRole('button', { name: 'Скинути фільтри' })).not.toBeInTheDocument()
	})

	it('offers no action when the landing itself is empty — there is nothing to drop', () => {
		renderPage({
			initialCatalog: EMPTY,
			pinnedFilters: { finish: ['Silk'] },
			landing: LANDING
		})

		expect(screen.queryByRole('link', { name: /Скинути/ })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Скинути/ })).not.toBeInTheDocument()
	})
})

describe('CatalogPage — the landing FAQ', () => {
	it('says «Часті запитання», opens the first question and draws its own chevron', () => {
		const page = renderPage({ landing: LANDING })

		expect(screen.getByRole('heading', { name: 'Часті запитання' })).toBeInTheDocument()
		expect(screen.queryByText('Часті питання')).not.toBeInTheDocument()

		const items = page.container.querySelectorAll('details')
		expect(items).toHaveLength(2)
		expect(items[0]).toHaveAttribute('open')
		expect(items[1]).not.toHaveAttribute('open')

		// The native marker is suppressed and replaced by the chevron the mock draws.
		const summary = items[0].querySelector('summary')!
		expect(summary.className).toContain('list-none')
		expect(summary.querySelector('svg')).not.toBeNull()
	})

	it('keeps every answer in the HTML, so the FAQPage markup beside it stays truthful', () => {
		renderPage({ landing: LANDING })

		// The second row is closed, and its answer is still in the document.
		expect(screen.getByText('Сопло 190–220 °C, стіл 50–60 °C.')).toBeInTheDocument()

		const faq = JSON.parse(screen.getByTestId('json-ld').textContent!)
		expect(faq['@type']).toBe('FAQPage')
		expect(faq.mainEntity).toHaveLength(2)
		expect(faq.mainEntity[1].acceptedAnswer.text).toBe('Сопло 190–220 °C, стіл 50–60 °C.')
	})
})

describe('generateMetadata — page 2 of a listing is not a duplicate of page 1', () => {
	const landingArgs = (searchParams: Record<string, string>) => ({
		params: Promise.resolve({ category: 'filament', landing: 'pla-silk' }),
		searchParams: Promise.resolve(searchParams)
	})

	it('numbers the landing title from page 2 on', async () => {
		// `?page=2` is indexable and self-canonical, so the same <title> on both pages is two
		// indexed URLs claiming to be the same page.
		const first = await landingMetadata(landingArgs({}))
		const second = await landingMetadata(landingArgs({ page: '2' }))

		expect(first.title).toEqual({ absolute: 'PLA Silk філамент — купити у Fillando' })
		expect(second.title).toEqual({
			absolute: 'PLA Silk філамент — купити у Fillando — сторінка 2'
		})
		expect(second.alternates?.canonical).toBe(`${SITE_URL}/filament/pla-silk?page=2`)
		expect(second.openGraph).toMatchObject({
			title: 'PLA Silk філамент — купити у Fillando — сторінка 2'
		})
	})

	it('numbers the category title the same way', async () => {
		const args = (searchParams: Record<string, string>) => ({
			params: Promise.resolve({ category: 'filament' }),
			searchParams: Promise.resolve(searchParams)
		})

		const first = await categoryMetadata(args({}))
		const second = await categoryMetadata(args({ page: '2' }))

		expect(first.title).toBe('Філамент — купити у Fillando')
		expect(second.title).toBe('Філамент — сторінка 2 — купити у Fillando')
	})
})
