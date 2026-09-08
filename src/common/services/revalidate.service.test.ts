import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REVALIDATE_RESOURCES } from '@/common/constants/cache-tags.constants'
import { revalidateStorefront } from './revalidate.service'

const fetchMock = vi.fn()

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock)
	// The endpoint is unreachable from a production bundle, so the helper compiles itself out
	// there; every case below relies on NODE_ENV being 'test'.
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	fetchMock.mockReset()
})

describe('revalidateStorefront', () => {
	it('posts the resource to the same-origin endpoint without credentials', async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 200 })

		await revalidateStorefront('landings')

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/revalidate',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ resource: 'landings' }),
				// Never the backend session cookie: this is the Next origin, not the API.
				credentials: 'omit'
			})
		)
	})

	/**
	 * The resource name is the whole contract with the route handler, and the handler answers 400
	 * for a string it cannot find in its own map. Sent verbatim, never lower-cased or pluralised
	 * on the way out.
	 */
	it('posts every resource name verbatim', async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 200 })

		for (const resource of REVALIDATE_RESOURCES) {
			await revalidateStorefront(resource)

			expect(fetchMock).toHaveBeenLastCalledWith(
				'/api/revalidate',
				expect.objectContaining({ body: JSON.stringify({ resource }) })
			)
		}

		expect(fetchMock).toHaveBeenCalledTimes(REVALIDATE_RESOURCES.length)
	})

	/** The landing is already saved by the time this runs; a refused purge is not an edit error. */
	it('resolves when the endpoint refuses', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 503 })

		await expect(revalidateStorefront('landings')).resolves.toBeUndefined()
	})

	it('resolves when the network call rejects', async () => {
		fetchMock.mockRejectedValue(new Error('offline'))

		await expect(revalidateStorefront('landings')).resolves.toBeUndefined()
	})
})
