vi.mock('@/common/constants/seo.constants', () => ({ SITE_URL: 'https://shop.example.invalid' }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
const fetcher = vi.hoisted(() => vi.fn())
const revalidateTag = vi.hoisted(() => vi.fn())
vi.mock('@/common/utils/server-fetch.utils', () => ({ serverFetch: fetcher }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag }))
import { GET as sitemapXml } from '@/app/sitemap.xml/route'
import { GET as sitemapFile } from '@/app/sitemap/[part]/route'
import { API_URLS } from '@/common/constants/api-routes.constants'

const stamp = { initialized: true, revision: 4, epoch: 2 }
const part = (variants: string[], pages = false) => ({
	...stamp,
	variants: variants.map(slug => ({ slug })),
	categories: pages ? [{ slug: 'electrical' }] : [],
	landings: pages ? [{ category_slug: 'electrical', slug: 'avr' }] : []
})
const one = { ...stamp, parts: [{ from: null, to: null, urls: 4 }] }
const three = {
	...stamp,
	parts: [
		{ from: null, to: 'b', urls: 4 },
		{ from: 'b', to: 'c', urls: 1 },
		{ from: 'c', to: null, urls: 1 }
	]
}
/** The backend: the index, then each part by its `from` (absent → the first). */
const backend = (index: unknown, parts: Record<string, unknown>) =>
	fetcher.mockImplementation(async (path: string) => {
		if (path === API_URLS.CATALOG_SITEMAP) return index
		const query = new URL(path, 'http://x').searchParams
		return parts[query.get('from') ?? '']
	})
const file = (n: string) =>
	sitemapFile(new Request('http://x'), { params: Promise.resolve({ part: n }) })
const locs = async (response: Response) =>
	[...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
beforeEach(() => {
	fetcher.mockReset()
	revalidateTag.mockReset()
})

describe('/sitemap.xml', () => {
	it('is the one urlset itself while the backend has one part — as before the split', async () => {
		backend(one, { '': part(['a', 'b'], true) })
		const response = await sitemapXml()
		expect(response.headers.get('content-type')).toBe('application/xml')
		const urls = await locs(response)
		expect(urls).toHaveLength(8 + 1 + 1 + 1 + 2)
		expect(urls).toContain('https://shop.example.invalid/catalog')
		expect(urls).toContain('https://shop.example.invalid/products/a')
		expect(fetcher).toHaveBeenCalledWith(API_URLS.CATALOG_SITEMAP, { cache: 'no-store' })
		expect(fetcher).toHaveBeenCalledWith(
			`${API_URLS.CATALOG_SITEMAP_PART}?revision=4&epoch=2`,
			{
				cache: 'no-store'
			}
		)
	})
	it('is a sitemap index of /sitemap/<n>.xml once the backend splits the set', async () => {
		backend(three, {})
		const response = await sitemapXml()
		const body = await response.clone().text()
		expect(body).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
		expect(await locs(response)).toEqual(
			[0, 1, 2].map(n => `https://shop.example.invalid/sitemap/${n}.xml`)
		)
	})
	it('does not turn upstream absence, failure or a malformed index into a partial sitemap', async () => {
		fetcher.mockResolvedValueOnce(null)
		await expect(sitemapXml()).rejects.toThrow()
		fetcher.mockRejectedValueOnce(new Error('Upstream 503'))
		await expect(sitemapXml()).rejects.toThrow('Upstream 503')
		fetcher.mockResolvedValueOnce({ ...stamp, parts: [{ from: 'x', to: null, urls: 1 }] })
		await expect(sitemapXml()).rejects.toThrow()
		fetcher.mockResolvedValueOnce({ ...stamp, parts: [] })
		await expect(sitemapXml()).rejects.toThrow()
	})
})

describe('/sitemap/<n>.xml', () => {
	it('lists every URL exactly once across the files; static pages only in the first', async () => {
		backend(three, { '': part(['a'], true), b: part(['b']), c: part(['c']) })
		const files = await Promise.all(['0.xml', '1.xml', '2.xml'].map(file))
		const urls = (await Promise.all(files.map(locs))).flat()
		expect(new Set(urls).size).toBe(urls.length)
		expect(await locs(await file('1.xml'))).toEqual(['https://shop.example.invalid/products/b'])
		expect(urls.filter(url => url === 'https://shop.example.invalid')).toHaveLength(1)
		// Every part is read with the index's revision and its own range.
		expect(fetcher).toHaveBeenCalledWith(
			`${API_URLS.CATALOG_SITEMAP_PART}?revision=4&epoch=2&from=b&to=c`,
			{ cache: 'no-store' }
		)
	})
	it.each(['3.xml', '01.xml', '1', 'x.xml', '-1.xml'])('is 404 for %s', async name => {
		backend(three, {})
		expect((await file(name)).status).toBe(404)
	})
	it('serves a part from a fresh index when the cached one is of an older revision', async () => {
		let calls = 0
		fetcher.mockImplementation(async (path: string) => {
			if (path === API_URLS.CATALOG_SITEMAP)
				return calls++ ? { ...three, revision: 5 } : three
			if (path.includes('revision=4')) throw new Error(`Upstream 409 for ${path}`)
			return { ...part(['b2']), revision: 5 }
		})
		expect(await locs(await file('1.xml'))).toEqual([
			'https://shop.example.invalid/products/b2'
		])
		expect(revalidateTag).toHaveBeenCalledWith('sitemap', { expire: 0 })
	})
})
