import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serverFetch } from './server-fetch.utils'

// `API` is read at module load, so the env has to be stubbed before the import above runs.
vi.hoisted(() => vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test'))

const response = (status: number, body?: unknown) => ({
	ok: status >= 200 && status < 300,
	status,
	json: () => Promise.resolve(body)
})

const fetchMock = vi.fn()

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
})

afterAll(() => {
	vi.unstubAllEnvs()
})

describe('serverFetch', () => {
	it('returns the parsed JSON body on 200', async () => {
		fetchMock.mockResolvedValue(response(200, { slug: 'pla' }))
		await expect(serverFetch('/categories/slug/pla')).resolves.toEqual({ slug: 'pla' })
	})

	it('returns null on 404 — the resource is genuinely absent', async () => {
		fetchMock.mockResolvedValue(response(404))
		await expect(serverFetch('/categories/slug/nope')).resolves.toBeNull()
	})

	it('throws on 429 so a rate-limited render is never cached as "not found"', async () => {
		fetchMock.mockResolvedValue(response(429))
		await expect(serverFetch('/categories')).rejects.toThrow(/Upstream 429 for \/categories/)
	})

	it('throws on 5xx', async () => {
		fetchMock.mockResolvedValue(response(500))
		await expect(serverFetch('/categories')).rejects.toThrow(/Upstream 500/)
	})

	it('propagates network errors instead of swallowing them', async () => {
		fetchMock.mockRejectedValue(new TypeError('fetch failed'))
		await expect(serverFetch('/categories')).rejects.toThrow('fetch failed')
	})

	it('prefixes the path with the API base and defaults to revalidate 3600', async () => {
		fetchMock.mockResolvedValue(response(200, []))
		await serverFetch('/categories')
		expect(fetchMock).toHaveBeenCalledWith('http://api.test/categories', {
			next: { revalidate: 3600 }
		})
	})

	it('lets init.next.revalidate override the default', async () => {
		fetchMock.mockResolvedValue(response(200, []))
		await serverFetch('/categories', { next: { revalidate: 0 } })
		expect(fetchMock).toHaveBeenCalledWith('http://api.test/categories', {
			next: { revalidate: 0 }
		})
	})

	it('merges extra next options and passes the rest of init through', async () => {
		fetchMock.mockResolvedValue(response(200, []))
		await serverFetch('/categories', {
			headers: { accept: 'application/json' },
			next: { tags: ['categories'] }
		})
		expect(fetchMock).toHaveBeenCalledWith('http://api.test/categories', {
			headers: { accept: 'application/json' },
			next: { revalidate: 3600, tags: ['categories'] }
		})
	})
})
