import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorFilter, SEARCH_DROPDOWN_THRESHOLD, type ColorOption } from './ColorFilter'

afterEach(cleanup)

const FAMILIES = [
	'black',
	'white',
	'gray',
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'purple',
	'pink'
]
const option = (family: string, count = 1): ColorOption => ({
	family,
	count,
	hex_stops: ['#123456']
})
const many = FAMILIES.map(f => option(f))

const renderFilter = (options: ColorOption[], currentValue = '', onChange = vi.fn()) => {
	render(<ColorFilter options={options} currentValue={currentValue} onChange={onChange} />)
	return onChange
}

const openDropdown = () => {
	fireEvent.click(screen.getByRole('button', { name: 'Знайти колір за назвою' }))
	return screen.getByRole('dialog')
}

describe('ColorFilter — chips', () => {
	it('toggles a family on and off as a comma-separated value', () => {
		const onChange = renderFilter([option('black'), option('red')], 'black')
		fireEvent.click(screen.getByRole('button', { name: /Червоний/ }))
		expect(onChange).toHaveBeenLastCalledWith('black,red')
		fireEvent.click(screen.getByRole('button', { name: /Чорний/ }))
		expect(onChange).toHaveBeenLastCalledWith('')
	})
})

describe('ColorFilter — search dropdown', () => {
	it('is absent while the list is short: the chips alone are quicker', () => {
		renderFilter(many.slice(0, SEARCH_DROPDOWN_THRESHOLD - 1))
		expect(
			screen.queryByRole('button', { name: 'Знайти колір за назвою' })
		).not.toBeInTheDocument()
	})

	it('appears above a long list and keeps every chip in place', () => {
		renderFilter(many)
		expect(screen.getByRole('button', { name: 'Знайти колір за назвою' })).toBeInTheDocument()
		// The chips are still all there — the dropdown duplicates, it does not replace.
		for (const label of ['Чорний', 'Білий', 'Рожевий']) {
			expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
		}
	})

	it('filters by the Ukrainian label and by the family key', () => {
		renderFilter(many)
		const panel = openDropdown()
		const search = within(panel).getByRole('searchbox', { name: 'Пошук кольору' })

		fireEvent.change(search, { target: { value: 'син' } })
		expect(within(panel).getAllByRole('checkbox')).toHaveLength(1)
		expect(within(panel).getByLabelText(/Синій/)).toBeInTheDocument()

		fireEvent.change(search, { target: { value: 'BLUE' } })
		expect(within(panel).getByLabelText(/Синій/)).toBeInTheDocument()

		fireEvent.change(search, { target: { value: 'бірюз' } })
		expect(within(panel).getByText('Нічого не знайдено')).toBeInTheDocument()
	})

	it('accepts the spellings suppliers use for a family', () => {
		renderFilter([...many, option('gray'), option('transparent')])
		const panel = openDropdown()
		const search = within(panel).getByRole('searchbox', { name: 'Пошук кольору' })

		fireEvent.change(search, { target: { value: 'grey' } })
		expect(within(panel).getByLabelText(/Сірий \(Gray\)/)).toBeInTheDocument()

		fireEvent.change(search, { target: { value: 'clear' } })
		expect(within(panel).getByLabelText(/Прозорий \(Transparent\)/)).toBeInTheDocument()
	})

	it('ticks through the same toggle as the chips and stays open for the next tick', () => {
		const onChange = renderFilter(many, 'black')
		const panel = openDropdown()

		fireEvent.click(within(panel).getByLabelText(/Червоний/))
		expect(onChange).toHaveBeenLastCalledWith('black,red')
		// Still open: a multi-select that closes on every tick is a single-select with extra steps.
		expect(screen.getByRole('dialog')).toBeInTheDocument()

		fireEvent.click(within(panel).getByLabelText(/Чорний/))
		expect(onChange).toHaveBeenLastCalledWith('')
	})

	it('names the ticked families on the trigger', () => {
		renderFilter(many, 'black,blue')
		expect(screen.getByRole('button', { name: 'Знайти колір за назвою' })).toHaveTextContent(
			'Обрано: Чорний (Black), Синій (Blue)'
		)
	})
})
