'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Check, Loader2, Minus, Plus } from 'lucide-react'
import { Badge } from '@/common/components/ui/badge'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { cn } from '@/common/utils/shad-cn.utils'
import { useCartStore } from '@/common/store/useCartStore'
import { getVariantBySlug } from '@/app/(root)/[category]/[subcategory]/catalog.api'
import { JsonLd } from '@/common/components/JsonLd'
import { SITE_NAME, SITE_URL } from '@/common/constants/seo.constants'
import { mapCartErrorMessage } from '@/common/utils/cart-error.utils'

interface ProductPageProps {
	slug: string
}

export const ProductPage = ({ slug }: ProductPageProps) => {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['product', slug],
		queryFn: () => getVariantBySlug(slug)
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
	const siblings = data?.siblings ?? []
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

	const { category_slug, subcategory_slug } = data

	const catalogPath = `/${category_slug}/${subcategory_slug}`
	const displayName = variant.v_value ? `${product.name} — ${variant.v_value}` : variant.name
	const isOutOfStock = availableStock <= 0
	const isLowStock = availableStock > 0 && availableStock <= 5

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
		},
	}

	const breadcrumbSchema = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
			{
				'@type': 'ListItem',
				position: 2,
				name: category_slug,
				item: `${SITE_URL}/${category_slug}`,
			},
			{
				'@type': 'ListItem',
				position: 3,
				name: subcategory_slug,
				item: `${SITE_URL}/${category_slug}/${subcategory_slug}`,
			},
			{
				'@type': 'ListItem',
				position: 4,
				name: displayName,
				item: `${SITE_URL}/products/${variant.slug}`,
			},
		],
	}

	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<JsonLd data={productSchema} />
			<JsonLd data={breadcrumbSchema} />
			<nav className='text-muted-foreground mb-6 flex items-center gap-2 text-sm'>
				<Link href={catalogPath} className='hover:text-foreground transition-colors'>
					{subcategory_slug}
				</Link>
				<span>/</span>
				<span className='text-foreground'>{displayName}</span>
			</nav>

			<div className='flex flex-col gap-8 lg:flex-row'>
				{/* Image gallery */}
				<div className='flex flex-col gap-3 lg:w-1/2'>
					<div className='bg-muted relative aspect-square overflow-hidden rounded-xl'>
						{images.length > 0 ? (
							images.map((img, i) => (
								<Image
									key={img}
									src={img}
									alt={`${displayName} ${i + 1}`}
									fill
									className={cn(
										'object-cover transition-opacity duration-300',
										i === currentIndex ? 'opacity-100' : 'opacity-0'
									)}
									sizes='(max-width: 1024px) 100vw, 50vw'
									priority={i === 0}
								/>
							))
						) : (
							<div className='flex h-full w-full items-center justify-center'>
								<span className='text-muted-foreground text-sm'>Немає фото</span>
							</div>
						)}
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
								<div className='absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5'>
									{images.map((_, i) => (
										<button
											key={i}
											onClick={() => setCurrentIndex(i)}
											className={cn(
												'h-1.5 rounded-full transition-all',
												i === currentIndex
													? 'w-4 bg-white'
													: 'w-1.5 bg-white/50'
											)}
										/>
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
							'w-fit',
							availableStock > 0
								? 'border-green-500/30 bg-green-500/10 text-green-400'
								: 'border-border bg-muted text-muted-foreground'
						)}
						variant='outline'
					>
						{availableStock > 0 ? 'В наявності' : 'Нема в наявності'}
					</Badge>

					<div>
						<p className='text-primary text-3xl font-bold'>
							{variant.price.toLocaleString('uk-UA')} ₴
						</p>
						<span className='text-muted-foreground text-sm'>Арт. {variant.sku}</span>
					</div>

					{/* Add to cart */}
					<div className='flex flex-col gap-3'>
						{isLowStock && (
							<p className='text-sm text-amber-400'>
								Залишилось лише {availableStock} шт.
							</p>
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
											? 'border border-green-500/30 bg-green-500/20 text-green-400 hover:bg-green-500/30'
											: 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60'
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
									? 'Нема в наявності'
									: isInCart
										? 'В кошику'
										: 'Додати в кошик'}
							</button>
						</div>
						{stockHint && <p className='text-xs text-amber-500'>{stockHint}</p>}
						{addError && <p className='text-destructive text-sm'>{addError}</p>}
					</div>

					{/* Variant switcher */}
					{siblings.length > 1 && (
						<div>
							<p className='text-muted-foreground mb-2 text-sm'>
								{product.variant_type?.label ?? 'Варіація'}:
							</p>
							<Select
								value={variant.slug}
								onValueChange={slug => router.push(`/products/${slug}`)}
							>
								<SelectTrigger className='w-full bg-white'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{siblings.map(s => (
										<SelectItem key={s.id} value={s.slug}>
											{s.v_value ?? s.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
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
									isVariantAttr && variant.v_value
										? variant.v_value
										: String(attr.v)
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
