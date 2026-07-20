import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import {
	wholesaleInquiriesListResponseSchema,
	wholesaleInquirySchema,
	type ListWholesaleInquiriesQuery,
	type WholesaleInquiriesListResponse,
	type WholesaleInquiry,
	type WholesaleInquiryStatus
} from './wholesale.schema'

export const wholesaleAdminApi = {
	getAll: (params: ListWholesaleInquiriesQuery): Promise<WholesaleInquiriesListResponse> => {
		const cleanParams: Record<string, string | number> = {}
		if (params.page !== undefined) cleanParams.page = params.page
		if (params.limit !== undefined) cleanParams.limit = params.limit
		if (params.status !== undefined) cleanParams.status = params.status

		return httpService.get(API_URLS.WHOLESALE.BASE, {
			params: cleanParams,
			schema: wholesaleInquiriesListResponseSchema
		})
	},

	updateStatus: (id: string, status: WholesaleInquiryStatus): Promise<WholesaleInquiry> =>
		httpService.patch(
			API_URLS.WHOLESALE.STATUS(id),
			{ status },
			{ schema: wholesaleInquirySchema, skipErrorToast: true }
		)
}
