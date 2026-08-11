'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type PropsWithChildren, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { useConsentStore } from '@/common/store/useConsentStore'

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
		// Stores use skipHydration so the first client render matches the
		// server HTML; apply the persisted state now that we're mounted.
		useAuthStore.persist.rehydrate()
		useCartStore.persist.rehydrate()
		// Without this the consent status stays 'unknown' forever, so the banner
		// never closes for returning visitors and the ads tag never mounts.
		useConsentStore.persist.rehydrate()

		useAuthStore
			.getState()
			.checkAuth()
			.then(() => {
				if (useAuthStore.getState().isUserLoggedIn()) {
					useCartStore.getState().fetchCart()
				}
			})
	}, [])

	return (
		<QueryClientProvider client={client}>
			<Toaster />
			{children}
		</QueryClientProvider>
	)
}
