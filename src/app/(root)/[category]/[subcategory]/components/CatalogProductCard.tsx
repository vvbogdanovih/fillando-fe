'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { CatalogItem } from '../catalog.api'
import { useCartStore } from '@/common/store/useCartStore'
import { cn } from '@/common/utils/shad-cn.utils'
import { mapCartErrorMessage } from '@/common/utils/cart-error.utils'

interface CatalogProductCardProps {
	item: CatalogItem
	href: string
}

export const CatalogProductCard = ({ item, href }: CatalogProductCardProps) => {
	const addItem = useCartStore(s => s.addItem)
	const openCart = useCartStore(s => s.openCart)
	const inAuthCart = useCartStore(s => s.items.some(i => i.variant_id === item.id))
	const inGuestCart = useCartStore(s => s.guestItems.some(i => i.variant_id === item.id))
	const isInCart = inAuthCart || inGuestCart
	const [isAdding, setIsAdding] = useState(false)

	const availableQuantity = item.quantity ?? item.stock
	const isOutOfStock = availableQuantity <= 0

	const handleCartButton = async (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		if (isInCart) {
			openCart()
			return
		}

		if (isAdding || isOutOfStock) return
		setIsAdding(true)
		try {
			await addItem(item.id, 1, {
				name: item.name,
				price: item.price,
				thumbnail: item.main_image,
				slug: item.slug
			})
		} catch (err) {
			toast.error(mapCartErrorMessage(err instanceof Error ? err.message : undefined))
		} finally {
			setIsAdding(false)
		}
	}

	return (
		<div
			className={cn(
				'bg-card border-border/50 flex flex-col overflow-hidden rounded-xl border shadow-lg shadow-black/10',
				isOutOfStock
					? 'border-muted bg-muted grayscale'
					: 'card-hover'
			)}
		>
			<Link href={href} className='block flex-1'>
				<div className='p-3 pb-0'>
					<div className='bg-muted relative aspect-square overflow-hidden rounded-lg'>
						{item.main_image ? (
							<Image
								src={item.main_image}
								alt={item.name}
								fill
								className={cn('object-cover', isOutOfStock && 'grayscale')}
								sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
							/>
						) : (
							<div className='flex h-full w-full items-center justify-center'>
								<span className='text-muted-foreground text-xs'>Немає фото</span>
							</div>
						)}
					</div>
				</div>
				<div className='space-y-1 p-3'>
					<p className='line-clamp-3 text-sm leading-tight font-medium'>{item.name}</p>
					<p className='text-muted-foreground text-xs'>Арт. {item.sku}</p>
					<p
						className={cn(
							'text-lg font-bold',
							isOutOfStock ? 'text-muted-foreground' : 'text-primary'
						)}
					>
						{item.price.toLocaleString('uk-UA')} ₴
					</p>
				</div>
			</Link>
			<div className='px-3 pb-3'>
				<button
					onClick={handleCartButton}
					disabled={isAdding || isOutOfStock}
					className={cn(
						'flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
						isOutOfStock
							? 'bg-muted text-muted-foreground cursor-not-allowed'
							: isInCart
								? 'border border-green-500/30 bg-green-500/20 text-green-400 hover:bg-green-500/30'
								: 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 border disabled:opacity-60'
					)}
				>
					{isAdding ? (
						<Loader2 className='h-4 w-4 animate-spin' />
					) : isOutOfStock ? (
						'Нема в наявності'
					) : isInCart ? (
						<>
							<Check className='h-4 w-4' />В кошику
						</>
					) : (
						<>
							<ShoppingCart className='h-4 w-4' />В кошик
						</>
					)}
				</button>
			</div>
		</div>
	)
}
