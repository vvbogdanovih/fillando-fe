import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import {
	adminVariantsListSchema,
	type AdminVariantsList,
	type AdminVariantsQuery
} from './price-sheet.schema'

export const priceSheetApi = {
	getAll: (params: AdminVariantsQuery): Promise<AdminVariantsList> => {
		const cleanParams: Record<string, string | number> = {}
		if (params.q) cleanParams.q = params.q
		if (params.page !== undefined) cleanParams.page = params.page
		if (params.limit !== undefined) cleanParams.limit = params.limit

		return httpService.get(API_URLS.PRODUCTS.PRICE_SHEET, {
			params: cleanParams,
			schema: adminVariantsListSchema
		})
	}
}
