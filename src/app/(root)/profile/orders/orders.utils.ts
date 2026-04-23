import type { MyOrder } from './orders.schema'

export const formatPrice = (value: number): string =>
	new Intl.NumberFormat('uk-UA', {
		style: 'currency',
		currency: 'UAH',
		maximumFractionDigits: 0
	}).format(value)

export const formatDate = (value: string): string => {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return '—'
	return date.toLocaleString('uk-UA')
}

export const getOrderErrorMessage = (error: unknown): string => {
	if (error instanceof Error && error.message) return error.message
	return 'Сталася помилка під час завантаження'
}

export const isNotFoundError = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	'status' in error &&
	(error as { status?: number }).status === 404

export const readAddressField = (order: MyOrder, key: string): string =>
	String((order.delivery_address as Record<string, unknown> | null)?.[key] ?? '—')
