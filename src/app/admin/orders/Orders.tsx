'use client'

import Image from 'next/image'
import { useEffect, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
	formatCustomerShort,
	formatDate,
	formatPrice,
	ordersListQuery,
	ORDERS_LIMIT_OPTIONS,
	parseOrdersListParams,
	type OrdersListParams
} from './orders.utils'
import { Pagination } from '@/common/components/Pagination'
import {
	orderStatusValues,
	paymentStatusValues,
	type OrderStatus,
	type PaymentStatus
} from './orders.schema'
import { ReportModal } from './ReportModal'

export function Orders() {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	// The URL is the state: a reload or the way back from an order lands on the same page.
	const listParams = useMemo(
		() => parseOrdersListParams(new URLSearchParams(searchParams.toString())),
		[searchParams]
	)
	const { page, limit, orderStatus, paymentStatus } = listParams

	/** Filters and page size restart from page 1; `replace` keeps them out of the back stack. */
	const updateList = (changes: Partial<OrdersListParams>) => {
		const query = ordersListQuery({ ...listParams, page: 1, ...changes })
		router.replace(`${pathname}${query}`, { scroll: false })
	}

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ['admin-orders', page, limit, orderStatus, paymentStatus],
		queryFn: () =>
			ordersApi.getAll({
				page,
				limit,
				order_status: orderStatus === 'all' ? undefined : orderStatus,
				payment_status: paymentStatus === 'all' ? undefined : paymentStatus
			}),
		// The previous page stays on screen while the next one loads, instead of a skeleton flash.
		placeholderData: keepPreviousData
	})

	const orders = data?.items ?? []
	const total = data?.total ?? 0
	const totalPages = Math.max(1, Math.ceil(total / limit))
	// What is shown while an overflowing URL waits for the redirect below.
	const currentPage = Math.min(page, totalPages)

	// A page that no longer exists (orders cancelled, an old link) moves to the last real one.
	useEffect(() => {
		if (data && !isFetching && page > totalPages) {
			router.replace(`${pathname}${ordersListQuery({ ...listParams, page: totalPages })}`, {
				scroll: false
			})
		}
	}, [data, isFetching, page, totalPages, pathname, router, listParams])

	const orderStatusLabel =
		orderStatus === 'all' ? 'Всі статуси замовлення' : ORDER_STATUS_LABELS[orderStatus]
	const paymentStatusLabel =
		paymentStatus === 'all' ? 'Всі статуси оплати' : PAYMENT_STATUS_LABELS[paymentStatus]
	const limitLabel = `${limit} / сторінку`

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
										onValueChange={value =>
											updateList({
												orderStatus: value as 'all' | OrderStatus
											})
										}
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
										onValueChange={value =>
											updateList({
												paymentStatus: value as 'all' | PaymentStatus
											})
										}
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
										onValueChange={value =>
											updateList({ limit: Number(value) })
										}
									>
										{ORDERS_LIMIT_OPTIONS.map(option => (
											<DropdownMenuRadioItem
												key={option}
												value={String(option)}
											>
												{option} / сторінку
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
							<div className='mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row'>
								<p className='text-muted-foreground text-xs'>
									Сторінка {currentPage} з {totalPages} •{' '}
									{(currentPage - 1) * limit + 1}–
									{Math.min(currentPage * limit, total)} з {total}
								</p>
								{totalPages > 1 && (
									<Pagination
										pagination={{ total, page: currentPage, limit, totalPages }}
										label='Сторінки замовлень'
									/>
								)}
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
