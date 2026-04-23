import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	paymentDetailSchema,
	paymentDetailsListSchema,
	type PaymentDetailFormValues
} from './payment-details.schema'

export const paymentDetailsApi = {
	getAll: () => httpService.get(API_URLS.PAYMENT_DETAILS.BASE, { schema: paymentDetailsListSchema }),

	create: (data: PaymentDetailFormValues) =>
		httpService.post(API_URLS.PAYMENT_DETAILS.BASE, data, {
			schema: paymentDetailSchema,
			skipErrorToast: true
		}),

	update: (id: string, data: PaymentDetailFormValues) =>
		httpService.patch(API_URLS.PAYMENT_DETAILS.BY_ID(id), data, {
			schema: paymentDetailSchema,
			skipErrorToast: true
		}),

	delete: (id: string) =>
		httpService.delete<{ message?: string }, undefined>(API_URLS.PAYMENT_DETAILS.BY_ID(id)),

	activate: (id: string) =>
		httpService.patch<unknown, undefined>(API_URLS.PAYMENT_DETAILS.ACTIVATE(id), undefined)
}
