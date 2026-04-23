import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import {
	orderSchema,
	ordersListResponseSchema,
	patchOrderSchema,
	type OrdersListQuery,
	type OrdersListResponse,
	type Order,
	type PatchOrderPayload,
	type PatchOrderStatusPayload,
	type PatchPaymentStatusPayload,
	type PatchTtnPayload
} from './orders.schema'

export const ordersApi = {
	getAll: (params: OrdersListQuery): Promise<OrdersListResponse> => {
		const cleanParams: Record<string, string | number> = {}
		if (params.page !== undefined) cleanParams.page = params.page
		if (params.limit !== undefined) cleanParams.limit = params.limit
		if (params.order_status) cleanParams.order_status = params.order_status
		if (params.payment_status) cleanParams.payment_status = params.payment_status

		return httpService.get(API_URLS.ORDERS.BASE, {
			params: cleanParams,
			schema: ordersListResponseSchema
		})
	},

	getById: (id: string): Promise<Order> =>
		httpService.get(API_URLS.ORDERS.BY_ID(id), {
			schema: orderSchema
		}),

	patchOrder: (id: string, payload: PatchOrderPayload): Promise<Order> =>
		httpService.patch(API_URLS.ORDERS.BY_ID(id), payload, {
			schema: orderSchema,
			skipErrorToast: true
		}),

	patchOrderStatus: (id: string, payload: PatchOrderStatusPayload): Promise<Order> =>
		httpService.patch(API_URLS.ORDERS.STATUS(id), payload, {
			schema: orderSchema,
			skipErrorToast: true
		}),

	patchPaymentStatus: (id: string, payload: PatchPaymentStatusPayload): Promise<Order> =>
		httpService.patch(API_URLS.ORDERS.PAYMENT_STATUS(id), payload, {
			schema: orderSchema,
			skipErrorToast: true
		}),

	patchTtn: (id: string, payload: PatchTtnPayload): Promise<Order> =>
		httpService.patch(API_URLS.ORDERS.TTN(id), payload, {
			schema: orderSchema,
			skipErrorToast: true
		})
}

export const parsePatchOrderPayload = (payload: PatchOrderPayload): PatchOrderPayload =>
	patchOrderSchema.parse(payload)
