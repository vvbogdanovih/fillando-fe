'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { pluralUk, productsCount } from '@/common/utils'

export interface PopularLanding {
	slug: string
	h1: string
	image: string | null
	/** null when the backend did not send one — a tile reading "0 товарів" would be a lie. */
	product_count: number | null
}

interface PopularLandingsProps {
	categorySlug: string
	categoryName: string
	landings: PopularLanding[]
}

/** Five across, two rows — the tenth tile is «Ще N видів» when there are more. */
const VISIBLE = 9

/**
 * A stable accent per tile. There is no colour on a landing to read, and the artboard's dots
 * are a visual marker rather than data, so the hue is derived from the slug: the same landing
 * always gets the same dot, and neighbouring tiles do not collide.
 */
const DOT_COLORS = [
	'#2f855a',
	'#3182ce',
	'#805ad5',
	'#d69e2e',
	'#dd6b20',
	'#e53e3e',
	'#319795',
	'#b83280'
]
const dotColor = (slug: string) => {
	let hash = 0
	for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) % 100003
	return DOT_COLORS[hash % DOT_COLORS.length]
}

/**
 * The tile label: the H1 without a trailing mention of the category.
 *
 * «PLA філамент» in a category called «Філамент» is a tile that says «PLA» — which is what the
 * artboard shows and what fits a 5-across grid. Nothing else is guessed: an H1 the rule cannot
 * shorten («Філамент, що світиться») is printed whole rather than cut somewhere arbitrary. A
 * landing that wants a different short label needs a field of its own; there is none yet.
 */
export const shortLabel = (h1: string, categoryName: string): string => {
	const trimmed = h1
		.replace(new RegExp(`[\\s—–-]*${escapeRegExp(categoryName)}\\s*$`, 'i'), '')
		.trim()
	return trimmed.length > 0 ? trimmed : h1
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const PopularLandings = ({ categorySlug, categoryName, landings }: PopularLandingsProps) => {
	const [expanded, setExpanded] = useState(false)

	if (landings.length === 0) return null

	const hidden = landings.length - VISIBLE
	const shown = expanded || hidden <= 0 ? landings : landings.slice(0, VISIBLE)

	return (
		<nav aria-label='Популярні види' className='mb-8'>
			<h2 className='text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase'>
				Популярні види
			</h2>
			<div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
				{shown.map(item => (
					<Link
						key={item.slug}
						href={`/${categorySlug}/${item.slug}`}
						className='border-border/50 bg-card hover:border-primary group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors'
					>
						{item.image ? (
							<Image
								src={item.image}
								alt=''
								width={32}
								height={32}
								className='size-8 shrink-0 rounded object-cover'
							/>
						) : (
							<span
								aria-hidden
								className='size-3 shrink-0 rounded-full'
								style={{ background: dotColor(item.slug) }}
							/>
						)}
						<span className='min-w-0'>
							<span className='group-hover:text-primary block truncate text-sm font-medium transition-colors'>
								{shortLabel(item.h1, categoryName)}
							</span>
							{item.product_count !== null && (
								<span className='text-muted-foreground block text-xs'>
									{productsCount(item.product_count)}
								</span>
							)}
						</span>
					</Link>
				))}

				{hidden > 0 && !expanded && (
					<button
						type='button'
						onClick={() => setExpanded(true)}
						className='border-border/50 text-muted-foreground hover:border-primary hover:text-primary rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors'
					>
						Ще {hidden} {pluralUk(hidden, 'вид', 'види', 'видів')}
					</button>
				)}
			</div>
		</nav>
	)
}
