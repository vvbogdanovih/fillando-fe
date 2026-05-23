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

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	PENDING: 'Очікує оплату',
	PAID: 'Оплачено',
	FAILED: 'Помилка оплати',
	REFUNDED: 'Повернено'
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

