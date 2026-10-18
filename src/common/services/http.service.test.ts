import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Role } from '@/common/constants'
import { API_URLS } from '@/common/constants/api-routes.constants'
import type { User } from '@/common/types'

/**
 * A fake axios: `create()` returns a callable client whose every request — including the
 * retry the interceptor issues by calling the client directly — goes through the registered
 * rejection handler, exactly as a real axios instance does. Responses are served from `queue`.
 */
const { queue } = vi.hoisted(() => ({
	queue: [] as Array<{ status: number; data?: unknown }>
}))

vi.mock('axios', () => {
	let onRejected: (error: unknown) => unknown = e => {
		throw e
	}
	const raw = async (config: Record<string, unknown>) => {
		const next = queue.shift() ?? { status: 599, data: { message: 'queue empty' } }
		if (next.status < 400) return { data: next.data, config }
		const error = new Error('request failed') as Error & {
			config: unknown
			response: unknown
		}
		error.config = config
		error.response = { status: next.status, data: next.data }
		throw error
	}
	const client = vi.fn(async (config: Record<string, unknown>) => {
		try {
			return await raw(config)
		} catch (error) {
			return onRejected(error)
		}
	}) as unknown as Record<string, unknown> & ((c: Record<string, unknown>) => Promise<unknown>)
	client.get = (url: string, config?: Record<string, unknown>) =>
		client({ ...config, url, method: 'get' })
	client.post = (url: string, data?: unknown, config?: Record<string, unknown>) =>
		client({ ...config, url, data, method: 'post' })
	client.interceptors = {
		response: {
			use: (_ok: unknown, rej: (error: unknown) => unknown) => {
				onRejected = rej
			}
		}
	}
	return { default: { create: () => client } }
})

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

const { httpService, HttpService } = await import('./http.service')
const { useAuthStore } = await import('@/common/store/useAuthStore')

const USER: User = {
	id: 'u1',
	role: Role.USER,
	email: 'u1@test.invalid',
	name: 'Test',
	picture: null
}

const fetchMock = vi.fn()

beforeEach(() => {
	queue.length = 0
	vi.stubGlobal('fetch', fetchMock)
	fetchMock.mockReset()
	useAuthStore.setState({ user: USER, isAuthChecked: true })
})

afterEach(() => {
	vi.unstubAllGlobals()
})

const refreshCalls = () =>
	fetchMock.mock.calls.filter(([url]) => String(url).endsWith(API_URLS.AUTH.REFRESH))

describe('HttpService.refreshToken', () => {
	it('on 401 signs out locally only — no POST /auth/logout', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })

		await expect(HttpService.refreshToken()).resolves.toBe(false)

		expect(useAuthStore.getState().user).toBeNull()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(refreshCalls()).toHaveLength(1)
		expect(queue).toHaveLength(0)
	})

	it('on success keeps the stored user untouched', async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })

		await expect(HttpService.refreshToken()).resolves.toBe(true)

		expect(useAuthStore.getState().user).toEqual(USER)
	})
})

describe('401 interceptor', () => {
	it('refreshes once and retries the request after a successful refresh', async () => {
		fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
		queue.push({ status: 401, data: { message: 'expired' } }, { status: 200, data: { ok: 1 } })

		await expect(httpService.get<{ ok: number }, unknown>('/cart')).resolves.toEqual({ ok: 1 })

		expect(refreshCalls()).toHaveLength(1)
		expect(useAuthStore.getState().user).toEqual(USER)
	})

	it('after a failed refresh still retries once, so a guest-friendly route answers as a guest', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
		queue.push(
			{ status: 401, data: { message: 'expired' } },
			{ status: 200, data: { message: 'Not authenticated', user: null } }
		)

		await expect(httpService.get('/auth/me')).resolves.toEqual({
			message: 'Not authenticated',
			user: null
		})

		expect(useAuthStore.getState().user).toBeNull()
		expect(refreshCalls()).toHaveLength(1)
	})

	it('after a failed refresh a second 401 is final — no refresh loop', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
		queue.push(
			{ status: 401, data: { message: 'expired' } },
			{ status: 401, data: { message: 'Unauthorized' } }
		)

		await expect(httpService.get('/cart', { skipErrorToast: true })).rejects.toMatchObject({
			status: 401
		})

		expect(refreshCalls()).toHaveLength(1)
		expect(queue).toHaveLength(0)
	})
})
