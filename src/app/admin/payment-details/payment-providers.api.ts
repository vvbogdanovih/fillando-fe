import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	paymentProviderSchema,
	paymentProvidersListSchema,
	type PaymentProviderKey
} from './payment-providers.schema'

export type PaymentProviderPayload = {
	provider?: PaymentProviderKey
	label: string
	public_key: string
	private_key?: string
	sandbox?: boolean
}

export const paymentProvidersApi = {
	getAll: () =>
		httpService.get(API_URLS.PAYMENT_PROVIDERS.BASE, { schema: paymentProvidersListSchema }),

	create: (data: PaymentProviderPayload) =>
		httpService.post(API_URLS.PAYMENT_PROVIDERS.BASE, data, {
			schema: paymentProviderSchema,
			skipErrorToast: true
		}),

	update: (id: string, data: PaymentProviderPayload) =>
		httpService.patch(API_URLS.PAYMENT_PROVIDERS.BY_ID(id), data, {
			schema: paymentProviderSchema,
			skipErrorToast: true
		}),

	delete: (id: string) =>
		httpService.delete<{ message?: string }, undefined>(API_URLS.PAYMENT_PROVIDERS.BY_ID(id)),

	activate: (id: string) =>
		httpService.patch<unknown, undefined>(API_URLS.PAYMENT_PROVIDERS.ACTIVATE(id), undefined)
}
