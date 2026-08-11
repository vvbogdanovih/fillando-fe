'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronDown, Trash2Icon } from 'lucide-react'
import { Badge } from '@/common/components/ui/badge'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from '@/common/components/ui/dropdown-menu'
import { Textarea } from '@/common/components/ui/textarea'
import { ordersApi, parsePatchOrderPayload } from './orders.api'
import {
	DELIVERY_METHOD_LABELS,
	ORDER_STATUS_CLASSES,
	ORDER_STATUS_LABELS,
	PAYMENT_METHOD_LABELS,
	PAYMENT_STATUS_CLASSES,
	PAYMENT_STATUS_LABELS
} from './orders.constants'
import {
	buildOrderPatchPayload,
	formatDate,
	formatPrice,
	mapOrderErrorMessage
} from './orders.utils'
import {
	deliveryMethodValues,
	orderStatusValues,
	paymentMethodValues,
	paymentStatusValues,
	type DeliveryMethod,
	type Order,
	type PatchOrderPayload,
	type PaymentMethod
} from './orders.schema'
import { OrderItemsList } from './orders.components'
import { InvoiceModal } from './InvoiceModal'
import { VendorEmailModal } from './VendorEmailModal'

function normalizeEditValues(order: Order): PatchOrderPayload {
	return {
		customer: {
			name: order.customer.name ?? '',
			phone: order.customer.phone ?? '',
			email: order.customer.email ?? ''
		},
		delivery_method: order.delivery_method,
		delivery_address: (order.delivery_address ?? {}) as Record<string, unknown>,
		payment_method: order.payment_method,
		comment: order.comment ?? '',
		items: order.items
			.filter(item => Boolean(item.variant_id))
			.map(item => ({
				variant_id: item.variant_id!,
				quantity: item.quantity
			}))
	}
}

function AddressFields({
	deliveryMethod,
	deliveryAddress,
	onChange
}: {
	deliveryMethod: DeliveryMethod
	deliveryAddress: Record<string, unknown>
	onChange: (key: string, value: string) => void
}) {
	if (deliveryMethod === 'PICKUP') {
		return <p className='text-muted-foreground text-sm'>Самовивіз — адреса не потрібна.</p>
	}

	if (deliveryMethod === 'NOVA_POST') {
		return (
			<div className='grid gap-3 sm:grid-cols-3'>
				<div className='space-y-2'>
					<Label>Місто</Label>
					<Input
						value={String(deliveryAddress.city_name ?? '')}
						onChange={e => onChange('city_name', e.target.value)}
					/>
				</div>
				<div className='space-y-2'>
					<Label>Відділення</Label>
					<Input
						value={String(deliveryAddress.warehouse_description ?? '')}
						onChange={e => onChange('warehouse_description', e.target.value)}
					/>
				</div>
				<div className='space-y-2'>
					<Label>Номер відділення</Label>
					<Input
						value={String(deliveryAddress.warehouse_number ?? '')}
						onChange={e => onChange('warehouse_number', e.target.value)}
					/>
				</div>
			</div>
		)
	}

	return (
		<div className='grid gap-3 sm:grid-cols-4'>
			<div className='space-y-2'>
				<Label>Місто</Label>
				<Input
					value={String(deliveryAddress.city_name ?? '')}
					onChange={e => onChange('city_name', e.target.value)}
				/>
			</div>
			<div className='space-y-2'>
				<Label>Вулиця</Label>
				<Input
					value={String(deliveryAddress.street ?? '')}
					onChange={e => onChange('street', e.target.value)}
				/>
			</div>
			<div className='space-y-2'>
				<Label>Будинок</Label>
				<Input
					value={String(deliveryAddress.building ?? '')}
					onChange={e => onChange('building', e.target.value)}
				/>
			</div>
			<div className='space-y-2'>
				<Label>Квартира</Label>
				<Input
					value={String(deliveryAddress.apartment ?? '')}
					onChange={e => onChange('apartment', e.target.value)}
				/>
			</div>
		</div>
	)
}

export function OrderDetails({ orderId }: { orderId: string }) {
	const queryClient = useQueryClient()
	const [editValues, setEditValues] = useState<PatchOrderPayload | null>(null)
	const [ttnValue, setTtnValue] = useState('')
	const lastInitIdRef = useRef<string | null>(null)

	const {
		data: order,
		isLoading,
		isError,
		refetch
	} = useQuery({
		queryKey: ['admin-order', orderId],
		queryFn: () => ordersApi.getById(orderId)
	})

	useEffect(() => {
		if (!order) return
		if (lastInitIdRef.current === order.id) return
		lastInitIdRef.current = order.id
		setEditValues(normalizeEditValues(order))
		setTtnValue(order.nova_post_ttn ?? '')
	}, [order])

	const updateOrderInCache = (updated: Order) => {
		queryClient.setQueryData(['admin-order', orderId], updated)
		queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
	}

	const statusMutation = useMutation({
		mutationFn: (nextStatus: Order['order_status']) =>
			ordersApi.patchOrderStatus(orderId, { order_status: nextStatus }),
		onMutate: async nextStatus => {
			await queryClient.cancelQueries({ queryKey: ['admin-order', orderId] })
			const prev = queryClient.getQueryData<Order>(['admin-order', orderId])
			if (prev) {
				queryClient.setQueryData<Order>(['admin-order', orderId], {
					...prev,
					order_status: nextStatus
				})
			}
			return { prev }
		},
		onError: (error: Error, _, context) => {
			if (context?.prev) queryClient.setQueryData(['admin-order', orderId], context.prev)
			toast.error(mapOrderErrorMessage(error.message))
		},
		onSuccess: updated => {
			updateOrderInCache(updated)
			toast.success('Статус замовлення оновлено')
		}
	})

	const paymentStatusMutation = useMutation({
		mutationFn: (nextStatus: Order['payment_status']) =>
			ordersApi.patchPaymentStatus(orderId, { payment_status: nextStatus }),
		onMutate: async nextStatus => {
			await queryClient.cancelQueries({ queryKey: ['admin-order', orderId] })
			const prev = queryClient.getQueryData<Order>(['admin-order', orderId])
			if (prev) {
				queryClient.setQueryData<Order>(['admin-order', orderId], {
					...prev,
					payment_status: nextStatus
				})
			}
			return { prev }
		},
		onError: (error: Error, _, context) => {
			if (context?.prev) queryClient.setQueryData(['admin-order', orderId], context.prev)
			toast.error(mapOrderErrorMessage(error.message))
		},
		onSuccess: updated => {
			updateOrderInCache(updated)
			toast.success('Статус оплати оновлено')
		}
	})

	const ttnMutation = useMutation({
		mutationFn: (nextTtn: string) => ordersApi.patchTtn(orderId, { nova_post_ttn: nextTtn }),
		onMutate: async nextTtn => {
			await queryClient.cancelQueries({ queryKey: ['admin-order', orderId] })
			const prev = queryClient.getQueryData<Order>(['admin-order', orderId])
			if (prev) {
				queryClient.setQueryData<Order>(['admin-order', orderId], {
					...prev,
					nova_post_ttn: nextTtn
				})
			}
			return { prev }
		},
		onError: (error: Error, _, context) => {
			if (context?.prev) queryClient.setQueryData(['admin-order', orderId], context.prev)
			toast.error(mapOrderErrorMessage(error.message))
		},
		onSuccess: updated => {
			updateOrderInCache(updated)
			setTtnValue(updated.nova_post_ttn ?? '')
			toast.success('TTN оновлено')
		}
	})

	const fullEditMutation = useMutation({
		mutationFn: async () => {
			if (!order || !editValues) throw new Error('Немає даних для оновлення')
			const patchPayload = buildOrderPatchPayload(order, parsePatchOrderPayload(editValues))
			if (Object.keys(patchPayload).length === 0) return null
			return ordersApi.patchOrder(orderId, patchPayload)
		},
		onError: (error: Error) => {
			toast.error(mapOrderErrorMessage(error.message))
		},
		onSuccess: updated => {
			if (!updated) {
				toast.success('Змін не виявлено')
				return
			}
			updateOrderInCache(updated)
			setEditValues(normalizeEditValues(updated))
			toast.success('Замовлення успішно оновлено')
		}
	})

	/** Removes an item from the local edit state; persisted on "Зберегти зміни". */
	const removeItem = (index: number) => {
		const items = editValues?.items
		if (!items) return
		if (items.length <= 1) {
			toast.error('Замовлення повинно містити щонайменше один товар')
			return
		}
		setEditValues(prev =>
			prev?.items ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev
		)
	}

	if (isLoading) {
		return (
			<div className='space-y-4 p-4 sm:p-6'>
				{Array.from({ length: 5 }).map((_, index) => (
					<div key={index} className='h-32 animate-pulse rounded-md bg-gray-100' />
				))}
			</div>
		)
	}

	if (isError || !order || !editValues) {
		return (
			<div className='p-4 sm:p-6'>
				<p className='text-sm text-gray-500'>Не вдалося завантажити замовлення</p>
				<Button className='mt-3' variant='outline' onClick={() => refetch()}>
					Оновити
				</Button>
			</div>
		)
	}

	const deliveryAddress = (editValues.delivery_address ?? {}) as Record<string, unknown>

	return (
		<div className='max-w-[1400px] space-y-4 p-4 sm:space-y-6 sm:p-6'>
			<Card>
				<CardHeader className='flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between'>
					<div>
						<div className='flex flex-wrap items-center gap-2'>
							<CardTitle>Замовлення #{order.order_number}</CardTitle>
							<Badge
								variant='outline'
								className={ORDER_STATUS_CLASSES[order.order_status]}
							>
								{ORDER_STATUS_LABELS[order.order_status]}
							</Badge>
							<Badge
								variant='outline'
								className={PAYMENT_STATUS_CLASSES[order.payment_status]}
							>
								{PAYMENT_STATUS_LABELS[order.payment_status]}
							</Badge>
						</div>
						<p className='text-muted-foreground text-xs'>
							Створено: {formatDate(order.created_at)}
						</p>
					</div>
					<div className='flex gap-3 sm:gap-6'>
						<VendorEmailModal orderId={orderId} />
						<InvoiceModal orderId={orderId} orderNumber={order.order_number} />
					</div>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Що замовлено</CardTitle>
				</CardHeader>
				<CardContent className='space-y-3'>
					<OrderItemsList items={order.items} />
				</CardContent>
			</Card>

			<div className='grid gap-6 lg:grid-cols-2'>
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
						<CardTitle>Підсумок</CardTitle>
					</CardHeader>
					<CardContent className='space-y-2 text-sm'>
						<div className='flex justify-between'>
							<span>Subtotal</span>
							<span>{formatPrice(order.subtotal_price)}</span>
						</div>
						{!!order.applied_discount && (
							<div className='flex justify-between'>
								<span>Знижка</span>
								<span>-{formatPrice(order.applied_discount)}</span>
							</div>
						)}
						<div className='flex justify-between text-base font-semibold'>
							<span>Total</span>
							<span>{formatPrice(order.total_price)}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Доставка</CardTitle>
				</CardHeader>
				<CardContent className='space-y-2 text-sm'>
					<p>Метод: {DELIVERY_METHOD_LABELS[order.delivery_method]}</p>
					{order.delivery_method === 'NOVA_POST' && (
						<>
							<p>
								Місто:{' '}
								{String(
									(order.delivery_address as Record<string, unknown>)
										?.city_name ?? '—'
								)}
							</p>
							<p>
								Відділення:{' '}
								{String(
									(order.delivery_address as Record<string, unknown>)
										?.warehouse_description ?? '—'
								)}
							</p>
							<p>
								Номер відділення:{' '}
								{String(
									(order.delivery_address as Record<string, unknown>)
										?.warehouse_number ?? '—'
								)}
							</p>
						</>
					)}
					{order.delivery_method === 'COURIER' && (
						<>
							<p>
								Місто:{' '}
								{String(
									(order.delivery_address as Record<string, unknown>)
										?.city_name ?? '—'
								)}
							</p>
							<p>
								Вулиця:{' '}
								{String(
									(order.delivery_address as Record<string, unknown>)?.street ??
										'—'
								)}
							</p>
							<p>
								Будинок:{' '}
								{String(
									(order.delivery_address as Record<string, unknown>)?.building ??
										'—'
								)}
							</p>
							<p>
								Квартира:{' '}
								{String(
									(order.delivery_address as Record<string, unknown>)
										?.apartment ?? '—'
								)}
							</p>
						</>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Статуси (швидкі дії)</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 sm:grid-cols-3'>
					<div className='space-y-2'>
						<Label>Статус замовлення</Label>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant='outline' className='w-full justify-between'>
									{ORDER_STATUS_LABELS[order.order_status]}
									<ChevronDown className='ml-2 size-4 opacity-50' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='start' className='w-56'>
								<DropdownMenuRadioGroup
									value={order.order_status}
									onValueChange={value =>
										statusMutation.mutate(value as Order['order_status'])
									}
								>
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
									{PAYMENT_STATUS_LABELS[order.payment_status]}
									<ChevronDown className='ml-2 size-4 opacity-50' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='start' className='w-56'>
								<DropdownMenuRadioGroup
									value={order.payment_status}
									onValueChange={value =>
										paymentStatusMutation.mutate(
											value as Order['payment_status']
										)
									}
								>
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
						<Label htmlFor='ttn'>TTN Нова Пошта</Label>
						<div className='flex gap-2'>
							<Input
								id='ttn'
								value={ttnValue}
								onChange={e => setTtnValue(e.target.value)}
								placeholder='Вкажіть TTN'
							/>
							<Button
								onClick={() => ttnMutation.mutate(ttnValue.trim())}
								disabled={ttnMutation.isPending}
							>
								Зберегти
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Редагування замовлення</CardTitle>
				</CardHeader>
				<CardContent className='space-y-5'>
					<div className='grid gap-3 sm:grid-cols-3'>
						<div className='space-y-2'>
							<Label>Імʼя</Label>
							<Input
								value={editValues.customer?.name ?? ''}
								onChange={e =>
									setEditValues(prev =>
										prev
											? {
													...prev,
													customer: {
														...prev.customer!,
														name: e.target.value
													}
												}
											: prev
									)
								}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Телефон</Label>
							<Input
								value={editValues.customer?.phone ?? ''}
								onChange={e =>
									setEditValues(prev =>
										prev
											? {
													...prev,
													customer: {
														...prev.customer!,
														phone: e.target.value
													}
												}
											: prev
									)
								}
							/>
						</div>
						<div className='space-y-2'>
							<Label>Email</Label>
							<Input
								value={editValues.customer?.email ?? ''}
								onChange={e =>
									setEditValues(prev =>
										prev
											? {
													...prev,
													customer: {
														...prev.customer!,
														email: e.target.value
													}
												}
											: prev
									)
								}
							/>
						</div>
					</div>

					<div className='flex flex-wrap gap-3'>
						<div className='w-full space-y-2 sm:w-[280px]'>
							<Label>Метод доставки</Label>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' className='w-full justify-between'>
										{DELIVERY_METHOD_LABELS[editValues.delivery_method!]}
										<ChevronDown className='ml-2 size-4 opacity-50' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='start' className='w-56'>
									<DropdownMenuRadioGroup
										value={editValues.delivery_method}
										onValueChange={value =>
											setEditValues(prev =>
												prev
													? {
															...prev,
															delivery_method:
																value as DeliveryMethod,
															delivery_address: {}
														}
													: prev
											)
										}
									>
										{deliveryMethodValues.map(method => (
											<DropdownMenuRadioItem key={method} value={method}>
												{DELIVERY_METHOD_LABELS[method]}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
						<div className='w-full space-y-2 sm:w-[280px]'>
							<Label>Метод оплати</Label>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='outline' className='w-full justify-between'>
										{PAYMENT_METHOD_LABELS[editValues.payment_method!]}
										<ChevronDown className='ml-2 size-4 opacity-50' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='start' className='w-56'>
									<DropdownMenuRadioGroup
										value={editValues.payment_method}
										onValueChange={value =>
											setEditValues(prev =>
												prev
													? {
															...prev,
															payment_method: value as PaymentMethod
														}
													: prev
											)
										}
									>
										{paymentMethodValues.map(method => (
											<DropdownMenuRadioItem key={method} value={method}>
												{PAYMENT_METHOD_LABELS[method]}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<AddressFields
						deliveryMethod={editValues.delivery_method!}
						deliveryAddress={deliveryAddress}
						onChange={(key, value) =>
							setEditValues(prev =>
								prev
									? {
											...prev,
											delivery_address: {
												...(prev.delivery_address as Record<
													string,
													unknown
												>),
												[key]: value
											}
										}
									: prev
							)
						}
					/>

					<div className='space-y-2'>
						<Label>Товари (variant_id + quantity)</Label>
						<p className='text-muted-foreground text-xs'>
							Змінюйте кількість або видаляйте товари — зміни застосуються після
							«Зберегти зміни». Замовлення не може залишитись без товарів.
						</p>
						<div className='space-y-2'>
							{(editValues.items ?? []).map((item, index) => (
								<div
									key={item.variant_id}
									className='grid gap-2 sm:grid-cols-[1fr_140px_auto]'
								>
									<div className='rounded-md border bg-gray-50 px-3 py-2 text-sm'>
										{(() => {
											const originalItem = order.items.find(
												source => source.variant_id === item.variant_id
											)
											if (!originalItem)
												return (
													<span className='text-muted-foreground'>
														Товар
													</span>
												)
											return (
												<>
													<p className='font-medium'>
														{originalItem.name}
													</p>
													<p className='text-muted-foreground text-xs'>
														SKU: {originalItem.sku ?? '—'} • Vendor SKU:{' '}
														{originalItem.vendor_sku ?? '—'}
													</p>
												</>
											)
										})()}
									</div>
									<Input
										type='number'
										min={1}
										value={item.quantity}
										onChange={e =>
											setEditValues(prev => {
												if (!prev?.items) return prev
												const nextItems = [...prev.items]
												nextItems[index] = {
													...nextItems[index],
													quantity: Number(e.target.value)
												}
												return { ...prev, items: nextItems }
											})
										}
									/>
									<Button
										type='button'
										variant='ghost'
										className='justify-self-start text-red-500 hover:text-red-700 sm:justify-self-auto'
										title='Видалити товар із замовлення'
										disabled={(editValues.items ?? []).length <= 1}
										onClick={() => removeItem(index)}
									>
										<Trash2Icon className='size-4' />
									</Button>
								</div>
							))}
						</div>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='comment'>Коментар</Label>
						<Textarea
							id='comment'
							value={editValues.comment ?? ''}
							onChange={e =>
								setEditValues(prev =>
									prev ? { ...prev, comment: e.target.value } : prev
								)
							}
						/>
					</div>

					<Button
						onClick={() => fullEditMutation.mutate()}
						disabled={fullEditMutation.isPending}
					>
						{fullEditMutation.isPending ? 'Збереження...' : 'Зберегти зміни'}
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
