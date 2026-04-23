'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type PropsWithChildren, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { FullScreenLoader } from '@/common/components'

export const Providers = ({ children }: PropsWithChildren) => {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { refetchOnWindowFocus: false } }
			})
	)
	const [ready, setReady] = useState(false)

	useEffect(() => {
		useAuthStore
			.getState()
			.checkAuth()
			.then(() => {
				if (useAuthStore.getState().isUserLoggedIn()) {
					useCartStore.getState().fetchCart()
				}
			})
			.finally(() => setReady(true))
	}, [])

	return (
		<QueryClientProvider client={client}>
			<Toaster />
			{ready ? children : <FullScreenLoader />}
		</QueryClientProvider>
	)
}
