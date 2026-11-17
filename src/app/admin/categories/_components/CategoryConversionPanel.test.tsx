import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryConversionPanel } from './CategoryConversionPanel'
import type { ConversionPlan, TreeItem } from '../category-tree.api'

const { typedProducts, typedLandings, conversionPlan } = vi.hoisted(() => ({
	typedProducts: vi.fn(),
	typedLandings: vi.fn(),
	conversionPlan: vi.fn()
}))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { typedProducts, typedLandings, conversionPlan }
}))

const id = (n: number) => n.toString(16).padStart(24, '0')
const node = (n: number, name: string, extra: Partial<TreeItem> = {}): TreeItem => ({
	_id: id(n),
	parent_id: null,
	name,
	slug: `c-${n}`,
	kind: 'product',
	status: 'active',
	order: n,
	attribute_contract_version: 2,
	...extra
})
const filament = node(1, 'Філамент', { slug: 'filament' })
const items = [
	filament,
	node(2, 'PLA'),
	node(3, 'PETG', { status: 'draft' }),
	node(4, 'Група', { kind: 'group' })
]
const report = (extra: Partial<ConversionPlan> = {}): ConversionPlan => ({
	plan_id: '6f1c2b8e-5d0a-4c7e-9b2f-0a1b2c3d4e5f',
	category_id: id(1),
	revision: 9,
	executable: true,
	counts: {
		products: 2,
		variants: 3,
		landings: 1,
		targets: 2,
		variants_to_draft: 1,
		routes: 1,
		patches: 9
	},
	products: [],
	landings: [],
	problems: [],
	warnings: [{ code: 'CONVERSION_ACTIVE_SKUS_TO_DRAFT', count: 1 }],
	...extra
})

beforeEach(() => {
	typedProducts.mockReset().mockResolvedValueOnce({
		category_id: id(1),
		revision: 9,
		items: [{ id: id(10), name: 'Kingroon PLA' }],
		next_cursor: 'next'
	})
	typedProducts.mockResolvedValueOnce({
		category_id: id(1),
		revision: 9,
		items: [{ id: id(11), name: 'Kingroon PETG' }],
		next_cursor: null
	})
	typedLandings.mockReset().mockResolvedValue({
		category_id: id(1),
		revision: 9,
		items: [{ _id: id(30), slug: 'pla', status: 'active' }]
	})
	conversionPlan.mockReset()
})
afterEach(cleanup)

function renderPanel(onSubmit = vi.fn()) {
	render(
		<CategoryConversionPanel
			item={filament}
			items={items}
			revision={9}
			disabled={false}
			onSubmit={onSubmit}
		/>
	)
	return onSubmit
}

describe('CategoryConversionPanel', () => {
	it('refuses to plan when the server listed only the first landings (P06)', async () => {
		typedLandings.mockReset().mockResolvedValue({
			category_id: id(1),
			revision: 9,
			items: [{ _id: id(30), slug: 'pla', status: 'active' }],
			truncated: true
		})
		renderPanel()
		fireEvent.click(screen.getByRole('button', { name: /Перетворити на групу з розподілом/ }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'У категорії понад 500 посадкових сторінок — план не може розподілити їх усі.'
		)
		expect(screen.queryByRole('button', { name: 'Перевірити план' })).toBeNull()
		expect(conversionPlan).not.toHaveBeenCalled()
	})
	it('loads every product page, assigns all and runs only a checked plan', async () => {
		const onSubmit = renderPanel()
		fireEvent.click(screen.getByRole('button', { name: /Перетворити на групу з розподілом/ }))
		expect(await screen.findByText('Товари (2)')).toBeTruthy()
		// Only other v2 product categories are targets — never itself or a group.
		const all = screen.getByRole('combobox', { name: 'Усі товари й сторінки в' })
		expect([...all.querySelectorAll('option')].map(option => option.textContent)).toEqual([
			'— оберіть категорію —',
			'PLA',
			'PETG (чернетка)'
		])
		const check = screen.getByRole('button', { name: 'Перевірити план' })
		expect((check as HTMLButtonElement).disabled).toBe(true)
		fireEvent.change(all, { target: { value: id(2) } })
		fireEvent.click(screen.getByRole('button', { name: 'Призначити всім' }))
		fireEvent.change(screen.getByRole('combobox', { name: 'Категорія для «Kingroon PETG»' }), {
			target: { value: id(3) }
		})
		conversionPlan.mockResolvedValue(report())
		fireEvent.click(check)
		expect(await screen.findByText(/2 товари, 3 варіанти, 1 посадкова сторінка/)).toBeTruthy()
		expect(conversionPlan).toHaveBeenCalledWith(id(1), {
			target_kind: 'group',
			assignments: [
				{ product_id: id(10), target_category_id: id(2) },
				{ product_id: id(11), target_category_id: id(3) }
			],
			landing_assignments: [{ landing_id: id(30), target_category_id: id(2) }],
			adopt_targets: true
		})
		expect(screen.getByText(/1 активний варіант перейдуть у категорії-чернетки/)).toBeTruthy()
		// A double-click must not pass the confirmation: the trigger itself turns into «Скасувати»
		// where it stands, so the second click cancels and nothing is sent.
		const trigger = screen.getByRole('button', { name: 'Перетворити на групу' })
		fireEvent.click(trigger)
		expect(trigger).toHaveTextContent('Скасувати')
		fireEvent.click(trigger)
		expect(screen.queryByRole('button', { name: /^Так, перетворити/ })).toBeNull()
		expect(onSubmit).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Перетворити на групу' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Так, перетворити «Філамент» на групу' })
		)
		expect(onSubmit).toHaveBeenCalledWith({
			type: 'convert',
			id: id(1),
			body: { kind: 'group', plan_id: report().plan_id, expected_revision: 9 }
		})
	})

	it('explains what blocks a plan and offers no execution', async () => {
		const onSubmit = renderPanel()
		fireEvent.click(screen.getByRole('button', { name: /Перетворити на групу з розподілом/ }))
		await screen.findByText('Товари (2)')
		fireEvent.change(screen.getByRole('combobox', { name: 'Усі товари й сторінки в' }), {
			target: { value: id(2) }
		})
		fireEvent.click(screen.getByRole('button', { name: 'Призначити всім' }))
		conversionPlan.mockResolvedValue(
			report({
				plan_id: null,
				executable: false,
				problems: [
					{
						code: 'CONVERSION_PRODUCT_LOSES_VALUES',
						product_id: id(10),
						target_category_id: id(2),
						dropped: [{ key: 'vyrobnyk', label: 'Виробник', value_label: 'Kingroon' }]
					},
					{
						code: 'CONVERSION_LANDING_SLUG_TAKEN',
						landing_id: id(30),
						target_category_id: id(2)
					},
					{ code: 'CONVERSION_PLAN_TOO_LARGE', detail: '612', limit: 400 }
				],
				warnings: []
			})
		)
		fireEvent.click(screen.getByRole('button', { name: 'Перевірити план' }))
		expect(
			await screen.findByText(/Kingroon PLA: у «PLA» немає місця для Виробник \(Kingroon\)/)
		).toBeTruthy()
		expect(
			screen.getByText('Сторінка /filament/pla: у «PLA» уже є сторінка з такою адресою.')
		).toBeTruthy()
		// The limit comes from the server (the journal's), not a number written into the admin (P08).
		expect(screen.getByText(/План завеликий \(612 змін, межа 400\)/)).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Перетворити на групу' })).toBeNull()
		expect(onSubmit).not.toHaveBeenCalled()
	})
})
