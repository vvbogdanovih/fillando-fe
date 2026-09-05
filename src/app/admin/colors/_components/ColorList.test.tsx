import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorList } from './ColorList'
import type { AdminColor } from '../colors.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

// The list only reads the dictionary; the delete call is the one API it would touch, and no
// test here clicks it.
vi.mock('../colors.api', () => ({ colorsApi: { delete: vi.fn() } }))

const color = (over: Partial<AdminColor> & Pick<AdminColor, 'name_en' | 'variant_count'>) =>
	({
		_id: over.name_en,
		name_uk: over.name_en,
		slug: over.name_en.toLowerCase(),
		family: 'black',
		hex_stops: ['#111418'],
		order: 0,
		...over
	}) as AdminColor

const renderList = (colors: AdminColor[]) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<ColorList colors={colors} selectedId={null} onSelect={vi.fn()} onCreate={vi.fn()} />
		</QueryClientProvider>
	)
}

/**
 * The «Варіантів» column (Plan-0005 D2). Without it the manual pass over the unrecognized
 * colour spellings is blind: nothing on the screen says which dictionary entries the catalogue
 * actually resolved to.
 */
describe('ColorList — «Варіантів» column', () => {
	it('shows how many variants use each colour', () => {
		renderList([
			color({ name_en: 'Black', variant_count: 34 }),
			color({ name_en: 'Gold', variant_count: 9 })
		])

		const black = screen.getByText('Black').closest('div[class*="cursor-pointer"]')!
		expect(within(black as HTMLElement).getByText('34')).toBeInTheDocument()

		const gold = screen.getByText('Gold').closest('div[class*="cursor-pointer"]')!
		expect(within(gold as HTMLElement).getByText('9')).toBeInTheDocument()
	})

	it('prints a literal 0 for a colour nothing points at', () => {
		renderList([color({ name_en: 'Candy', variant_count: 0 })])

		// A blank cell would read as "unknown"; the zero is the finding.
		expect(screen.getByText('0')).toBeInTheDocument()
	})

	/**
	 * The visible cell is the figure alone — a per-row caption costs the width the colour name
	 * needs at w-80, where the badge then paints over the numbers. The word survives for a
	 * screen reader, and once above the list for everyone else.
	 */
	it('names the column for a screen reader and above the list', () => {
		renderList([color({ name_en: 'Black', variant_count: 34 })])

		expect(screen.getAllByText('Варіантів')).toHaveLength(1)
		expect(
			screen.getByText(/скільки варіантів товарів використовують колір/)
		).toBeInTheDocument()
	})
})
