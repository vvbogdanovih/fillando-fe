import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import { landingSchema, landingsListSchema, type LandingFormValues } from './landings.schema'

export const landingsApi = {
	/** Admin listing — includes drafts, unlike the public `GET /landings`. */
	getAll: (categoryId?: string) =>
		httpService.get(API_URLS.LANDINGS.ADMIN, {
			schema: landingsListSchema,
			params: categoryId ? { category_id: categoryId } : undefined
		}),

	create: (data: LandingFormValues) =>
		httpService.post(API_URLS.LANDINGS.BASE, data, {
			schema: landingSchema,
			skipErrorToast: true
		}),

	update: (id: string, data: Partial<LandingFormValues>) =>
		httpService.patch(API_URLS.LANDINGS.BY_ID(id), data, {
			schema: landingSchema,
			skipErrorToast: true
		}),

	delete: (id: string) =>
		httpService.delete<{ success: boolean }, undefined>(API_URLS.LANDINGS.BY_ID(id), {
			skipErrorToast: true
		})
}
