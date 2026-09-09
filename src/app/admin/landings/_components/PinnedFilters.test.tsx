import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinnedFilters } from './PinnedFilters'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

vi.mock('@/app/admin/categories/categories.api', () => ({
	categoriesApi: {
		getAll: () =>
			Promise.resolve([
				{
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
							unit: null
						},
						{
							key: 'finish',
							label: 'Ефект поверхні',
							filter_type: 'multi-select',
							unit: null
						}
					],
					createdAt: '',
					updatedAt: ''
				}
			])
	}
}))

// Wrapped rather than passed: the factory runs before the `const` below is initialised.
const getCatalogProducts = vi.fn<(params: Record<string, string>) => Promise<unknown>>()
vi.mock('@/app/(root)/[category]/catalog.api', async importOriginal => ({
	...(await importOriginal<typeof import('@/app/(root)/[category]/catalog.api')>()),
	getCatalogProducts: (params: Record<string, string>) => getCatalogProducts(params)
}))

/**
 * The picker reads its values off the catalogue's own `facets`, and the counter plate off the
 * same response's total — so one answer feeds both. `catalogFacets` stays real.
 *
 * The two dimensions are the ones the shop's data really holds several values of:
 * `reinforcement: CF, GF` and `finish: Glow, Luminous`.
 */
const catalogResponse = (total: number) => ({
	items: [],
	pagination: { total, page: 1, limit: 1, totalPages: 1 },
	price_range: { min: 100, max: 900 },
	facets: {
		reinforcement: [
			{ value: 'CF', count: 12 },
			{ value: 'GF', count: 7 }
		],
		finish: [
			{ value: 'Glow', count: 5 },
			{ value: 'Luminous', count: 3 }
		]
	},
	color_options: []
})

let matchTotal = 38

beforeEach(() => {
	matchTotal = 38
	getCatalogProducts.mockReset()
	getCatalogProducts.mockImplementation(() => Promise.resolve(catalogResponse(matchTotal)))
})

/**
 * The component is controlled: the toggles only compose if the caller stores what it is handed,
 * which is what the form does. `onChange` records every hand-off, so a test can read the value
 * the form would have saved.
 */
const renderFilters = (initial: Record<string, string[]> = {}) => {
	const onChange = vi.fn<(filters: Record<string, string[]>) => void>()
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const Harness = () => {
		const [value, setValue] = useState(initial)
		return (
			<PinnedFilters
				categoryId='cat1'
				value={value}
				onChange={next => {
					onChange(next)
					setValue(next)
				}}
			/>
		)
	}
	render(
		<QueryClientProvider client={client}>
			<Harness />
		</QueryClientProvider>
	)
	return { saved: () => onChange.mock.calls.at(-1)?.[0] }
}

const toggle = (option: string) => fireEvent.click(screen.getByRole('button', { name: option }))
const chip = (option: string) => screen.getByRole('button', { name: option })
const cards = () => screen.getAllByRole('group', { name: 'Значення' })

/** The facets arrive from the query, so nothing is clickable on the first paint. */
const waitForValues = (option: string) => waitFor(() => expect(chip(option)).toBeInTheDocument())

/**
 * «Значення» is deliberately a multi-select rather than the artboard's single dropdown, because
 * `reinforcement: CF, GF` and `finish: Glow, Luminous` exist in the data. A regression to one
 * value per attribute renders and saves fine — it just narrows every such landing to the wrong
 * products.
 */
describe('PinnedFilters — several values of one attribute', () => {
	it('adds the second value beside the first instead of replacing it', async () => {
		const form = renderFilters({ reinforcement: ['CF'] })
		await waitForValues('GF')

		toggle('GF')

		expect(form.saved()).toEqual({ reinforcement: ['CF', 'GF'] })
		expect(chip('CF')).toHaveAttribute('aria-pressed', 'true')
		expect(chip('GF')).toHaveAttribute('aria-pressed', 'true')
		// Both values belong to one filter, so the second one must not open a second card.
		expect(cards()).toHaveLength(1)
	})

	it('drops only the value that was switched off', async () => {
		const form = renderFilters({ finish: ['Glow', 'Luminous'] })
		await waitForValues('Luminous')

		toggle('Luminous')

		expect(form.saved()).toEqual({ finish: ['Glow'] })
		expect(chip('Glow')).toHaveAttribute('aria-pressed', 'true')
		expect(chip('Luminous')).toHaveAttribute('aria-pressed', 'false')
		// The amber line belongs to an empty card only — on a card that still pins something it
		// is a warning about nothing, on every card of every landing.
		expect(
			screen.queryByText('Оберіть хоча б одне значення, інакше фільтр не збережеться.')
		).not.toBeInTheDocument()
	})

	it('marks every pinned value as chosen, in each of its attributes', async () => {
		renderFilters({ reinforcement: ['CF', 'GF'], finish: ['Glow', 'Luminous'] })
		await waitForValues('Luminous')

		for (const option of ['CF', 'GF', 'Glow', 'Luminous']) {
			expect(chip(option)).toHaveAttribute('aria-pressed', 'true')
		}
		expect(cards()).toHaveLength(2)
	})

	/**
	 * Two halves of the same rule: an empty array would mean «pins nothing», so the key leaves
	 * the saved value — but the card stays put (`draftKeys`), or the filter vanishes from under
	 * the cursor of an editor who only wanted to swap one value for another.
	 */
	it('keeps the card but drops the key when the last value is switched off', async () => {
		const form = renderFilters({ reinforcement: ['CF'] })
		await waitForValues('CF')

		toggle('CF')

		expect(form.saved()).toEqual({})
		expect(cards()).toHaveLength(1)
		expect(chip('CF')).toHaveAttribute('aria-pressed', 'false')
		expect(
			screen.getByText('Оберіть хоча б одне значення, інакше фільтр не збережеться.')
		).toBeInTheDocument()

		// Swapping one value for another is the whole reason the card is kept, and the card that
		// comes back must be the same one: a draft key left beside the saved key renders the
		// dimension twice, with two «Значення» groups under one attribute.
		toggle('GF')

		expect(form.saved()).toEqual({ reinforcement: ['GF'] })
		expect(cards()).toHaveLength(1)
	})
})

/** The moment that is cheap to fix: the API refuses to publish a landing that matches nothing. */
describe('PinnedFilters — the counter plate', () => {
	it('says no product matches when nothing does', async () => {
		matchTotal = 0
		renderFilters({ reinforcement: ['CF', 'GF'] })

		expect(await screen.findByText('Під фільтр не підпадає жоден товар')).toBeInTheDocument()
	})

	it('states the count as a sentence when something does', async () => {
		renderFilters({ reinforcement: ['CF', 'GF'] })

		expect(await screen.findByText('Під фільтр підпадає 38 товарів')).toBeInTheDocument()
		expect(screen.queryByText('Під фільтр не підпадає жоден товар')).not.toBeInTheDocument()
	})

	/**
	 * The number is only worth showing if it was asked of the landing that will be published:
	 * the count query joins the pinned values the same way the route does, and narrowed to `CF`
	 * it would show the editor — and the publish guard reading the same number — the count for a
	 * different page.
	 */
	it('counts the values the landing pins, joined as one parameter', async () => {
		renderFilters({ reinforcement: ['CF', 'GF'] })

		expect(await screen.findByText('Під фільтр підпадає 38 товарів')).toBeInTheDocument()
		expect(getCatalogProducts).toHaveBeenCalledWith({
			category_id: 'cat1',
			limit: '1',
			reinforcement: 'CF,GF'
		})
		expect(getCatalogProducts).not.toHaveBeenCalledWith(
			expect.objectContaining({ reinforcement: 'CF' })
		)
	})
})
