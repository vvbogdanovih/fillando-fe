import type { CheckoutFormValues } from './checkout.schema'

export const DELIVERY_METHOD_LABELS: Record<CheckoutFormValues['delivery_method'], string> = {
	NOVA_POST: 'Нова Пошта (відділення)',
	COURIER: "Кур'єр Нова Пошта (адресна доставка)",
	PICKUP: 'Самовивіз'
}

export const WAREHOUSE_TYPE_LABELS = {
	PARCEL_LOCKER: 'Поштомат (до 20 кг)',
	POST: 'Поштове відділення (до 30 кг)',
	CARGO: 'Вантажне відділення (до 1100 кг)'
} as const

/** Накладний платіж requires the parcel to travel with Nova Post. */
export const COD_ALLOWED_DELIVERY: CheckoutFormValues['delivery_method'][] = [
	'NOVA_POST',
	'COURIER'
]

/** Payment methods that only work with some delivery methods. */
export function isPaymentMethodAllowed(
	paymentMethod: CheckoutFormValues['payment_method'],
	deliveryMethod: CheckoutFormValues['delivery_method']
): boolean {
	if (paymentMethod === 'CASH') return deliveryMethod === 'PICKUP'
	if (paymentMethod === 'COD') return COD_ALLOWED_DELIVERY.includes(deliveryMethod)
	return true
}

export const COD_MIN_PREPAYMENT_UAH = 200

export const COD_MODAL = {
	title: 'Накладний платіж — з частковою передоплатою',
	description: `Відправка накладним платежем здійснюється за умови часткової передоплати — щонайменше ${COD_MIN_PREPAYMENT_UAH} ₴.`,
	details: [
		"Наш менеджер зв'яжеться з вами найближчим часом і уточнить суму передоплати.",
		'Передоплата потрібна, щоб гарантувати викуп замовлення з відділення.',
		'Решту суми ви сплачуєте на пошті при отриманні.'
	],
	confirm: 'Погоджуюсь',
	cancel: 'Скасувати'
} as const
