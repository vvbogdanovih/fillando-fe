'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Button } from '@/common/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/common/components/ui/select'
import { UI_URLS } from '@/common/constants'
import { myOrdersApi } from './orders.api'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from './orders.constants'
import { formatDate, formatPrice, getOrderErrorMessage } from './orders.utils'
import {
	orderStatusValues,
	paymentStatusValues,
	type OrderStatus,
	type PaymentStatus
} from './orders.schema'

export function Orders() {
	const router = useRouter()
	const [page, setPage] = useState(1)
	const [limit, setLimit] = useState(20)
	const [orderStatus, setOrderStatus] = useState<'all' | OrderStatus>('all')
	const [paymentStatus, setPaymentStatus] = useState<'all' | PaymentStatus>('all')

	const { data, isLoading, isError, isFetching, refetch, error } = useQuery({
		queryKey: ['my-orders', page, limit, orderStatus, paymentStatus],
		queryFn: () =>
			myOrdersApi.getMyOrders({
				page,
				limit,
				order_status: orderStatus === 'all' ? undefined : orderStatus,
				payment_status: paymentStatus === 'all' ? undefined : paymentStatus
			})
	})

	const orders = data?.items ?? []
	const total = data?.total ?? 0
	const totalPages = Math.max(1, Math.ceil(total / limit))

	return (
		<div className='mx-auto w-full max-w-5xl'>
			<Card>
				<CardHeader className='border-b'>
				<div className='flex items-center justify-between gap-3'>
					<CardTitle>Мої замовлення</CardTitle>
					<div className='text-muted-foreground text-xs'>
						Всього: {total} {isFetching ? '• Оновлення...' : ''}
					</div>
				</div>
				<div className='mt-3 grid gap-3 sm:grid-cols-3'>
					<Select
						value={orderStatus}
						onValueChange={value => {
							setOrderStatus(value as 'all' | OrderStatus)
							setPage(1)
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder='Статус замовлення' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>Всі статуси замовлення</SelectItem>
							{orderStatusValues.map(status => (
								<SelectItem key={status} value={status}>
									{ORDER_STATUS_LABELS[status]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={paymentStatus}
						onValueChange={value => {
							setPaymentStatus(value as 'all' | PaymentStatus)
							setPage(1)
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder='Статус оплати' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>Всі статуси оплати</SelectItem>
							{paymentStatusValues.map(status => (
								<SelectItem key={status} value={status}>
									{PAYMENT_STATUS_LABELS[status]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={String(limit)}
						onValueChange={value => {
							setLimit(Number(value))
							setPage(1)
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder='Ліміт' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='10'>10 / сторінку</SelectItem>
							<SelectItem value='20'>20 / сторінку</SelectItem>
							<SelectItem value='50'>50 / сторінку</SelectItem>
						</SelectContent>
					</Select>
				</div>
				</CardHeader>
				<CardContent className='pt-5'>
				{isLoading ? (
					<div className='space-y-3'>
						{Array.from({ length: 6 }).map((_, index) => (
							<div key={index} className='h-16 animate-pulse rounded-md bg-gray-100' />
						))}
					</div>
				) : isError ? (
					<div className='space-y-2'>
						<p className='text-sm text-gray-500'>{getOrderErrorMessage(error)}</p>
						<Button variant='outline' size='sm' onClick={() => refetch()}>
							Спробувати знову
						</Button>
					</div>
				) : orders.length === 0 ? (
					<div className='space-y-1'>
						<p className='text-sm text-gray-500'>У вас поки немає замовлень за обраними фільтрами.</p>
						<p className='text-muted-foreground text-xs'>
							Спробуйте змінити фільтри або оформити перше замовлення.
						</p>
					</div>
				) : (
					<>
						<div className='overflow-x-auto'>
							<table className='w-full min-w-[760px] text-sm'>
								<thead>
									<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
										<th className='px-3 py-2'>№</th>
										<th className='px-3 py-2'>Дата</th>
										<th className='px-3 py-2'>Сума</th>
										<th className='px-3 py-2'>Статус</th>
										<th className='px-3 py-2'>Оплата</th>
									</tr>
								</thead>
								<tbody>
									{orders.map(order => (
										<tr
											key={order.id}
											className='cursor-pointer border-b hover:bg-gray-50'
											onClick={() => router.push(UI_URLS.PROFILE.ORDER_DETAILS(order.id))}
											onKeyDown={event => {
												if (event.key === 'Enter' || event.key === ' ') {
													event.preventDefault()
													router.push(UI_URLS.PROFILE.ORDER_DETAILS(order.id))
												}
											}}
											tabIndex={0}
										>
											<td className='px-3 py-3 font-medium'>#{order.order_number}</td>
											<td className='px-3 py-3'>{formatDate(order.created_at)}</td>
											<td className='px-3 py-3'>{formatPrice(order.total_price)}</td>
											<td className='px-3 py-3'>{ORDER_STATUS_LABELS[order.order_status]}</td>
											<td className='px-3 py-3'>{PAYMENT_STATUS_LABELS[order.payment_status]}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className='mt-4 flex items-center justify-between'>
							<p className='text-muted-foreground text-xs'>
								Сторінка {page} з {totalPages}
							</p>
							<div className='flex gap-2'>
								<Button
									variant='outline'
									size='sm'
									disabled={page <= 1 || isFetching}
									onClick={() => setPage(prev => Math.max(1, prev - 1))}
								>
									Попередня
								</Button>
								<Button
									variant='outline'
									size='sm'
									disabled={page >= totalPages || isFetching}
									onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
								>
									Наступна
								</Button>
							</div>
						</div>
					</>
				)}
				</CardContent>
			</Card>
		</div>
	)
}
