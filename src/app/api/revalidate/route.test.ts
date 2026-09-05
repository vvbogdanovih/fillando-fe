import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

// `revalidateTag` throws E263 ("static generation store missing") outside a Next work store, so
// the module has to be mocked rather than exercised.
const revalidateTag = vi.fn()
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
	revalidateTag: (...args: unknown[]) => revalidateTag(...args),
	revalidatePath: (...args: unknown[]) => revalidatePath(...args)
}))

const HOST = 'localhost:9000'

const post = (body: string, headers: Record<string, string> = {}) =>
	POST(
		new Request(`http://${HOST}/api/revalidate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', host: HOST, ...headers },
			body
		})
	)

const purge = (resource = 'landings', headers?: Record<string, string>) =>
	post(JSON.stringify({ resource }), headers)

beforeEach(() => {
	revalidateTag.mockReset()
	revalidatePath.mockReset()
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('POST /api/revalidate', () => {
	/**
	 * The highest-value assertion in the file. `revalidateTag(tag, 'max')` and the single-argument
	 * form both look right and both restore the original symptom — the first reload after a save
	 * still shows the old copy — so the profile is pinned literally.
	 */
	it('expires the landings tag immediately, so the next render refetches instead of serving one more stale copy', async () => {
		const res = await purge()

		expect(res.status).toBe(200)
		expect(revalidateTag).toHaveBeenCalledWith('landings', { expire: 0 })
	})

	it('refreshes the sitemap too, because its entry list is keyed on the product count and a landing never moves it', async () => {
		await purge()

		expect(revalidateTag).toHaveBeenCalledWith('sitemap', { expire: 0 })
		expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml')
	})

	/** The highest-severity guard: no request may choose what gets purged. */
	it('passes only the literal sitemap path to revalidatePath', async () => {
		await purge()

		expect(revalidatePath).toHaveBeenCalledTimes(1)
		expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml')
	})

	it('never purges more than the resource owns', async () => {
		await purge()

		expect(revalidateTag.mock.calls.length + revalidatePath.mock.calls.length).toBe(3)
	})

	it('refuses a resource it does not know, so no request can name an arbitrary tag', async () => {
		const res = await purge('products')

		expect(res.status).toBe(400)
		expect(revalidateTag).not.toHaveBeenCalled()
		expect(revalidatePath).not.toHaveBeenCalled()
	})

	it('refuses a malformed body rather than throwing', async () => {
		const res = await post('not json')

		expect(res.status).toBe(400)
		expect(revalidateTag).not.toHaveBeenCalled()
	})

	/**
	 * The CSRF control: cross-origin JavaScript cannot send `application/json` without a
	 * preflight, and this route answers none.
	 */
	it('refuses a non-JSON content type', async () => {
		const res = await post('{}', { 'content-type': 'text/plain' })

		expect(res.status).toBe(415)
		expect(revalidateTag).not.toHaveBeenCalled()
	})

	it('refuses an Origin that is not the storefront', async () => {
		const res = await purge('landings', { origin: 'https://evil.test' })

		expect(res.status).toBe(403)
		expect(revalidateTag).not.toHaveBeenCalled()
	})

	it('accepts a same-origin call', async () => {
		const res = await purge('landings', { origin: `http://${HOST}` })

		expect(res.status).toBe(200)
	})

	describe('in production', () => {
		beforeEach(() => {
			vi.stubEnv('NODE_ENV', 'production')
		})

		/** Nothing on fillando.com may purge the cache without holding the secret. */
		it('stays disabled while no secret is configured', async () => {
			const res = await purge()

			expect(res.status).toBe(503)
			expect(revalidateTag).not.toHaveBeenCalled()
		})

		it('accepts a matching secret', async () => {
			vi.stubEnv('REVALIDATE_SECRET', 's'.repeat(32))

			const res = await purge('landings', { 'x-revalidate-secret': 's'.repeat(32) })

			expect(res.status).toBe(200)
			expect(revalidateTag).toHaveBeenCalledWith('landings', { expire: 0 })
		})

		it('refuses a wrong secret of the same length', async () => {
			vi.stubEnv('REVALIDATE_SECRET', 's'.repeat(32))

			const res = await purge('landings', { 'x-revalidate-secret': 'x'.repeat(32) })

			expect(res.status).toBe(401)
			expect(revalidateTag).not.toHaveBeenCalled()
		})

		/** `timingSafeEqual` throws on unequal lengths — the length check has to come first. */
		it('refuses a secret of the wrong length without throwing', async () => {
			vi.stubEnv('REVALIDATE_SECRET', 's'.repeat(32))

			const res = await purge('landings', { 'x-revalidate-secret': 'short' })

			expect(res.status).toBe(401)
			expect(revalidateTag).not.toHaveBeenCalled()
		})
	})

	it('allows an unauthenticated call outside production, so a local save shows up at once', async () => {
		const res = await purge()

		expect(res.status).toBe(200)
		await expect(res.json()).resolves.toMatchObject({ revalidated: true, resource: 'landings' })
	})
})
