import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadStorefrontSettings, readStorefrontSettings } from './storefront-settings.server'

const { serverFetch } = vi.hoisted(() => ({ serverFetch: vi.fn() }))
vi.mock('./server-fetch.utils', () => ({ serverFetch }))
beforeEach(() => {
	serverFetch.mockReset()
})

/**
 * The «Вітрина» read (audit 2026-11-11): a collection embeds its typed landing's pins, address and
 * status, and a landing save purges only `landings` — so the read carries that tag beside
 * `categories`, or the strip keeps the old pins and a link to a page that is gone.
 */
describe('loadStorefrontSettings', () => {
	it('is purged by a settings save and by a landing save alike', async () => {
		serverFetch.mockResolvedValue(null)
		await loadStorefrontSettings()
		expect(serverFetch).toHaveBeenCalledWith('/storefront-settings', {
			next: { tags: ['categories', 'landings'] }
		})
	})

	it('drops the blocks, never the page, when the read fails', async () => {
		serverFetch.mockRejectedValue(new Error('Upstream 503 for /storefront-settings'))
		expect(await loadStorefrontSettings()).toBeNull()
	})
})

/**
 * The home page's own read (review 2026-11-14). The page is prerendered and kept for an hour: with
 * the outage caught, one failed read during a regeneration was cached as a page without its copy,
 * its H1 and its shelves. Thrown, the regeneration fails and the previous page stays.
 */
describe('readStorefrontSettings', () => {
	it('throws on an outage instead of answering «no settings»', async () => {
		serverFetch.mockRejectedValue(new Error('Upstream 503 for /storefront-settings'))
		await expect(readStorefrontSettings()).rejects.toThrow('Upstream 503')
	})

	it('answers null for a backend without the endpoint and for a shape it does not know', async () => {
		serverFetch.mockResolvedValue(null)
		expect(await readStorefrontSettings()).toBeNull()
		serverFetch.mockResolvedValue({ strip: 'not a list' })
		expect(await readStorefrontSettings()).toBeNull()
	})

	it('is the same address with the same tags as the layout reads: one cache entry', async () => {
		serverFetch.mockResolvedValue(null)
		await readStorefrontSettings()
		await loadStorefrontSettings()
		expect(serverFetch.mock.calls[0]).toEqual(serverFetch.mock.calls[1])
		expect(serverFetch).toHaveBeenCalledWith('/storefront-settings', {
			next: { tags: ['categories', 'landings'] }
		})
	})
})
