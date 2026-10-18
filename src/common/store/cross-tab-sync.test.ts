import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Role } from '@/common/constants'
import { API_URLS } from '@/common/constants/api-routes.constants'
import type { User } from '@/common/types'
import { startCrossTabSync } from './cross-tab-sync'
import { useAuthStore } from './useAuthStore'
import { useCartStore } from './useCartStore'

// The stores call the API through `httpService`; every call here is a cart read.
vi.mock('@/common/services/http.service', () => ({
	httpService: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

const { httpService } = await import('@/common/services/http.service')
const getMock = httpService.get as unknown as ReturnType<typeof vi.fn>

const USER: User = {
	id: 'u1',
	role: Role.USER,
	email: 'u1@test.invalid',
	name: 'Test',
	picture: null
}

const SERVER_ITEM = {
	variant_id: 'v1',
	quantity: 2,
	added_at: '2026-10-18T00:00:00.000Z',
	variant: {
		name: 'PLA',
		slug: 'pla',
		price: 100,
		stock: 5,
		thumbnail: null,
		v_value: null
	}
}

/** What another tab writes: zustand persist's envelope for the partialized slice. */
const writeFromOtherTab = (key: string, state: object) => {
	const value = JSON.stringify({ state, version: 0 })
	localStorage.setItem(key, value)
	window.dispatchEvent(
		new StorageEvent('storage', { key, newValue: value, storageArea: localStorage })
	)
}

const setVisibility = (value: DocumentVisibilityState) => {
	Object.defineProperty(document, 'visibilityState', { value, configurable: true })
	document.dispatchEvent(new Event('visibilitychange'))
}

const authKey = useAuthStore.persist.getOptions().name!
const cartKey = useCartStore.persist.getOptions().name!

let stop: () => void

beforeEach(() => {
	localStorage.clear()
	useAuthStore.setState({ user: null, isAuthChecked: false })
	useCartStore.setState({ items: [], guestItems: [], isLoading: false, hasFetched: false })
	getMock.mockReset().mockResolvedValue({ items: [SERVER_ITEM], removed_items: [] })
	stop = startCrossTabSync()
})

afterEach(() => {
	stop()
	setVisibility('visible')
})

describe('startCrossTabSync — storage events from another tab', () => {
	it('a login elsewhere sets the user here and loads the server cart', async () => {
		writeFromOtherTab(authKey, { user: USER })

		expect(useAuthStore.getState().user).toEqual(USER)
		await vi.waitFor(() => expect(useCartStore.getState().items).toEqual([SERVER_ITEM]))
		expect(getMock).toHaveBeenCalledWith(API_URLS.CART.BASE, expect.anything())
	})

	it('a logout elsewhere clears the user and the server cart without calling the API', () => {
		useAuthStore.setState({ user: USER })
		useCartStore.setState({ items: [SERVER_ITEM] })
		getMock.mockClear()

		writeFromOtherTab(authKey, { user: null })

		expect(useAuthStore.getState().user).toBeNull()
		expect(useCartStore.getState().items).toEqual([])
		expect(getMock).not.toHaveBeenCalled()
	})

	it('a guest cart written elsewhere replaces the stale one here', () => {
		useCartStore.setState({ guestItems: [{ variant_id: 'old', quantity: 1 }] })

		writeFromOtherTab(cartKey, { guestItems: [{ variant_id: 'v9', quantity: 3 }] })

		expect(useCartStore.getState().guestItems).toEqual([{ variant_id: 'v9', quantity: 3 }])
	})

	it('ignores keys that belong to neither store', () => {
		useCartStore.setState({ guestItems: [{ variant_id: 'keep', quantity: 1 }] })

		writeFromOtherTab('something-else', { guestItems: [] })

		expect(useCartStore.getState().guestItems).toEqual([{ variant_id: 'keep', quantity: 1 }])
	})
})

describe('startCrossTabSync — user transitions in this tab', () => {
	it('loads the server cart when the user appears (boot rehydrate, login, /auth/me)', async () => {
		useAuthStore.setState({ user: USER })

		await vi.waitFor(() => expect(useCartStore.getState().items).toEqual([SERVER_ITEM]))
		expect(getMock).toHaveBeenCalledTimes(1)
	})

	it('does not reload the cart when the same user is stored again (checkAuth after rehydrate)', async () => {
		useAuthStore.setState({ user: USER })
		await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))

		useAuthStore.setState({ user: { ...USER }, isAuthChecked: true })

		expect(getMock).toHaveBeenCalledTimes(1)
	})

	it('drops the server cart when the user goes away', () => {
		useAuthStore.setState({ user: USER })
		useCartStore.setState({ items: [SERVER_ITEM] })

		useAuthStore.setState({ user: null })

		expect(useCartStore.getState().items).toEqual([])
	})
})

describe('startCrossTabSync — tab becomes visible', () => {
	it('re-reads the server cart quietly for a logged-in user', async () => {
		useAuthStore.setState({ user: USER })
		// The login-triggered read is the loud one; let it settle before the quiet re-read.
		await vi.waitFor(() => expect(useCartStore.getState().items).toEqual([SERVER_ITEM]))
		expect(useCartStore.getState().isLoading).toBe(false)
		getMock.mockResolvedValue({ items: [{ ...SERVER_ITEM, quantity: 7 }], removed_items: [] })

		setVisibility('visible')

		expect(useCartStore.getState().isLoading).toBe(false)
		await vi.waitFor(() => expect(useCartStore.getState().items[0]?.quantity).toBe(7))
		expect(useCartStore.getState().isLoading).toBe(false)
	})

	it('does nothing for a guest, and nothing when the tab is hidden', () => {
		setVisibility('visible')
		expect(getMock).not.toHaveBeenCalled()

		useAuthStore.setState({ user: USER })
		getMock.mockClear()
		setVisibility('hidden')
		expect(getMock).not.toHaveBeenCalled()
	})
})

describe('startCrossTabSync — cleanup', () => {
	it('stops listening once the returned function is called', () => {
		stop()

		writeFromOtherTab(authKey, { user: USER })
		useAuthStore.setState({ user: null })
		useAuthStore.setState({ user: USER })

		expect(getMock).not.toHaveBeenCalled()
		// Re-arm so afterEach's stop() has something to remove.
		stop = startCrossTabSync()
	})
})
