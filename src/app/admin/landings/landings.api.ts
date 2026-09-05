import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import { uploadEntityImage } from '@/common/services/entity-image.service'
import { adminLandingsListSchema, landingSchema, type LandingFormValues } from './landings.schema'

export const landingsApi = {
	/**
	 * Admin listing — drafts included, unlike the public `GET /landings`, and each row carrying
	 * `product_count`.
	 */
	getAll: (categoryId?: string) =>
		httpService.get(API_URLS.LANDINGS.ADMIN, {
			schema: adminLandingsListSchema,
			params: categoryId ? { category_id: categoryId } : undefined
		}),

	/** The tile image, through the shared S3 presign flow. Returns the URL to store. */
	uploadImage: (landingId: string, file: File) => uploadEntityImage('landing', landingId, file),

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
