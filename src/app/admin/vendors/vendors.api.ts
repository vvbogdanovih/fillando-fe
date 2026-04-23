import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import { vendorSchema, vendorsListSchema, type VendorFormValues } from './vendors.schema'

export const vendorsApi = {
	getAll: () => httpService.get(API_URLS.VENDORS.BASE, { schema: vendorsListSchema }),

	checkSlugAvailability: (slug: string) =>
		httpService.get<{ available: boolean }, unknown>(
			`${API_URLS.VENDORS.CHECK_AVAILABILITY}?slug=${encodeURIComponent(slug)}`,
			{ skipErrorToast: true }
		),

	create: (data: VendorFormValues) =>
		httpService.post(API_URLS.VENDORS.BASE, data, {
			schema: vendorSchema,
			skipErrorToast: true
		}),

	update: (id: string, data: Partial<VendorFormValues>) =>
		httpService.patch(API_URLS.VENDORS.BY_ID(id), data, {
			schema: vendorSchema,
			skipErrorToast: true
		}),

	delete: (id: string) =>
		httpService.delete<{ message: string }, undefined>(API_URLS.VENDORS.BY_ID(id))
}
