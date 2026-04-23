'use client'
import { ReactNode, useEffect } from 'react'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useRouter } from 'next/navigation'
import { UI_URLS, Role, ANY_AUTHENTICATED, type AnyAuthenticated } from '@/common/constants'
import toast from 'react-hot-toast'

type PrivateRouteProps = {
	children: ReactNode
	allowedRoles?: Role[] | AnyAuthenticated
	redirectTo?: string
	unauthorizedMessage?: string
	forbiddenMessage?: string
}

/**
 * Wrapper for protecting private routes with role checks.
 *
 * @example
 * // Access for any authenticated user
 * <PrivateRoute>
 *   <Dashboard />
 * </PrivateRoute>
 *
 * @example
 * // Access for administrators only
 * <PrivateRoute allowedRoles={[Role.ADMIN]}>
 *   <AdminPanel />
 * </PrivateRoute>
 *
 * @example
 * // Access for administrators and moderators with custom redirect
 * <PrivateRoute
 *   allowedRoles={[Role.ADMIN, Role.MODERATOR]}
 *   redirectTo={UI_URLS.HOME}
 * >
 *   <ModeratorTools />
 * </PrivateRoute>
 */
export const PrivateRoute = ({
	children,
	allowedRoles = ANY_AUTHENTICATED,
	redirectTo = UI_URLS.NOT_FOUND,
	unauthorizedMessage,
	forbiddenMessage
}: PrivateRouteProps) => {
	const router = useRouter()
	const user = useAuthStore(state => state.getUser())

	const hasAccess = (): boolean => {
		if (!user) return false

		// ANY_AUTHENTICATED ('any') grants access to every logged-in user regardless of role.
		// Otherwise, check that the user's role is in the explicit allowedRoles array.
		if (allowedRoles === ANY_AUTHENTICATED) return true

		return allowedRoles.includes(user.role)
	}

	useEffect(() => {
		if (!user) {
			if (unauthorizedMessage) toast.error(unauthorizedMessage)
			router.push(UI_URLS.AUTH.LOGIN)
			return
		}

		if (!hasAccess()) {
			if (forbiddenMessage) toast.error(forbiddenMessage)
			router.push(redirectTo)
		}
	}, [router, user, allowedRoles, redirectTo, unauthorizedMessage, forbiddenMessage])

	if (!hasAccess()) {
		return null
	}

	return <>{children}</>
}
