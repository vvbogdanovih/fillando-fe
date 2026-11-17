import { describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const { loadCatalogTree } = vi.hoisted(() => ({ loadCatalogTree: vi.fn() }))
vi.mock('@/common/utils/catalog-tree.server', () => ({ loadCatalogTree }))

const node = (slug: string, children: unknown[] = []) => ({
	id: slug.padEnd(24, '0'),
	name: slug,
	slug,
	href: `/${slug}`,
	kind: children.length ? 'group' : 'product',
	count: 1,
	children
})
const call = (slug: string) =>
	GET(new Request(`http://x/api/catalog-nav/trail?slug=${encodeURIComponent(slug)}`))

describe('GET /api/catalog-nav/trail (P09)', () => {
	loadCatalogTree.mockResolvedValue([node('root', [node('mid', [node('deep')])]), node('other')])
	it('answers the addresses from the root down to the category, the category included', async () => {
		const response = await call('deep')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ hrefs: ['/root', '/mid', '/deep'] })
	})
	it('is a 404 for an address that is no category of the public tree', async () => {
		for (const slug of ['faq', 'no-such', '', '../x'])
			expect((await call(slug)).status).toBe(404)
	})
	it('is a 503 the browser does not keep when the tree cannot be read', async () => {
		loadCatalogTree.mockRejectedValueOnce(new Error('Upstream 503'))
		const response = await call('deep')
		expect(response.status).toBe(503)
		expect(response.headers.get('cache-control')).toBe('no-store')
	})
})
