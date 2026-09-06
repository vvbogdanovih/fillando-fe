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

// The delivery/payment compatibility rule now lives in `common/constants/payment.constants.ts`,
// shared with the payment-method change on the success page and in the account (TD-0009).
export { COD_ALLOWED_DELIVERY, isPaymentMethodAllowed } from '@/common/constants/payment.constants'

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
