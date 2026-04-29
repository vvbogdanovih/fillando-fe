import { API_URLS } from '@/common/constants'
import { httpService } from '@/common/services/http.service'
import { usersListResponseSchema, type UsersListQuery, type UsersListResponse } from './users.schema'

export const usersApi = {
	getAll: (params: UsersListQuery): Promise<UsersListResponse> => {
		const cleanParams: Record<string, string | number> = {}
		if (params.page !== undefined) cleanParams.page = params.page
		if (params.limit !== undefined) cleanParams.limit = params.limit
		if (params.role) cleanParams.role = params.role

		return httpService.get(API_URLS.USERS.BASE, {
			params: cleanParams,
			schema: usersListResponseSchema
		})
	}
}
