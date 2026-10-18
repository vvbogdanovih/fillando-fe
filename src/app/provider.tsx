'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type PropsWithChildren, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { useConsentStore } from '@/common/store/useConsentStore'
import { startCrossTabSync } from '@/common/store/cross-tab-sync'

export const Providers = ({ children }: PropsWithChildren) => {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { refetchOnWindowFocus: false } }
			})
	)

	// Auth check runs in the background so the server-rendered HTML stays
	// visible to crawlers; routes that need the result wait on isAuthChecked.
	useEffect(() => {
		// Subscribed before rehydration on purpose: the `user` the next line restores is what
		// triggers the first server-cart read, and later logins/logouts (this tab or another)
		// go through the same subscription.
		const stopCrossTabSync = startCrossTabSync()

		// Stores use skipHydration so the first client render matches the
		// server HTML; apply the persisted state now that we're mounted.
		useAuthStore.persist.rehydrate()
		useCartStore.persist.rehydrate()
		// Without this the consent status stays 'unknown' forever, so the banner
		// never closes for returning visitors and the ads tag never mounts.
		useConsentStore.persist.rehydrate()

		useAuthStore.getState().checkAuth()

		return stopCrossTabSync
	}, [])

	return (
		<QueryClientProvider client={client}>
			<Toaster />
			{children}
		</QueryClientProvider>
	)
}
