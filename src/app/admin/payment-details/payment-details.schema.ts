import { z } from 'zod'

export const paymentDetailSchema = z.object({
	_id: z.string(),
	last_name: z.string(),
	first_name: z.string(),
	middle_name: z.string().optional(),
	iban: z.string(),
	edrpou: z.string(),
	bank_name: z.string(),
	is_available: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
})

export const paymentDetailsListSchema = z.array(paymentDetailSchema)

export const paymentDetailFormSchema = z.object({
	last_name: z.string().min(1, "Прізвище є обов'язковим"),
	first_name: z.string().min(1, "Ім'я є обов'язковим"),
	middle_name: z.string().optional(),
	iban: z.string().min(1, "IBAN є обов'язковим"),
	edrpou: z.string().min(1, "ЄДРПОУ є обов'язковим"),
	bank_name: z.string().min(1, "Назва банку є обов'язковою")
})

export type PaymentDetail = z.infer<typeof paymentDetailSchema>
export type PaymentDetailFormValues = z.infer<typeof paymentDetailFormSchema>
