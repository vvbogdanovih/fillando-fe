import type { CheckoutFormValues } from './checkout.schema'

export const DELIVERY_METHOD_LABELS: Record<CheckoutFormValues['delivery_method'], string> = {
	NOVA_POST: 'Нова Пошта (відділення)',
	COURIER: "Кур'єр Нова Пошта (адресна доставка)",
	PICKUP: 'Самовивіз'
}

/**
 * Two choices, not three: `BRANCH` is post and cargo branches in one list. A buyer does not know
 * which kind their branch is, and a town with cargo branches only showed an empty list under
 * «Поштове». The weight limit of a branch is part of its name in the list.
 */
export const WAREHOUSE_TYPES = ['PARCEL_LOCKER', 'BRANCH'] as const
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number]

export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
	PARCEL_LOCKER: 'Поштомат (до 20 кг)',
	BRANCH: 'Відділення'
}

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
