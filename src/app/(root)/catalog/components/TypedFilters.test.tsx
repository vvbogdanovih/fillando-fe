import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { emptyFilters } from '../typed-filters'
import { TypedFilters } from './TypedFilters'

// jsdom's document has focus only after an element took it; a browser's has it while its window is
// the active one — which is what a range form asks before applying on blur.
beforeEach(() => {
	vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

it('puts price and availability first, before the colour and the category dimensions', () => {
	render(
		<TypedFilters
			definitions={[
				{
					key: 'polymer',
					label: 'Тип пластику',
					value_type: 'string',
					unit: null,
					filter_enabled: true,
					filter_type: 'multi-select',
					order: 0,
					multiple: false,
					options: []
				}
			]}
			facets={{
				attributes: [
					{
						key: 'polymer',
						values: [
							{ value: 'PLA', count: 2 },
							{ value: 'PETG', count: 1 }
						],
						min: null,
						max: null
					}
				],
				categories: [
					{ id: 'a', label: 'АВР', count: 2 },
					{ id: 'b', label: 'Філамент', count: 1 }
				],
				brands: [],
				price: { min: 100, max: 900 },
				in_stock: { true: 2, false: 1 },
				colors: [
					{ family: 'black', count: 2, hex_stops: ['#000000'] },
					{ family: 'white', count: 1, hex_stops: ['#ffffff'] }
				]
			}}
			filters={emptyFilters()}
			onChange={() => {}}
		/>
	)
	expect(
		screen.getAllByRole('group').map(group => group.querySelector('legend')?.textContent)
	).toEqual(['Ціна, ₴', 'Наявність', 'Колір', 'Тип пластику'])
})

it('puts the colour where the category orders its definition (owner, 2026-11-07)', () => {
	const definition = (key: string, label: string, order: number, extra: object = {}) => ({
		key,
		label,
		value_type: 'string' as const,
		unit: null,
		filter_enabled: true,
		filter_type: 'multi-select' as const,
		order,
		multiple: false,
		options: [],
		...extra
	})
	const values = [
		{ value: 'a', count: 2 },
		{ value: 'b', count: 1 }
	]
	render(
		<TypedFilters
			definitions={[
				definition('series', 'Серія', 2),
				definition('color', 'Колір', 1, {
					semantic: 'color',
					filter_enabled: false,
					filter_type: null
				}),
				definition('polymer', 'Тип пластику', 0)
			]}
			facets={{
				attributes: [
					{ key: 'polymer', values, min: null, max: null },
					{ key: 'series', values, min: null, max: null }
				],
				categories: [],
				brands: [],
				price: { min: 100, max: 900 },
				in_stock: { true: 2, false: 1 },
				colors: [
					{ family: 'black', count: 2, hex_stops: ['#000000'] },
					{ family: 'white', count: 1, hex_stops: ['#ffffff'] }
				]
			}}
			filters={emptyFilters()}
			onChange={() => {}}
		/>
	)
	expect(
		screen.getAllByRole('group').map(group => group.querySelector('legend')?.textContent)
	).toEqual(['Ціна, ₴', 'Наявність', 'Тип пластику', 'Колір', 'Серія'])
})

const rangeFacets = {
	attributes: [{ key: 'current', values: [], min: 16, max: 63 }],
	categories: [],
	brands: [],
	price: { min: 100, max: 900 },
	in_stock: { true: 0, false: 3 },
	colors: []
}
const currentDefinition = {
	key: 'current',
	label: 'Струм',
	value_type: 'number' as const,
	unit: 'А',
	filter_enabled: true,
	filter_type: 'range' as const,
	order: 0,
	multiple: false,
	options: []
}

it('gives every range filter a slider over the scope bounds that applies on release', () => {
	const onChange = vi.fn()
	render(
		<TypedFilters
			definitions={[currentDefinition]}
			facets={rangeFacets}
			filters={emptyFilters()}
			onChange={onChange}
		/>
	)
	const priceFrom = screen.getByRole('slider', { name: 'Ціна: від' })
	expect(priceFrom).toHaveAttribute('aria-valuemin', '100')
	expect(priceFrom).toHaveAttribute('aria-valuemax', '900')
	expect(screen.getByRole('slider', { name: 'Ціна: до' })).toHaveAttribute('aria-valuenow', '900')
	expect(screen.getByRole('slider', { name: 'Струм: від' })).toHaveAttribute(
		'aria-valuenow',
		'16'
	)

	fireEvent.keyDown(screen.getByRole('slider', { name: 'Струм: від' }), { key: 'ArrowRight' })
	// A bound left at its end is no bound: only the moved thumb reaches the filter.
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ attributes: [{ key: 'current', min: 17 }] })
	)
})

it('shows a chosen range on the slider and clears the bound when dragged back to the end', () => {
	const onChange = vi.fn()
	render(
		<TypedFilters
			definitions={[]}
			facets={rangeFacets}
			filters={{ ...emptyFilters(), price: { min: 101 } }}
			onChange={onChange}
		/>
	)
	const from = screen.getByRole('slider', { name: 'Ціна: від' })
	expect(from).toHaveAttribute('aria-valuenow', '101')
	fireEvent.keyDown(from, { key: 'ArrowLeft' })
	expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: undefined }))
})

it('applies a characteristic below zero from the slider and the inputs, never a negative price', () => {
	const onChange = vi.fn()
	render(
		<TypedFilters
			definitions={[{ ...currentDefinition, key: 'temperature', label: 'Температура' }]}
			facets={{
				...rangeFacets,
				attributes: [{ key: 'temperature', values: [], min: -20, max: 10 }]
			}}
			filters={emptyFilters()}
			onChange={onChange}
		/>
	)
	fireEvent.keyDown(screen.getByRole('slider', { name: 'Температура: від' }), {
		key: 'ArrowRight'
	})
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ attributes: [{ key: 'temperature', min: -19 }] })
	)

	const from = screen.getByRole('textbox', { name: 'Температура: від' })
	// A phone's decimal keypad has no minus sign.
	expect(from).toHaveAttribute('inputmode', 'text')
	fireEvent.change(from, { target: { value: '-15,5' } })
	fireEvent.submit(from.closest('form')!)
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ attributes: [{ key: 'temperature', min: -15.5 }] })
	)

	onChange.mockClear()
	const priceFrom = screen.getByRole('textbox', { name: 'Ціна: від' })
	expect(priceFrom).toHaveAttribute('inputmode', 'decimal')
	fireEvent.change(priceFrom, { target: { value: '-5' } })
	fireEvent.submit(priceFrom.closest('form')!)
	expect(onChange).not.toHaveBeenCalled()
	expect(screen.getByText('Вкажіть числа від меншого до більшого')).toBeInTheDocument()
})

it('applies typed bounds without a button: on Enter or when focus leaves the pair (owner, 2026-11-14)', () => {
	const onChange = vi.fn()
	const panel = (price?: { min?: number; max?: number }) => (
		<TypedFilters
			definitions={[]}
			facets={rangeFacets}
			filters={{ ...emptyFilters(), price }}
			onChange={onChange}
		/>
	)
	const { rerender } = render(panel())
	// Every other filter applies at once; a «Застосувати» beside them read as doing nothing.
	expect(screen.queryByRole('button', { name: 'Застосувати' })).not.toBeInTheDocument()
	const from = screen.getByRole('textbox', { name: 'Ціна: від' })
	const to = screen.getByRole('textbox', { name: 'Ціна: до' })

	// Typing is local, and moving from «від» to «до» is not leaving the pair.
	fireEvent.change(from, { target: { value: '200' } })
	fireEvent.blur(from, { relatedTarget: to })
	expect(onChange).not.toHaveBeenCalled()

	// Leaving both fields (a click elsewhere, Tab, a phone keypad's «Готово») applies them together.
	fireEvent.change(to, { target: { value: '500' } })
	fireEvent.blur(to, { relatedTarget: null })
	expect(onChange).toHaveBeenCalledTimes(1)
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ price: { min: 200, max: 500 } })
	)

	// The range is in the address: leaving again without a change asks for nothing.
	rerender(panel({ min: 200, max: 500 }))
	fireEvent.blur(to, { relatedTarget: null })
	expect(onChange).toHaveBeenCalledTimes(1)

	// Enter applies too: two fields and no submit button submit nothing by themselves.
	fireEvent.change(to, { target: { value: '600' } })
	fireEvent.keyDown(to, { key: 'Enter' })
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ price: { min: 200, max: 600 } })
	)

	// A pair that makes no range is never sent; the reason stands under the fields.
	onChange.mockClear()
	fireEvent.change(to, { target: { value: '50' } })
	fireEvent.blur(to, { relatedTarget: null })
	expect(onChange).not.toHaveBeenCalled()
	expect(screen.getByText('Вкажіть числа від меншого до більшого')).toBeInTheDocument()
})

it('keeps a just-typed range when the click that ends it ticks another filter', () => {
	const onChange = vi.fn()
	// The address — the parent's `filters` — changes a round trip later: not re-rendered here.
	render(
		<TypedFilters
			definitions={[]}
			facets={{ ...rangeFacets, in_stock: { true: 2, false: 1 } }}
			filters={emptyFilters()}
			onChange={onChange}
		/>
	)
	const from = screen.getByRole('textbox', { name: 'Ціна: від' })
	fireEvent.change(from, { target: { value: '200' } })
	// The click on the checkbox: the field loses focus first, then the box is ticked.
	fireEvent.blur(from, { relatedTarget: null })
	fireEvent.click(screen.getByRole('checkbox', { name: /Є в наявності/ }))
	expect(onChange).toHaveBeenCalledTimes(2)
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ price: { min: 200 }, in_stock: true })
	)
})

it('builds a second quick tick on the first, and follows the address once it changes', () => {
	const onChange = vi.fn()
	const facets = {
		...rangeFacets,
		in_stock: { true: 2, false: 1 },
		brands: [
			{ id: 'b1', label: 'Бренд b1', count: 1 },
			{ id: 'b2', label: 'Бренд b2', count: 1 }
		]
	}
	const { rerender } = render(
		<TypedFilters
			definitions={[]}
			facets={facets}
			filters={emptyFilters()}
			onChange={onChange}
		/>
	)
	fireEvent.click(screen.getByRole('checkbox', { name: /Бренд b1/ }))
	fireEvent.click(screen.getByRole('checkbox', { name: /Бренд b2/ }))
	expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ brand_ids: ['b1', 'b2'] }))

	// The way back: the address says «no brand» again, and the next tick starts from it.
	rerender(
		<TypedFilters
			definitions={[]}
			facets={facets}
			filters={{ ...emptyFilters(), in_stock: true }}
			onChange={onChange}
		/>
	)
	fireEvent.click(screen.getByRole('checkbox', { name: /Бренд b2/ }))
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ brand_ids: ['b2'], in_stock: true })
	)
})

it('keeps its fields when its own range reaches the address: the focus and a half-typed bound stay', () => {
	const onChange = vi.fn()
	const panel = (price?: { min?: number; max?: number }) => (
		<TypedFilters
			definitions={[]}
			facets={rangeFacets}
			filters={{ ...emptyFilters(), price }}
			onChange={onChange}
		/>
	)
	const { rerender } = render(panel())
	const from = screen.getByRole('textbox', { name: 'Ціна: від' })
	const to = screen.getByRole('textbox', { name: 'Ціна: до' })
	// «від», the keypad's «Готово», then «до» — while the first request is still on its way.
	fireEvent.change(from, { target: { value: '200' } })
	fireEvent.blur(from, { relatedTarget: null })
	expect(onChange).toHaveBeenCalledTimes(1)
	to.focus()
	fireEvent.change(to, { target: { value: '5' } })

	// The address takes «від 200». A form recreated here dropped the focus and the typed «5».
	rerender(panel({ min: 200 }))
	expect(screen.getByRole('textbox', { name: 'Ціна: до' })).toBe(to)
	expect(to).toHaveFocus()
	expect(to).toHaveValue('5')
	expect(from).toHaveValue('200')

	fireEvent.change(to, { target: { value: '500' } })
	fireEvent.keyDown(to, { key: 'Enter' })
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ price: { min: 200, max: 500 } })
	)
})

it('keeps a slider thumb in place and focused when its step reaches the address', () => {
	const onChange = vi.fn()
	const panel = (price?: { min?: number; max?: number }) => (
		<TypedFilters
			definitions={[]}
			facets={rangeFacets}
			filters={{ ...emptyFilters(), price }}
			onChange={onChange}
		/>
	)
	const { rerender } = render(panel())
	const thumb = screen.getByRole('slider', { name: 'Ціна: від' })
	thumb.focus()
	fireEvent.keyDown(thumb, { key: 'ArrowRight' })
	expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: { min: 101 } }))
	rerender(panel({ min: 101 }))
	expect(screen.getByRole('slider', { name: 'Ціна: від' })).toBe(thumb)
	expect(thumb).toHaveFocus()
	expect(thumb).toHaveAttribute('aria-valuenow', '101')
})

it('asks again for a range that never reached the address — the field is never dead', () => {
	const onChange = vi.fn()
	render(
		<TypedFilters
			definitions={[]}
			facets={rangeFacets}
			filters={emptyFilters()}
			onChange={onChange}
		/>
	)
	const from = screen.getByRole('textbox', { name: 'Ціна: від' })
	fireEvent.change(from, { target: { value: '200' } })
	fireEvent.blur(from, { relatedTarget: null })
	expect(onChange).toHaveBeenCalledTimes(1)
	// Another navigation replaced that request (the address still has no price): what the field
	// shows is not applied, so Enter must ask for it again. It used to compare with its own note of
	// the last request and stay silent until a digit changed.
	fireEvent.keyDown(from, { key: 'Enter' })
	expect(onChange).toHaveBeenCalledTimes(2)
	expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: { min: 200 } }))
})

it('takes the address back when the address changes to what the form did not ask for', () => {
	const onChange = vi.fn()
	const panel = (filters: Partial<ReturnType<typeof emptyFilters>>) => (
		<TypedFilters
			definitions={[]}
			facets={{ ...rangeFacets, in_stock: { true: 2, false: 1 } }}
			filters={{ ...emptyFilters(), ...filters }}
			onChange={onChange}
		/>
	)
	const { rerender } = render(panel({ in_stock: true }))
	const from = screen.getByRole('textbox', { name: 'Ціна: від' })
	fireEvent.change(from, { target: { value: '200' } })
	fireEvent.blur(from, { relatedTarget: null })
	expect(onChange).toHaveBeenLastCalledWith(
		expect.objectContaining({ price: { min: 200 }, in_stock: true })
	)
	// «Очистити все» on that very click: the address is bare, the range never was in it. The field
	// must not go on showing a bound that filters nothing.
	rerender(panel({}))
	expect(from).toHaveValue('')
	// …and it applies as any other the next time.
	fireEvent.change(from, { target: { value: '200' } })
	fireEvent.keyDown(from, { key: 'Enter' })
	expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: { min: 200 } }))

	// A range in the address that another control removes (its chip, the way back) leaves the field too.
	rerender(panel({ price: { min: 200 } }))
	expect(from).toHaveValue('200')
	rerender(panel({}))
	expect(from).toHaveValue('')
})

it('keeps what is being typed when another filter reaches the address meanwhile', () => {
	const panel = (filters: Partial<ReturnType<typeof emptyFilters>>) => (
		<TypedFilters
			definitions={[]}
			facets={{ ...rangeFacets, in_stock: { true: 2, false: 1 } }}
			filters={{ ...emptyFilters(), ...filters }}
			onChange={() => {}}
		/>
	)
	const { rerender } = render(panel({}))
	const from = screen.getByRole('textbox', { name: 'Ціна: від' })
	fireEvent.change(from, { target: { value: '20' } })
	rerender(panel({ in_stock: true }))
	expect(from).toHaveValue('20')
})

it('does not apply a half-typed bound when the window or the tab loses focus', () => {
	const onChange = vi.fn()
	render(
		<TypedFilters
			definitions={[]}
			facets={rangeFacets}
			filters={emptyFilters()}
			onChange={onChange}
		/>
	)
	const to = screen.getByRole('textbox', { name: 'Ціна: до' })
	// «15» on the way to «150», and a look into another window: the field is blurred with the
	// window, not left. Applied, «до 15» found nothing — a 404 to come back to.
	fireEvent.change(to, { target: { value: '15' } })
	vi.mocked(document.hasFocus).mockReturnValue(false)
	fireEvent.blur(to, { relatedTarget: null })
	expect(onChange).not.toHaveBeenCalled()

	// Back in the window the field still has the focus; leaving the pair applies as always.
	vi.mocked(document.hasFocus).mockReturnValue(true)
	fireEvent.change(to, { target: { value: '150' } })
	fireEvent.blur(to, { relatedTarget: null })
	expect(onChange).toHaveBeenCalledTimes(1)
	expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: { max: 150 } }))
})
