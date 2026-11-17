import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { StripItem } from '../[category]/catalog.api'
import { productsCount } from '@/common/utils'
import { cn } from '@/common/utils/shad-cn.utils'
import { CardAurora } from './CardAurora'
import { STRIP_IMAGE_SIZES, WIDE_CARDS_MAX } from './FeaturedProducts'
import { RailScroller } from './RailScroller'
import { StripProductCard } from './StripProductCard'

/**
 * A card of the row that scrolls is as wide as a card of the other shelves — five beside the cover
 * from `xl`, four below — and on a phone two with a hint of the third, which is what says «swipe».
 */
const SHELF_ROW =
	'auto-cols-[44%] sm:auto-cols-[30%] md:auto-cols-[calc((100%-3*0.75rem)/4)] xl:auto-cols-[calc((100%-4*0.75rem)/5)]'

interface CollectionShelfProps {
	title: string
	/** Where the cover leads: the collection's own page, or the catalogue for a picked list. */
	href: string
	/** «Дивитися всі» for a page of its own; «До каталогу» for a picked list, which has none. */
	label: string
	/** The photo of the collection's category or landing, from the admin; none — a plain cover. */
	image: string | null
	/** Products behind the cover; `null` when nothing counts them (a picked list). */
	count: number | null
	items: StripItem[]
	/**
	 * A list picked by hand: every product of it, in one row that scrolls sideways like «Новинки»
	 * (owner, 2026-11-15). A category's or a landing's shelf shows its five — the rest is a click
	 * away; a picked list has no page, so what its shelf does not show stands nowhere.
	 */
	rail?: boolean
	/** 0…1: this cover's cut of the shared «Аврора», so neighbouring covers are not one picture. */
	shift?: number
}

/**
 * A home page collection as a shelf (owner, 2026-11-14): a dark cover in the manner of the card
 * beside the banner — the photo, the title, how many products, the way in — and the cards beside
 * it: five from `xl`, four below. On a phone the cover is one compact row above two columns. The
 * rows under the first screen were three strips of one shape in a paler manner than the row above
 * them; the cover gives each collection a face and the page a rhythm. One or two products are
 * row-wide cards, as in every strip. A list picked by hand (`rail`) keeps the cover and puts every
 * product beside it in one row that scrolls — under the compact cover on a phone. Nothing here
 * knows a category: the title is «Вітрина» copy, the photo is the admin's.
 */
export function CollectionShelf({
	title,
	href,
	label,
	image,
	count,
	items,
	rail = false,
	shift
}: CollectionShelfProps) {
	const counted = count === null ? null : productsCount(count)
	const scrolls = rail && items.length > WIDE_CARDS_MAX
	return (
		// The row that scrolls is a region by the title itself: one region of that name, not two.
		<section
			aria-label={scrolls ? undefined : title}
			className='grid gap-3 lg:grid-cols-[232px_minmax(0,1fr)]'
		>
			{/* The colour and the glow as two classes: one `bg-[…]` holding both is invalid (TD-0015). */}
			<Link
				href={href}
				className='relative isolate flex items-center gap-3 overflow-hidden rounded-2xl bg-[#0f172a] bg-[image:radial-gradient(120%_80%_at_100%_0,rgba(24,144,219,.5),transparent_60%)] p-3.5 text-[#e8f1f6] lg:flex-col lg:items-stretch lg:justify-between lg:gap-6 lg:p-5'
			>
				<CardAurora shift={shift} />
				{/* The title is the section's heading, like «Новинки» and the band's (H1 → H2 on the
				    page) — so the wrappers are `div`s: a `span` cannot hold a heading. */}
				<div className='flex min-w-0 flex-1 items-center gap-3 lg:flex-none lg:flex-col lg:items-start lg:gap-0'>
					{image && (
						<Image
							src={image}
							alt=''
							width={128}
							height={128}
							sizes='64px'
							className='size-12 shrink-0 rounded-[10px] object-cover lg:size-16 lg:rounded-xl'
						/>
					)}
					<div className={cn('min-w-0', image && 'lg:mt-[18px]')}>
						<h2 className='font-display block text-[15px] leading-tight font-semibold text-white lg:text-lg'>
							{title}
						</h2>
						{/* A phone has no room for a button: the way in is said beside the count. */}
						<span className='mt-1 block text-[13px] text-[#b9c7d6] lg:mt-2 lg:text-sm'>
							{counted && <span>{counted}</span>}
							<span className='lg:hidden'>
								{counted ? ` · ${label.toLowerCase()}` : label}
							</span>
						</span>
					</div>
				</div>
				<span
					aria-hidden
					className='bg-primary flex size-11 shrink-0 items-center justify-center rounded-full text-black lg:hidden'
				>
					<ArrowRight size={18} />
				</span>
				<span
					aria-hidden
					className='bg-primary hidden min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-black lg:flex'
				>
					{label}
					<ArrowRight size={16} />
				</span>
			</Link>

			{items.length <= WIDE_CARDS_MAX ? (
				<div className={cn('grid gap-3', items.length === 2 && 'xl:grid-cols-2')}>
					{items.map(item => (
						<StripProductCard
							key={item.id}
							item={item}
							href={`/products/${item.slug}`}
							sizes={STRIP_IMAGE_SIZES}
							wide
						/>
					))}
				</div>
			) : scrolls ? (
				// `min-w-0`: below `lg` the section is one column sized by its content, and a row of
				// two dozen cards would stretch it — and the page — to the row's whole length.
				<div className='min-w-0'>
					<RailScroller label={title} columns={SHELF_ROW}>
						{items.map(item => (
							<div key={item.id} className='h-full snap-start'>
								<StripProductCard
									item={item}
									href={`/products/${item.slug}`}
									sizes={STRIP_IMAGE_SIZES}
								/>
							</div>
						))}
					</RailScroller>
				</div>
			) : (
				<div className='grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5'>
					{items.map((item, index) => (
						<div
							key={item.id}
							className={cn(
								'h-full',
								// Four below `xl` — two full rows on a phone, one from `md`; the fifth
								// stands beside the cover only where five fit. Three on a phone would
								// be a row and a half. The hidden cards stay in the HTML.
								index >= 4 && 'max-xl:hidden',
								items.length === 3 && index === 2 && 'max-md:hidden'
							)}
						>
							<StripProductCard
								item={item}
								href={`/products/${item.slug}`}
								sizes={STRIP_IMAGE_SIZES}
							/>
						</div>
					))}
				</div>
			)}
		</section>
	)
}
