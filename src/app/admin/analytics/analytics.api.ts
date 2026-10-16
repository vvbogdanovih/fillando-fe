import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import { orderStatsSchema, type OrderStats } from './analytics.schema'

export interface OrderStatsQuery {
	/** Kyiv calendar day, `YYYY-MM-DD`. */
	date_from: string
	date_to: string
}

export const analyticsApi = {
	getOrderStats: (params: OrderStatsQuery): Promise<OrderStats> =>
		httpService.get(API_URLS.ORDERS.STATS, { params, schema: orderStatsSchema })
}
