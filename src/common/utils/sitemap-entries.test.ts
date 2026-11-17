vi.mock('@/common/constants/seo.constants', () => ({ SITE_URL: 'https://shop.example.invalid' }))
import { describe, expect, it, vi } from 'vitest'
import { buildSitemapEntries } from './sitemap-entries'
const empty = {
	initialized: true,
	revision: 1,
	epoch: 2,
	variants: [],
	categories: [],
	landings: []
}
describe('sitemap export', () => {
	it('uses only actual edit dates and retains existing legacy URL structure', () => {
		const rows = buildSitemapEntries({
			...empty,
			variants: [{ slug: 'avr-63a', updatedAt: '2026-10-01T12:00:00Z' }],
			categories: [{ slug: 'electrical' }],
			landings: [{ category_slug: 'electrical', slug: 'avr' }]
		})
		expect(rows.find(row => row.url.endsWith('/products/avr-63a'))?.lastModified).toEqual(
			new Date('2026-10-01T12:00:00Z')
		)
		expect(rows.find(row => row.url.endsWith('/electrical/avr'))).toBeDefined()
		expect(rows.filter(row => row.url === 'https://shop.example.invalid/catalog')).toHaveLength(
			1
		)
		expect(rows.find(row => row.url.endsWith('/electrical'))).not.toHaveProperty('lastModified')
		expect(rows[0]).not.toHaveProperty('lastModified')
	})
	it.each([
		null,
		{},
		{ ...empty, landings: undefined },
		{ ...empty, variants: [{ slug: 'ok', updatedAt: 'invalid' }] },
		{ ...empty, categories: [{ slug: '../external' }] }
	])('rejects absent, incomplete or malformed export %j', input => {
		expect(() => buildSitemapEntries(input)).toThrow()
	})
	it('accepts explicitly empty sources from a successful complete export', () => {
		// No `/catalog` while nothing is published: an empty listing is noindex, never in a sitemap.
		expect(buildSitemapEntries(empty)).toHaveLength(8)
		expect(buildSitemapEntries(empty).some(row => row.url.endsWith('/catalog'))).toBe(false)
	})
})
