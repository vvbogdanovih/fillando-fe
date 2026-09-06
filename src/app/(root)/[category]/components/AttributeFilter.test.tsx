import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import type { FacetValue } from '../catalog.api'
import { AttributeFilter, SEARCH_THRESHOLD, VISIBLE_LIMIT } from './AttributeFilter'

afterEach(cleanup)

const POLYMER: RequiredAttribute = {
	key: 'polymer',
	label: 'Тип пластику',
	filter_type: 'multi-select',
	unit: null
}

const facet = (value: string, count: number | null = 1): FacetValue => ({ value, count })

const renderFilter = (options: FacetValue[], currentValue = '', onChange = vi.fn()) => {
	render(
		<AttributeFilter
			attribute={POLYMER}
			options={options}
			currentValue={currentValue}
			onChange={onChange}
		/>
	)
	return onChange
}

describe('AttributeFilter — counts', () => {
	it('shows the facet count after every value', () => {
		renderFilter([facet('PLA', 24), facet('PETG', 3)])

		expect(screen.getByText('(24)')).toBeInTheDocument()
		expect(screen.getByText('(3)')).toBeInTheDocument()
	})

	it('keeps a zero-count value in the list, muted but still tickable', () => {
		const onChange = renderFilter([facet('PLA', 24), facet('Wood', 0)])

		const wood = screen.getByLabelText(/Wood/)
		expect(wood).toBeEnabled()
		expect(screen.getByText('(0)')).toBeInTheDocument()

		fireEvent.click(wood)
		expect(onChange).toHaveBeenCalledWith('Wood')
	})

	it('shows no numbers when the backend sent none (compatibility fallback)', () => {
		renderFilter([facet('PLA', null), facet('PETG', null)])

		expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
		expect(screen.getByLabelText('PLA')).toBeInTheDocument()
	})

	it('toggles a value in and out of the comma-separated selection', () => {
		const onChange = renderFilter([facet('PLA'), facet('PETG')], 'PLA')

		fireEvent.click(screen.getByLabelText(/PETG/))
		expect(onChange).toHaveBeenCalledWith('PLA,PETG')

		fireEvent.click(screen.getByLabelText(/PLA/))
		expect(onChange).toHaveBeenCalledWith('')
	})
})

describe('AttributeFilter — long lists', () => {
	const many = (n: number) => Array.from({ length: n }, (_, i) => facet(`V${i + 1}`))

	it(`shows «Показати ще» after ${VISIBLE_LIMIT} values and expands on click`, () => {
		renderFilter(many(VISIBLE_LIMIT + 2))

		expect(screen.getAllByRole('checkbox')).toHaveLength(VISIBLE_LIMIT)
		const more = screen.getByRole('button', { name: 'Показати ще 2' })

		fireEvent.click(more)
		expect(screen.getAllByRole('checkbox')).toHaveLength(VISIBLE_LIMIT + 2)
		expect(screen.getByRole('button', { name: 'Згорнути' })).toBeInTheDocument()
	})

	it('keeps a selected value visible even when it falls beyond the limit', () => {
		renderFilter(many(VISIBLE_LIMIT + 2), 'V10')

		expect(screen.getByLabelText(/V10/)).toBeChecked()
		expect(screen.getAllByRole('checkbox')).toHaveLength(VISIBLE_LIMIT + 1)
	})

	it(`offers a search box above ${SEARCH_THRESHOLD} values and filters by label or value`, () => {
		renderFilter([...many(SEARCH_THRESHOLD), facet('TPU')])

		const search = screen.getByRole('searchbox', { name: /Пошук у групі/ })
		// «TPU (Flex)» is the shopper's label; typing the gloss must find the raw value.
		fireEvent.change(search, { target: { value: 'flex' } })

		expect(screen.getAllByRole('checkbox')).toHaveLength(1)
		expect(screen.getByLabelText(/TPU \(Flex\)/)).toBeInTheDocument()
	})

	it('says so when the search matches nothing', () => {
		renderFilter(many(SEARCH_THRESHOLD + 1))

		fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
		expect(screen.getByText('Нічого не знайдено')).toBeInTheDocument()
	})

	it('shows a selected value the search would hide, so it can be unticked', () => {
		renderFilter(many(SEARCH_THRESHOLD + 1), 'V3')

		fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'V1' } })
		expect(screen.getByLabelText(/V3/)).toBeChecked()
	})
})

describe('AttributeFilter — range-typed dimension', () => {
	it('renders a range dimension as the same value list rather than nothing', () => {
		render(
			<AttributeFilter
				attribute={{
					...POLYMER,
					key: 'vaha',
					label: 'Вага',
					filter_type: 'range',
					unit: 'кг'
				}}
				options={[facet('1', 300), facet('3', 1)]}
				currentValue=''
				onChange={vi.fn()}
			/>
		)

		expect(screen.getByLabelText(/^1 кг/)).toBeInTheDocument()
		expect(screen.getByLabelText(/^3 кг/)).toBeInTheDocument()
	})
})
