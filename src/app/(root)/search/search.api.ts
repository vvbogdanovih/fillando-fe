import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import type { CatalogItem } from '@/app/(root)/[category]/[subcategory]/catalog.api'

export interface SearchResponse {
	items: CatalogItem[]
	pagination: {
		total: number
		page: number
		limit: number
		totalPages: number
	}
}

export interface SearchParams {
	q: string
	page?: number
	limit?: number
}

export const searchProducts = (params: SearchParams): Promise<SearchResponse> => {
	return httpService.get<SearchResponse, unknown>(API_URLS.PRODUCTS.SEARCH, { params })
}
