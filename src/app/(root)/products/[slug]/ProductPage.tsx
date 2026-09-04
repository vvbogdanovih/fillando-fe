'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
	AlertTriangle,
	Check,
	ChevronDown,
	Handshake,
	Loader2,
	Minus,
	Plus,
	ShoppingCart
} from 'lucide-react'
import { UI_URLS } from '@/common/constants'
import { Badge } from '@/common/components/ui/badge'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from '@/common/components/ui/dropdown-menu'
import { cn } from '@/common/utils/shad-cn.utils'
import { formatPriceAsOf, formatUah } from '@/common/utils/price.utils'
import { useCartStore } from '@/common/store/useCartStore'
import { getVariantBySlug, type ProductDetailData } from '@/app/(root)/[category]/catalog.api'
import { JsonLd } from '@/common/components/JsonLd'
import { Breadcrumbs } from '@/common/components/Breadcrumbs'
import {
	MERCHANT_RETURN_POLICY,
	OFFER_SHIPPING_DETAILS,
	SITE_NAME
} from '@/common/constants/seo.constants'
import { mapCartErrorMessage } from '@/common/utils/cart-error.utils'
import { variantLabel } from '@/common/utils/color.utils'
import {
	ATTR_NOTES,
	REFILL_NOTE,
	REFILL_VARIANT_PATTERN
} from '@/common/constants/attribute-notes.constants'

interface ProductPageProps {
	slug: string
	initialData?: ProductDetailData | null
}

export const ProductPage = ({ slug, initialData }: ProductPageProps) => {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['product', slug],
		queryFn: () => getVariantBySlug(slug),
		initialData: initialData ?? undefined
	})

	const [currentIndex, setCurrentIndex] = useState(0)
	const [quantity, setQuantity] = useState(1)
	const [isAdding, setIsAdding] = useState(false)
	const [addError, setAddError] = useState<string | null>(null)
	const [stockHint, setStockHint] = useState<string | null>(null)
	const stockHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const router = useRouter()
	const addItem = useCartStore(s => s.addItem)
	const openCart = useCartStore(s => s.openCart)

	const variant = data?.variant
	const product = data?.product
	const siblings = [...(data?.siblings ?? [])].sort((a, b) => {
		const aOut = a.stock <= 0 ? 1 : 0
		const bOut = b.stock <= 0 ? 1 : 0
		return aOut - bOut
	})
	const images = variant?.images ?? []

	const inAuthCart = useCartStore(s => s.items.some(i => i.variant_id === (variant?.id ?? '')))
	const inGuestCart = useCartStore(s =>
		s.guestItems.some(i => i.variant_id === (variant?.id ?? ''))
	)
	const isInCart = inAuthCart || inGuestCart
	const availableStock = variant?.quantity ?? variant?.stock ?? 0

	const prev = useCallback(
		() => setCurrentIndex(i => (i - 1 + images.length) % images.length),
		[images.length]
	)
	const next = useCallback(() => setCurrentIndex(i => (i + 1) % images.length), [images.length])

	useEffect(() => {
		return () => {
			if (stockHintTimerRef.current) clearTimeout(stockHintTimerRef.current)
		}
	}, [])

	const showStockHint = useCallback(
		(currentQuantity: number) => {
			if (availableStock <= 0 || currentQuantity <= availableStock) return
			setStockHint(`Наявна кількість ${availableStock}`)
			setQuantity(availableStock)
			if (stockHintTimerRef.current) clearTimeout(stockHintTimerRef.current)
			stockHintTimerRef.current = setTimeout(() => {
				setStockHint(null)
			}, 5000)
		},
		[availableStock]
	)

	if (isLoading) {
		return (
			<div className='container mx-auto flex max-w-7xl items-center justify-center px-4 py-32'>
				<Loader2 className='text-primary h-8 w-8 animate-spin' />
			</div>
		)
	}

	if (isError || !data || !variant || !product) {
		return (
			<div className='container mx-auto max-w-7xl px-4 py-32 text-center'>
				<p className='text-muted-foreground'>Товар не знайдено</p>
			</div>
		)
	}

	const { category_slug, category_name } = data

	const catalogPath = `/${category_slug}`
	// The dictionary colour, not `v_value`: after the colour migration the raw value is the
	// English name, and every one of these five places would switch the shop to English.
	const variantValue = variantLabel(variant)

	// Above the buy button, never in the description: the description renders below the CTA,
	// i.e. after the decision (TD-0002 §5.2.1).
	const attrNote =
		product.attributes.map(attr => ATTR_NOTES[attr.k]?.[String(attr.v)]).find(Boolean) ??
		(REFILL_VARIANT_PATTERN.test(variant.v_value ?? '') ? REFILL_NOTE : undefined)
	const displayName = variantValue ? `${product.name} — ${variantValue}` : variant.name
	const isOutOfStock = availableStock <= 0
	const isLowStock = availableStock > 0 && availableStock <= 5
	const priceAsOf = isOutOfStock ? formatPriceAsOf(variant.price_updated_at) : null

	const handleAddToCart = async () => {
		if (isInCart) {
			openCart()
			return
		}
		setIsAdding(true)
		setAddError(null)
		try {
			await addItem(variant.id, quantity, {
				name: displayName,
				price: variant.price,
				thumbnail: variant.images[0] ?? null,
				slug: variant.slug
			})
		} catch (err) {
			setAddError(mapCartErrorMessage(err instanceof Error ? err.message : undefined))
		} finally {
			setIsAdding(false)
		}
	}

	const productSchema = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: displayName,
		description: product.description?.html?.replace(/<[^>]*>/g, '') ?? undefined,
		image: images,
		brand: { '@type': 'Brand', name: SITE_NAME },
		offers: {
			'@type': 'Offer',
			price: variant.price,
			priceCurrency: 'UAH',
			availability:
				availableStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
			shippingDetails: OFFER_SHIPPING_DETAILS,
			hasMerchantReturnPolicy: MERCHANT_RETURN_POLICY
		}
	}

	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<JsonLd data={productSchema} />
			<Breadcrumbs
				items={[
					{ name: 'Головна', href: '/' },
					{ name: category_name, href: catalogPath },
					{ name: displayName, href: `/products/${variant.slug}` }
				]}
			/>

			<div className='flex flex-col gap-8 lg:flex-row'>
				{/* Image gallery */}
				<div className='flex flex-col gap-3 lg:w-1/2'>
					<div className='bg-muted relative aspect-square overflow-hidden rounded-xl'>
						<div className='absolute inset-4'>
							<div className='relative h-full w-full overflow-hidden rounded-lg'>
								{images.length > 0 ? (
									images.map((img, i) => (
										<Image
											key={img}
											src={img}
											alt={`${displayName} ${i + 1}`}
											fill
											className={cn(
												'object-contain transition-opacity duration-300',
												i === currentIndex ? 'opacity-100' : 'opacity-0'
											)}
											sizes='(max-width: 1024px) 100vw, 50vw'
											preload={i === 0}
											fetchPriority={i === 0 ? 'high' : undefined}
										/>
									))
								) : (
									<div className='flex h-full w-full items-center justify-center'>
										<span className='text-muted-foreground text-sm'>
											Немає фото
										</span>
									</div>
								)}
							</div>
						</div>
						{images.length > 1 && (
							<>
								<button
									onClick={prev}
									className='absolute top-1/2 left-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60'
									aria-label='Попереднє фото'
								>
									‹
								</button>
								<button
									onClick={next}
									className='absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60'
									aria-label='Наступне фото'
								>
									›
								</button>
								{/* 24x24 hit areas (target-size) wrapping the smaller visible dots.
								    bottom-0 keeps the dots optically where bottom-2 put them. */}
								<div className='absolute bottom-0 left-1/2 flex -translate-x-1/2'>
									{images.map((_, i) => (
										<button
											key={i}
											type='button'
											onClick={() => setCurrentIndex(i)}
											aria-label={`Перейти до фото ${i + 1}`}
											aria-current={i === currentIndex ? 'true' : undefined}
											className='flex h-6 w-6 items-center justify-center'
										>
											<span
												className={cn(
													'block h-1.5 rounded-full transition-all',
													i === currentIndex
														? 'w-4 bg-white'
														: 'w-1.5 bg-white/50'
												)}
											/>
										</button>
									))}
								</div>
							</>
						)}
					</div>
					{images.length > 1 && (
						<div className='flex gap-2 overflow-x-auto'>
							{images.map((img, i) => (
								<button
									key={i}
									onClick={() => setCurrentIndex(i)}
									className={cn(
										'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
										i === currentIndex
											? 'border-primary'
											: 'border-border hover:border-muted-foreground'
									)}
								>
									<Image
										src={img}
										alt={`${displayName} ${i + 1}`}
										fill
										className='object-cover'
										sizes='64px'
									/>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Product info */}
				<div className='flex flex-col gap-5 lg:w-1/2'>
					<h1 className='text-2xl font-bold'>{displayName}</h1>

					<Badge
						className={cn(
							'w-fit px-3 py-1 text-sm',
							availableStock > 0
								? 'border-green-700 bg-green-700 text-white'
								: 'border-border bg-muted text-muted-foreground'
						)}
						variant='outline'
					>
						{availableStock > 0 ? 'В наявності' : 'Немає в наявності'}
					</Badge>

					<div>
						<p
							className={cn(
								'text-3xl font-bold',
								isOutOfStock ? 'text-muted-foreground' : 'text-primary-strong'
							)}
						>
							{formatUah(variant.price)}
						</p>
						{priceAsOf && <p className='text-muted-foreground text-sm'>{priceAsOf}</p>}
						<span className='text-muted-foreground text-sm'>Арт. {variant.sku}</span>
					</div>

					{/* Add to cart */}
					<div className='flex flex-col gap-3'>
						{attrNote && (
							<div className='rounded-lg border border-amber-500/40 bg-amber-50 p-3'>
								<p className='flex items-center gap-2 text-sm font-medium text-amber-900'>
									<AlertTriangle className='h-4 w-4 shrink-0' />
									{attrNote.title}
								</p>
								<p className='mt-1 text-xs text-amber-800'>{attrNote.text}</p>
							</div>
						)}
						{isLowStock && (
							<div className='w-fit rounded-md bg-amber-700 px-3 py-1 text-sm font-medium text-white'>
								Залишилось лише {availableStock} шт.
							</div>
						)}
						<div className='flex items-center gap-3'>
							<div className='border-border bg-card flex items-center overflow-hidden rounded-lg border shadow-sm'>
								<button
									onClick={() => setQuantity(q => Math.max(1, q - 1))}
									disabled={quantity <= 1 || isOutOfStock}
									className='bg-muted text-foreground hover:bg-muted/80 flex h-9 w-9 items-center justify-center transition-colors disabled:opacity-40'
									aria-label='Зменшити кількість'
								>
									<Minus className='h-3.5 w-3.5' />
								</button>
								<input
									type='number'
									min={1}
									step={1}
									value={quantity}
									onChange={e => {
										const next = Number(e.target.value)
										if (!Number.isFinite(next)) return
										const normalized = Math.max(1, Math.floor(next))
										setQuantity(normalized)
									}}
									onBlur={() => showStockHint(quantity)}
									onKeyDown={e => {
										if (e.key === 'Enter') {
											e.preventDefault()
											showStockHint(quantity)
										}
									}}
									disabled={isOutOfStock}
									className='w-14 border-x border-zinc-300 bg-white text-center text-sm font-medium text-black outline-none'
									aria-label='Кількість'
								/>
								<button
									onClick={() => {
										const nextQuantity = Math.max(1, quantity + 1)
										setQuantity(nextQuantity)
										showStockHint(nextQuantity)
									}}
									disabled={isOutOfStock}
									className='bg-muted text-foreground hover:bg-muted/80 flex h-9 w-9 items-center justify-center transition-colors disabled:opacity-40'
									aria-label='Збільшити кількість'
								>
									<Plus className='h-3.5 w-3.5' />
								</button>
							</div>
							<button
								onClick={handleAddToCart}
								disabled={isOutOfStock || isAdding}
								className={cn(
									'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
									isOutOfStock
										? 'bg-muted text-muted-foreground cursor-not-allowed'
										: isInCart
											? 'border border-green-500/30 bg-green-500/20 text-black hover:bg-green-500/30'
											: 'bg-primary hover:bg-primary/90 text-black disabled:opacity-60'
								)}
							>
								{isAdding ? (
									<Loader2 className='h-4 w-4 animate-spin' />
								) : isInCart ? (
									<Check className='h-4 w-4' />
								) : (
									<ShoppingCart className='h-4 w-4' />
								)}
								{isOutOfStock
									? 'Немає в наявності'
									: isInCart
										? 'В кошику'
										: 'Додати в кошик'}
							</button>
						</div>
						{stockHint && <p className='text-xs text-amber-700'>{stockHint}</p>}
						{addError && <p className='text-destructive text-sm'>{addError}</p>}
					</div>

					{/* Variant switcher */}
					{siblings.length > 1 && (
						<div>
							<p className='text-muted-foreground mb-2 text-sm'>
								{product.variant_type?.label ?? 'Варіація'}:
							</p>
							<DropdownMenu>
								<DropdownMenuTrigger className='border-input flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus:outline-none focus-visible:outline-none'>
									<span>{variantValue ?? variant.name}</span>
									<ChevronDown className='size-4 opacity-50' />
								</DropdownMenuTrigger>
								<DropdownMenuContent
									className='max-h-[360px] min-w-(--radix-dropdown-menu-trigger-width) bg-white'
									align='start'
									sideOffset={4}
								>
									<DropdownMenuRadioGroup
										value={variant.slug}
										onValueChange={slug => router.push(`/products/${slug}`)}
									>
										{siblings.map(s => (
											<DropdownMenuRadioItem
												key={s.id}
												value={s.slug}
												className={
													s.stock <= 0 ? 'text-muted-foreground/50' : ''
												}
											>
												{variantLabel(s) ?? s.name}
												{s.stock <= 0 && (
													<span className='text-muted-foreground/40 ml-2 text-xs'>
														— немає в наявності
													</span>
												)}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}

					{/* Wholesale note */}
					<Link
						href={UI_URLS.WHOLESALE}
						className='border-border bg-card hover:border-primary group flex items-center gap-3 rounded-xl border p-4 transition-colors'
					>
						<div className='bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
							<Handshake className='h-4 w-4' />
						</div>
						<div>
							<p className='text-sm font-medium'>
								Цікавить оптова закупка чи поставки для бізнесу?
							</p>
							<p className='text-muted-foreground group-hover:text-primary text-xs transition-colors'>
								Дізнатись про умови співпраці →
							</p>
						</div>
					</Link>
				</div>
			</div>

			{/* Description */}
			{product.description?.html && (
				<div className='border-border/50 bg-card mt-8 rounded-xl border p-6 shadow-lg shadow-black/10'>
					<div
						className='description'
						dangerouslySetInnerHTML={{ __html: product.description.html }}
					/>
				</div>
			)}

			{/* Attributes */}
			{product.attributes.length > 0 && (
				<div className='border-border/50 bg-card mt-6 rounded-xl border p-4 shadow-lg shadow-black/10'>
					<table className='w-full text-sm'>
						<tbody>
							{product.attributes.map(attr => {
								const isVariantAttr = product.variant_type?.key === attr.k
								const displayValue =
									isVariantAttr && variantValue ? variantValue : String(attr.v)
								return (
									<tr
										key={attr.k}
										className='border-border/50 border-b last:border-0'
									>
										<td className='text-muted-foreground w-1/2 py-2 pr-8'>
											{attr.l}
										</td>
										<td className='py-2 font-medium'>{displayValue}</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
