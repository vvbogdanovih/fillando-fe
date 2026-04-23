export enum Role {
	USER = 'USER',
	MODERATOR = 'MODERATOR',
	ADMIN = 'ADMIN'
}

export const ROLES = {
	USER: Role.USER,
	MODERATOR: Role.MODERATOR,
	ADMIN: Role.ADMIN
} as const

// Спеціальне значення для доступу будь-якому авторизованому користувачу
export const ANY_AUTHENTICATED = 'any' as const
export type AnyAuthenticated = typeof ANY_AUTHENTICATED
