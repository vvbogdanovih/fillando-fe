import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import type { TypedCatalogResponse } from './typed-catalog.types'

/** Browser read of the typed catalogue; the query string comes from `apiQuery`. */
export const getTypedCatalog = (query: string): Promise<TypedCatalogResponse> =>
	httpService.get<TypedCatalogResponse, unknown>(`${API_URLS.PRODUCTS.CATALOG_V2}?${query}`)
