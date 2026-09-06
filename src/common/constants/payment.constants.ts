import type { DeliveryMethod, PaymentMethod } from '@/app/(root)/profile/orders/orders.schema'

/** Накладний платіж requires the parcel to travel with Nova Post. */
export const COD_ALLOWED_DELIVERY: DeliveryMethod[] = ['NOVA_POST', 'COURIER']

/**
 * Payment methods that only work with some delivery methods. Mirrors
 * `OrderService.ALLOWED_DELIVERY_BY_PAYMENT` on the backend, which enforces the same pairs.
 */
export function isPaymentMethodAllowed(
	paymentMethod: PaymentMethod,
	deliveryMethod: DeliveryMethod
): boolean {
	if (paymentMethod === 'CASH') return deliveryMethod === 'PICKUP'
	if (paymentMethod === 'COD') return COD_ALLOWED_DELIVERY.includes(deliveryMethod)
	return true
}

/**
 * The methods a buyer may switch an unpaid order to (TD-0009 §5.3). Card is not among them:
 * moving an offline order onto LiqPay stays an admin action.
 */
export const CUSTOMER_SELECTABLE_PAYMENT_METHODS = ['COD', 'IBAN', 'CASH'] as const
export type CustomerSelectablePaymentMethod = (typeof CUSTOMER_SELECTABLE_PAYMENT_METHODS)[number]

/** Why a method is greyed out in the payment-method picker. */
export function paymentMethodRestriction(method: CustomerSelectablePaymentMethod): string | null {
	if (method === 'CASH') return 'Доступно лише при самовивозі'
	if (method === 'COD') return 'Доступно лише для доставки Новою Поштою або кур’єром'
	return null
}
