import { z } from 'zod'
import { Role } from '@/common/constants'

// Role is the authoritative enum from role.constants.ts
const roleSchema = z.nativeEnum(Role)

export const userSchema = z.object({
	id: z.string(),
	role: roleSchema,
	email: z.string(),
	name: z.string(),
	picture: z.string().nullable(),
	phone: z.string().nullable().optional(),
	authMethod: z.enum(['EMAIL', 'GOOGLE']).optional()
})
