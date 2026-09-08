'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/common/components/ui/button'
import { ChangePaymentMethodDialog } from '@/common/components/order-payment/ChangePaymentMethodDialog'
import { PayNowButton } from '@/common/components/order-payment/PayNowButton'
import { changePaymentMethodMine } from '@/common/components/order-payment/order-payment.api'
import { describeUnpaidPayment } from '@/common/components/order-payment/payment-state.copy'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { UI_URLS } from '@/common/constants'
import { myOrdersApi } from './orders.api'
import {
	DELIVERY_METHOD_LABELS,
	ORDER_STATUS_LABELS,
	PAYMENT_METHOD_LABELS,
	PAYMENT_STATUS_LABELS
} from './orders.constants'
import {
	formatDate,
	formatPrice,
	getOrderErrorMessage,
	isNotFoundError,
	readAddressField
} from './orders.utils'
import type { MyOrder, MyOrderItem } from './orders.schema'

function OrderItemsList({ items }: { items: MyOrderItem[] }) {
	if (items.length === 0) {
		return <p className='text-muted-foreground text-sm'>Товари відсутні</p>
	}

	return (
		<div className='space-y-3'>
			{items.map(item => (
				<div
					key={`${item.variant_id}-${item.sku}-${item.name}`}
					className='flex items-center gap-3 rounded-md border p-3'
				>
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

/** Mirrors the backend rule: the buyer may act on payment while it is awaited and the order is not yet in fulfilment. */
const PAYMENT_OPEN_STATUSES = new Set(['PENDING', 'FAILED'])
const PAYMENT_CHANGEABLE_ORDER_STATUSES = new Set(['NEW', 'CONFIRMED'])
/** A closed order is never explained as «ви можете оплатити» — there is nothing to pay for. */
const CLOSED_ORDER_STATUSES = new Set(['CANCELLED', 'RETURNED'])

/**
 * TD-0009's cooldown clock is not part of `myOrderSchema` yet (the schema passes unknown keys
 * through untyped), so read it defensively: anything but a number or `null` means "unknown",
 * which `PayNowButton` treats as "let the server decide".
 */
function readRetryAfterSeconds(order: MyOrder): number | null | undefined {
	const value = (order as { liqpay_retry_after_seconds?: unknown }).liqpay_retry_after_seconds
	if (value === null || typeof value === 'number') return value
	return undefined
}

export function OrderDetails({ orderId }: { orderId: string }) {
	const queryClient = useQueryClient()
	const [isChangeOpen, setIsChangeOpen] = useState(false)
	const {
		data: order,
		isLoading,
		isError,
		refetch,
		error
	} = useQuery({
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
								<Link href={UI_URLS.PROFILE.ORDERS}>
									Повернутися до списку замовлень
								</Link>
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

	const retryAfterSeconds = readRetryAfterSeconds(order)
	// The same explanation the success page gives for the same state: this screen carries the
	// same two actions, so «Статус: Помилка оплати» on its own left the buyer guessing.
	const paymentExplanation = CLOSED_ORDER_STATUSES.has(order.order_status)
		? null
		: describeUnpaidPayment({
				paymentMethod: order.payment_method,
				paymentStatus: order.payment_status,
				retryAfterSeconds
			})

	return (
		<div className='mx-auto w-full max-w-5xl space-y-6'>
			<Card>
				<CardHeader className='border-b'>
					<CardTitle>Замовлення #{order.order_number}</CardTitle>
					<p className='text-muted-foreground text-xs'>
						Створено: {formatDate(order.created_at)}
					</p>
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
				<CardContent className='space-y-3 text-sm'>
					<div>
						<p>Метод: {PAYMENT_METHOD_LABELS[order.payment_method]}</p>
						<p>Статус: {PAYMENT_STATUS_LABELS[order.payment_status]}</p>
					</div>
					{paymentExplanation && (
						<p className='text-muted-foreground leading-relaxed'>
							{paymentExplanation}
						</p>
					)}
					{/* An unpaid order that is not yet in fulfilment can still be paid by card or
					    moved to an offline method (TD-0009); the server enforces the same rule. */}
					{PAYMENT_OPEN_STATUSES.has(order.payment_status) &&
						PAYMENT_CHANGEABLE_ORDER_STATUSES.has(order.order_status) && (
							<div className='flex flex-col gap-2 sm:flex-row'>
								{order.payment_method === 'LIQPAY' && (
									<PayNowButton
										orderNumber={order.order_number}
										retryAfterSeconds={retryAfterSeconds}
										label={
											order.payment_status === 'FAILED'
												? 'Повторити оплату карткою'
												: 'Оплатити карткою'
										}
										onError={() =>
											void queryClient.invalidateQueries({
												queryKey: ['my-order', orderId]
											})
										}
									/>
								)}
								<Button
									type='button'
									variant='outline'
									onClick={() => setIsChangeOpen(true)}
								>
									Обрати інший спосіб оплати
								</Button>
								<ChangePaymentMethodDialog
									open={isChangeOpen}
									onOpenChange={setIsChangeOpen}
									orderNumber={order.order_number}
									currentMethod={order.payment_method}
									deliveryMethod={order.delivery_method}
									onSubmit={method => changePaymentMethodMine(order.id, method)}
									onChanged={() => {
										void queryClient.invalidateQueries({
											queryKey: ['my-order', orderId]
										})
										void queryClient.invalidateQueries({
											queryKey: ['my-orders']
										})
									}}
								/>
							</div>
						)}
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
