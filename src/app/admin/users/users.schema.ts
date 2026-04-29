import { z } from 'zod'

export const roleValues = ['USER', 'ADMIN'] as const
export const authMethodValues = ['EMAIL', 'GOOGLE', 'GITHUB'] as const

export const userListItemSchema = z
	.object({
		_id: z.string().optional(),
		id: z.string().optional(),
		email: z.string(),
		name: z.string(),
		role: z.enum(roleValues).catch('USER'),
		phone: z.string().nullable().optional(),
		authMethod: z.enum(authMethodValues).catch('EMAIL'),
		createdAt: z.string().optional()
	})
	.passthrough()
	.transform(data => ({
		...data,
		id: data.id ?? data._id ?? '',
		phone: data.phone ?? null,
		createdAt: data.createdAt ?? new Date().toISOString()
	}))

export const usersListResponseSchema = z.object({
	items: z.array(userListItemSchema),
	total: z.coerce.number().min(0),
	page: z.coerce.number().min(1),
	limit: z.coerce.number().min(1)
})

export type UserRole = (typeof roleValues)[number]
export type AuthMethod = (typeof authMethodValues)[number]
export type UserListItem = z.infer<typeof userListItemSchema>
export type UsersListResponse = z.infer<typeof usersListResponseSchema>

export interface UsersListQuery {
	page?: number
	limit?: number
	role?: UserRole
}
