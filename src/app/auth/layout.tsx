'use client'

import { UI_URLS } from '@/common/constants'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	const user = useAuthStore(state => state.user)
	const { replace } = useRouter()

	useEffect(() => {
		if (user) {
			replace(UI_URLS.HOME)
		}
	}, [user, replace])

	return <>{children}</>
}
