import { cn } from '@/common/utils/shad-cn.utils'
import {
	effectivePrice,
	formatUah,
	isPromoActive,
	type PromoPriced
} from '@/common/utils/price.utils'

interface PriceTagProps {
	item: PromoPriced
	/** Classes for the figure the shopper pays — size and colour differ per surface. */
	priceClassName?: string
	className?: string
}

/**
 * The one way the storefront prints a price (TD-0012): what the shopper pays, and — while a
 * promotion is on — the regular price struck through beside it. `<s>` rather than a CSS-only
 * strike, so the meaning survives reader modes; the visually hidden captions tell a screen reader
 * which figure is which, since a struck number is only visual.
 */
export const PriceTag = ({ item, priceClassName, className }: PriceTagProps) => {
	const onPromo = isPromoActive(item)
	return (
		<p className={cn('flex flex-wrap items-baseline gap-x-2', className)}>
			{onPromo && <span className='sr-only'>Ціна зі знижкою:</span>}
			<span className={priceClassName}>{formatUah(effectivePrice(item))}</span>
			{onPromo && (
				<s className='text-muted-foreground text-[0.6em] font-normal'>
					<span className='sr-only'>Стара ціна:</span>
					{formatUah(item.price)}
				</s>
			)}
		</p>
	)
}
