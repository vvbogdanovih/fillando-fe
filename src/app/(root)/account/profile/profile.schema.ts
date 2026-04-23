import { z } from 'zod'
import { FORM_ERRORS } from '@/common/constants'
import { userSchema } from '@/common/schemas'

export const profileResponseSchema = z.object({
	message: z.string(),
	user: userSchema
})

const phoneRegex = /^\+380\d{9}$/

export const profileFormSchema = z.object({
	email: z.string().email(),
	name: z.string().trim().min(1, FORM_ERRORS.FIELD_IS_REQUIRED('Імʼя')),
	phone: z
		.string()
		.trim()
		.refine(value => value === '' || phoneRegex.test(value), {
			message: 'Телефон має бути у форматі +380XXXXXXXXX'
		}),
	picture: z.string().trim().url('Некоректний URL').or(z.literal(''))
})

export type ProfileResponse = z.infer<typeof profileResponseSchema>
export type ProfileFormValues = z.infer<typeof profileFormSchema>

export type UpdateProfilePayload = Partial<{
	name: string
	phone: string | null
	picture: string | null
}>
