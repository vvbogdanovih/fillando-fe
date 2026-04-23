'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { UI_URLS } from '@/common/constants'
import { myOrdersApi } from './orders.api'
import {
	DELIVERY_METHOD_LABELS,
	ORDER_STATUS_LABELS,
	PAYMENT_METHOD_LABELS,
	PAYMENT_STATUS_LABELS
} from './orders.constants'
import { formatDate, formatPrice, getOrderErrorMessage, isNotFoundError, readAddressField } from './orders.utils'
import type { MyOrderItem } from './orders.schema'

function OrderItemsList({ items }: { items: MyOrderItem[] }) {
	if (items.length === 0) {
		return <p className='text-muted-foreground text-sm'>Товари відсутні</p>
	}

	return (
		<div className='space-y-3'>
			{items.map(item => (
				<div key={`${item.variant_id}-${item.sku}-${item.name}`} className='flex items-center gap-3 rounded-md border p-3'>
					{item.image ? (
						<Image
							src={item.image}
							alt={item.name}
							width={64}
							height={64}
							className='h-16 w-16 rounded object-cover'
						/>
					) : (
						<div className='h-16 w-16 rounded bg-gray-100' />
					)}
					<div className='min-w-0 flex-1'>
						<p className='line-clamp-1 font-medium'>{item.name}</p>
						<p className='text-muted-foreground text-xs'>SKU: {item.sku ?? '—'}</p>
					</div>
					<div className='text-right text-sm'>
						<p>К-сть: {item.quantity}</p>
						<p>Ціна: {formatPrice(item.price ?? 0)}</p>
						<p className='font-medium'>Разом: {formatPrice(item.line_total)}</p>
					</div>
				</div>
			))}
		</div>
	)
}

export function OrderDetails({ orderId }: { orderId: string }) {
	const { data: order, isLoading, isError, refetch, error } = useQuery({
		queryKey: ['my-order', orderId],
		queryFn: () => myOrdersApi.getMyOrderById(orderId),
		retry: false
	})

	if (isLoading) {
		return (
			<div className='mx-auto w-full max-w-5xl space-y-4'>
				{Array.from({ length: 4 }).map((_, index) => (
					<div key={index} className='h-28 animate-pulse rounded-md bg-gray-100' />
				))}
			</div>
		)
	}

	if (isError) {
		if (isNotFoundError(error)) {
			return (
				<div className='mx-auto w-full max-w-5xl'>
					<Card>
						<CardHeader>
						<CardTitle>Замовлення не знайдено</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
						<p className='text-muted-foreground text-sm'>
							Можливо, замовлення не існує або недоступне для вашого акаунта.
						</p>
						<Button asChild variant='outline'>
							<Link href={UI_URLS.PROFILE.ORDERS}>Повернутися до списку замовлень</Link>
						</Button>
						</CardContent>
					</Card>
				</div>
			)
		}

		return (
			<div className='mx-auto w-full max-w-5xl'>
				<Card>
					<CardHeader>
					<CardTitle>Не вдалося завантажити замовлення</CardTitle>
					</CardHeader>
					<CardContent className='space-y-3'>
					<p className='text-sm text-gray-500'>{getOrderErrorMessage(error)}</p>
					<Button variant='outline' onClick={() => refetch()}>
						Спробувати знову
					</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (!order) return null

	return (
		<div className='mx-auto w-full max-w-5xl space-y-6'>
			<Card>
				<CardHeader className='border-b'>
					<CardTitle>Замовлення #{order.order_number}</CardTitle>
					<p className='text-muted-foreground text-xs'>Створено: {formatDate(order.created_at)}</p>
				</CardHeader>
				<CardContent className='grid gap-2 pt-4 text-sm sm:grid-cols-2'>
					<p>Статус: {ORDER_STATUS_LABELS[order.order_status]}</p>
					<p>Статус оплати: {PAYMENT_STATUS_LABELS[order.payment_status]}</p>
					<p>Subtotal: {formatPrice(order.subtotal_price)}</p>
					<p>Total: {formatPrice(order.total_price)}</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Одержувач</CardTitle>
				</CardHeader>
				<CardContent className='space-y-1 text-sm'>
					<p>{order.customer.name || '—'}</p>
					<p>{order.customer.phone || '—'}</p>
					<p>{order.customer.email || '—'}</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Доставка</CardTitle>
				</CardHeader>
				<CardContent className='space-y-1 text-sm'>
					<p>Метод: {DELIVERY_METHOD_LABELS[order.delivery_method]}</p>
					{order.delivery_method === 'NOVA_POST' && (
						<>
							<p>Місто: {readAddressField(order, 'city_name')}</p>
							<p>Відділення: {readAddressField(order, 'warehouse_description')}</p>
							<p>Номер відділення: {readAddressField(order, 'warehouse_number')}</p>
						</>
					)}
					{order.delivery_method === 'COURIER' && (
						<>
							<p>Місто: {readAddressField(order, 'city_name')}</p>
							<p>Вулиця: {readAddressField(order, 'street')}</p>
							<p>Будинок: {readAddressField(order, 'building')}</p>
							<p>Квартира: {readAddressField(order, 'apartment')}</p>
						</>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Оплата</CardTitle>
				</CardHeader>
				<CardContent className='text-sm'>
					<p>Метод: {PAYMENT_METHOD_LABELS[order.payment_method]}</p>
					<p>Статус: {PAYMENT_STATUS_LABELS[order.payment_status]}</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Товари</CardTitle>
				</CardHeader>
				<CardContent>
					<OrderItemsList items={order.items} />
				</CardContent>
			</Card>
		</div>
	)
}
