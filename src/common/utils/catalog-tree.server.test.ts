import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCatalogTree, loadCategoryAncestors } from './catalog-tree.server'

const { serverFetch } = vi.hoisted(() => ({ serverFetch: vi.fn() }))
vi.mock('./server-fetch.utils', () => ({ serverFetch }))
beforeEach(() => {
	serverFetch.mockReset()
})

const crumb = (n: number) => ({ _id: `g${n}`, name: `Рівень ${n}`, slug: `level-${n}` })
const cached = { next: { tags: ['categories'] } }
const fresh = { cache: 'no-store' }
const conflict = (path: string) => new Error(`Upstream 409 for ${path}`)

describe('loadCategoryAncestors (Plan-0010 D06.4)', () => {
	it('reads every page of the path, root first, with the categories tag', async () => {
		serverFetch
			.mockResolvedValueOnce({
				revision: 7,
				total: 3,
				items: [crumb(0), crumb(1)],
				next_cursor: 'c 1'
			})
			.mockResolvedValueOnce({ revision: 7, total: 3, items: [crumb(2)], next_cursor: null })
		expect(await loadCategoryAncestors('leaf')).toEqual([crumb(0), crumb(1), crumb(2)])
		expect(serverFetch.mock.calls.map(call => call[0])).toEqual([
			'/categories/leaf/ancestors?limit=1000',
			'/categories/leaf/ancestors?limit=1000&cursor=c%201'
		])
		expect(serverFetch.mock.calls[0][1]).toEqual(cached)
	})
	it('never assembles a path from two revisions: it reads the whole path again, uncached', async () => {
		serverFetch
			.mockResolvedValueOnce({
				revision: 7,
				total: 2,
				items: [crumb(0)],
				next_cursor: 'next'
			})
			.mockResolvedValueOnce({ revision: 8, total: 2, items: [crumb(1)], next_cursor: null })
			.mockResolvedValueOnce({ revision: 8, total: 2, items: [crumb(0)], next_cursor: 'n8' })
			.mockResolvedValueOnce({ revision: 8, total: 2, items: [crumb(5)], next_cursor: null })
		expect(await loadCategoryAncestors('leaf')).toEqual([crumb(0), crumb(5)])
		expect(serverFetch.mock.calls.map(call => call[1])).toEqual([cached, cached, fresh, fresh])
	})
	it('is null for a category hidden or removed since its detail was read', async () => {
		serverFetch.mockResolvedValueOnce(null)
		expect(await loadCategoryAncestors('gone')).toBeNull()
		// Hidden between two pages: the fresh read finds it gone as well.
		serverFetch
			.mockResolvedValueOnce({
				revision: 7,
				total: 2,
				items: [crumb(0)],
				next_cursor: 'next'
			})
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null)
		expect(await loadCategoryAncestors('hidden')).toBeNull()
	})
	it('throws when the path keeps changing, and on any other upstream failure', async () => {
		serverFetch.mockImplementation(async (path: string) => {
			if (path.includes('cursor')) throw conflict(path)
			return { revision: 7, total: 2, items: [crumb(0)], next_cursor: 'next' }
		})
		await expect(loadCategoryAncestors('leaf')).rejects.toThrow('Upstream 409')
		expect(serverFetch).toHaveBeenCalledTimes(4)
		serverFetch.mockReset()
		serverFetch.mockRejectedValueOnce(new Error('Upstream 503 for /x'))
		await expect(loadCategoryAncestors('leaf')).rejects.toThrow('Upstream 503')
		expect(serverFetch).toHaveBeenCalledTimes(1)
	})
})

const row = (id: string, parent_id: string | null, kind: 'group' | 'product', order = 0) => ({
	_id: id,
	parent_id,
	kind,
	name: id.toUpperCase(),
	slug: id,
	order
})

describe('loadCatalogTree (Plan-0010 D06.5)', () => {
	it('counts from every page of the category counts, past the facet limit', async () => {
		serverFetch.mockImplementation(async (path: string) => {
			if (path.startsWith('/categories/tree'))
				return {
					revision: 1,
					items: [
						row('g', null, 'group'),
						row('a', 'g', 'product'),
						row('b', 'g', 'product', 1)
					],
					next_cursor: null
				}
			if (path === '/products/catalog/v2/category-counts')
				return { categories: [{ id: 'a', count: 2 }], next_cursor: 'n' }
			if (path === '/products/catalog/v2/category-counts?cursor=n')
				return { categories: [{ id: 'b', count: 1 }], next_cursor: null }
			throw new Error(`unexpected ${path}`)
		})
		const [group] = await loadCatalogTree()
		expect(group.count).toBe(3)
		expect(group.children.map(node => node.id)).toEqual(['a', 'b'])
	})
	it('falls back to the whole-catalogue facet on a backend without the counts', async () => {
		serverFetch.mockImplementation(async (path: string) => {
			if (path.startsWith('/categories/tree'))
				return { revision: 1, items: [row('a', null, 'product')], next_cursor: null }
			if (path.startsWith('/products/catalog/v2/category-counts')) return null
			if (path === '/products/catalog/v2?limit=1')
				return { facets: { categories: [{ id: 'a', count: 5 }] } }
			throw new Error(`unexpected ${path}`)
		})
		expect((await loadCatalogTree())[0].count).toBe(5)
	})
	it('reads the tree in the largest pages the backend serves', async () => {
		serverFetch.mockImplementation(async (path: string) => {
			if (path === '/categories/tree?limit=1000')
				return { revision: 1, items: [row('a', null, 'product')], next_cursor: 'p2' }
			if (path === '/categories/tree?limit=1000&cursor=p2')
				return { revision: 1, items: [row('b', null, 'product', 1)], next_cursor: null }
			if (path === '/products/catalog/v2/category-counts')
				return {
					categories: [
						{ id: 'a', count: 1 },
						{ id: 'b', count: 1 }
					],
					next_cursor: null
				}
			throw new Error(`unexpected ${path}`)
		})
		expect((await loadCatalogTree()).map(node => node.id)).toEqual(['a', 'b'])
	})
	it('walks the tree again, uncached, when a cached first page is of an older revision', async () => {
		// A product edit moved the revision on without purging `categories`: page 1 is still the
		// cached one of revision 1, and its cursor is refused until the walk starts over.
		let refused = false
		serverFetch.mockImplementation(async (path: string, init: unknown) => {
			if (path === '/categories/tree?limit=1000')
				return init === undefined || 'next' in (init as object)
					? { revision: 1, items: [row('a', null, 'product')], next_cursor: 'r1' }
					: { revision: 2, items: [row('a', null, 'product')], next_cursor: 'r2' }
			if (path === '/categories/tree?limit=1000&cursor=r1') {
				refused = true
				throw conflict(path)
			}
			if (path === '/categories/tree?limit=1000&cursor=r2')
				return { revision: 2, items: [row('c', null, 'product', 1)], next_cursor: null }
			if (path.startsWith('/products/catalog/v2/category-counts'))
				return {
					categories: [
						{ id: 'a', count: 1 },
						{ id: 'c', count: 4 }
					],
					next_cursor: null
				}
			throw new Error(`unexpected ${path}`)
		})
		expect((await loadCatalogTree()).map(node => [node.id, node.count])).toEqual([
			['a', 1],
			['c', 4]
		])
		expect(refused).toBe(true)
		const tree = serverFetch.mock.calls.filter(call =>
			String(call[0]).startsWith('/categories')
		)
		expect(tree.map(call => call[1])).toEqual([cached, cached, fresh, fresh])
	})
	it('restarts the counts on a 409 as well, and gives up after one fresh walk', async () => {
		let counts = 0
		serverFetch.mockImplementation(async (path: string, init: { cache?: string }) => {
			if (path.startsWith('/categories/tree'))
				return { revision: 1, items: [row('a', null, 'product')], next_cursor: null }
			if (path === '/products/catalog/v2/category-counts')
				return { categories: [{ id: 'a', count: ++counts }], next_cursor: 'n' }
			if (path === '/products/catalog/v2/category-counts?cursor=n') {
				if (!init.cache) throw conflict(path)
				return { categories: [], next_cursor: null }
			}
			throw new Error(`unexpected ${path}`)
		})
		expect((await loadCatalogTree())[0].count).toBe(2)
		serverFetch.mockImplementation(async (path: string) => {
			if (path.startsWith('/categories/tree')) throw conflict(path)
			throw new Error(`unexpected ${path}`)
		})
		await expect(loadCatalogTree()).rejects.toThrow('Upstream 409')
	})
})
