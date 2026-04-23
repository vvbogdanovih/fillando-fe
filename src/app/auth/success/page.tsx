'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/common/store/useAuthStore'
import { FullScreenLoader } from '@/common/components'
import { UI_URLS } from '@/common/constants'

export default function AuthSuccessPage() {
	const router = useRouter()
	const checkAuth = useAuthStore(state => state.checkAuth)
	const [isChecking, setIsChecking] = useState(true)

	useEffect(() => {
		let cancelled = false

		checkAuth().then(() => {
			if (cancelled) return
			setIsChecking(false)
		})

		return () => {
			cancelled = true
		}
	}, [checkAuth])

	useEffect(() => {
		if (isChecking) return
		const currentUser = useAuthStore.getState().getUser()
		router.replace(currentUser ? UI_URLS.HOME : UI_URLS.AUTH.LOGIN)
	}, [isChecking, router])

	return <FullScreenLoader />
}
