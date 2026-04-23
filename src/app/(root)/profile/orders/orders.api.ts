import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import {
	myOrderSchema,
	myOrdersListResponseSchema,
	type MyOrder,
	type MyOrdersListResponse,
	type MyOrdersQuery
} from './orders.schema'

export const myOrdersApi = {
	getMyOrders: (params: MyOrdersQuery): Promise<MyOrdersListResponse> => {
		const cleanParams: Record<string, string | number> = {}
		if (params.page !== undefined) cleanParams.page = params.page
		if (params.limit !== undefined) cleanParams.limit = params.limit
		if (params.order_status) cleanParams.order_status = params.order_status
		if (params.payment_status) cleanParams.payment_status = params.payment_status

		return httpService.get(API_URLS.ORDERS.ME, {
			params: cleanParams,
			schema: myOrdersListResponseSchema,
			skipErrorToast: true
		})
	},

	getMyOrderById: (id: string): Promise<MyOrder> =>
		httpService.get(API_URLS.ORDERS.ME_BY_ID(id), {
			schema: myOrderSchema,
			skipErrorToast: true
		})
}
