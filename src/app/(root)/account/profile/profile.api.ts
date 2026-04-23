import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import { profileResponseSchema, type UpdateProfilePayload } from './profile.schema'

export const profileApi = {
	getMe: async () =>
		await httpService.get(API_URLS.USERS.ME, {
			schema: profileResponseSchema,
			skipErrorToast: true
		}),

	updateMe: async (payload: UpdateProfilePayload) =>
		await httpService.patch(API_URLS.USERS.ME, payload, {
			schema: profileResponseSchema,
			skipErrorToast: true
		})
}
