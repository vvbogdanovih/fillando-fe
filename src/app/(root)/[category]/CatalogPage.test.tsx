import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '@/app/admin/categories/categories.schema'
import type { CatalogResponse } from './catalog.api'

afterEach(cleanup)

/**
 * The URL is the only filter state, so a "click" is a change of `useSearchParams` followed by a
 * re-render — exactly what `router.push` produces in the app.
 */
let currentSearch = ''
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams(currentSearch),
	usePathname: () => '/filament'
}))

const getCatalogProducts = vi.fn<(params: Record<string, string>) => Promise<CatalogResponse>>()
vi.mock('./catalog.api', async importOriginal => ({
	...(await importOriginal<typeof import('./catalog.api')>()),
	getCatalogProducts: (params: Record<string, string>) => getCatalogProducts(params),
	getCategoryBySlug: () => Promise.resolve(CATEGORY)
}))

// Not under test; they would pull in `next/image` and the cart store.
vi.mock('./components/ProductGrid', () => ({ ProductGrid: () => <div data-testid='grid' /> }))
vi.mock('./components/PopularLandings', () => ({ PopularLandings: () => null }))
vi.mock('@/common/components/Breadcrumbs', () => ({ Breadcrumbs: () => null }))
vi.mock('@/common/components/JsonLd', () => ({ JsonLd: () => null }))

import { CatalogPage } from './CatalogPage'

const CATEGORY: Category = {
	_id: 'cat1',
	name: 'Філамент',
	slug: 'filament',
	image: null,
	order: 0,
	required_attributes: [
		{ key: 'polymer', label: 'Тип пластику', filter_type: 'multi-select', unit: null }
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

/** What the backend answers per `?polymer=` value; a key in `pending` answers only when told. */
const RESPONSES: Record<string, CatalogResponse> = { '': SSR, PETG: catalog(72) }
const pending = new Map<string, Promise<CatalogResponse>>()

const renderPage = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const Page = () => (
		<QueryClientProvider client={client}>
			<CatalogPage categorySlug='filament' initialCategory={CATEGORY} initialCatalog={SSR} />
		</QueryClientProvider>
	)
	const view = render(<Page />)
	return { rerender: () => view.rerender(<Page />) }
}

/** The footer line «Показано … з N» — the listing's own total, not the H1's scope count. */
const footerTotal = (total: number) => screen.queryByText(new RegExp(`з ${total}$`))

beforeEach(() => {
	currentSearch = ''
	pending.clear()
	getCatalogProducts.mockReset()
	getCatalogProducts.mockImplementation(params => {
		const key = params.polymer ?? ''
		return pending.get(key) ?? Promise.resolve(RESPONSES[key] ?? SSR)
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
