'use client'

import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Badge } from '@/common/components/ui/badge'
import { Button } from '@/common/components/ui/button'
import { Label } from '@/common/components/ui/label'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from '@/common/components/ui/dropdown-menu'
import { UI_URLS } from '@/common/constants'
import { ordersApi } from './orders.api'
import {
	ORDER_STATUS_CLASSES,
	ORDER_STATUS_LABELS,
	PAYMENT_STATUS_CLASSES,
	PAYMENT_STATUS_LABELS
} from './orders.constants'
import {
	buildOrdersListSearch,
	formatCustomerShort,
	formatDate,
	formatPrice,
	ORDERS_LIMIT_VALUES,
	parseOrdersListParams,
	type OrdersListParams
} from './orders.utils'
import {
	orderStatusValues,
	paymentStatusValues,
	type OrderStatus,
	type PaymentStatus
} from './orders.schema'
import { ReportModal } from './ReportModal'

const LIMIT_OPTIONS = ORDERS_LIMIT_VALUES.map(value => ({
	value: String(value),
	label: `${value} / сторінку`
}))

export function Orders() {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const listParams = parseOrdersListParams(new URLSearchParams(searchParams.toString()))
	const { page, limit, orderStatus, paymentStatus } = listParams

	// `replace`, not `push`: paging through the list should not fill the history, and the
	// order page is pushed on top of this address, so «Назад» still lands right here.
	const updateList = (patch: Partial<OrdersListParams>) =>
		router.replace(`${pathname}${buildOrdersListSearch({ ...listParams, ...patch })}`, {
			scroll: false
		})

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ['admin-orders', page, limit, orderStatus, paymentStatus],
		queryFn: () =>
			ordersApi.getAll({
				page,
				limit,
				order_status: orderStatus === 'all' ? undefined : orderStatus,
				payment_status: paymentStatus === 'all' ? undefined : paymentStatus
			})
	})

	const orders = data?.items ?? []
	const total = data?.total ?? 0
	const totalPages = Math.max(1, Math.ceil(total / limit))

	const orderStatusLabel =
		orderStatus === 'all' ? 'Всі статуси замовлення' : ORDER_STATUS_LABELS[orderStatus]
	const paymentStatusLabel =
		paymentStatus === 'all' ? 'Всі статуси оплати' : PAYMENT_STATUS_LABELS[paymentStatus]
	const limitLabel =
		LIMIT_OPTIONS.find(o => o.value === String(limit))?.label ?? `${limit} / сторінку`

	return (
		<div className='p-6'>
			<Card>
				<CardHeader className='border-b'>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle>Замовлення</CardTitle>
						<div className='flex items-center gap-3'>
							<ReportModal />
							<div className='text-muted-foreground text-xs'>
								Всього: {total} {isFetching ? '• Оновлення...' : ''}
							</div>
						</div>
					</div>
					<div className='mt-3 grid gap-3 sm:grid-cols-3'>
						<div className='space-y-2'>
							<Label>Статус замовлення</Label>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' className='w-full justify-between'>
										{orderStatusLabel}
										<ChevronDown className='ml-2 size-4 opacity-50' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='start' className='w-56'>
									<DropdownMenuRadioGroup
										value={orderStatus}
										onValueChange={value => {
											updateList({
												orderStatus: value as 'all' | OrderStatus,
												page: 1
											})
										}}
									>
										<DropdownMenuRadioItem value='all'>
											Всі статуси замовлення
										</DropdownMenuRadioItem>
										{orderStatusValues.map(status => (
											<DropdownMenuRadioItem key={status} value={status}>
												{ORDER_STATUS_LABELS[status]}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
						<div className='space-y-2'>
							<Label>Статус оплати</Label>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' className='w-full justify-between'>
										{paymentStatusLabel}
										<ChevronDown className='ml-2 size-4 opacity-50' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='start' className='w-56'>
									<DropdownMenuRadioGroup
										value={paymentStatus}
										onValueChange={value => {
											updateList({
												paymentStatus: value as 'all' | PaymentStatus,
												page: 1
											})
										}}
									>
										<DropdownMenuRadioItem value='all'>
											Всі статуси оплати
										</DropdownMenuRadioItem>
										{paymentStatusValues.map(status => (
											<DropdownMenuRadioItem key={status} value={status}>
												{PAYMENT_STATUS_LABELS[status]}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
						<div className='space-y-2'>
							<Label>Кількість на сторінці</Label>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' className='w-full justify-between'>
										{limitLabel}
										<ChevronDown className='ml-2 size-4 opacity-50' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='start' className='w-44'>
									<DropdownMenuRadioGroup
										value={String(limit)}
										onValueChange={value => {
											updateList({ limit: Number(value), page: 1 })
										}}
									>
										{LIMIT_OPTIONS.map(option => (
											<DropdownMenuRadioItem
												key={option.value}
												value={option.value}
											>
												{option.label}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</CardHeader>
				<CardContent className='pt-5'>
					{isLoading ? (
						<div className='space-y-3'>
							{Array.from({ length: 6 }).map((_, index) => (
								<div
									key={index}
									className='h-16 animate-pulse rounded-md bg-gray-100'
								/>
							))}
						</div>
					) : isError ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>
								Не вдалося завантажити список замовлень
							</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : orders.length === 0 ? (
						<p className='text-sm text-gray-500'>
							Замовлень за обраними фільтрами не знайдено
						</p>
					) : (
						<>
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[960px] text-sm'>
									<thead>
										<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
											<th className='px-3 py-2'>№</th>
											<th className='px-3 py-2'>Дата</th>
											<th className='px-3 py-2'>Одержувач</th>
											<th className='px-3 py-2'>Сума</th>
											<th className='px-3 py-2'>Статус</th>
											<th className='px-3 py-2'>Оплата</th>
											<th className='px-3 py-2'>Товар</th>
										</tr>
									</thead>
									<tbody>
										{orders.map(order => {
											const firstItem = order.items[0]
											return (
												<tr
													key={order.id}
													className='cursor-pointer border-b hover:bg-gray-50'
													onClick={() =>
														router.push(
															UI_URLS.ADMIN.ORDER_DETAILS(order.id)
														)
													}
													onKeyDown={event => {
														if (
															event.key === 'Enter' ||
															event.key === ' '
														) {
															event.preventDefault()
															router.push(
																UI_URLS.ADMIN.ORDER_DETAILS(
																	order.id
																)
															)
														}
													}}
													tabIndex={0}
												>
													<td className='px-3 py-3 font-medium'>
														#{order.order_number}
													</td>
													<td className='px-3 py-3'>
														{formatDate(order.created_at)}
													</td>
													<td className='px-3 py-3'>
														{formatCustomerShort(order)}
													</td>
													<td className='px-3 py-3'>
														{formatPrice(order.total_price)}
													</td>
													<td className='px-3 py-3'>
														<Badge
															variant='outline'
															className={
																ORDER_STATUS_CLASSES[
																	order.order_status
																]
															}
														>
															{
																ORDER_STATUS_LABELS[
																	order.order_status
																]
															}
														</Badge>
													</td>
													<td className='px-3 py-3'>
														<Badge
															variant='outline'
															className={
																PAYMENT_STATUS_CLASSES[
																	order.payment_status
																]
															}
														>
															{
																PAYMENT_STATUS_LABELS[
																	order.payment_status
																]
															}
														</Badge>
													</td>
													<td className='px-3 py-3'>
														{firstItem ? (
															<div className='flex items-center gap-2'>
																{firstItem.image ? (
																	<Image
																		src={firstItem.image}
																		alt={firstItem.name}
																		width={40}
																		height={40}
																		className='h-10 w-10 rounded object-cover'
																	/>
																) : (
																	<div className='h-10 w-10 rounded bg-gray-100' />
																)}
																<span className='line-clamp-1 max-w-44'>
																	{firstItem.name}
																</span>
															</div>
														) : (
															'—'
														)}
													</td>
												</tr>
											)
										})}
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
										onClick={() =>
											updateList({
												page: Math.max(1, Math.min(page - 1, totalPages))
											})
										}
									>
										Попередня
									</Button>
									<Button
										variant='outline'
										size='sm'
										disabled={page >= totalPages || isFetching}
										onClick={() =>
											updateList({ page: Math.min(totalPages, page + 1) })
										}
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
