import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redirectIfMoved } from './moved-route.server'

const { serverFetch, permanentRedirect } = vi.hoisted(() => ({
	serverFetch: vi.fn(),
	permanentRedirect: vi.fn()
}))
vi.mock('./server-fetch.utils', () => ({ serverFetch }))
vi.mock('next/navigation', () => ({ permanentRedirect }))
beforeEach(() => {
	serverFetch.mockReset()
	permanentRedirect.mockReset()
})

describe('redirectIfMoved — old addresses after a slug change (Plan-0010 B07)', () => {
	it('sends one permanent redirect to the current address, the query kept', async () => {
		serverFetch.mockResolvedValueOnce({ kind: 'redirect', target_path: '/new-filament' })
		await redirectIfMoved(['old-filament'], {
			'f.polymer': ['PLA', 'PETG'],
			gclid: 'abc',
			empty: undefined
		})
		expect(serverFetch).toHaveBeenCalledWith('/routes/resolve?path=%2Fold-filament', {
			next: { tags: ['categories', 'products', 'landings'] }
		})
		expect(permanentRedirect).toHaveBeenCalledWith(
			'/new-filament?f.polymer=PLA&f.polymer=PETG&gclid=abc'
		)
	})
	it('redirects a landing and a SKU address, without a query when there is none', async () => {
		serverFetch.mockResolvedValueOnce({ kind: 'redirect', target_path: '/filament/pla-new' })
		await redirectIfMoved(['filament', 'pla'])
		expect(serverFetch.mock.calls[0][0]).toBe('/routes/resolve?path=%2Ffilament%2Fpla')
		expect(permanentRedirect).toHaveBeenCalledWith('/filament/pla-new')
	})
	it('leaves a plain 404 when nothing moved or the path is not slug-shaped', async () => {
		serverFetch.mockResolvedValueOnce(null)
		await redirectIfMoved(['never-existed'])
		for (const segments of [[], ['Upper'], ['a', '../b'], ['with space']])
			await redirectIfMoved(segments)
		expect(serverFetch).toHaveBeenCalledTimes(1)
		expect(permanentRedirect).not.toHaveBeenCalled()
	})
	it('lets the target decide: its own redirect in one hop, its 404 on the old address (P03)', async () => {
		serverFetch.mockResolvedValueOnce({ kind: 'redirect', target_path: '/new-filament' })
		const decide = vi
			.fn()
			.mockResolvedValueOnce({ kind: 'redirect', to: '/new-filament/pla?gclid=abc' })
		await redirectIfMoved(['old-filament'], { polymer: 'PLA', gclid: 'abc' }, decide)
		expect(decide).toHaveBeenCalledWith('/new-filament', { polymer: 'PLA', gclid: 'abc' })
		expect(permanentRedirect).toHaveBeenCalledTimes(1)
		expect(permanentRedirect).toHaveBeenCalledWith('/new-filament/pla?gclid=abc')

		permanentRedirect.mockReset()
		serverFetch.mockResolvedValueOnce({ kind: 'redirect', target_path: '/new-filament' })
		await redirectIfMoved(
			['old-filament'],
			{ page: '999' },
			vi.fn().mockResolvedValueOnce({ kind: 'not_found' })
		)
		expect(permanentRedirect).not.toHaveBeenCalled()

		serverFetch.mockResolvedValueOnce({ kind: 'redirect', target_path: '/new-filament' })
		await redirectIfMoved(
			['old-filament'],
			{ 'f.polymer': 'PLA' },
			vi.fn().mockResolvedValueOnce(null)
		)
		expect(permanentRedirect).toHaveBeenCalledWith('/new-filament?f.polymer=PLA')
	})
	it('never redirects to anything but a site path, and an outage throws', async () => {
		serverFetch.mockResolvedValueOnce({ kind: 'redirect', target_path: 'https://evil.test/' })
		await redirectIfMoved(['old'])
		expect(permanentRedirect).not.toHaveBeenCalled()
		serverFetch.mockRejectedValueOnce(new Error('Upstream 503 for /routes/resolve'))
		await expect(redirectIfMoved(['old'])).rejects.toThrow('Upstream 503')
	})
})
