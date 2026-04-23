import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	couponSchema,
	couponsListResponseSchema,
	type Coupon,
	type CreateCouponPayload,
	type ListCouponsQuery,
	type CouponsListResponse,
	type UpdateCouponPayload
} from './coupons.schema'

export const couponsApi = {
	getAll: (params: ListCouponsQuery): Promise<CouponsListResponse> => {
		const cleanParams: Record<string, string | number | boolean> = {}
		if (params.page !== undefined) cleanParams.page = params.page
		if (params.limit !== undefined) cleanParams.limit = params.limit
		if (params.is_active !== undefined) cleanParams.is_active = params.is_active
		if (params.q !== undefined && params.q.trim().length > 0) cleanParams.q = params.q.trim()

		return httpService.get(API_URLS.COUPONS.BASE, {
			params: cleanParams,
			schema: couponsListResponseSchema
		})
	},

	getById: (id: string): Promise<Coupon> =>
		httpService.get(API_URLS.COUPONS.BY_ID(id), {
			schema: couponSchema
		}),

	create: (payload: CreateCouponPayload): Promise<Coupon> =>
		httpService.post(API_URLS.COUPONS.BASE, payload, {
			schema: couponSchema,
			skipErrorToast: true
		}),

	update: (id: string, payload: UpdateCouponPayload): Promise<Coupon> =>
		httpService.patch(API_URLS.COUPONS.BY_ID(id), payload, {
			schema: couponSchema,
			skipErrorToast: true
		}),

	delete: (id: string): Promise<{ message?: string }> =>
		httpService.delete(API_URLS.COUPONS.BY_ID(id), {
			skipErrorToast: true
		})
}
