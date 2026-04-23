'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Banknote, Building2, CreditCard, MapPin, Minus, Package, Plus, Store, Truck } from 'lucide-react'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { UI_URLS } from '@/common/constants'
import { cn } from '@/common/utils/shad-cn.utils'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Textarea } from '@/common/components/ui/textarea'
import { Badge } from '@/common/components/ui/badge'
import {
	buildCreateOrderPayload,
	checkoutFormSchema,
	type CheckoutFormValues
} from './checkout.schema'
import {
	createOrder,
	fetchNovaPostCities,
	fetchNovaPostWarehouses,
	validateCouponCode
} from './checkout.api'
import { DELIVERY_METHOD_LABELS, WAREHOUSE_TYPE_LABELS } from './checkout.constants'

type DisplayLine = {
	variant_id: string
	quantity: number
	name: string
	price: number
	thumbnail: string | null
	stock?: number
}

const DEBOUNCE_MS = 320
const couponCodeRegex = /^[A-Z0-9]{10}$/

function mapCouponReason(reason: 'NOT_FOUND' | 'INACTIVE' | 'EXPIRED') {
	switch (reason) {
		case 'NOT_FOUND':
			return 'Купон не знайдено'
		case 'INACTIVE':
			return 'Купон неактивний'
		case 'EXPIRED':
			return 'Термін дії купона завершився'
		default:
			return 'Купон недійсний'
	}
}

export function CheckoutPage() {
	const router = useRouter()
	const user = useAuthStore(s => s.user)
	const isAuth = !!user
	const items = useCartStore(s => s.items)
	const guestItems = useCartStore(s => s.guestItems)
	const isLoadingCart = useCartStore(s => s.isLoading)
	const clearAfterOrder = useCartStore(s => s.clearAfterOrder)
	const updateQuantity = useCartStore(s => s.updateQuantity)
	const setGuestItemQuantity = useCartStore(s => s.setGuestItemQuantity)

	const displayItems: DisplayLine[] = useMemo(() => {
		if (isAuth) {
			return items.map(i => ({
				variant_id: i.variant_id,
				quantity: i.quantity,
				name: i.variant.name,
				price: i.variant.price,
				thumbnail: i.variant.thumbnail,
				stock: i.variant.stock
			}))
		}
		return guestItems.map(i => ({
			variant_id: i.variant_id,
			quantity: i.quantity,
			name: i._meta?.name ?? i.variant_id,
			price: i._meta?.price ?? 0,
			thumbnail: i._meta?.thumbnail ?? null,
			stock: undefined
		}))
	}, [isAuth, items, guestItems])

	const total = useMemo(
		() => displayItems.reduce((s, i) => s + i.price * i.quantity, 0),
		[displayItems]
	)

	const [citySearchInput, setCitySearchInput] = useState('')
	const [debouncedCityQuery, setDebouncedCityQuery] = useState('')
	const [cityOpen, setCityOpen] = useState(false)
	const [warehouseOpen, setWarehouseOpen] = useState(false)
	const [warehouseSearchInput, setWarehouseSearchInput] = useState('')
	const [debouncedWarehouseQuery, setDebouncedWarehouseQuery] = useState('')
	const [debouncedCouponCode, setDebouncedCouponCode] = useState('')
	const cityWrapRef = useRef<HTMLDivElement>(null)
	const warehouseWrapRef = useRef<HTMLDivElement>(null)
	const warehouseInputRef = useRef<HTMLInputElement>(null)
	const prevCityRefForWarehouseFocus = useRef('')

	useEffect(() => {
		const t = setTimeout(() => setDebouncedCityQuery(citySearchInput.trim()), DEBOUNCE_MS)
		return () => clearTimeout(t)
	}, [citySearchInput])

	useEffect(() => {
		const t = setTimeout(
			() => setDebouncedWarehouseQuery(warehouseSearchInput.trim()),
			DEBOUNCE_MS
		)
		return () => clearTimeout(t)
	}, [warehouseSearchInput])

	useEffect(() => {
		if (!isLoadingCart && displayItems.length === 0) {
			router.replace(UI_URLS.CATALOG.FILAMENT)
		}
	}, [displayItems.length, isLoadingCart, router])

	const form = useForm<CheckoutFormValues>({
		resolver: zodResolver(checkoutFormSchema),
		mode: 'onChange',
		defaultValues: {
			customer: { name: '', phone: '', email: '' },
			delivery_method: 'NOVA_POST',
			payment_method: 'IBAN',
			comment: '',
			coupon_code: '',
			city_ref: '',
			city_name: '',
			warehouse_type: 'PARCEL_LOCKER',
			warehouse_number: undefined,
			warehouse_description: '',
			courier_city_name: '',
			courier_street: '',
			courier_building: '',
			courier_apartment: ''
		}
	})

	const { register, handleSubmit, watch, setValue, setError, clearErrors, trigger, formState } = form
	const { errors, isSubmitting, isValid } = formState
	const deliveryMethod = watch('delivery_method')
	const paymentMethod = watch('payment_method')
	const cityRef = watch('city_ref')
	const warehouseType = watch('warehouse_type')
	const couponCode = watch('coupon_code')

	useEffect(() => {
		const t = setTimeout(() => {
			setDebouncedCouponCode((couponCode ?? '').trim().toUpperCase())
		}, DEBOUNCE_MS)
		return () => clearTimeout(t)
	}, [couponCode])

	const prevDelivery = useRef(deliveryMethod)
	useEffect(() => {
		if (prevDelivery.current === deliveryMethod) return
		prevDelivery.current = deliveryMethod
		if (deliveryMethod !== 'PICKUP') {
			setValue('payment_method', 'IBAN', { shouldValidate: true })
		}
		if (deliveryMethod !== 'NOVA_POST') {
			setValue('city_ref', '')
			setValue('city_name', '')
			setValue('warehouse_number', undefined)
			setValue('warehouse_description', '')
			setCitySearchInput('')
			setCityOpen(false)
			setWarehouseOpen(false)
			setWarehouseSearchInput('')
			setDebouncedWarehouseQuery('')
		}
		if (deliveryMethod !== 'COURIER') {
			setValue('courier_city_name', '')
			setValue('courier_street', '')
			setValue('courier_building', '')
			setValue('courier_apartment', '')
		}
	}, [deliveryMethod, setValue])

	const prevWarehouseType = useRef(warehouseType)
	useEffect(() => {
		if (prevWarehouseType.current === warehouseType) return
		prevWarehouseType.current = warehouseType
		setValue('warehouse_number', undefined)
		setValue('warehouse_description', '')
		setWarehouseOpen(false)
		setWarehouseSearchInput('')
		setDebouncedWarehouseQuery('')
	}, [warehouseType, setValue])

	useEffect(() => {
		setWarehouseSearchInput('')
		setDebouncedWarehouseQuery('')
	}, [cityRef])

	useEffect(() => {
		const hadCity = Boolean(prevCityRefForWarehouseFocus.current)
		if (deliveryMethod === 'NOVA_POST' && cityRef && !hadCity) {
			warehouseInputRef.current?.focus()
			setWarehouseOpen(true)
		}
		prevCityRefForWarehouseFocus.current = cityRef ?? ''
	}, [cityRef, deliveryMethod])

	useEffect(() => {
		if (!user) return
		setValue('customer.name', user.name)
		setValue('customer.email', user.email)
		if (user.phone) {
			setValue('customer.phone', user.phone)
		}
	}, [user, setValue])

	const { data: cities = [], isFetching: citiesLoading } = useQuery({
		queryKey: ['checkout', 'nova-cities', debouncedCityQuery],
		queryFn: () => fetchNovaPostCities(debouncedCityQuery),
		enabled: deliveryMethod === 'NOVA_POST' && debouncedCityQuery.length >= 2
	})

	const { data: warehouses = [], isFetching: warehousesLoading } = useQuery({
		queryKey: ['checkout', 'nova-warehouses', cityRef, warehouseType, debouncedWarehouseQuery],
		queryFn: () =>
			fetchNovaPostWarehouses(cityRef!, warehouseType!, debouncedWarehouseQuery || undefined),
		enabled:
			deliveryMethod === 'NOVA_POST' && Boolean(cityRef) && Boolean(warehouseType)
	})

	const shouldValidateCoupon = couponCodeRegex.test(debouncedCouponCode)
	const {
		data: couponValidation,
		isFetching: couponValidationLoading,
		isError: couponValidationError
	} = useQuery({
		queryKey: ['checkout', 'coupon-validate', debouncedCouponCode],
		queryFn: () => validateCouponCode(debouncedCouponCode),
		enabled: shouldValidateCoupon
	})

	useEffect(() => {
		if (!shouldValidateCoupon || !couponValidation || couponValidationLoading || couponValidationError) return
		if (couponValidation.valid) {
			clearErrors('coupon_code')
			return
		}
		setError('coupon_code', {
			type: 'server',
			message: mapCouponReason(couponValidation.reason)
		})
	}, [
		shouldValidateCoupon,
		couponValidation,
		couponValidationLoading,
		couponValidationError,
		setError,
		clearErrors
	])

	const getOrderItems = useCallback(() => {
		return displayItems.map(i => ({ variant_id: i.variant_id, quantity: i.quantity }))
	}, [displayItems])

	const applyQuantity = useCallback(
		(variantId: string, raw: number, stock?: number) => {
			const normalizedBase = Math.max(1, Math.floor(raw))
			const normalized = stock !== undefined ? Math.min(normalizedBase, stock) : normalizedBase
			if (isAuth) {
				void updateQuantity(variantId, normalized)
			} else {
				setGuestItemQuantity(variantId, normalized)
			}
		},
		[isAuth, setGuestItemQuantity, updateQuantity]
	)

	const orderMutation = useMutation({
		mutationFn: async (values: CheckoutFormValues) => {
			const body = buildCreateOrderPayload(values, getOrderItems())
			return createOrder(body)
		},
		onSuccess: async data => {
			await clearAfterOrder()
			const params = new URLSearchParams()
			params.set('order', String(data.order_number))
			if (data.subtotal_price !== undefined) {
				params.set('subtotal', String(data.subtotal_price))
			}
			if (data.total_price !== undefined) {
				params.set('total', String(data.total_price))
			}
			if (data.applied_discount) {
				params.set('discountCode', data.applied_discount.code)
				params.set('discountPercent', String(data.applied_discount.discount_percent))
				params.set('discountAmount', String(data.applied_discount.discount_amount))
			}
			router.push(`${UI_URLS.CHECKOUT_SUCCESS}?${params.toString()}`)
		},
		onError: (err: Error) => {
			setError('coupon_code', {
				type: 'server',
				message: err.message || 'Не вдалося застосувати купон'
			})
			toast.error(err.message || 'Не вдалося оформити замовлення. Спробуйте ще раз.')
		}
	})

	const onSubmit = (values: CheckoutFormValues) => {
		orderMutation.mutate(values)
	}

	useEffect(() => {
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node
			if (cityWrapRef.current && !cityWrapRef.current.contains(t)) setCityOpen(false)
			if (warehouseWrapRef.current && !warehouseWrapRef.current.contains(t)) {
				setWarehouseOpen(false)
			}
		}
		document.addEventListener('mousedown', onDocClick)
		return () => document.removeEventListener('mousedown', onDocClick)
	}, [])

	if (isLoadingCart || displayItems.length === 0) {
		return (
			<div className='text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm'>
				Завантаження…
			</div>
		)
	}

	const pending = isSubmitting || orderMutation.isPending
	const normalizedCoupon = couponCode?.trim().toUpperCase() ?? ''
	const hasCouponInput = normalizedCoupon.length > 0
	const couponLooksValid = couponCodeRegex.test(normalizedCoupon)
	const subtotal = total
	const appliedDiscountPercent =
		couponValidation && couponValidation.valid ? couponValidation.coupon.discount_percent : 0
	const previewDiscountAmount =
		appliedDiscountPercent > 0 ? Number(((subtotal * appliedDiscountPercent) / 100).toFixed(2)) : 0
	const previewTotal = Math.max(0, Number((subtotal - previewDiscountAmount).toFixed(2)))
	const hasAppliedDiscount = previewDiscountAmount > 0
	const couponValidationMessage =
		couponValidation && !couponValidation.valid ? mapCouponReason(couponValidation.reason) : null

	return (
		<div className='mx-auto max-w-3xl px-4 py-8 md:py-12'>
			<div className='mb-8'>
				<h1 className='text-2xl font-bold tracking-tight md:text-3xl'>Оформлення замовлення</h1>
				<p className='text-muted-foreground mt-1 text-sm'>
					Перевірте дані та підтвердіть замовлення.
				</p>
			</div>

			<form onSubmit={handleSubmit(onSubmit)} className='space-y-8'>
				{/* Контактні дані */}
				<Card>
					<CardHeader>
						<CardTitle className='text-lg'>Контактні дані</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='customer.name'>Ім&apos;я</Label>
							<Input
								id='customer.name'
								autoComplete='name'
								{...register('customer.name')}
								aria-invalid={!!errors.customer?.name}
							/>
							{errors.customer?.name && (
								<p className='text-destructive text-sm'>{errors.customer.name.message}</p>
							)}
						</div>
						<div className='space-y-2'>
							<Label htmlFor='customer.phone'>Телефон</Label>
							<Input
								id='customer.phone'
								type='tel'
								placeholder='+380991234567'
								autoComplete='tel'
								{...register('customer.phone')}
								aria-invalid={!!errors.customer?.phone}
							/>
							{errors.customer?.phone && (
								<p className='text-destructive text-sm'>{errors.customer.phone.message}</p>
							)}
						</div>
						<div className='space-y-2'>
							<Label htmlFor='customer.email'>Email</Label>
							<Input
								id='customer.email'
								type='email'
								autoComplete='email'
								{...register('customer.email')}
								aria-invalid={!!errors.customer?.email}
							/>
							{errors.customer?.email && (
								<p className='text-destructive text-sm'>{errors.customer.email.message}</p>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Доставка */}
				<Card>
					<CardHeader>
						<CardTitle className='text-lg'>Спосіб доставки</CardTitle>
					</CardHeader>
					<CardContent className='space-y-6'>
						<div className='grid gap-3'>
							{(['NOVA_POST', 'COURIER', 'PICKUP'] as const).map(method => (
								<label
									key={method}
									className={cn(
										'border-border hover:border-primary/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
										deliveryMethod === method && 'border-primary bg-primary/5 ring-primary/20 ring-2'
									)}
								>
									<input
										type='radio'
										className='mt-1'
										value={method}
										{...register('delivery_method')}
									/>
									<div className='min-w-0 flex-1'>
										<div className='flex items-center gap-2 font-medium'>
											{method === 'NOVA_POST' && (
												<Package className='text-primary h-4 w-4 shrink-0' />
											)}
											{method === 'COURIER' && (
												<Truck className='text-primary h-4 w-4 shrink-0' />
											)}
											{method === 'PICKUP' && (
												<Store className='text-primary h-4 w-4 shrink-0' />
											)}
											{DELIVERY_METHOD_LABELS[method]}
										</div>
									</div>
								</label>
							))}
						</div>
						{errors.delivery_method && (
							<p className='text-destructive text-sm'>{errors.delivery_method.message}</p>
						)}

						{deliveryMethod === 'NOVA_POST' && (
							<div className='border-border/60 space-y-4 border-t pt-4'>
								<div className='relative space-y-2' ref={cityWrapRef}>
									<Label htmlFor='checkout-np-settlement'>Місто</Label>
									<div className='relative'>
										<MapPin className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
										<Input
											id='checkout-np-settlement'
											name='np-settlement-query'
											className='pl-9'
											placeholder='Введіть щонайменше 2 символи…'
											autoComplete='off'
											autoCorrect='off'
											autoCapitalize='off'
											spellCheck={false}
											value={citySearchInput}
											onChange={e => {
												const v = e.target.value
												setCitySearchInput(v)
												setCityOpen(true)
												if (!v.trim()) {
													setValue('city_ref', '')
													setValue('city_name', '')
													setValue('warehouse_number', undefined)
													setValue('warehouse_description', '')
												}
											}}
											onFocus={() => setCityOpen(true)}
											aria-invalid={!!errors.city_ref || !!errors.city_name}
										/>
									</div>
									{(errors.city_ref || errors.city_name) && (
										<p className='text-destructive text-sm'>
											{errors.city_ref?.message || errors.city_name?.message}
										</p>
									)}
									{cityOpen && debouncedCityQuery.length >= 2 && (
										<div className='bg-popover text-popover-foreground border-border absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-md'>
											{citiesLoading ? (
												<p className='text-muted-foreground p-3 text-sm'>Пошук…</p>
											) : cities.length === 0 ? (
												<p className='text-muted-foreground p-3 text-sm'>
													Нічого не знайдено
												</p>
											) : (
												<ul className='py-1'>
													{cities.map(c => (
														<li key={c.ref}>
															<button
																type='button'
																className='hover:bg-accent block w-full px-3 py-2 text-left text-sm'
																onClick={() => {
																	setValue('city_ref', c.ref, { shouldValidate: true })
																	setValue('city_name', c.description, { shouldValidate: true })
																	setCitySearchInput(c.description)
																	setValue('warehouse_number', undefined)
																	setValue('warehouse_description', '')
																	setCityOpen(false)
																}}
															>
																{c.description}
															</button>
														</li>
													))}
												</ul>
											)}
										</div>
									)}
								</div>

								<div className='space-y-2'>
									<Label>Тип відділення</Label>
									<div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap'>
										{(['PARCEL_LOCKER', 'POST', 'CARGO'] as const).map(t => (
											<label
												key={t}
												className={cn(
													'border-border flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
													warehouseType === t && 'border-primary bg-primary/5'
												)}
											>
												<input type='radio' value={t} {...register('warehouse_type')} />
												{WAREHOUSE_TYPE_LABELS[t]}
											</label>
										))}
									</div>
									{errors.warehouse_type && (
										<p className='text-destructive text-sm'>
											{errors.warehouse_type.message}
										</p>
									)}
								</div>

								<div className='relative space-y-2' ref={warehouseWrapRef}>
									<Label htmlFor='checkout-np-warehouse'>Відділення</Label>
									<div className='relative'>
										<Building2 className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
										<Input
											ref={warehouseInputRef}
											id='checkout-np-warehouse'
											name='np-warehouse-query'
											className='pl-9'
											placeholder={
												cityRef
													? 'Номер, вулиця або оберіть зі списку…'
													: 'Спочатку оберіть місто'
											}
											autoComplete='off'
											autoCorrect='off'
											autoCapitalize='off'
											spellCheck={false}
											disabled={!cityRef}
											value={warehouseSearchInput}
											onChange={e => {
												const v = e.target.value
												setWarehouseSearchInput(v)
												setWarehouseOpen(true)
												if (!v.trim()) {
													setValue('warehouse_number', undefined)
													setValue('warehouse_description', '')
												}
											}}
											onFocus={() => cityRef && setWarehouseOpen(true)}
											aria-invalid={
												!!errors.warehouse_number || !!errors.warehouse_description
											}
										/>
									</div>
									{(errors.warehouse_number || errors.warehouse_description) && (
										<p className='text-destructive text-sm'>
											{errors.warehouse_number?.message ||
												errors.warehouse_description?.message}
										</p>
									)}
									{warehouseOpen && cityRef && (
										<div className='bg-popover text-popover-foreground border-border absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-md'>
											{warehousesLoading ? (
												<p className='text-muted-foreground p-3 text-sm'>Завантаження…</p>
											) : warehouses.length === 0 ? (
												<p className='text-muted-foreground p-3 text-sm'>
													Відділень не знайдено
												</p>
											) : (
												<ul className='py-1'>
													{warehouses.map(w => (
														<li key={`${w.number}-${w.description}`}>
															<button
																type='button'
																className='hover:bg-accent block w-full px-3 py-2 text-left text-sm'
																onClick={() => {
																	setValue('warehouse_number', w.number, { shouldValidate: true })
																	setValue('warehouse_description', w.description, { shouldValidate: true })
																	setWarehouseSearchInput(w.description)
																	void trigger()
																	setWarehouseOpen(false)
																}}
															>
																{w.description}
															</button>
														</li>
													))}
												</ul>
											)}
										</div>
									)}
								</div>
							</div>
						)}

						{deliveryMethod === 'COURIER' && (
							<div className='border-border/60 grid gap-4 border-t pt-4 sm:grid-cols-2'>
								<div className='space-y-2 sm:col-span-2'>
									<Label htmlFor='courier_city_name'>Місто</Label>
									<Input
										id='courier_city_name'
										{...register('courier_city_name')}
										aria-invalid={!!errors.courier_city_name}
									/>
									{errors.courier_city_name && (
										<p className='text-destructive text-sm'>
											{errors.courier_city_name.message}
										</p>
									)}
								</div>
								<div className='space-y-2 sm:col-span-2'>
									<Label htmlFor='courier_street'>Вулиця</Label>
									<Input
										id='courier_street'
										{...register('courier_street')}
										aria-invalid={!!errors.courier_street}
									/>
									{errors.courier_street && (
										<p className='text-destructive text-sm'>
											{errors.courier_street.message}
										</p>
									)}
								</div>
								<div className='space-y-2'>
									<Label htmlFor='courier_building'>Будинок</Label>
									<Input
										id='courier_building'
										{...register('courier_building')}
										aria-invalid={!!errors.courier_building}
									/>
									{errors.courier_building && (
										<p className='text-destructive text-sm'>
											{errors.courier_building.message}
										</p>
									)}
								</div>
								<div className='space-y-2'>
									<Label htmlFor='courier_apartment'>Квартира (необов&apos;язково)</Label>
									<Input id='courier_apartment' {...register('courier_apartment')} />
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Оплата */}
				<Card>
					<CardHeader>
						<CardTitle className='text-lg'>Спосіб оплати</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<label
							className={cn(
								'border-border hover:border-primary/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
								paymentMethod === 'IBAN' && 'border-primary bg-primary/5 ring-primary/20 ring-2'
							)}
						>
							<input type='radio' className='mt-1' value='IBAN' {...register('payment_method')} />
							<CreditCard className='text-primary mt-0.5 h-5 w-5 shrink-0' />
							<div className='min-w-0 flex-1'>
								<div className='font-medium'>Оплата на рахунок (IBAN)</div>
								<p className='text-muted-foreground mt-1 text-sm'>
									Реквізити для оплати будуть надіслані на вашу електронну пошту після
									оформлення замовлення.
								</p>
							</div>
						</label>

						<label
							className={cn(
								'flex items-start gap-3 rounded-xl border p-4 transition-colors',
								deliveryMethod === 'PICKUP'
									? cn(
											'border-border hover:border-primary/40 cursor-pointer',
											paymentMethod === 'CASH' &&
												'border-primary bg-primary/5 ring-primary/20 ring-2'
										)
									: 'border-border/50 text-muted-foreground cursor-not-allowed opacity-50'
							)}
						>
							<input
								type='radio'
								className='mt-1'
								value='CASH'
								disabled={deliveryMethod !== 'PICKUP'}
								{...register('payment_method')}
							/>
							<Banknote className='mt-0.5 h-5 w-5 shrink-0' />
							<div className='min-w-0 flex-1'>
								<div className='font-medium'>Готівка</div>
								<p className='mt-1 text-sm'>
									{deliveryMethod === 'PICKUP' ? (
										<span className='text-muted-foreground'>
											Оплата при отриманні замовлення.
										</span>
									) : (
										<span className='text-muted-foreground'>
											Доступно тільки при{' '}
											<span className='font-medium'>«Спосіб доставки — самовивіз»</span>
										</span>
									)}
								</p>
							</div>
						</label>

						<button
							type='button'
							disabled
							className='border-border text-muted-foreground flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-dashed p-4 opacity-60'
						>
							<span className='flex items-center gap-2 font-medium'>
								<CreditCard className='h-4 w-4' />
								LiqPay
							</span>
							<Badge variant='secondary'>Незабаром</Badge>
						</button>
						<button
							type='button'
							disabled
							className='border-border text-muted-foreground flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-dashed p-4 opacity-60'
						>
							<span className='flex items-center gap-2 font-medium'>
								<CreditCard className='h-4 w-4' />
								MonoPay
							</span>
							<Badge variant='secondary'>Незабаром</Badge>
						</button>
						{errors.payment_method && (
							<p className='text-destructive text-sm'>{errors.payment_method.message}</p>
						)}
					</CardContent>
				</Card>

				{/* Купон */}
				<Card>
					<CardHeader>
						<CardTitle className='text-lg'>Купон на знижку</CardTitle>
					</CardHeader>
					<CardContent className='space-y-2'>
						<Label htmlFor='coupon_code'>Coupon code</Label>
						<Input
							id='coupon_code'
							placeholder='Наприклад: ZY64GM08WT'
							maxLength={10}
							autoCapitalize='characters'
							{...register('coupon_code')}
							onChange={e => {
								const sanitized = e.target.value
									.toUpperCase()
									.replace(/[^A-Z0-9]/g, '')
									.slice(0, 10)
								setValue('coupon_code', sanitized, { shouldValidate: true, shouldDirty: true })
								clearErrors('coupon_code')
							}}
							aria-invalid={!!errors.coupon_code}
						/>
						<p className='text-muted-foreground text-xs'>Дозволені символи: A-Z і 0-9, рівно 10 символів.</p>
						{hasCouponInput && !couponLooksValid && (
							<p className='text-xs text-amber-600'>
								Некоректний формат коду (потрібно рівно 10 символів A-Z0-9).
							</p>
						)}
						{hasCouponInput && couponLooksValid && couponValidationLoading && (
							<p className='text-muted-foreground text-xs'>Перевіряємо купон...</p>
						)}
						{hasCouponInput && couponLooksValid && !couponValidationLoading && couponValidationError && (
							<p className='text-destructive text-xs'>
								Не вдалося перевірити купон. Спробуйте ще раз.
							</p>
						)}
						{hasCouponInput &&
							couponLooksValid &&
							!couponValidationLoading &&
							couponValidation &&
							couponValidation.valid && (
								<p className='text-xs text-emerald-600'>
									Купон валідний: -{couponValidation.coupon.discount_percent}% ({couponValidation.coupon.code})
								</p>
							)}
						{hasCouponInput &&
							couponLooksValid &&
							!couponValidationLoading &&
							couponValidationMessage && (
								<p className='text-xs text-amber-600'>{couponValidationMessage}</p>
							)}
						{errors.coupon_code && (
							<p className='text-destructive text-sm'>{errors.coupon_code.message}</p>
						)}
					</CardContent>
				</Card>

				{/* Коментар */}
				<Card>
					<CardHeader>
						<CardTitle className='text-lg'>Коментар до замовлення</CardTitle>
					</CardHeader>
					<CardContent>
						<Textarea
							placeholder='Наприклад: зателефонуйте перед відправкою…'
							rows={3}
							{...register('comment')}
						/>
					</CardContent>
				</Card>

				{/* Підсумок */}
				<Card>
					<CardHeader>
						<CardTitle className='text-lg'>Підсумок замовлення</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<ul className='space-y-3'>
							{displayItems.map(line => (
								<li
									key={line.variant_id}
									className='flex gap-3 border-b border-dashed pb-3 last:border-0 last:pb-0'
								>
									<div className='bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-lg'>
										{line.thumbnail ? (
											<Image
												src={line.thumbnail}
												alt={line.name}
												fill
												className='object-cover'
												sizes='56px'
											/>
										) : (
											<div className='flex h-full w-full items-center justify-center'>
												<Package className='text-muted-foreground h-5 w-5' />
											</div>
										)}
									</div>
									<div className='min-w-0 flex-1'>
										<p className='line-clamp-2 text-sm font-medium'>{line.name}</p>
										<div className='mt-1 flex items-center gap-2'>
											<div className='border-border bg-card flex items-center overflow-hidden rounded-md border shadow-xs'>
												<button
													type='button'
													onClick={() =>
														applyQuantity(line.variant_id, line.quantity - 1, line.stock)
													}
													disabled={line.quantity <= 1}
													className='bg-muted text-foreground hover:bg-muted/80 flex h-6 w-6 items-center justify-center transition-colors disabled:opacity-40'
													aria-label='Зменшити кількість'
												>
													<Minus className='h-3 w-3' />
												</button>
												<input
													type='number'
													min={1}
													step={1}
													value={line.quantity}
													onChange={e => {
														const next = Number(e.target.value)
														if (!Number.isFinite(next)) return
														applyQuantity(line.variant_id, next, line.stock)
													}}
													className='w-11 border-x border-zinc-300 bg-white text-center text-xs font-medium text-black outline-none'
													aria-label='Кількість'
												/>
												<button
													type='button'
													onClick={() =>
														applyQuantity(line.variant_id, line.quantity + 1, line.stock)
													}
													className='bg-muted text-foreground hover:bg-muted/80 flex h-6 w-6 items-center justify-center transition-colors'
													aria-label='Збільшити кількість'
												>
													<Plus className='h-3 w-3' />
												</button>
											</div>
											<p className='text-muted-foreground text-xs'>
												× {line.price.toLocaleString('uk-UA')} ₴
											</p>
										</div>
									</div>
									<p className='text-sm font-semibold whitespace-nowrap'>
										{(line.price * line.quantity).toLocaleString('uk-UA')} ₴
									</p>
								</li>
							))}
						</ul>
						<div className='space-y-2 rounded-lg border p-3'>
							{hasAppliedDiscount && (
								<>
									<div className='flex items-center justify-between text-sm'>
										<span className='text-muted-foreground'>Підсумок</span>
										<span>{subtotal.toLocaleString('uk-UA')} ₴</span>
									</div>
									<div className='flex items-center justify-between text-sm'>
										<span className='text-muted-foreground'>Знижка</span>
										<span>
											-{previewDiscountAmount.toLocaleString('uk-UA')} ₴ ({appliedDiscountPercent}%)
										</span>
									</div>
								</>
							)}
							<div
								className={cn(
									'flex items-center justify-between text-lg font-bold',
									hasAppliedDiscount && 'border-t pt-2'
								)}
							>
								<span>Фінальна ціна</span>
								<span className='text-primary'>{previewTotal.toLocaleString('uk-UA')} ₴</span>
							</div>
						</div>
						<Button type='submit' className='w-full' size='lg' disabled={pending || !isValid}>
							{pending ? 'Відправка…' : 'Замовити'}
						</Button>
						<p className='text-muted-foreground text-center text-xs'>
							Продовжуючи, ви підтверджуєте коректність введених даних.
						</p>
					</CardContent>
				</Card>
			</form>

			<div className='mt-8 text-center'>
				<Link
					href={UI_URLS.CATALOG.FILAMENT}
					className='text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline'
				>
					Повернутися до каталогу
				</Link>
			</div>
		</div>
	)
}
