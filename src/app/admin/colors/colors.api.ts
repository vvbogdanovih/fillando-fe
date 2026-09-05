import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import { adminColorsListSchema, colorSchema, type ColorFormValues } from './colors.schema'

export const colorsApi = {
	/**
	 * Admin listing — the same dictionary as the public `GET /colors`, plus `variant_count` per
	 * colour. Both callers of this are admin screens (the dictionary and the variant colour
	 * picker), so neither needs the public endpoint.
	 */
	getAll: () => httpService.get(API_URLS.COLORS.ADMIN, { schema: adminColorsListSchema }),

	create: (data: ColorFormValues) =>
		httpService.post(API_URLS.COLORS.BASE, data, {
			schema: colorSchema,
			skipErrorToast: true
		}),

	update: (id: string, data: Partial<ColorFormValues>) =>
		httpService.patch(API_URLS.COLORS.BY_ID(id), data, {
			schema: colorSchema,
			skipErrorToast: true
		}),

	// The API answers 409 while variants still reference the colour, so the caller shows the
	// message rather than a generic toast.
	delete: (id: string) =>
		httpService.delete<{ success: boolean }, undefined>(API_URLS.COLORS.BY_ID(id), {
			skipErrorToast: true
		})
}
