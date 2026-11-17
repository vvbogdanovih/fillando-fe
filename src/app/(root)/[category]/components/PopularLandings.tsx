import Image from 'next/image'
import Link from 'next/link'
import { pluralUk } from '@/common/utils'
import { cn } from '@/common/utils/shad-cn.utils'
import { shortLabel } from './landing-label'

export interface PopularLanding {
	slug: string
	h1: string
	image: string | null
	/** null when the backend did not send one — a pill reading «0» would be a lie. */
	product_count: number | null
	/** Its own category when the pills span several (the catalogue hub); else the props'. */
	category?: { slug: string; name: string }
}

interface PopularLandingsProps {
	categorySlug?: string
	categoryName?: string
	landings: PopularLanding[]
	title?: string
	/** The hub's section heading (Unbounded, like its strips); a category keeps its quiet label. */
	display?: boolean
}

export { shortLabel }

/**
 * A category's landings as a row of pills — the label and how many products it holds (owner,
 * 2026-11-14; before that five-across tiles with a dot, nine shown and the rest behind «Ще N
 * видів»). A pill takes the width of its label, so no name is cut, and every landing is visible:
 * these are the category's internal links to its landings, the ones a crawler follows. The dot is
 * gone because its colour was a hash of the slug — beside filament it read as the plastic's colour.
 *
 * The label is the H1 without the category's name only on the category's own page, under its
 * heading. On the hub the pills come from every category at once, so each prints its H1 whole.
 */
export const PopularLandings = ({
	categorySlug,
	categoryName,
	landings: all,
	title = 'Популярні види',
	display = false
}: PopularLandingsProps) => {
	// A landing with no products is a known empty listing — noindex, left out of the sitemap —
	// so no pill links to it either (P02). An unknown count (null) still shows.
	const landings = all.filter(item => item.product_count !== 0)

	if (landings.length === 0) return null

	return (
		<nav aria-label={title} className='mb-8'>
			<h2
				className={cn(
					display
						? 'font-display mb-3.5 text-lg font-semibold md:text-xl'
						: 'text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase'
				)}
			>
				{title}
			</h2>
			<div className='flex flex-wrap gap-2'>
				{landings.map(item => (
					<Link
						key={`${item.category?.slug ?? categorySlug}/${item.slug}`}
						href={`/${item.category?.slug ?? categorySlug}/${item.slug}`}
						className={cn(
							'border-border bg-card hover:border-primary inline-flex min-h-11 items-center gap-2 rounded-full border pr-4 text-sm font-semibold transition-colors',
							item.image ? 'pl-2' : 'pl-4'
						)}
					>
						{item.image && (
							// The admin's tile image, when there is one; decoration beside the label.
							<Image
								src={item.image}
								alt=''
								width={28}
								height={28}
								className='size-7 shrink-0 rounded-full object-cover'
							/>
						)}
						{item.category ? item.h1 : shortLabel(item.h1, categoryName ?? '')}
						{item.product_count !== null && (
							// One text for a screen reader and for a crawler reading the link —
							// «PLA, 64 товари»; the eye sees the figure alone. The spaces are the
							// link's own text: a flex row draws none, the text keeps them.
							<>
								<span className='sr-only'>,</span>{' '}
								<span className='text-muted-foreground text-[13px] font-normal'>
									{item.product_count}
								</span>{' '}
								<span className='sr-only'>
									{pluralUk(item.product_count, 'товар', 'товари', 'товарів')}
								</span>
							</>
						)}
					</Link>
				))}
			</div>
		</nav>
	)
}
