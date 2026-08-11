import { z } from 'zod'
import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import type { CreateOrderPayload } from './checkout.schema'
import {
	createOrderResponseSchema,
	validateCouponResponseSchema,
	type CreateOrderResponse,
	type ValidateCouponResponse
} from './checkout.api.schemas'

/** API returns `name` (and extra Mongo fields); UI keeps using `description`. */
export const novaCitySchema = z
	.object({
		ref: z.string(),
		name: z.string().optional(),
		description: z.string().optional()
	})
	.passthrough()
	.transform(data => ({
		ref: data.ref,
		description: (data.name ?? data.description ?? '').trim()
	}))

export const novaWarehouseSchema = z.object({
	number: z.coerce.number(),
	description: z.string(),
	shortAddress: z.string().optional()
})

const novaCityListSchema = z.array(novaCitySchema)
const novaWarehouseListSchema = z.array(novaWarehouseSchema)

export type NovaCity = z.infer<typeof novaCitySchema>
export type NovaWarehouse = z.infer<typeof novaWarehouseSchema>

export async function fetchNovaPostCities(q: string): Promise<NovaCity[]> {
	return httpService.get<NovaCity[], unknown>(API_URLS.NOVA_POST.CITIES, {
		params: { q },
		schema: novaCityListSchema,
		skipErrorToast: true
	})
}

export async function fetchNovaPostWarehouses(
	cityRef: string,
	type: 'PARCEL_LOCKER' | 'POST' | 'CARGO',
	q?: string
): Promise<NovaWarehouse[]> {
	const trimmed = q?.trim()
	const params: Record<string, string> = { cityRef, type }
	if (trimmed) params.q = trimmed
	return httpService.get<NovaWarehouse[], unknown>(API_URLS.NOVA_POST.WAREHOUSES, {
		params,
		schema: novaWarehouseListSchema,
		skipErrorToast: true
	})
}

export async function createOrder(body: CreateOrderPayload) {
	return httpService.post<CreateOrderResponse, CreateOrderPayload>(API_URLS.ORDERS.BASE, body, {
		schema: createOrderResponseSchema,
		skipErrorToast: true
	})
}

const liqpayCheckoutSchema = z.object({
	data: z.string(),
	signature: z.string(),
	action_url: z.string()
})

export type LiqpayCheckout = z.infer<typeof liqpayCheckoutSchema>

/** Builds the signed LiqPay payload the browser auto-submits to the LiqPay page. */
export async function initLiqpayCheckout(orderNumber: string | number): Promise<LiqpayCheckout> {
	return httpService.post<LiqpayCheckout, { order_number: string }>(
		API_URLS.LIQPAY.CHECKOUT,
		{ order_number: String(orderNumber) },
		{ schema: liqpayCheckoutSchema, skipErrorToast: true }
	)
}

/** Public: returns the active provider record (no secrets) or null when unavailable. */
export async function fetchActivePaymentProvider(
	provider: 'LIQPAY' | 'MONOPAY'
): Promise<{ provider: string } | null> {
	return httpService
		.get<{ provider: string } | null, unknown>(API_URLS.PAYMENT_PROVIDERS.ACTIVE(provider), {
			skipErrorToast: true
		})
		.catch(() => null)
}

export async function validateCouponCode(code: string): Promise<ValidateCouponResponse> {
	return httpService.post<ValidateCouponResponse, { code: string }>(
		API_URLS.COUPONS.VALIDATE,
		{ code },
		{
			schema: validateCouponResponseSchema,
			skipErrorToast: true
		}
	)
}
