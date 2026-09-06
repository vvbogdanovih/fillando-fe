import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import { ActiveFilterChips, clearableFilterKeys } from './ActiveFilterChips'

afterEach(cleanup)

const dimension = (key: string, label: string): RequiredAttribute => ({
	key,
	label,
	filter_type: 'multi-select',
	unit: null
})
const ATTRIBUTES = [dimension('polymer', 'Тип пластику'), dimension('finish', 'Ефект поверхні')]

const renderChips = (
	searchParams: Record<string, string>,
	pinnedFilters: Record<string, string[]> = {}
) => {
	const onParamsChange = vi.fn()
	render(
		<ActiveFilterChips
			attributes={ATTRIBUTES}
			pinnedFilters={pinnedFilters}
			searchParams={searchParams}
			onParamsChange={onParamsChange}
		/>
	)
	return onParamsChange
}

describe('clearableFilterKeys', () => {
	it('names every narrowing parameter and nothing that only shapes the listing', () => {
		expect(
			clearableFilterKeys(
				{
					page: '2',
					limit: '12',
					sort: 'price_asc',
					category_id: 'c1',
					polymer: 'PLA',
					color_family: 'black',
					price_min: '100',
					material: 'PLA'
				},
				{}
			)
		).toEqual(['polymer', 'color_family', 'price_min', 'material'])
	})

	it('leaves the keys a landing pins alone', () => {
		expect(
			clearableFilterKeys({ polymer: 'PLA', finish: 'Silk' }, { polymer: ['PLA'] })
		).toEqual(['finish'])
	})
})

describe('ActiveFilterChips — «Очистити все»', () => {
	it('removes every filter the shopper set, including one the category does not list', () => {
		const onParamsChange = renderChips({
			polymer: 'PLA',
			color_family: 'black',
			price_min: '100',
			price_max: '900',
			material: 'PLA',
			limit: '12'
		})

		fireEvent.click(screen.getByRole('button', { name: 'Очистити все' }))

		expect(onParamsChange).toHaveBeenCalledWith({
			polymer: null,
			color_family: null,
			price_min: null,
			price_max: null,
			material: null
		})
	})

	it('does not touch what the landing pins', () => {
		const onParamsChange = renderChips({ polymer: 'PLA', finish: 'Silk' }, { polymer: ['PLA'] })

		fireEvent.click(screen.getByRole('button', { name: 'Очистити все' }))

		expect(onParamsChange).toHaveBeenCalledWith({ finish: null })
	})

	it('is absent when only pinned filters are active', () => {
		renderChips({ polymer: 'PLA' }, { polymer: ['PLA'] })

		expect(screen.queryByRole('button', { name: 'Очистити все' })).not.toBeInTheDocument()
		expect(screen.getByText(/Тип пластику: PLA/)).toBeInTheDocument()
	})

	it('renders nothing at all with no filters', () => {
		const { container } = render(
			<ActiveFilterChips
				attributes={ATTRIBUTES}
				pinnedFilters={{}}
				searchParams={{ limit: '12', page: '2' }}
				onParamsChange={vi.fn()}
			/>
		)
		expect(container).toBeEmptyDOMElement()
	})
})

describe('ActiveFilterChips — a key the sidebar cannot name', () => {
	it('shows a chip with the raw key so the narrowing is visible and removable', () => {
		const onParamsChange = renderChips({ material: 'PLA,PETG' })

		const chip = screen.getByRole('button', { name: /Прибрати фільтр material: PLA, PETG/ })
		fireEvent.click(chip)

		expect(onParamsChange).toHaveBeenCalledWith({ material: null })
	})
})
