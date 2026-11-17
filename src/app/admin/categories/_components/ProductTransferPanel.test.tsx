import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductTransferPanel } from './ProductTransferPanel'
import type { TransferPreview } from '../typed-product.schema'

const { transferPreview } = vi.hoisted(() => ({ transferPreview: vi.fn() }))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { transferPreview }
}))
vi.mock('@/app/admin/colors/colors.api', () => ({ colorsApi: { getAll: vi.fn() } }))

const product = '000000000000000000000010'
const target = '000000000000000000000002'
const definition = (key: string, label: string, extra: object = {}) => ({
	key,
	label,
	value_type: 'string' as const,
	unit: null,
	is_required: false,
	filter_enabled: false,
	filter_type: null,
	visible_in_specs: true,
	order: 0,
	multiple: false,
	semantic: 'generic' as const,
	options: [],
	...extra
})
const plan = (extra: Partial<TransferPreview> = {}): TransferPreview => ({
	revision: 7,
	product_id: product,
	name: 'Sunlu PLA',
	source: { id: '000000000000000000000001', name: 'Філамент', status: 'active' },
	target: {
		id: target,
		name: 'Філамент преміум',
		status: 'active',
		definitions: [
			definition('polymer_2', 'Тип пластику', { is_required: true }),
			definition('diameter', 'Діаметр', {
				value_type: 'number',
				unit: 'мм',
				is_required: true
			})
		]
	},
	mapped: [
		{
			source_key: 'polymer',
			target_key: 'polymer_2',
			target_label: 'Тип пластику',
			value: 'PLA'
		}
	],
	dropped: [
		{
			key: 'vyrobnyk',
			label: 'Виробник',
			value: 'Sunlu',
			value_label: 'Sunlu',
			reason: 'no_target'
		}
	],
	missing_required: ['diameter'],
	axis_problem: null,
	variants_to_draft: 0,
	proposal: {
		attributes_v2: [{ k: 'polymer_2', v: 'PLA' }],
		variant_axis: { key: 'colour_2' },
		variants: [{ id: '000000000000000000000020', variant_value: '000000000000000000000070' }]
	},
	...extra
})
function mount(submit = vi.fn()) {
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<ProductTransferPanel
				productId={product}
				revision={7}
				disabled={false}
				onSubmit={submit}
				targets={[{ id: target, name: 'Філамент преміум', status: 'active' }]}
			/>
		</QueryClientProvider>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Перенести в іншу категорію' }))
	fireEvent.change(screen.getByLabelText('Цільова категорія'), { target: { value: target } })
	return submit
}
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

describe('ProductTransferPanel', () => {
	it('shows what moves and what is lost, and sends the confirmed plan with the filled value', async () => {
		transferPreview.mockResolvedValue(plan())
		const submit = mount()
		expect(await screen.findByText('Тип пластику: PLA')).toBeInTheDocument()
		expect(screen.getByText('Виробник: Sunlu — немає в цільовій категорії')).toBeInTheDocument()
		const move = screen.getByRole('button', { name: 'Перенести товар' })
		expect(move).toBeDisabled()
		fireEvent.click(screen.getByLabelText('Підтверджую втрату цих значень'))
		expect(move).toBeEnabled()
		// A published target refuses to move without its required value.
		fireEvent.click(move)
		expect(screen.getByRole('alert')).toHaveTextContent('Заповніть «Діаметр»')
		expect(submit).not.toHaveBeenCalled()
		fireEvent.change(screen.getByLabelText('Діаметр (мм)'), { target: { value: '1.75' } })
		fireEvent.click(move)
		expect(transferPreview).toHaveBeenCalledWith(product, target)
		expect(submit).toHaveBeenCalledWith({
			type: 'transfer',
			id: product,
			body: {
				expected_revision: 7,
				target_category_id: target,
				attributes_v2: [
					{ k: 'polymer_2', v: 'PLA' },
					{ k: 'diameter', v: 1.75 }
				],
				variant_axis: { key: 'colour_2' },
				variants: [
					{ id: '000000000000000000000020', variant_value: '000000000000000000000070' }
				],
				confirm_dropped: ['vyrobnyk']
			}
		})
	})

	it('blocks an incompatible axis and warns about variants becoming drafts', async () => {
		transferPreview.mockResolvedValue(
			plan({
				axis_problem: 'AXIS_NO_TARGET',
				dropped: [],
				missing_required: [],
				variants_to_draft: 2
			})
		)
		mount()
		expect(await screen.findByRole('alert')).toHaveTextContent('Перенесення неможливе')
		expect(
			screen.getByText(/2 активні варіанти стануть чернетками й зникнуть/)
		).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Перенести товар' })).toBeDisabled()
	})
})
