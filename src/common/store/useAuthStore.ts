import { API_URLS } from '@/common/constants/api-routes.constants'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { httpService } from '../services/http.service'
import { User } from '../types'
import { authResponseSchema } from '@/app/auth/auth.schema'

interface AuthState {
	user: User | null
	isAuthChecked: boolean
	setUser: (user: User | null) => void
	getUser: () => User | null
	logOut: () => Promise<void>
	isUserLoggedIn: () => boolean
	checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			user: null,
			isAuthChecked: false,

			setUser: user => set({ user }),

			isUserLoggedIn: () => get().user !== null,
			getUser: () => get().user,

			checkAuth: async () => {
				if (get().user) {
					set({ isAuthChecked: true })
					return
				}

				try {
					const response = await httpService.get(API_URLS.AUTH.ME, {
						schema: authResponseSchema,
						skipErrorToast: true
					})
					set({ user: response.user, isAuthChecked: true })
				} catch {
					set({ user: null, isAuthChecked: true })
				}
			},

			logOut: async () => {
				try {
					await httpService.post(API_URLS.AUTH.LOGOUT)
				} finally {
					set({ user: null })
				}
			}
		}),
		{
			name: 'auth-storage',
			partialize: state => ({ user: state.user })
		}
	)
)
