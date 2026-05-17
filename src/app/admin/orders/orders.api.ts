import axios from 'axios'
import { API_BASE_URL, API_URLS } from '@/common/constants'
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
		}),

	downloadInvoice: async (
		id: string,
		orderNumber: string,
		adminComment?: string
	): Promise<void> => {
		const response = await axios.post(
			`${API_BASE_URL}${API_URLS.ORDERS.INVOICE(id)}`,
			{ admin_comment: adminComment || undefined },
			{ responseType: 'blob', withCredentials: true }
		)

		const url = window.URL.createObjectURL(new Blob([response.data]))
		const link = document.createElement('a')
		link.href = url
		link.download = `${orderNumber}.pdf`
		document.body.appendChild(link)
		link.click()
		link.remove()
		window.URL.revokeObjectURL(url)
	},

	sendVendorEmail: (
		id: string,
		payload: { vendor_email: string; admin_comment?: string }
	): Promise<void> =>
		httpService.post(API_URLS.ORDERS.VENDOR_EMAIL(id), payload)
}

export const parsePatchOrderPayload = (payload: PatchOrderPayload): PatchOrderPayload =>
	patchOrderSchema.parse(payload)
