'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type PropsWithChildren, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'

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
