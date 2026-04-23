import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import { authResponseSchema, LoginValues, RegisterValues } from './auth.schema'

export const authApi = {
	/**
	 * Authenticate an existing user.
	 * @param data - { email, password }
	 * @returns { message: string, user: User } — validated against authResponseSchema
	 */
	login: async (data: LoginValues) => {
		return await httpService.post(API_URLS.AUTH.LOGIN, data, {
			schema: authResponseSchema
		})
	},

	/**
	 * Create a new account.
	 * @param data - { name, email, password, confirmPassword }
	 * @returns { message: string, user: User } — validated against authResponseSchema
	 */
	register: async (data: RegisterValues) => {
		return await httpService.post(API_URLS.AUTH.REGISTER, data, {
			schema: authResponseSchema
		})
	},

	/**
	 * Fetch the currently authenticated user from the active cookie session.
	 * Called on app boot and after OAuth redirect.
	 * @returns { message: string, user: User } — validated against authResponseSchema
	 */
	getMe: async () => {
		return await httpService.get(API_URLS.AUTH.ME, {
			schema: authResponseSchema
		})
	}
}
