import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CategoryFilterPreview } from './CategoryFilterPreview'
import { newDefinition, type CategoryConfiguration } from '../category-definitions.schema'
const { filterPreview } = vi.hoisted(() => ({ filterPreview: vi.fn() }))
vi.mock('../category-tree.api', () => ({ categoryTreeApi: { filterPreview } }))
const definitions = [
	{
		...newDefinition(),
		key: 'amps',
		label: 'Струм',
		value_type: 'number' as const,
		filter_type: 'range' as const,
		options: []
	},
	{
		...newDefinition(),
		key: 'auto',
		label: 'Автоматичний режим',
		value_type: 'boolean' as const,
		options: []
	},
	{ ...newDefinition(), key: 'name', label: 'Позначення', options: [] }
]
const config: CategoryConfiguration = {
	category_id: 'category',
	revision: 5,
	kind: 'product',
	status: 'draft',
	definitions,
	controls: {
		fields: definitions,
		filters: definitions,
		specs: definitions,
		variant_axes: ['amps', 'auto', 'name']
	}
}
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)
it('sends zero range bounds, actual false, and comma-containing strings without splitting or coercing', async () => {
	filterPreview.mockResolvedValue({
		category_id: 'category',
		revision: 5,
		total_variants: 2,
		total_products: 1,
		sample_variant_ids: [],
		facets: []
	})
	render(<CategoryFilterPreview config={config} disabled={false} />)
	fireEvent.click(screen.getByText('Перевірити фільтри на товарах'))
	fireEvent.change(screen.getByLabelText('Струм: від'), { target: { value: '0' } })
	fireEvent.change(screen.getByLabelText('Струм: до'), { target: { value: '16.5' } })
	fireEvent.click(screen.getByRole('checkbox', { name: 'Ні' }))
	fireEvent.change(screen.getByLabelText('Значення: Позначення'), {
		target: { value: 'Чорний, білий\nІнший' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Перевірити на товарах' }))
	await waitFor(() =>
		expect(filterPreview).toHaveBeenCalledWith('category', [
			{ key: 'amps', min: 0, max: 16.5 },
			{ key: 'auto', values: [false] },
			{ key: 'name', values: ['Чорний, білий', 'Інший'] }
		])
	)
	await screen.findByRole('status')
})
it('does not show an empty success after data or snapshot errors', async () => {
	filterPreview.mockRejectedValue({
		details: { details: { code: 'CATALOG_PREVIEW_DATA_UNAVAILABLE' } }
	})
	render(<CategoryFilterPreview config={config} disabled={false} />)
	fireEvent.click(screen.getByText('Перевірити фільтри на товарах'))
	fireEvent.click(screen.getByRole('button', { name: 'Перевірити на товарах' }))
	await screen.findByRole('alert')
	expect(screen.queryByRole('status')).not.toBeInTheDocument()
	filterPreview.mockResolvedValue({
		revision: 6,
		total_variants: 0,
		total_products: 0,
		facets: []
	})
	fireEvent.click(screen.getByRole('button', { name: 'Перевірити на товарах' }))
	await screen.findByText('Каталог змінився. Оновіть дерево перед перевіркою.')
	expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('rejects inverted ranges locally and keeps unsaved configuration disabled', async () => {
	const view = render(<CategoryFilterPreview config={config} disabled={false} />)
	fireEvent.click(screen.getByText('Перевірити фільтри на товарах'))
	fireEvent.change(screen.getByLabelText('Струм: від'), { target: { value: '20' } })
	fireEvent.change(screen.getByLabelText('Струм: до'), { target: { value: '10' } })
	fireEvent.click(screen.getByRole('button', { name: 'Перевірити на товарах' }))
	await screen.findByRole('alert')
	expect(filterPreview).not.toHaveBeenCalled()
	view.rerender(<CategoryFilterPreview config={config} disabled />)
	expect(screen.getByRole('button', { name: 'Перевірити на товарах' })).toBeDisabled()
})
