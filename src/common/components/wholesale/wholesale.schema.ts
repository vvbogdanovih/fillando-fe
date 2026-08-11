import '@/common/lib/zod-locale'
import * as z from 'zod'
import { emailSchema } from '@/common/schemas'

const phoneRegex = /^\+380\d{9}$/

export const wholesaleInquiryFormSchema = z.object({
	name: z.string().trim().min(1, "Вкажіть ім'я"),
	phone: z.string().trim().regex(phoneRegex, 'Формат телефону: +380XXXXXXXXX'),
	email: emailSchema,
	quantity: z.string().trim().min(1, 'Вкажіть бажану кількість'),
	comment: z.string().optional()
})

export type WholesaleInquiryFormValues = z.infer<typeof wholesaleInquiryFormSchema>

export const createWholesaleInquiryResponseSchema = z.object({
	message: z.string(),
	id: z.string()
})

export type CreateWholesaleInquiryResponse = z.infer<typeof createWholesaleInquiryResponseSchema>
