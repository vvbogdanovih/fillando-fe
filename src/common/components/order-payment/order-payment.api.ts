import { httpService } from '@/common/services/http.service'
import { API_URLS } from '@/common/constants'
import type { CustomerSelectablePaymentMethod } from '@/common/constants/payment.constants'
import {
	orderPaymentStatusSchema,
	type OrderPaymentStatus
} from '@/app/(root)/checkout/checkout.api.schemas'
import { myOrderSchema, type MyOrder } from '@/app/(root)/profile/orders/orders.schema'

type ChangeBody = { payment_method: CustomerSelectablePaymentMethod }

/**
 * Public: switch an unpaid order to an offline method, authorised by the same per-order token
 * the lookup uses. Wrong token → 404, locked order → 409 `PAYMENT_METHOD_LOCKED`, incompatible
 * delivery → 400 with a Ukrainian message (TD-0009 §5.3).
 */
export function changePaymentMethodPublic(
	orderNumber: string,
	token: string,
	method: CustomerSelectablePaymentMethod
): Promise<OrderPaymentStatus> {
	return httpService.patch<OrderPaymentStatus, ChangeBody>(
		API_URLS.ORDERS.LOOKUP_PAYMENT_METHOD(orderNumber),
		{ payment_method: method },
		{ params: { token }, schema: orderPaymentStatusSchema, skipErrorToast: true }
	)
}

/** The signed-in counterpart for the buyer's own order (`/profile/orders/[id]`). */
export function changePaymentMethodMine(
	orderId: string,
	method: CustomerSelectablePaymentMethod
): Promise<MyOrder> {
	return httpService.patch<MyOrder, ChangeBody>(
		API_URLS.ORDERS.ME_PAYMENT_METHOD(orderId),
		{ payment_method: method },
		{ schema: myOrderSchema, skipErrorToast: true }
	)
}

/** The structured error body the backend attaches to 409s (`INSUFFICIENT_STOCK` style). */
interface ApiErrorDetails {
	code?: string
	message?: string
	retry_after_seconds?: number
}

export function readApiErrorDetails(err: unknown): ApiErrorDetails {
	const details = (err as { details?: unknown } | null)?.details
	return details && typeof details === 'object' ? (details as ApiErrorDetails) : {}
}

export const minutesLeft = (seconds: number) => Math.max(1, Math.ceil(seconds / 60))

/**
 * A request that never got an answer. `httpService` has no response to read a status or a
 * body from, so it rethrows `Error('Unknown error')` — the one English sentence that used to
 * reach the buyer as a toast when the connection dropped mid-payment.
 */
function isOffline(err: unknown): boolean {
	const e = err as { status?: unknown; response?: unknown; message?: string } | null
	if (typeof e?.status === 'number' || e?.response) return false
	return !e?.message || e.message === 'Unknown error'
}

/**
 * What to tell the buyer when a payment action fails. The backend's `message` is already
 * Ukrainian, but for the codes we know the page can say something more useful than the server
 * could — the LiqPay cooldown, for instance, names the two ways out. The status branches below
 * cover the answers that carry no Ukrainian body at all: the throttler, an expired or foreign
 * token, and a lost connection.
 */
export function describePaymentError(err: unknown): string {
	const details = readApiErrorDetails(err)
	const status = (err as { status?: number } | null)?.status
	if (details.code === 'LIQPAY_SESSION_ACTIVE') {
		const minutes = details.retry_after_seconds
			? minutesLeft(details.retry_after_seconds)
			: null
		return `Ви вже відкривали сторінку оплати. Якщо платіж не завершено, спробуйте знову${
			minutes ? ` через ${minutes} хв` : ' трохи пізніше'
		} або оберіть інший спосіб оплати.`
	}
	if (details.code === 'PAYMENT_METHOD_LOCKED') {
		return 'Спосіб оплати цього замовлення вже не можна змінити. Оновіть сторінку, щоб побачити поточний стан.'
	}
	if (status === 429) {
		return 'Занадто багато спроб. Зачекайте хвилину і спробуйте ще раз.'
	}
	if (status === 404) {
		return 'Замовлення не знайдено — можливо, посилання на оплату вже недійсне. Відкрийте замовлення у своєму профілі або зв’яжіться з нами.'
	}
	if (isOffline(err)) {
		return 'Немає зв’язку з сервером. Перевірте інтернет і спробуйте ще раз.'
	}
	const message = (err as { message?: string } | null)?.message
	return message || 'Не вдалося виконати дію. Спробуйте ще раз.'
}
