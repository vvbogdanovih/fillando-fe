import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorTable } from './ColorTable'
import type { AdminColor } from '../colors.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

// The table only reads the dictionary; delete is the one API it would touch, and no test here
// clicks it.
vi.mock('../colors.api', () => ({ colorsApi: { delete: vi.fn() } }))

const color = (over: Partial<AdminColor> & Pick<AdminColor, 'name_en' | 'variant_count'>) =>
	({
		_id: over.name_en,
		// Distinct from name_en on purpose: the two live in separate columns now, and a query
		// for one must not match the other.
		name_uk: `${over.name_en} укр`,
		slug: over.name_en.toLowerCase(),
		family: 'black',
		hex_stops: ['#111418'],
		order: 0,
		...over
	}) as AdminColor

const renderTable = (colors: AdminColor[]) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<ColorTable colors={colors} onSelect={vi.fn()} />
		</QueryClientProvider>
	)
}

const rowOf = (nameEn: string) => screen.getByText(nameEn).closest('tr') as HTMLElement

describe('ColorTable — the dictionary as a table', () => {
	it('has the columns of the mock, in order', () => {
		renderTable([color({ name_en: 'Black', variant_count: 34 })])

		const headers = screen.getAllByRole('columnheader').map(h => h.textContent?.trim())

		expect(headers).toEqual([
			'Зразок',
			'Name EN (канон)',
			'Назва укр',
			'Slug',
			'Родина',
			'Кольори нитки',
			'Варіантів',
			'Порядок',
			'Дії'
		])
	})

	/**
	 * Slug and Порядок are the two the previous master-list had physically nowhere to put — the
	 * whole reason the screen became a table.
	 */
	it('shows the slug and the order value on every row', () => {
		renderTable([
			color({
				name_en: 'Gold Silk',
				name_uk: 'Золотистий',
				slug: 'gold-silk',
				order: 20,
				variant_count: 3
			})
		])

		const row = rowOf('Gold Silk')
		expect(within(row).getByText('gold-silk')).toBeInTheDocument()
		expect(within(row).getByText('20')).toBeInTheDocument()
	})

	it('keeps the canonical English name and the Ukrainian one in separate columns', () => {
		renderTable([color({ name_en: 'Bambu Green', name_uk: 'Зелений Bambu', variant_count: 1 })])

		const row = rowOf('Bambu Green')
		expect(within(row).getByText('Зелений Bambu')).toBeInTheDocument()
	})

	describe('the «Кольори нитки» column', () => {
		it('prints the hex itself when there is only one stop', () => {
			renderTable([color({ name_en: 'Black', hex_stops: ['#111418'], variant_count: 34 })])

			expect(within(rowOf('Black')).getByText('#111418')).toBeInTheDocument()
		})

		it('counts the stops instead when there are several, in the right plural', () => {
			renderTable([
				color({ name_en: 'Duo', hex_stops: ['#a', '#b'], variant_count: 1 }),
				color({
					name_en: 'Rainbow',
					hex_stops: ['#a', '#b', '#c', '#d', '#e'],
					variant_count: 0
				})
			])

			expect(within(rowOf('Duo')).getByText('2 кольори')).toBeInTheDocument()
			expect(within(rowOf('Rainbow')).getByText('5 кольорів')).toBeInTheDocument()
		})

		it('paints one chip per stop, in the stored order', () => {
			renderTable([
				color({
					name_en: 'Trio',
					hex_stops: ['#111111', '#222222', '#333333'],
					variant_count: 1
				})
			])

			const chips = within(rowOf('Trio')).getAllByTitle(/^#/)
			expect(chips).toHaveLength(3)
			expect(chips.map(c => c.getAttribute('title'))).toEqual([
				'#111111',
				'#222222',
				'#333333'
			])
		})
	})

	/**
	 * The «Варіантів» column (Plan-0005 D2). A zero is the reading that matters: it marks a
	 * dictionary entry no variant resolved to, which is what the manual pass over the
	 * unrecognized colour spellings is hunting for.
	 */
	describe('the «Варіантів» column', () => {
		it('shows how many variants use each colour', () => {
			renderTable([
				color({ name_en: 'Black', variant_count: 34 }),
				color({ name_en: 'Gold', variant_count: 9 })
			])

			expect(within(rowOf('Black')).getByText('34')).toBeInTheDocument()
			expect(within(rowOf('Gold')).getByText('9')).toBeInTheDocument()
		})

		it('prints a literal 0 for a colour nothing points at', () => {
			renderTable([color({ name_en: 'Candy', order: 7, variant_count: 0 })])

			// A blank cell would read as "unknown"; the zero is the finding.
			expect(within(rowOf('Candy')).getByText('0')).toBeInTheDocument()
		})
	})

	it('sorts by order, then by the canonical name', () => {
		renderTable([
			color({ name_en: 'Zinc', order: 10, variant_count: 1 }),
			color({ name_en: 'Amber', order: 20, variant_count: 1 }),
			color({ name_en: 'Blue', order: 10, variant_count: 1 })
		])

		const names = screen
			.getAllByRole('row')
			.slice(1)
			.map(r => r.children[1].textContent)

		expect(names).toEqual(['Blue', 'Zinc', 'Amber'])
	})
})
