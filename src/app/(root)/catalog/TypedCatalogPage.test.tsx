import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicDefinition, TypedCatalogResponse } from './typed-catalog.types'

/**
 * The address is the listing's state, but it changes a round trip after a control asks for it — and
 * a navigation issued meanwhile replaces the one on its way. A typed range applies when its field
 * loses focus, which is the very click on the next control: a chip, the order, a page link, each
 * built on the address still on screen, dropped the range (review 2026-11-14). A «click» here is
 * what the app does: `router.push`, then a re-render with the new `useSearchParams`.
 */
let currentSearch = ''
const push = vi.fn<(url: string) => void>()
vi.mock('next/navigation', () => ({
	// Wrapped rather than passed: the factory runs before the `const` above is initialised.
	useRouter: () => ({ push: (url: string) => push(url) }),
	useSearchParams: () => new URLSearchParams(currentSearch),
	usePathname: () => '/avr'
}))
vi.mock('next/link', () => ({
	default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
		<a href={href} {...rest}>
			{children}
		</a>
	)
}))
vi.mock('./typed-catalog.api', () => ({ getTypedCatalog: () => Promise.resolve(response()) }))
// Not under test: the grid pulls in `next/image` and the cart store, the drawer a second copy of
// the panel, the order a Radix menu jsdom cannot open.
vi.mock('@/app/(root)/[category]/components/ProductGrid', () => ({ ProductGrid: () => null }))
vi.mock('@/app/(root)/[category]/components/PopularLandings', () => ({
	PopularLandings: () => null
}))
vi.mock('@/app/(root)/[category]/components/FilterDrawer', () => ({
	FilterDrawer: ({ onClearAll }: { onClearAll?: () => void }) =>
		onClearAll ? <button onClick={onClearAll}>Очистити</button> : null
}))
vi.mock('@/app/(root)/[category]/components/SortSelector', () => ({
	SortSelector: ({ onChange }: { onChange: (sort: string | null) => void }) => (
		<button onClick={() => onChange('price_asc')}>Спочатку дешевші</button>
	)
}))
vi.mock('@/common/components/Breadcrumbs', () => ({ Breadcrumbs: () => null }))
vi.mock('@/common/components/JsonLd', () => ({ JsonLd: () => null }))

import { TypedCatalogPage, type TypedCatalogScope } from './TypedCatalogPage'
import { apiQuery, parseListingParams } from './typed-filters'

const DEFINITIONS: PublicDefinition[] = [
	{
		key: 'poles',
		label: 'Полюси',
		value_type: 'string',
		unit: null,
		filter_enabled: true,
		filter_type: 'multi-select',
		order: 0,
		multiple: false,
		options: []
	}
]
const response = (): TypedCatalogResponse => ({
	revision: 1,
	page: 1,
	limit: 24,
	// Three pages: the page links are on screen.
	total: 60,
	items: [],
	facets: {
		attributes: [
			{
				key: 'poles',
				values: [
					{ value: '1P', count: 40 },
					{ value: '3P', count: 20 }
				],
				min: null,
				max: null
			}
		],
		categories: [],
		brands: [],
		price: { min: 100, max: 900 },
		in_stock: { true: 50, false: 10 }
	}
})
const SCOPE: TypedCatalogScope = {
	categoryId: 'c1',
	path: '/avr',
	name: 'АВР',
	h1: 'АВР',
	crumbs: [],
	definitions: DEFINITIONS,
	introHtml: null,
	bottomHtml: null,
	pinned: null,
	faq: [],
	popularLandings: [],
	categorySlug: 'avr'
}

/** The page at an address, and `land` — the address a navigation ended on. */
function open(search: string) {
	currentSearch = search
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const initialQuery = apiQuery(
		parseListingParams(new URLSearchParams(search), DEFINITIONS)!,
		'c1'
	)
	const page = () => (
		<QueryClientProvider client={client}>
			<TypedCatalogPage
				scope={SCOPE}
				initialResponse={response()}
				initialQuery={initialQuery}
			/>
		</QueryClientProvider>
	)
	const view = render(page())
	return {
		land: (next: string) => {
			currentSearch = next
			view.rerender(page())
		}
	}
}
/** «від N» typed and left for another control: the field loses focus first. */
function typeFrom(value: string) {
	const from = screen.getByRole('textbox', { name: 'Ціна: від' })
	fireEvent.change(from, { target: { value } })
	fireEvent.blur(from, { relatedTarget: null })
	return from
}
const lastPush = () => push.mock.calls.at(-1)?.[0]

/** Whether the page itself cancelled a link's click — then cancelled here, for jsdom's sake. */
let cancelled: boolean | undefined
const recordClick = (event: Event) => {
	cancelled = event.defaultPrevented
	event.preventDefault()
}

beforeEach(() => {
	push.mockClear()
	cancelled = undefined
	// jsdom's document has focus only after an element took it; a browser's while its window is active.
	vi.spyOn(document, 'hasFocus').mockReturnValue(true)
	document.addEventListener('click', recordClick)
})
afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	document.removeEventListener('click', recordClick)
})

describe('TypedCatalogPage — every control builds on the last request', () => {
	it('removes a chip from what was asked for: the range typed just before the click stays', () => {
		open('f.poles=1P')
		typeFrom('200')
		expect(lastPush()).toBe('/avr?f.poles=1P&price.min=200')
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати фільтр Полюси: 1P' }))
		expect(lastPush()).toBe('/avr?price.min=200')
	})

	it('keeps the range when the order is chosen before it reaches the address', () => {
		open('f.poles=1P')
		typeFrom('200')
		fireEvent.click(screen.getByRole('button', { name: 'Спочатку дешевші' }))
		expect(lastPush()).toBe('/avr?f.poles=1P&price.min=200&sort=price_asc')
	})

	it('clears everything on «Очистити все» and «Очистити», the just-typed range and its field too', () => {
		for (const name of ['Очистити все', 'Очистити']) {
			const { land } = open('f.poles=1P')
			const from = typeFrom('200')
			fireEvent.click(screen.getByRole('button', { name }))
			expect(lastPush(), name).toBe('/avr')
			land('')
			// The address has no price: the field must not go on showing a bound that filters nothing…
			expect(from, name).toHaveValue('')
			// …and it applies as any other the next time.
			typeFrom('300')
			expect(lastPush(), name).toBe('/avr?price.min=300')
			cleanup()
		}
	})

	it('does not let a page link of the listing on screen replace a narrowing on its way', () => {
		const { land } = open('')
		const second = () => screen.getAllByRole('link', { name: 'Сторінка 2' })[0]
		// Nothing asked for: a page link is a plain link.
		fireEvent.click(second())
		expect(cancelled).toBe(false)
		expect(push).not.toHaveBeenCalled()

		typeFrom('200')
		expect(push).toHaveBeenCalledTimes(1)
		// The same click lands on «2» of the unfiltered listing: the range is asked for again.
		fireEvent.click(second())
		expect(cancelled).toBe(true)
		expect(push).toHaveBeenCalledTimes(2)
		expect(lastPush()).toBe('/avr?price.min=200')
		// Another tab is the visitor's own business.
		fireEvent.click(second(), { metaKey: true })
		expect(cancelled).toBe(false)

		// The range is in the address: the page links are its own again.
		land('price.min=200')
		fireEvent.click(second())
		expect(cancelled).toBe(false)
		expect(push).toHaveBeenCalledTimes(2)
	})

	it('follows the address again once it changes — the request or the way back', () => {
		const { land } = open('f.poles=1P')
		fireEvent.click(screen.getByRole('checkbox', { name: /3P/ }))
		expect(lastPush()).toBe('/avr?f.poles=1P&f.poles=3P')
		land('f.poles=1P&f.poles=3P')
		// Back to where the request was made from: it is not «on its way» a second time.
		land('f.poles=1P')
		fireEvent.click(screen.getAllByRole('link', { name: 'Сторінка 2' })[0])
		expect(cancelled).toBe(false)
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати фільтр Полюси: 1P' }))
		expect(lastPush()).toBe('/avr')
	})
})
