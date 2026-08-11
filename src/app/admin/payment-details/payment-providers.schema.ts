import '@/common/lib/zod-locale'
import * as z from 'zod'

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderKey, string> = {
	LIQPAY: 'LiqPay',
	MONOPAY: 'MonoPay'
}

export const paymentProviderSchema = z.object({
	_id: z.string(),
	provider: z.enum(['LIQPAY', 'MONOPAY']),
	label: z.string(),
	public_key: z.string(),
	is_active: z.boolean(),
	sandbox: z.boolean(),
	has_private_key: z.boolean().optional(),
	createdAt: z.string(),
	updatedAt: z.string()
})

export const paymentProvidersListSchema = z.array(paymentProviderSchema)

export const paymentProviderFormSchema = z.object({
	label: z.string().min(1, "Назва є обов'язковою"),
	public_key: z.string().min(1, "Public key є обов'язковим"),
	// Optional so that editing without rotating the secret is allowed; the form
	// enforces "required on create" separately.
	private_key: z.string().optional(),
	sandbox: z.boolean().optional()
})

export type PaymentProviderKey = 'LIQPAY' | 'MONOPAY'
export type PaymentProvider = z.infer<typeof paymentProviderSchema>
export type PaymentProviderFormValues = z.infer<typeof paymentProviderFormSchema>
