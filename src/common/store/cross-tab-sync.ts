import { useAuthStore } from './useAuthStore'
import { useCartStore } from './useCartStore'

/**
 * Keeps the session and the cart consistent across browser tabs. Without it every tab lived on
 * its own: a login in one tab left the others logged out, a guest cart written in one tab was
 * overwritten by the next `set()` in a stale tab, and the server cart was read once at boot and
 * never again.
 *
 * Three signals, one subscription:
 * - `storage` (fires in the *other* tabs when `localStorage` changes) → re-read the persisted
 *   auth / guest-cart slices. Nothing is written here, so there is no echo between tabs.
 * - `user` leaving or entering `null` → load or drop the server cart. This is also what loads
 *   the cart at boot (the persisted `user` is rehydrated after the subscription is made) and
 *   after a login, whichever tab did it. Only the null-ness is compared: `checkAuth` stores a
 *   fresh object on every call.
 * - the tab becoming visible while logged in → re-read the server cart quietly. One `GET /cart`
 *   per switch is enough; pushing the other tab's response across would let a stale tab clobber
 *   the server's answer.
 *
 * Returns the cleanup so Strict Mode's double effect does not leave two sets of listeners.
 */
export const startCrossTabSync = (): (() => void) => {
	const authKey = useAuthStore.persist.getOptions().name
	const cartKey = useCartStore.persist.getOptions().name

	const onStorage = (event: StorageEvent) => {
		if (event.key === authKey) void useAuthStore.persist.rehydrate()
		if (event.key === cartKey) void useCartStore.persist.rehydrate()
	}

	const onVisibility = () => {
		if (document.visibilityState !== 'visible') return
		if (!useAuthStore.getState().isUserLoggedIn()) return
		void useCartStore.getState().fetchCart({ silent: true })
	}

	const unsubscribe = useAuthStore.subscribe((state, prev) => {
		const wasLoggedIn = prev.user !== null
		const isLoggedIn = state.user !== null
		if (wasLoggedIn === isLoggedIn) return
		if (isLoggedIn) void useCartStore.getState().fetchCart()
		else useCartStore.getState().resetServerCart()
	})

	window.addEventListener('storage', onStorage)
	document.addEventListener('visibilitychange', onVisibility)

	return () => {
		unsubscribe()
		window.removeEventListener('storage', onStorage)
		document.removeEventListener('visibilitychange', onVisibility)
	}
}
