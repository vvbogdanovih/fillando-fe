import { beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryTreeApi } from './category-tree.api'
const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('@/common/services/http.service', () => ({ httpService: { get, post, patch } }))
beforeEach(() => vi.resetAllMocks())
describe('admin tree API', () => {
	it('collects every page with the cursor before returning a snapshot', async () => {
		get.mockResolvedValueOnce({
			revision: 4,
			items: [{ _id: 'one' }],
			next_cursor: 'next'
		}).mockResolvedValueOnce({ revision: 4, items: [{ _id: 'two' }], next_cursor: null })
		expect(await categoryTreeApi.tree()).toEqual({
			revision: 4,
			items: [{ _id: 'one' }, { _id: 'two' }]
		})
		expect(get.mock.calls[1][1].params.cursor).toBe('next')
	})
	it('never returns partial or mixed revision trees', async () => {
		get.mockResolvedValueOnce({
			revision: 4,
			items: [],
			next_cursor: 'next'
		}).mockResolvedValueOnce({ revision: 5, items: [], next_cursor: null })
		await expect(categoryTreeApi.tree()).rejects.toThrow('Дерево змінилося')
		get.mockResolvedValueOnce({
			revision: 4,
			items: [],
			next_cursor: 'next'
		}).mockRejectedValueOnce(Error('offline'))
		await expect(categoryTreeApi.tree()).rejects.toThrow('offline')
	})
	it('stops repeated cursors and duplicate items instead of looping', async () => {
		get.mockResolvedValue({ revision: 4, items: [], next_cursor: 'next' })
		await expect(categoryTreeApi.tree()).rejects.toThrow('повне дерево')
		get.mockResolvedValue({ revision: 4, items: [{ _id: 'same' }], next_cursor: 'next' })
		await expect(categoryTreeApi.tree()).rejects.toThrow('повтори')
	})
	it('sends the same command body and idempotency header without generating another key', async () => {
		const command = {
			type: 'details' as const,
			id: 'abc',
			body: { name: 'New', expected_revision: 5 }
		}
		await categoryTreeApi.execute({ key: 'unchanged', command })
		expect(patch).toHaveBeenCalledWith(
			'/categories/abc/admin/details',
			command.body,
			expect.objectContaining({ headers: { 'Idempotency-Key': 'unchanged' } })
		)
	})
})

it('reuses persisted product-creation data and key after serialization', async () => {
	const { pendingCategoryCommandSchema } = await import('./category-tree.api')
	const saved = pendingCategoryCommandSchema.parse(
		JSON.parse(
			JSON.stringify({
				key: '00000000-0000-4000-8000-000000000001',
				command: {
					type: 'product-create',
					body: {
						expected_revision: 1,
						category_id: '000000000000000000000001',
						vendor_id: '000000000000000000000002',
						name: 'Ковдра',
						variant_axis: null,
						attributes_v2: [],
						variants: [{ variant_value: null, price: 0, stock: 0 }]
					}
				}
			})
		)
	)
	await categoryTreeApi.execute(saved)
	await categoryTreeApi.execute(saved)
	expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
	expect(post).toHaveBeenCalledWith(
		'/products/admin/typed-drafts',
		saved.command.body,
		expect.objectContaining({ headers: { 'Idempotency-Key': saved.key } })
	)
})
