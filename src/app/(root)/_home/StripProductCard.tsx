'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check, Loader2, ShoppingCart } from 'lucide-react'
import type { StripItem } from '../[category]/catalog.api'
import { useCardCart } from '../[category]/components/useCardCart'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { PriceTag } from '@/common/components/PriceTag'
import { Badge } from '@/common/components/ui/badge'
import { pluralUk } from '@/common/utils'
import { colorLabel } from '@/common/utils/color.utils'
import {
	formatPriceAsOf,
	formatPromoEndsAt,
	formatUah,
	promoPercentLabel
} from '@/common/utils/price.utils'
import { cn } from '@/common/utils/shad-cn.utils'

/** Swatches a card shows before «+N». */
export const CARD_SWATCHES = 7

interface StripProductCardProps {
	item: StripItem
	href: string
	/** Above-the-fold card: skip lazy-load and bump network priority. */
	priority?: boolean
	/** How wide the photo is, for the derivative tier (see `STRIP_IMAGE_SIZES`). */
	sizes?: string
	/** One or two products in a strip: a row-wide card instead of a grid with a hole. */
	wide?: boolean
}

/**
 * A strip's card stands for a **product** (owner, 2026-11-14): the product's name, its colours as
 * swatches, «від N ₴» and «Обрати колір» that opens the product — one card where the SKU grid
 * printed seven that differed by a colour cut off at the end of the name. A product with one SKU
 * (or one SKU under the strip's filter, as in «Акції») keeps the price it has and «В кошик».
 * The catalogue grid and the search keep `CatalogProductCard`, one card per SKU.
 */
export const StripProductCard = ({
	item,
	href,
	priority = false,
	sizes,
	wide = false
}: StripProductCardProps) => {
	const { displayName, isInCart, isAdding, isOutOfStock, handleCartButton } = useCardCart(item)
	const { group } = item
	const multi = group.count > 1
	// Every SKU its own dictionary colour: the group is a row of colours. Anything else — a
	// current rating, a length — is «N варіантів», and no value is passed off as a colour.
	const colored = multi && group.colors_count === group.count
	const soldOut = multi ? group.in_stock === 0 : isOutOfStock
	const color = multi ? null : colorLabel(item.color)
	// One SKU with a colour: the product's name, the colour on its own line beside the swatch —
	// never at the end of a name the card cuts. Without a colour the SKU's own name is the name.
	const name = multi || color ? group.name : displayName
	// «−N %» on a product's card only when every SKU of the group is discounted: one colour on
	// sale must not badge the other six (the figure is the first SKU's).
	const promoLabel = !multi || group.on_sale === group.count ? promoPercentLabel(item) : null
	const promoEnds = formatPromoEndsAt(item.promo_ends_at)
	const priceAsOf = !multi && soldOut ? formatPriceAsOf(item.price_updated_at) : null
	const priceSize = wide ? 'text-2xl' : 'text-lg'
	const priceClass = cn('font-bold', soldOut && 'text-muted-foreground')

	const photo = item.main_image ? (
		<Image
			src={item.main_image}
			alt={name}
			fill
			className='object-cover'
			sizes={sizes}
			preload={priority}
			fetchPriority={priority ? 'high' : undefined}
		/>
	) : (
		<span className='text-muted-foreground flex size-full items-center justify-center text-xs'>
			Немає фото
		</span>
	)

	const badge = promoLabel && (
		<Badge
			variant='destructive'
			className={cn('px-2 py-0.5 text-xs', !wide && 'absolute top-2 left-2 z-10')}
			title={promoEnds ? `Акція ${promoEnds}` : undefined}
		>
			{promoLabel}
		</Badge>
	)

	// «10 кольорів · 1 у наявності»: the count is the assortment, the rest what can be bought now.
	// Said only when the two differ — and never of a sold-out product, whose card says so itself.
	const available =
		multi && group.in_stock > 0 && group.in_stock < group.count
			? ` · ${group.in_stock} у наявності`
			: ''
	const variants = colored ? (
		<div>
			<div aria-hidden className='flex items-center gap-1'>
				{group.colors.slice(0, CARD_SWATCHES).map((swatch, index) => (
					<ColorSwatch
						key={index}
						hexStops={swatch.hex_stops}
						family={swatch.family}
						size={14}
						// A sold-out colour stays in the row, faded: it exists, it cannot be bought.
						className={swatch.in_stock ? undefined : 'opacity-30'}
					/>
				))}
				{group.colors_count > CARD_SWATCHES && (
					<span className='text-muted-foreground ml-0.5 text-xs'>
						+{group.colors_count - CARD_SWATCHES}
					</span>
				)}
			</div>
			<p className='text-muted-foreground mt-1 text-xs'>
				{group.count} {pluralUk(group.count, 'колір', 'кольори', 'кольорів')}
				{available}
			</p>
		</div>
	) : multi ? (
		<p className='text-muted-foreground text-xs'>
			{group.count} {pluralUk(group.count, 'варіант', 'варіанти', 'варіантів')}
			{available}
		</p>
	) : color && item.color ? (
		<p
			className={cn(
				'text-muted-foreground flex items-center gap-1.5',
				wide ? 'text-sm' : 'text-xs'
			)}
		>
			<ColorSwatch
				hexStops={item.color.hex_stops}
				family={item.color.family}
				size={14}
				title={color}
			/>
			<span className='truncate'>{color}</span>
		</p>
	) : null

	const price = multi ? (
		<p className={cn(priceSize, priceClass)}>
			{group.price_min !== group.price_max && (
				<span className='text-muted-foreground text-[13px] font-medium'>від </span>
			)}
			{formatUah(group.price_min)}
		</p>
	) : (
		// A row-wide card sizes the whole tag, so the struck regular price (0.6em) stays readable; a
		// grid card sizes the figure alone, as the catalogue grid's card does.
		<PriceTag
			item={item}
			className={wide ? priceSize : undefined}
			priceClassName={cn(!wide && priceSize, priceClass)}
		/>
	)

	const actionClass = cn(
		'flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors',
		wide ? 'min-w-[168px]' : 'w-full'
	)
	const action = soldOut ? (
		<span className={cn(actionClass, 'bg-muted text-muted-foreground border font-medium')}>
			Немає в наявності
		</span>
	) : multi ? (
		<Link
			href={href}
			className={cn(actionClass, 'bg-card hover:border-primary border border-slate-300')}
		>
			{colored ? 'Обрати колір' : 'Обрати варіант'}
		</Link>
	) : (
		<button
			type='button'
			onClick={handleCartButton}
			disabled={isAdding}
			className={cn(
				actionClass,
				isInCart
					? 'border-primary bg-primary/20 hover:bg-primary/30 border text-black'
					: 'bg-primary hover:bg-primary/80 text-black disabled:opacity-60'
			)}
		>
			{isAdding ? (
				<Loader2 className='h-4 w-4 animate-spin' />
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
	)

	if (wide)
		return (
			<article
				className={cn(
					'bg-card border-border flex h-full flex-wrap items-center gap-5 rounded-2xl border p-4',
					soldOut && 'bg-muted grayscale'
				)}
			>
				<Link
					href={href}
					className='bg-muted relative block size-32 shrink-0 overflow-hidden rounded-xl'
				>
					{photo}
				</Link>
				<div className='min-w-0 flex-[1_1_18rem] space-y-2'>
					{badge && (
						// A `div`: the badge is one, and a `p` cannot hold it.
						<div className='flex items-center gap-2.5'>
							{badge}
							{promoEnds && (
								<span className='text-muted-foreground text-[13px]'>
									{promoEnds}
								</span>
							)}
						</div>
					)}
					<Link
						href={href}
						className='hover:text-primary-strong block text-base leading-snug font-semibold transition-colors'
					>
						{name}
					</Link>
					{variants}
				</div>
				<div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
					<div>
						{price}
						{priceAsOf && <p className='text-muted-foreground text-xs'>{priceAsOf}</p>}
					</div>
					{action}
				</div>
			</article>
		)

	return (
		<article
			className={cn(
				'bg-card border-border flex h-full flex-col rounded-[14px] border p-2.5',
				soldOut ? 'bg-muted grayscale' : 'card-hover'
			)}
		>
			<Link href={href} className='block'>
				<div className='bg-muted relative aspect-square overflow-hidden rounded-[10px]'>
					{/* The saving sits on the photo, where the eye lands first (TD-0012). */}
					{badge}
					{photo}
				</div>
				<p className='mt-2.5 line-clamp-3 text-sm leading-[1.3] font-semibold'>{name}</p>
			</Link>
			{variants && <div className='mt-2.5'>{variants}</div>}
			<div className='mt-auto pt-2.5'>
				{price}
				{priceAsOf && <p className='text-muted-foreground text-xs'>{priceAsOf}</p>}
			</div>
			<div className='mt-2.5'>{action}</div>
		</article>
	)
}
