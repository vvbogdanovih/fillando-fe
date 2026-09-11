import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '@/app/admin/categories/categories.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

/**
 * The route body is a server component, so it is called rather than rendered, and the catalogue
 * URL it asks `serverFetch` for is the whole behaviour under test — same approach as the
 * `generateMetadata` tests in `CatalogPage.test.tsx`.
 */
const serverFetch = vi.fn<(path: string, init?: unknown) => Promise<unknown>>()
vi.mock('@/common/utils/server-fetch.utils', () => ({
	serverFetch: (path: string, init?: unknown) => serverFetch(path, init)
}))

// The route and the category route it borrows `readPageNumber` from import these; nothing is
// rendered here, so nothing calls them.
vi.mock('next/navigation', () => ({
	notFound: vi.fn(),
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => '/filament'
}))

// Not under test — it would drag in `next/image` and the cart store — but its props are, so one
// test renders the returned tree to read them: `pinnedFilters` is the half of the promise that
// has to survive hydration.
const catalogProps = vi.fn<(props: Record<string, unknown>) => void>()
vi.mock('../CatalogPage', () => ({
	CatalogPage: (props: Record<string, unknown>) => {
		catalogProps(props)
		return null
	}
}))

import LandingRoutePage from './page'

const CATEGORY: Category = {
	_id: 'cat1',
	name: 'Філамент',
	slug: 'filament',
	image: null,
	order: 0,
	required_attributes: [
		{
			key: 'reinforcement',
			label: 'Армування',
			filter_type: 'multi-select',
			is_required: true,
			unit: null
		}
	],
	google_product_category: null,
	createdAt: '',
	updatedAt: ''
}

/** What the landing pins; each test sets it before opening the page. */
let filters: Record<string, string[]> = {}

const landingResponse = () => ({
	_id: 'l1',
	slug: 'armovanyi',
	h1: 'Армований філамент',
	title: 'Армований філамент — купити у Fillando',
	meta_description: 'CF і GF в наявності.',
	intro_html: '',
	bottom_html: '',
	faq: [],
	filters,
	category_slug: 'filament',
	category_name: 'Філамент'
})

beforeEach(() => {
	filters = {}
	catalogProps.mockReset()
	serverFetch.mockReset()
	serverFetch.mockImplementation(path => {
		if (path.startsWith('/categories/slug/')) return Promise.resolve(CATEGORY)
		if (path.startsWith('/landings/slug/')) return Promise.resolve(landingResponse())
		return Promise.resolve({
			items: [],
			pagination: { total: 0, page: 1, limit: 12, totalPages: 0 },
			price_range: { min: 0, max: 0 },
			facets: {},
			color_options: []
		})
	})
})

const openLanding = (searchParams: Record<string, string> = {}) =>
	LandingRoutePage({
		params: Promise.resolve({ category: 'filament', landing: 'armovanyi' }),
		searchParams: Promise.resolve(searchParams)
	})

/** The parameters the page actually asked the catalogue for. */
const catalogQuery = () => {
	const url = serverFetch.mock.calls
		.map(([path]) => path)
		.find(path => path.startsWith('/products/catalog?'))
	expect(url, 'the page never asked the catalogue for anything').toBeDefined()
	return new URLSearchParams(url!.split('?')[1])
}

/**
 * `reinforcement: CF, GF` is a landing that really exists, so the route has to carry every
 * pinned value into the query. Narrowing it to `values[0]` still renders a full page — of the
 * wrong products.
 */
describe('the landing route — a pinned filter with several values', () => {
	it('joins the values of one attribute into a single parameter', async () => {
		filters = { reinforcement: ['CF', 'GF'] }

		await openLanding()

		expect(catalogQuery().getAll('reinforcement')).toEqual(['CF,GF'])
	})

	/**
	 * The whole point of the second loop: a shopper who edits the address cannot widen the
	 * listing past what the landing promises, only narrow it further.
	 */
	it('overrides a same-named value that arrived in the query string', async () => {
		filters = { reinforcement: ['CF', 'GF'] }

		await openLanding({ reinforcement: 'GF', color_family: 'black' })

		const query = catalogQuery()
		expect(query.getAll('reinforcement')).toEqual(['CF,GF'])
		// The shopper's own extra narrowing still reaches the catalogue.
		expect(query.getAll('color_family')).toEqual(['black'])
	})

	/**
	 * Most of the fourteen landings pin one value, and several pin two dimensions at once
	 * (`polymer: PLA` + `finish: Silk`). A route that carried only the first entry of `filters`,
	 * or only the lists longer than one value, would list the whole category under an address
	 * that promises a slice of it.
	 */
	it('carries every pinned attribute, a lone value as well as a list', async () => {
		filters = { polymer: ['PLA'], finish: ['Glow', 'Luminous'] }

		await openLanding()

		const query = catalogQuery()
		expect(query.getAll('polymer')).toEqual(['PLA'])
		expect(query.getAll('finish')).toEqual(['Glow,Luminous'])
	})

	/**
	 * SSR is only the first paint. Every filter click after hydration is refetched by
	 * `CatalogPage`, which re-applies these pinned values itself — so a narrowed or empty copy
	 * of them widens the listing the moment the shopper touches the sidebar.
	 */
	it('hands the same pinned values to the client for its own refetches', async () => {
		filters = { reinforcement: ['CF', 'GF'], polymer: ['PLA'] }

		render(await openLanding())

		expect(catalogProps).toHaveBeenCalledWith(
			expect.objectContaining({
				pinnedFilters: { reinforcement: ['CF', 'GF'], polymer: ['PLA'] }
			})
		)
	})

	it('leaves out an attribute whose value list is empty', async () => {
		filters = { reinforcement: ['CF', 'GF'], finish: [] }

		await openLanding()

		expect(catalogQuery().has('finish')).toBe(false)
	})
})
