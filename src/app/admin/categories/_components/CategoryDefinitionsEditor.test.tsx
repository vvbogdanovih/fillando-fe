import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CategoryDefinitionsEditor } from './CategoryDefinitionsEditor'
import { WithDrafts } from './category-drafts.test-utils'
import {
	copyDefinitions,
	definitionsInputSchema,
	newDefinition
} from '../category-definitions.schema'
const { configuration, definitionUsage } = vi.hoisted(() => ({
	configuration: vi.fn(),
	definitionUsage: vi.fn()
}))
vi.mock('../category-tree.api', () => ({ categoryTreeApi: { configuration, definitionUsage } }))
const category = {
	_id: '000000000000000000000001',
	parent_id: null,
	name: 'АВР',
	slug: 'avr',
	kind: 'product' as const,
	status: 'draft' as const,
	order: 0,
	attribute_contract_version: 2 as const
}
const source = { ...category, _id: '000000000000000000000002', name: 'Інша категорія' }
const saved = {
	...newDefinition(),
	key: 'a_existing',
	label: 'Струм',
	value_type: 'number' as const,
	unit: 'А',
	filter_type: 'range' as const
}
const config = {
	category_id: category._id,
	revision: 7,
	kind: 'product',
	status: 'draft',
	definitions: [saved],
	controls: { fields: [saved], filters: [saved], specs: [saved], variant_axes: [saved.key] }
}
function mount(disabled = false) {
	const submit = vi.fn()
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<WithDrafts categoryId={category._id} revision={7} onSubmit={submit}>
				<CategoryDefinitionsEditor
					category={category}
					items={[category, source]}
					revision={7}
					disabled={disabled}
				/>
			</WithDrafts>
		</QueryClientProvider>
	)
	return submit
}
const unused = {
	key: saved.key,
	products: 0,
	variants: 0,
	landings: 0,
	pins: 0,
	missing: 0,
	options: []
}
const usage = (keys: object[] = [unused], published = false, products = 0) => ({
	category_id: category._id,
	revision: 7,
	published,
	products,
	keys
})
beforeEach(() => {
	vi.resetAllMocks()
	configuration.mockResolvedValue(config)
	definitionUsage.mockResolvedValue(usage())
})
afterEach(cleanup)
/** The list shows one-line summaries; «Редагувати <назва>» unfolds that characteristic's form. */
const open = async (label: string) =>
	fireEvent.click(await screen.findByRole('button', { name: `Редагувати ${label}` }))
it('lists one line per characteristic and unfolds only the one being edited', async () => {
	configuration.mockResolvedValue({
		...config,
		definitions: [saved, { ...saved, key: 'b_other', label: 'Полюси', order: 1 }]
	})
	mount()
	const list = await screen.findByRole('list', { name: 'Список характеристик' })
	expect(within(list).getAllByRole('listitem')).toHaveLength(2)
	expect(within(list).getAllByText('Фільтр · діапазон')).toHaveLength(2)
	expect(screen.queryByLabelText('Назва')).not.toBeInTheDocument()
	await open('Полюси')
	expect(screen.getByRole('group', { name: 'Характеристика 2' })).toBeInTheDocument()
	expect(screen.queryByRole('group', { name: 'Характеристика 1' })).not.toBeInTheDocument()
	fireEvent.change(screen.getByLabelText('Назва'), {
		target: { value: 'Полюси АВР' }
	})
	expect(within(list).getByText('змінено')).toBeInTheDocument()
	fireEvent.click(screen.getByRole('button', { name: 'Згорнути Полюси АВР' }))
	expect(screen.queryByLabelText('Назва')).not.toBeInTheDocument()
	// A new characteristic opens at once.
	fireEvent.click(screen.getByRole('button', { name: 'Додати характеристику' }))
	expect(screen.getByRole('group', { name: 'Характеристика 3' })).toBeInTheDocument()
})
it('keeps stable keys when renaming and turns a filter off only explicitly', async () => {
	const submit = mount()
	await open('Струм')
	fireEvent.change(screen.getByLabelText('Назва'), {
		target: { value: 'Номінальний струм' }
	})
	fireEvent.click(screen.getByRole('checkbox', { name: /^У фільтрах$/ }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).toHaveBeenCalledWith({
		type: 'definitions',
		id: category._id,
		body: {
			expected_revision: 7,
			definitions: [
				{ ...saved, label: 'Номінальний струм', filter_enabled: false, filter_type: null }
			]
		}
	})
})
it('validates an enum locally, then sends new options without inventing stable IDs', async () => {
	const submit = mount()
	await open('Струм')
	fireEvent.change(screen.getByLabelText('Тип значення'), { target: { value: 'enum' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).not.toHaveBeenCalled()
	fireEvent.change(screen.getByLabelText('Варіант 1'), {
		target: { value: 'Чотири полюси' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[0][0].body.definitions[0]).toMatchObject({
		key: saved.key,
		value_type: 'enum',
		options: [{ label: 'Чотири полюси', order: 0 }]
	})
	expect(submit.mock.calls[0][0].body.definitions[0].options[0]).not.toHaveProperty('id')
})
it('copies independent definitions only on explicit action and leaves the source unchanged', async () => {
	const copied = {
		...saved,
		key: 'source-key',
		value_type: 'enum',
		filter_type: 'multi-select',
		options: [{ id: 'source-option', label: '16 А', order: 0 }]
	}
	const submit = mount()
	await screen.findByRole('button', { name: 'Редагувати Струм' })
	configuration.mockResolvedValueOnce({
		...config,
		category_id: source._id,
		definitions: [copied]
	})
	fireEvent.change(screen.getByLabelText('Скопіювати з категорії'), {
		target: { value: source._id }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Замінити налаштування копією' }))
	await waitFor(() => expect(screen.getByText(/Список варіантів/)).toBeInTheDocument())
	await open('Струм')
	await screen.findByLabelText('Варіант 1')
	expect(submit).not.toHaveBeenCalled()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	await waitFor(() => expect(submit).toHaveBeenCalledOnce())
	const definition = submit.mock.calls[0][0].body.definitions[0]
	expect(definition).not.toHaveProperty('key')
	expect(definition.options[0]).not.toHaveProperty('id')
	expect(copied.key).toBe('source-key')
})
it('does not allow editing a stale snapshot or a disabled category', async () => {
	configuration.mockResolvedValueOnce({ ...config, revision: 8 })
	mount()
	await screen.findByRole('alert')
	// No form on a stale snapshot: nothing to edit, so nothing a save could send.
	expect(screen.queryByRole('list', { name: 'Список характеристик' })).not.toBeInTheDocument()
	cleanup()
	mount(true)
	// Read-only, yet it unfolds to be read.
	await open('Струм')
	expect(screen.getByLabelText('Назва')).toBeDisabled()
})
it('removes fields explicitly and can reset the unsaved edit', async () => {
	const submit = mount()
	await open('Струм')
	fireEvent.click(screen.getByRole('button', { name: 'Прибрати характеристику' }))
	fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
	expect(screen.getByLabelText('Назва')).toHaveValue('Струм')
	fireEvent.click(screen.getByRole('button', { name: 'Прибрати характеристику' }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[0][0].body.definitions).toEqual([])
})
it('rejects invalid range/multiple combinations and strips all copied identities', () => {
	expect(definitionsInputSchema.safeParse([{ ...saved, multiple: true }]).success).toBe(false)
	const copied = copyDefinitions([
		{ ...saved, options: [{ id: 'option', label: 'x', order: 0 }] }
	])
	expect(copied[0]).not.toHaveProperty('key')
	expect(copied[0].options[0]).not.toHaveProperty('id')
})
/** The brand of a v2 product without its own brand entity comes from here (owner, 2026-11-05). */
it('marks one text characteristic as the brand and explains what it feeds', async () => {
	const maker = { ...newDefinition(), key: 'vyrobnyk', label: 'Виробник', order: 1 }
	configuration.mockResolvedValue({ ...config, definitions: [saved, maker] })
	const submit = mount()
	await open('Виробник')
	expect(screen.getByRole('checkbox', { name: 'У таблиці на сторінці товару' })).toBeChecked()
	fireEvent.change(screen.getByLabelText('Призначення'), {
		target: { value: 'brand' }
	})
	expect(
		screen.getByText(
			'Бренд для фіду Google і розмітки сторінки: товар без нього не потрапить у Google Merchant.'
		)
	).toBeInTheDocument()
	const list = screen.getByRole('list', { name: 'Список характеристик' })
	// The summary badge; the select's option carries the same word.
	expect(within(list).getByText('Бренд', { selector: 'span' })).toBeInTheDocument()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[0][0].body.definitions[1]).toMatchObject({
		key: 'vyrobnyk',
		semantic: 'brand'
	})
})
it('warns while no required characteristic is the brand: Merchant refuses such items', async () => {
	const warning = /Немає обов’язкової характеристики з призначенням «Бренд»/
	const maker = { ...newDefinition(), key: 'vyrobnyk', label: 'Виробник', order: 1 }
	configuration.mockResolvedValue({ ...config, definitions: [saved, maker] })
	mount()
	await open('Виробник')
	expect(await screen.findByText(warning)).toBeVisible()
	fireEvent.change(screen.getByLabelText('Призначення'), { target: { value: 'brand' } })
	// A brand that is not required still lets a product go without one.
	expect(screen.getByText(warning)).toBeVisible()
	fireEvent.click(screen.getByRole('checkbox', { name: /Обов’язкова/ }))
	expect(screen.queryByText(warning)).toBeNull()
})
it('allows one brand per category and only on text or a list', () => {
	const brand = { ...newDefinition(), label: 'Бренд', semantic: 'brand' as const }
	expect(definitionsInputSchema.safeParse([brand]).success).toBe(true)
	expect(
		definitionsInputSchema.safeParse([brand, { ...brand, label: 'Виробник' }]).error?.issues
	).toMatchObject([
		{ path: [1, 'semantic'], message: 'Бренд може бути лише в однієї характеристики категорії' }
	])
	expect(
		definitionsInputSchema.safeParse([
			{ ...brand, value_type: 'number', filter_type: 'multi-select' }
		]).error?.issues
	).toMatchObject([{ path: [0, 'semantic'], message: 'Бренд — лише текст або список варіантів' }])
})
it('shows the exact usage of a published category and locks only what the server would refuse', async () => {
	const polymer = {
		...newDefinition(),
		key: 'polymer',
		label: 'Тип пластику',
		value_type: 'enum' as const,
		options: [
			{ id: 'pla', label: 'PLA', order: 0 },
			{ id: 'abs', label: 'ABS', order: 1 }
		]
	}
	const note = {
		...newDefinition(),
		key: 'note',
		label: 'Примітка',
		filter_enabled: false,
		filter_type: null,
		order: 1
	}
	configuration.mockResolvedValue({
		...config,
		status: 'active',
		definitions: [polymer, note],
		controls: { fields: [], filters: [], specs: [], variant_axes: [] }
	})
	definitionUsage.mockResolvedValue(
		usage(
			[
				{
					...unused,
					key: 'polymer',
					products: 36,
					landings: 2,
					pins: 2,
					options: [
						{ id: 'pla', products: 20, variants: 0, landings: 1 },
						{ id: 'abs', products: 0, variants: 0, landings: 0 }
					]
				},
				{ ...unused, key: 'note', missing: 44 }
			],
			true,
			44
		)
	)
	const submit = mount()
	expect(await screen.findByText(/36 товарів, 2 посадкові сторінки/)).toBeVisible()
	expect(screen.getByText(/Категорія опублікована/)).toBeVisible()
	await open('Тип пластику')
	await open('Примітка')
	const [polymerBox, noteBox] = screen.getAllByRole('group', { name: /^Характеристика \d$/ })
	const inPolymer = within(polymerBox)
	// Type, cardinality and unit cannot change while used: said as text, not offered as locked
	// fields (owner, 2026-11-07); the pinned filter keeps its reason beside it; no removal.
	expect(inPolymer.getByText('Список варіантів')).toBeVisible()
	expect(inPolymer.queryByLabelText('Тип значення')).toBeNull()
	expect(inPolymer.queryByRole('checkbox', { name: /Кілька значень/ })).toBeNull()
	// The meaning stays editable (owner, 2026-11-08) — never into the colour.
	const meaning = inPolymer.getByLabelText('Призначення')
	expect(meaning).toBeEnabled()
	expect(within(meaning).queryByRole('option', { name: 'Колір' })).toBeNull()
	expect(inPolymer.queryByLabelText(/Одиниця/)).toBeNull()
	expect(inPolymer.getByRole('checkbox', { name: /^У фільтрах$/ })).toBeDisabled()
	expect(inPolymer.getByText('закріплено на 2 посадкових сторінках')).toBeVisible()
	expect(inPolymer.queryByRole('button', { name: 'Прибрати характеристику' })).toBeNull()
	// Only the option nothing uses can go; the used one shows who holds it.
	expect(inPolymer.queryByRole('button', { name: 'Видалити варіант: PLA' })).toBeNull()
	const removeAbs = inPolymer.getByRole('button', { name: 'Видалити варіант: ABS' })
	expect(inPolymer.getByText('20 · 1 посадкова')).toBeVisible()
	// Required without values in 44 published products: blocked with the reason beside it.
	const inNote = within(noteBox)
	expect(inNote.getByRole('checkbox', { name: /Обов’язкова/ })).toBeDisabled()
	expect(inNote.getByText('немає значення в 44 товарах')).toBeVisible()
	expect(inNote.getByRole('button', { name: 'Прибрати характеристику' })).toBeEnabled()
	// No product holds a «Примітка» value: its unit stays editable.
	expect(inNote.getByLabelText('Одиниця вимірювання')).toBeEnabled()
	// A copy would replace used characteristics: not offered at all.
	expect(screen.queryByRole('button', { name: 'Замінити налаштування копією' })).toBeNull()
	// Allowed in place: a label, a new option, an unused option removed.
	fireEvent.change(inPolymer.getByLabelText('Назва'), {
		target: { value: 'Полімер' }
	})
	fireEvent.click(removeAbs)
	fireEvent.click(inPolymer.getByRole('button', { name: /Додати варіант/ }))
	fireEvent.change(inPolymer.getByLabelText('Варіант 2'), {
		target: { value: 'ASA' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[0][0].body.definitions[0]).toMatchObject({
		key: 'polymer',
		label: 'Полімер',
		options: [{ id: 'pla', label: 'PLA', order: 0 }, { label: 'ASA' }]
	})
})
it('explains a refused change with the counts the server sent', async () => {
	const { categoryError } = await import('../category-tree.utils')
	expect(
		categoryError({
			status: 409,
			details: {
				details: {
					code: 'DEFINITION_IN_USE',
					label: 'Колір',
					usage: { products: 36, variants: 301, landings: 1 }
				}
			}
		}).message
	).toBe(
		'Характеристику «Колір» не можна прибрати: її використовують 36 товарів, 301 SKU, 1 посадкова сторінка. Спершу приберіть значення з товарів і закріплення з посадкових сторінок.'
	)
	expect(
		categoryError({
			status: 409,
			details: {
				details: {
					code: 'REQUIRED_VALUES_MISSING',
					label: 'Діаметр',
					usage: { products: 44, variants: 0, landings: 0 }
				}
			}
		}).message
	).toMatch(/значення немає в 44 товарах/)
	expect(
		categoryError({
			status: 409,
			details: {
				details: {
					code: 'DEFINITION_UNIT_LOCKED',
					label: 'Вага',
					usage: { products: 36, variants: 0, landings: 0 }
				}
			}
		}).message
	).toBe(
		'Одиницю характеристики «Вага» не можна змінити: значення вже мають 36 товарів. Значення не перераховуються — «1000 г» стали б «1000 кг». Створіть нову характеристику з потрібною одиницею й перенесіть значення.'
	)
})
it('shows the colour as a filter that switches itself on, and keeps a variation in use required', async () => {
	const colour = {
		...newDefinition(),
		key: 'color',
		label: 'Колір',
		semantic: 'color' as const,
		is_required: true,
		filter_enabled: false,
		filter_type: null
	}
	configuration.mockResolvedValue({
		...config,
		definitions: [colour],
		controls: { fields: [], filters: [], specs: [], variant_axes: ['color'] }
	})
	definitionUsage.mockResolvedValue(
		usage([{ ...unused, key: 'color', products: 41, variants: 298 }], false, 41)
	)
	mount()
	const list = await screen.findByRole('list', { name: 'Список характеристик' })
	// The catalogue filters by colour family whatever the flag: the list says so.
	expect(within(list).getByText('Фільтр')).toBeInTheDocument()
	await open('Колір')
	const box = within(screen.getByRole('group', { name: 'Характеристика 1' }))
	const filter = box.getByRole('checkbox', { name: /^У фільтрах$/ })
	expect(filter).toBeChecked()
	expect(filter).toBeDisabled()
	expect(box.getByText('для кольору вмикається сам')).toBeInTheDocument()
	// 298 SKUs vary by it: it stays required.
	expect(box.getByRole('checkbox', { name: /Обов’язкова/ })).toBeDisabled()
	expect(box.getByText('за нею варіюються 298 SKU')).toBeInTheDocument()
})
it('gives a characteristic made a colour the colour shape and refuses a second colour', () => {
	const colour = {
		...newDefinition(),
		label: 'Колір',
		semantic: 'color' as const,
		filter_enabled: false,
		filter_type: null
	}
	expect(definitionsInputSchema.safeParse([colour]).success).toBe(true)
	expect(
		definitionsInputSchema.safeParse([colour, { ...colour, label: 'Колір 2' }]).success
	).toBe(false)
	expect(
		definitionsInputSchema.safeParse([
			{ ...colour, filter_enabled: true, filter_type: 'multi-select' }
		]).success
	).toBe(false)
})

it('orders characteristics and list options with arrows, not typed numbers (owner, 2026-11-07)', async () => {
	const poles = {
		...saved,
		key: 'b_poles',
		label: 'Полюси',
		value_type: 'enum' as const,
		filter_type: 'multi-select' as const,
		unit: null,
		order: 1,
		options: [
			{ id: 'two', label: 'Два', order: 0 },
			{ id: 'four', label: 'Чотири', order: 1 }
		]
	}
	configuration.mockResolvedValue({ ...config, definitions: [saved, poles] })
	const submit = mount()
	fireEvent.click(await screen.findByRole('button', { name: 'Вище: Полюси' }))
	const rows = within(screen.getByRole('list', { name: 'Список характеристик' })).getAllByRole(
		'listitem'
	)
	expect(rows[0]).toHaveTextContent('Полюси')
	expect(screen.getByRole('button', { name: 'Вище: Полюси' })).toBeDisabled()
	await open('Полюси')
	expect(screen.queryByLabelText(/Порядок/)).toBeNull()
	fireEvent.click(screen.getByRole('button', { name: 'Нижче: Два' }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[0][0].body.definitions).toMatchObject([
		{
			key: 'b_poles',
			order: 0,
			options: [
				{ id: 'four', order: 0 },
				{ id: 'two', order: 1 }
			]
		},
		{ key: saved.key, order: 1 }
	])
})
