import axios, { type AxiosRequestConfig } from 'axios'
import { API_BASE_URL, API_URLS } from '@/common/constants/api-routes.constants'
import { z } from 'zod'
import { useAuthStore } from '@/common/store/useAuthStore'
import toast from 'react-hot-toast'

const apiClient = axios.create({
	baseURL: `${API_BASE_URL}`,
	headers: {
		'Content-Type': 'application/json'
	},
	withCredentials: true
})

// Module-level singleton: ensures that multiple simultaneous 401s trigger exactly one
// /auth/refresh call. All waiting requests share the same promise and retry together
// once the token is renewed. Reset to null in .finally() so the next cycle can start fresh.
let refreshPromise: Promise<boolean> | null = null

apiClient.interceptors.response.use(
	async response => {
		return response
	},
	async error => {
		const originalRequest = error?.config

		const errorMessage = error?.response?.data?.message || 'Unknown error'
		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true

			if (!refreshPromise) {
				refreshPromise = HttpService.refreshToken().finally(() => {
					refreshPromise = null
				})
			}
			const isSuccessRefresh = await refreshPromise

			if (isSuccessRefresh) {
				return apiClient(originalRequest)
			}
		}
		if (!originalRequest?.skipErrorToast) {
			toast.error(errorMessage)
		}
		const err = new Error(errorMessage) as Error & { status?: number }
		err.status = error.response?.status
		throw err
	}
)

// Validates the response body against an optional Zod schema.
// On Zod failure: toasts the validation error and re-throws (not suppressed by skipErrorToast).
const handleAxiosResponse = async <T>(schema: z.ZodType<T> | undefined, data: T): Promise<T> => {
	try {
		if (schema) {
			return await schema.parseAsync(data)
		}
		return data
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorMessages = error.issues.map(err => {
				const path = err.path.join('.')
				return err.message
			})
			const errorMessage = `Помилка валідації: ${errorMessages.join(', ')}`
			toast.error(errorMessage)
			throw new Error(errorMessage)
		}
		const message = error instanceof Error ? error.message : 'Unknown error'
		toast.error(message)
		throw new Error(message)
	}
}

type Config<T = unknown, D = unknown> = AxiosRequestConfig<D> & {
	schema?: z.ZodType<T>
	skipErrorToast?: boolean
}

export class HttpService {
	async get<T, D>(url: string, config?: Config<T, D>): Promise<T> {
		if (config?.params) {
			const queryString = Object.entries(config.params)
				.map(([key, value]) => {
					const serialized =
						typeof value === 'object' ? JSON.stringify(value) : String(value)
					return `${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`
				})
				.join('&')

			const { params: _, ...restConfig } = config
			const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`

			const response = await apiClient.get(fullUrl, restConfig)
			return await handleAxiosResponse(restConfig?.schema, response.data)
		}

		const response = await apiClient.get(url, config)
		return await handleAxiosResponse(config?.schema, response.data)
	}

	async post<T, D>(url: string, data?: D, config?: Config<T, D>): Promise<T> {
		const response = await apiClient.post(url, data, config)
		return await handleAxiosResponse(config?.schema, response.data)
	}

	async put<T, D>(url: string, data?: D, config?: Config<T, D>): Promise<T> {
		const response = await apiClient.put(url, data, config)
		return await handleAxiosResponse(config?.schema, response.data)
	}

	async patch<T, D>(url: string, data?: D, config?: Config<T, D>): Promise<T> {
		const response = await apiClient.patch(url, data, config)
		return await handleAxiosResponse(config?.schema, response.data)
	}

	async delete<T, D>(url: string, config?: Config<T, D>): Promise<T> {
		const response = await apiClient.delete(url, config)
		return await handleAxiosResponse(config?.schema, response.data)
	}

	// Uses native fetch instead of apiClient (Axios) to avoid triggering the response
	// interceptor again, which would cause an infinite 401 → refresh → 401 loop.
	static async refreshToken(): Promise<boolean> {
		const { logOut } = useAuthStore.getState()

		const res = await fetch(API_BASE_URL + API_URLS.AUTH.REFRESH, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({})
		})

		if (!res.ok) {
			await logOut()
			return false
		}

		// Server updates the access token cookie via Set-Cookie header.
		// Do not overwrite the auth store user from refresh response because
		// backend may return a partial user payload (e.g. without picture),
		// which would wipe already loaded profile fields in UI.
		try {
			await res.json()
		} catch {
			// Empty or non-JSON response is fine - cookie was set
		}

		return true
	}
}

export const httpService = new HttpService()
