import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	storefrontAdminSchema,
	storefrontReceiptSchema,
	type StorefrontSettingsBody
} from './storefront.schema'

export const storefrontApi = {
	admin: () =>
		httpService.get(API_URLS.STOREFRONT_SETTINGS.ADMIN, {
			schema: storefrontAdminSchema,
			skipErrorToast: true
		}),
	save: (body: StorefrontSettingsBody, key: string) =>
		httpService.patch(API_URLS.STOREFRONT_SETTINGS.BASE, body, {
			headers: { 'Idempotency-Key': key },
			schema: storefrontReceiptSchema,
			skipErrorToast: true
		})
}
