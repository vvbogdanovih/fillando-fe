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
