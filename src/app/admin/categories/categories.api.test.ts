import { beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesApi } from './categories.api'
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/common/services/http.service', () => ({ httpService: { get } }))
beforeEach(() => vi.resetAllMocks())

const option = (_id: string) => ({
	_id,
	name: _id,
	slug: _id,
	kind: 'product',
	attribute_contract_version: 1,
	order: 0,
	image: null,
	attribute_count: 0
})

describe('category options (Plan-0010 D06)', () => {
	it('reads every page of /categories/options, never the full list', async () => {
		get.mockResolvedValueOnce({
			revision: 3,
			items: [option('a'), option('b')],
			next_cursor: 'next'
		}).mockResolvedValueOnce({ revision: 3, items: [option('c')], next_cursor: null })
		expect((await categoriesApi.getOptions()).map(item => item._id)).toEqual(['a', 'b', 'c'])
		expect(get.mock.calls.map(call => call[0])).toEqual([
			'/categories/options',
			'/categories/options'
		])
		expect(get.mock.calls[0][1].params).toEqual({ limit: 1000 })
		expect(get.mock.calls[1][1].params).toEqual({ limit: 1000, cursor: 'next' })
	})
	it('never returns a list mixed from two revisions, and stops on a repeated cursor', async () => {
		get.mockResolvedValueOnce({
			revision: 3,
			items: [option('a')],
			next_cursor: 'next'
		}).mockResolvedValueOnce({ revision: 4, items: [option('b')], next_cursor: null })
		await expect(categoriesApi.getOptions()).rejects.toThrow('Список категорій змінився')
		get.mockResolvedValue({ revision: 3, items: [], next_cursor: 'loop' })
		await expect(categoriesApi.getOptions()).rejects.toThrow('Не вдалося завантажити')
	})
	it('reads one category with its characteristics by id', async () => {
		get.mockResolvedValueOnce({ _id: 'a' })
		await categoriesApi.getById('a')
		expect(get.mock.calls[0][0]).toBe('/categories/a')
	})
})
