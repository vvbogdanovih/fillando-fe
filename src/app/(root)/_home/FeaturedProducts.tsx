import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { StripItem } from '../[category]/catalog.api'
import { UI_URLS } from '@/common/constants'
import { StaggerGroup, StaggerItem } from '@/common/components/motion'
import { cn } from '@/common/utils/shad-cn.utils'
import { RailScroller } from './RailScroller'
import { StripProductCard } from './StripProductCard'

/**
 * A strip of one or two products is row-wide cards, in either layout (owner, 2026-11-14): one
 * card in a grid of six read as broken markup. A shop of 45 products meets this often — one
 * product on sale is one card.
 */
export const WIDE_CARDS_MAX = 2

/**
 * The grid's columns per breakpoint (2 · `md` 4 · `lg` 6) and the classes that hide the cards past the
 * last full row at each, so a strip of 8 is one row of 6 on a computer, not 6 + 2 (owner, 2026-11-10;
 * the sketch shows one full row). Fewer cards than one row are all shown — there is nothing to fill.
 * The hidden cards stay in the HTML.
 */
export function beyondFullRows(index: number, count: number) {
	const visible = (columns: number) => (count >= columns ? count - (count % columns) : count)
	return [
		index >= visible(2) && 'max-md:hidden',
		index >= visible(4) && 'md:max-lg:hidden',
		index >= visible(6) && 'lg:hidden'
	]
		.filter(Boolean)
		.join(' ')
}

/**
 * How wide a strip card's photo is, for the derivative tier the browser picks (inert while
 * `NEXT_PUBLIC_USE_IMAGE_DERIVATIVES` is off). Measured in Chrome on 2026-11-11: from `md` on both
 * layouts show 157 / 142 / 172 px (the container is fixed per breakpoint); below `md` the grid's two
 * columns (158 px at 412, 302 px at 700) are wider than the rail's (141 / 174 px). **One value for
 * both layouts on purpose**: the same product often stands in «Новинки» and in a collection below,
 * and two `sizes` picked two tiers of one photo — it was downloaded twice on a phone. The catalogue
 * grid's default (25vw) would fetch the 640 tier where 320 is enough.
 */
export const STRIP_IMAGE_SIZES =
	'(max-width: 767px) calc(50vw - 48px), (max-width: 1023px) 160px, (max-width: 1279px) 145px, 175px'

interface FeaturedProductsProps {
	items: StripItem[]
	/** «Новинки» by default; an admin collection passes its own title and target. */
	title?: string
	/** `null`: no link — a strip with no page of its own, or one on the page it would open. */
	href?: string | null
	linkLabel?: string
	/** `rail`: one row that scrolls sideways (the home page's «Новинки», TD-0015); `grid`: rows. */
	layout?: 'grid' | 'rail'
	/** An anchor other pages link to (the hub's «Акції» and «Новинки»). */
	id?: string
	/**
	 * How many leading cards preload instead of lazy-loading (`ProductGrid`'s `EAGER_CARDS`). Only a
	 * strip above the fold sets it: a preload below it competes with the CSS and the fonts for nothing.
	 */
	eagerCards?: number
}

export function FeaturedProducts({
	items,
	title = 'Новинки',
	href = UI_URLS.CATALOG.ROOT,
	// `/catalog` is the catalogue hub (Plan-0010 P20), not a list of every product.
	linkLabel = 'До каталогу',
	layout = 'grid',
	id,
	eagerCards = 0
}: FeaturedProductsProps) {
	return (
		// `scroll-mt`: an anchor lands below the sticky header, not under it.
		<section id={id} className='scroll-mt-32 py-6 md:py-8'>
			<div className='mb-4 flex items-end justify-between gap-4'>
				<h2 className='font-display text-lg font-semibold md:text-xl'>{title}</h2>
				{href !== null && (
					<Link
						href={href}
						className='text-primary-strong inline-flex shrink-0 items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80'
					>
						{linkLabel}
						<ArrowRight className='size-4' />
					</Link>
				)}
			</div>
			{items.length <= WIDE_CARDS_MAX ? (
				<div className={cn('grid gap-3', items.length === 2 && 'lg:grid-cols-2')}>
					{items.map((item, index) => (
						<StripProductCard
							key={item.id}
							item={item}
							href={`/products/${item.slug}`}
							priority={index < eagerCards}
							// The strip's one value, though the square is 128 px: the same product in a
							// grid strip must pick the same derivative tier (see `STRIP_IMAGE_SIZES`).
							sizes={STRIP_IMAGE_SIZES}
							wide
						/>
					))}
				</div>
			) : layout === 'rail' ? (
				<RailScroller label={title}>
					{items.map((item, index) => (
						<div key={item.id} className='h-full snap-start'>
							<StripProductCard
								item={item}
								href={`/products/${item.slug}`}
								priority={index < eagerCards}
								sizes={STRIP_IMAGE_SIZES}
							/>
						</div>
					))}
				</RailScroller>
			) : (
				<StaggerGroup className='grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6'>
					{items.map((item, index) => (
						<StaggerItem
							key={item.id}
							className={`h-full ${beyondFullRows(index, items.length)}`}
						>
							<StripProductCard
								item={item}
								href={`/products/${item.slug}`}
								priority={index < eagerCards}
								sizes={STRIP_IMAGE_SIZES}
							/>
						</StaggerItem>
					))}
				</StaggerGroup>
			)}
		</section>
	)
}
