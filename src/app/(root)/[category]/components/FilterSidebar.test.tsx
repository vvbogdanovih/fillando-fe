import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import type { FacetValue } from '../catalog.api'
import { FilterSidebar } from './FilterSidebar'

afterEach(cleanup)

const dimension = (key: string, label: string): RequiredAttribute => ({
	key,
	label,
	filter_type: 'multi-select',
	unit: null
})
const ATTRIBUTES = [
	dimension('polymer', 'Тип пластику'),
	dimension('diametr', 'Діаметр'),
	dimension('finish', 'Ефект поверхні')
]

const facet = (value: string, count: number | null = 1): FacetValue => ({ value, count })

const renderSidebar = (
	facets: Record<string, FacetValue[]>,
	searchParams: Record<string, string> = {},
	colorOptions: { family: string; count: number; hex_stops: string[] }[] = []
) =>
	render(
		<FilterSidebar
			requiredAttributes={ATTRIBUTES}
			allAttributes={ATTRIBUTES}
			priceRange={{ min: 100, max: 900 }}
			facets={facets}
			colorOptions={colorOptions}
			searchParams={searchParams}
			onParamsChange={vi.fn()}
		/>
	)

describe('FilterSidebar — which groups exist', () => {
	it('does not render a dimension with fewer than two values in the category', () => {
		renderSidebar({
			polymer: [facet('PLA'), facet('PETG')],
			diametr: [facet('1.75', 301)],
			finish: []
		})

		expect(screen.getByRole('button', { name: /Тип пластику/ })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Діаметр/ })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Ефект поверхні/ })).not.toBeInTheDocument()
	})

	it('shows colour only once there are two families to choose between', () => {
		const black = { family: 'black', count: 3, hex_stops: ['#111'] }
		renderSidebar({}, {}, [black])
		expect(screen.queryByRole('button', { name: 'Колір' })).not.toBeInTheDocument()
		cleanup()

		renderSidebar({}, {}, [black, { family: 'red', count: 0, hex_stops: ['#e00'] }])
		expect(screen.getByRole('button', { name: 'Колір' })).toBeInTheDocument()
		// Both swatches are there, the zero-count one included.
		expect(screen.getByRole('button', { name: /Червоний/ })).toBeInTheDocument()
	})

	it('still lists a dimension whose values carry no counts (compatibility fallback)', () => {
		renderSidebar({ polymer: [facet('PLA', null), facet('PETG', null)] })

		expect(screen.getByRole('button', { name: /Тип пластику/ })).toBeInTheDocument()
		expect(screen.getByLabelText('PLA')).toBeInTheDocument()
	})
})

describe('FilterSidebar — accordion', () => {
	it('starts with every group open and shows how many values are ticked', () => {
		renderSidebar({ polymer: [facet('PLA'), facet('PETG')] }, { polymer: 'PLA,PETG' })

		expect(screen.getByLabelText(/PLA/)).toBeVisible()
		expect(screen.getByRole('button', { name: /Тип пластику/ })).toHaveTextContent('· 2')
	})

	it('collapses a group on click and hides its values', () => {
		renderSidebar({ polymer: [facet('PLA'), facet('PETG')] })

		fireEvent.click(screen.getByRole('button', { name: /Тип пластику/ }))

		expect(screen.queryByLabelText(/PLA/)).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Тип пластику/ })).toHaveAttribute(
			'data-state',
			'closed'
		)
	})

	it('opens a group that appears after mount', () => {
		const { rerender } = renderSidebar({})
		expect(screen.queryByRole('button', { name: /Тип пластику/ })).not.toBeInTheDocument()

		rerender(
			<FilterSidebar
				requiredAttributes={ATTRIBUTES}
				allAttributes={ATTRIBUTES}
				priceRange={{ min: 100, max: 900 }}
				facets={{ polymer: [facet('PLA'), facet('PETG')] }}
				colorOptions={[]}
				searchParams={{}}
				onParamsChange={vi.fn()}
			/>
		)

		expect(screen.getByRole('button', { name: /Тип пластику/ })).toHaveAttribute(
			'data-state',
			'open'
		)
		expect(screen.getByLabelText(/PLA/)).toBeInTheDocument()
	})
})
