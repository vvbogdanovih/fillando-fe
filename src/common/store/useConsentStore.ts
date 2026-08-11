import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CONSENT_STORAGE_KEY } from '@/common/constants/analytics.constants'

export type ConsentStatus = 'unknown' | 'granted' | 'denied'

interface ConsentState {
	status: ConsentStatus
	/** True once the banner has been explicitly reopened from the footer link. */
	isReopened: boolean
	accept: () => void
	decline: () => void
	reopen: () => void
}

/**
 * Cookie-consent decision.
 *
 * Persisted to localStorage, never to a cookie: a JS cookie write is exactly what
 * raises Chrome's `CacheControlNoStoreCookieModified` and knocks pages out of the
 * back/forward cache — the opposite of what this work is for.
 *
 * `skipHydration` mirrors useAuthStore/useCartStore so the first client render
 * matches the server HTML; `Providers` calls `rehydrate()` after mount. Without
 * that call the status stays 'unknown' forever and the tag never loads.
 */
export const useConsentStore = create<ConsentState>()(
	persist(
		set => ({
			status: 'unknown',
			isReopened: false,
			accept: () => set({ status: 'granted', isReopened: false }),
			decline: () => set({ status: 'denied', isReopened: false }),
			reopen: () => set({ isReopened: true })
		}),
		{
			name: CONSENT_STORAGE_KEY,
			partialize: state => ({ status: state.status }),
			skipHydration: true
		}
	)
)
