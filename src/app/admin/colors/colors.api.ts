import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import { colorSchema, colorsListSchema, type ColorFormValues } from './colors.schema'

export const colorsApi = {
	getAll: () => httpService.get(API_URLS.COLORS.BASE, { schema: colorsListSchema }),

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
