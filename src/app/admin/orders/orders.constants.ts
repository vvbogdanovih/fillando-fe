import type { DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus } from './orders.schema'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	NEW: 'Нове',
	CONFIRMED: 'Підтверджено',
	PROCESSING: 'В обробці',
	SHIPPED: 'Відправлено',
	DELIVERED: 'Доставлено',
	COMPLETED: 'Виконано',
	CANCELLED: 'Скасовано',
	RETURNED: 'Повернено'
}

export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
	NEW: 'border-green-200 bg-green-50 text-green-700',
	CONFIRMED: 'border-blue-200 bg-blue-50 text-blue-700',
	PROCESSING: 'border-amber-200 bg-amber-50 text-amber-700',
	SHIPPED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
	DELIVERED: 'border-teal-200 bg-teal-50 text-teal-700',
	COMPLETED: 'border-gray-200 bg-gray-50 text-gray-600',
	CANCELLED: 'border-red-200 bg-red-50 text-red-700',
	RETURNED: 'border-orange-200 bg-orange-50 text-orange-700'
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	PENDING: 'Очікує оплату',
	PAID: 'Оплачено',
	FAILED: 'Помилка оплати',
	REFUNDED: 'Повернено',
	VOIDED: 'Скасовано'
}

export const PAYMENT_STATUS_CLASSES: Record<PaymentStatus, string> = {
	PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
	PAID: 'border-green-200 bg-green-50 text-green-700',
	FAILED: 'border-red-200 bg-red-50 text-red-700',
	REFUNDED: 'border-gray-200 bg-gray-50 text-gray-600',
	VOIDED: 'border-gray-200 bg-gray-50 text-gray-600'
}

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
	NOVA_POST: 'Нова Пошта',
	COURIER: 'Курʼєр',
	PICKUP: 'Самовивіз'
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	CASH: 'Готівка',
	CARD: 'Картка',
	LIQPAY: 'LiqPay',
	MONOPAY: 'MonoPay',
	IBAN: 'Переказ за IBAN'
}
