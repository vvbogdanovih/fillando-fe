import { describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const { loadCatalogTree } = vi.hoisted(() => ({ loadCatalogTree: vi.fn() }))
vi.mock('@/common/utils/catalog-tree.server', () => ({ loadCatalogTree }))

const node = (id: string, children: unknown[] = []) => ({
	id,
	name: `Cat ${id}`,
	slug: id,
	href: `/${id}`,
	kind: children.length ? 'group' : 'product',
	count: 1,
	children
})
const call = (id: string) => GET(new Request('http://x'), { params: Promise.resolve({ id }) })

describe('GET /api/catalog-nav/:id (Plan-0010 D06.5)', () => {
	const group = 'a'.repeat(24)
	const leaf = 'b'.repeat(24)
	const inner = 'c'.repeat(24)
	loadCatalogTree.mockResolvedValue([
		node(group, [node(leaf), node(inner, [node('d'.repeat(24))])])
	])
	it('answers one level of the branch, deeper ones marked lazy', async () => {
		const response = await call(group)
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			links: [
				{ href: `/${leaf}`, label: `Cat ${leaf}` },
				{ href: `/${inner}`, label: `Cat ${inner}`, lazy: true, id: inner }
			],
			more: 0
		})
	})
	it('is a 503 the browser does not keep when the tree cannot be read', async () => {
		loadCatalogTree.mockRejectedValueOnce(new Error('Upstream 503 for /categories/tree'))
		const response = await call(group)
		expect(response.status).toBe(503)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(await response.json()).toEqual({ links: [] })
	})
	it('is 404 for an unknown or malformed id', async () => {
		expect((await call('e'.repeat(24))).status).toBe(404)
		expect((await call('../x')).status).toBe(404)
	})
})
