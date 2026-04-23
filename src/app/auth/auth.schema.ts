import { z } from 'zod'
import { FORM_ERRORS } from '@/common/constants'
import { emailSchema, nameSchema, passwordSchema, userSchema } from '@/common/schemas'

export const authResponseSchema = z.object({
	message: z.string(),
	user: userSchema
})

export const loginSchema = z.object({
	email: emailSchema,
	password: passwordSchema
})

export const registerSchema = z
	.object({
		name: nameSchema,
		email: emailSchema,
		password: passwordSchema,
		confirmPassword: passwordSchema
	})
	.refine(data => data.password === data.confirmPassword, {
		message: FORM_ERRORS.PASSWORDS_DO_NOT_MATCH,
		path: ['confirmPassword']
	})

export type RegisterValues = z.infer<typeof registerSchema>
export type LoginValues = z.infer<typeof loginSchema>
