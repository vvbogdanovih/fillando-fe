'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { X, ShoppingCart, Minus, Plus, Trash2, Package } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useAuthStore } from '@/common/store/useAuthStore'
import { useCartStore } from '@/common/store/useCartStore'
import { UI_URLS } from '@/common/constants'
import { cn } from '@/common/utils/shad-cn.utils'

export function CartSidebar() {
	const isOpen = useCartStore(s => s.isOpen)
	const closeCart = useCartStore(s => s.closeCart)
	const items = useCartStore(s => s.items)
	const guestItems = useCartStore(s => s.guestItems)
	const updateQuantity = useCartStore(s => s.updateQuantity)
	const removeItem = useCartStore(s => s.removeItem)
	const removeGuestItem = useCartStore(s => s.removeGuestItem)
	const setGuestItemQuantity = useCartStore(s => s.setGuestItemQuantity)
	const user = useAuthStore(s => s.user)
	const [stockHints, setStockHints] = useState<Record<string, string>>({})
	const stockHintTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

	const isAuth = !!user

	const displayItems = isAuth
		? items.map(i => ({
				variant_id: i.variant_id,
				quantity: i.quantity,
				name: i.variant.name,
				price: i.variant.price,
				thumbnail: i.variant.thumbnail,
				stock: i.variant.stock,
				slug: i.variant.slug
			}))
		: guestItems.map(i => ({
				variant_id: i.variant_id,
				quantity: i.quantity,
				name: i._meta?.name ?? i.variant_id,
				price: i._meta?.price ?? 0,
				thumbnail: i._meta?.thumbnail ?? null,
				stock: undefined as number | undefined,
				slug: i._meta?.slug ?? null
			}))

	const total = displayItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
	const isEmpty = displayItems.length === 0

	const handleDecrease = (variantId: string, current: number) => {
		if (current <= 1) return
		if (isAuth) {
			updateQuantity(variantId, current - 1)
		} else {
			setGuestItemQuantity(variantId, current - 1)
		}
	}

	useEffect(() => {
		return () => {
			Object.values(stockHintTimersRef.current).forEach(timer => clearTimeout(timer))
		}
	}, [])

	const showStockHint = (variantId: string, stock?: number, requested?: number) => {
		if (stock === undefined || requested === undefined || requested <= stock) return
		setStockHints(prev => ({ ...prev, [variantId]: `Наявна кількість ${stock}` }))
		if (stockHintTimersRef.current[variantId]) {
			clearTimeout(stockHintTimersRef.current[variantId])
		}
		stockHintTimersRef.current[variantId] = setTimeout(() => {
			setStockHints(prev => {
				const next = { ...prev }
				delete next[variantId]
				return next
			})
			delete stockHintTimersRef.current[variantId]
		}, 5000)
	}

	const commitQuantity = (variantId: string, value: number, stock?: number) => {
		const base = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
		const normalized = stock !== undefined ? Math.min(base, stock) : base
		if (isAuth) {
			void updateQuantity(variantId, normalized)
		} else {
			setGuestItemQuantity(variantId, normalized)
		}
		showStockHint(variantId, stock, normalized)
	}

	const handleIncrease = (variantId: string, current: number, stock?: number) => {
		commitQuantity(variantId, current + 1, stock)
	}

	const handleRemove = (variantId: string) => {
		if (isAuth) {
			removeItem(variantId)
		} else {
			removeGuestItem(variantId)
		}
	}

	return (
		<Dialog.Root open={isOpen} onOpenChange={open => !open && closeCart()}>
			<Dialog.Portal>
				<Dialog.Overlay className='data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 duration-300' />
				<Dialog.Content
					aria-describedby={undefined}
					className={cn(
						'bg-background fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col shadow-2xl outline-none',
						'data-[state=open]:animate-in data-[state=closed]:animate-out',
						'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
						'duration-300'
					)}
				>
					{/* Header */}
					<div className='border-border/50 flex items-center justify-between border-b px-5 py-4'>
						<Dialog.Title className='flex items-center gap-2 text-base font-semibold'>
							<ShoppingCart className='text-primary h-4 w-4' />
							Кошик
							{!isEmpty && (
								<span className='text-muted-foreground text-sm font-normal'>
									({displayItems.length})
								</span>
							)}
						</Dialog.Title>
						<Dialog.Close className='text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors'>
							<X className='h-4 w-4' />
							<span className='sr-only'>Закрити</span>
						</Dialog.Close>
					</div>

					{/* Body */}
					{isEmpty ? (
						<div className='flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center'>
							<div className='bg-muted flex h-16 w-16 items-center justify-center rounded-full'>
								<ShoppingCart className='text-muted-foreground h-7 w-7' />
							</div>
							<div>
								<p className='font-semibold'>Кошик порожній</p>
								<p className='text-muted-foreground mt-1 text-sm'>
									Додайте товари, щоб почати покупки
								</p>
							</div>
							<Dialog.Close asChild>
								<Link
									href={UI_URLS.CATALOG.FILAMENT}
									className='border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 mt-2 rounded-lg border px-5 py-2 text-sm font-medium transition-colors'
								>
									Перейти до каталогу
								</Link>
							</Dialog.Close>
						</div>
					) : (
						<div className='flex-1 space-y-2 overflow-y-auto px-4 py-3'>
							{displayItems.map(item => (
								<div
									key={item.variant_id}
									className='border-border/50 bg-card flex gap-3 rounded-xl border p-3'
								>
									{/* Thumbnail + name — clickable, opens in new tab */}
									<Link
										href={item.slug ? `/products/${item.slug}` : '#'}
										target='_blank'
										rel='noopener noreferrer'
										className='group flex shrink-0'
									>
										<div className='bg-muted relative h-16 w-16 overflow-hidden rounded-lg transition-opacity group-hover:opacity-80'>
											{item.thumbnail ? (
												<Image
													src={item.thumbnail}
													alt={item.name}
													fill
													className='object-cover'
													sizes='64px'
												/>
											) : (
												<div className='flex h-full w-full items-center justify-center'>
													<Package className='text-muted-foreground h-5 w-5' />
												</div>
											)}
										</div>
									</Link>

									{/* Info */}
									<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
										<Link
											href={item.slug ? `/products/${item.slug}` : '#'}
											target='_blank'
											rel='noopener noreferrer'
											className='hover:text-primary line-clamp-2 text-sm leading-tight font-medium transition-colors'
										>
											{item.name}
										</Link>
										<p className='text-primary text-sm font-bold'>
											{item.price.toLocaleString('uk-UA')} ₴
										</p>
										<div className='flex items-center justify-between'>
											{/* Quantity controls */}
											<div className='border-border bg-card flex items-center overflow-hidden rounded-md border shadow-sm'>
												<button
													onClick={() =>
														handleDecrease(
															item.variant_id,
															item.quantity
														)
													}
													disabled={item.quantity <= 1}
													className='bg-muted text-foreground hover:bg-muted/80 flex h-6 w-6 items-center justify-center transition-colors disabled:opacity-40'
													aria-label='Зменшити'
												>
													<Minus className='h-3 w-3' />
												</button>
												<input
													type='number'
													min={1}
													step={1}
													value={item.quantity}
													onChange={e => {
														const next = Number(e.target.value)
														if (!Number.isFinite(next)) return
														commitQuantity(item.variant_id, next, item.stock)
													}}
													onBlur={e =>
														commitQuantity(
															item.variant_id,
															Number(e.target.value),
															item.stock
														)
													}
													onKeyDown={e => {
														if (e.key === 'Enter') {
															e.preventDefault()
															commitQuantity(
																item.variant_id,
																Number((e.currentTarget as HTMLInputElement).value),
																item.stock
															)
														}
													}}
													className='w-10 border-x border-zinc-300 bg-white text-center text-xs font-medium text-black outline-none'
													aria-label='Кількість'
												/>
												<button
													onClick={() =>
														handleIncrease(item.variant_id, item.quantity, item.stock)
													}
													className='bg-muted text-foreground hover:bg-muted/80 flex h-6 w-6 items-center justify-center transition-colors disabled:opacity-40'
													aria-label='Збільшити'
												>
													<Plus className='h-3 w-3' />
												</button>
											</div>
											{/* Remove */}
											<button
												onClick={() => handleRemove(item.variant_id)}
												className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex h-6 w-6 items-center justify-center rounded transition-colors'
												aria-label='Видалити'
											>
												<Trash2 className='h-3.5 w-3.5' />
											</button>
										</div>
										{stockHints[item.variant_id] && (
											<p className='text-xs text-amber-500'>
												{stockHints[item.variant_id]}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					)}

					{/* Footer */}
					{!isEmpty && (
						<div className='border-border/50 space-y-3 border-t px-5 py-4'>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground text-sm'>Разом</span>
								<span className='text-primary text-xl font-bold'>
									{total.toLocaleString('uk-UA')} ₴
								</span>
							</div>
							<Dialog.Close asChild>
								<Link
									href={UI_URLS.CHECKOUT}
									className='bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors'
								>
									Оформити замовлення
								</Link>
							</Dialog.Close>
						</div>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
