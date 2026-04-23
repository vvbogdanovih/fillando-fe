import { z } from 'zod'
import { emailSchema } from '@/common/schemas'

const phoneRegex = /^\+380\d{9}$/
const couponCodeRegex = /^[A-Z0-9]{10}$/

export const checkoutCustomerSchema = z.object({
	name: z.string().trim().min(1, "Вкажіть ім'я"),
	phone: z
		.string()
		.trim()
		.regex(phoneRegex, 'Формат телефону: +380XXXXXXXXX'),
	email: emailSchema
})

export const checkoutFormSchema = z
	.object({
		customer: checkoutCustomerSchema,
		delivery_method: z.enum(['NOVA_POST', 'COURIER', 'PICKUP'], {
			message: "Оберіть спосіб доставки"
		}),
		payment_method: z.enum(['IBAN', 'CASH'], {
			message: 'Оберіть спосіб оплати'
		}),
		comment: z.string().optional(),
		coupon_code: z
			.string()
			.optional()
			.refine(value => !value || couponCodeRegex.test(value), 'Код купона має містити 10 символів A-Z0-9'),
		city_ref: z.string().optional(),
		city_name: z.string().optional(),
		warehouse_type: z.enum(['PARCEL_LOCKER', 'POST', 'CARGO']).optional(),
		warehouse_number: z.number().optional(),
		warehouse_description: z.string().optional(),
		courier_city_name: z.string().optional(),
		courier_street: z.string().optional(),
		courier_building: z.string().optional(),
		courier_apartment: z.string().optional()
	})
	.superRefine((data, ctx) => {
		if (data.delivery_method === 'NOVA_POST') {
			if (!data.city_ref?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['city_ref'],
					message: 'Оберіть місто'
				})
			}
			if (!data.city_name?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['city_name'],
					message: 'Оберіть місто'
				})
			}
			if (!data.warehouse_type) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['warehouse_type'],
					message: 'Оберіть тип відділення'
				})
			}
			if (data.warehouse_number === undefined || Number.isNaN(data.warehouse_number)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['warehouse_number'],
					message: 'Оберіть відділення'
				})
			}
			if (!data.warehouse_description?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['warehouse_description'],
					message: 'Оберіть відділення'
				})
			}
		}
		if (data.payment_method === 'CASH' && data.delivery_method !== 'PICKUP') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['payment_method'],
				message: 'Готівка доступна тільки при самовивозі'
			})
		}
		if (data.delivery_method === 'COURIER') {
			if (!data.courier_city_name?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['courier_city_name'],
					message: "Місто є обов'язковим"
				})
			}
			if (!data.courier_street?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['courier_street'],
					message: "Вулиця є обов'язковою"
				})
			}
			if (!data.courier_building?.trim()) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['courier_building'],
					message: "Будинок є обов'язковим"
				})
			}
		}
	})

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>

export type CreateOrderPayload = {
	items: { variant_id: string; quantity: number }[]
	customer: CheckoutFormValues['customer']
	payment_method: 'IBAN' | 'CASH'
	delivery_method: CheckoutFormValues['delivery_method']
	delivery_address?: {
		city_name: string
		warehouse_description?: string
		warehouse_number?: number
		street?: string
		building?: string
		apartment?: string
	}
	comment?: string
	coupon_code?: string
}

export function formatOrderNumber(orderNumber: number | string): string {
	const n = typeof orderNumber === 'string' ? Number(orderNumber) : orderNumber
	if (Number.isNaN(n)) return String(orderNumber)
	return String(Math.trunc(n)).padStart(6, '0')
}

export function buildCreateOrderPayload(
	values: CheckoutFormValues,
	items: { variant_id: string; quantity: number }[]
): CreateOrderPayload {
	const base: CreateOrderPayload = {
		items,
		customer: values.customer,
		payment_method: values.payment_method,
		delivery_method: values.delivery_method,
		comment: values.comment?.trim() ? values.comment.trim() : undefined,
		coupon_code: values.coupon_code?.trim()
			? values.coupon_code.trim().toUpperCase()
			: undefined
	}

	if (values.delivery_method === 'NOVA_POST') {
		return {
			...base,
			delivery_address: {
				city_name: values.city_name!.trim(),
				warehouse_description: values.warehouse_description!.trim(),
				warehouse_number: values.warehouse_number!
			}
		}
	}

	if (values.delivery_method === 'COURIER') {
		const apartment = values.courier_apartment?.trim()
		return {
			...base,
			delivery_address: {
				city_name: values.courier_city_name!.trim(),
				street: values.courier_street!.trim(),
				building: values.courier_building!.trim(),
				...(apartment ? { apartment } : {})
			}
		}
	}

	return base
}
