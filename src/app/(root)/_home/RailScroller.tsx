'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/common/utils/shad-cn.utils'

/** «Новинки»: two cards and a hint of the third on a phone, three from `sm`, four from `md`, six from `lg`. */
const WIDE_ROW =
	'auto-cols-[44%] sm:auto-cols-[30%] md:auto-cols-[calc((100%-3*0.75rem)/4)] lg:auto-cols-[calc((100%-5*0.75rem)/6)]'

/**
 * One row of cards that scrolls sideways (TD-0015): a finger swipes it, a computer has arrows.
 * The cards are server HTML in the row; only the arrows need the browser. An arrow with nowhere to
 * go is not shown (owner, 2026-11-14): «назад» stood over the first card of a row nobody had
 * scrolled yet. Hidden, not unmounted — the button under the pointer must not lose its focus to
 * the page when the row reaches its end.
 *
 * `columns` is how wide a card is at each breakpoint — the row of «Новинки» by default; a row that
 * shares its width with something else (a shelf's cover) says its own.
 */
export function RailScroller({
	label,
	columns = WIDE_ROW,
	children
}: {
	label: string
	columns?: string
	children: ReactNode
}) {
	const row = useRef<HTMLDivElement>(null)
	// The server's guess: at the start, with more to the right.
	const [edge, setEdge] = useState({ start: true, end: false })
	const measure = () => {
		const el = row.current
		if (!el) return
		const start = el.scrollLeft <= 1
		const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1
		setEdge(now => (now.start === start && now.end === end ? now : { start, end }))
	}
	useEffect(() => {
		measure()
		const el = row.current
		if (!el || typeof ResizeObserver === 'undefined') return
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	const scroll = (direction: number) =>
		row.current?.scrollBy({
			left: direction * row.current.clientWidth * 0.8,
			behavior: 'smooth'
		})
	const arrow =
		'bg-card hover:bg-muted absolute top-1/3 z-10 hidden h-10 w-10 items-center justify-center rounded-full border shadow-md transition-colors md:flex'
	return (
		<div className='relative'>
			<button
				type='button'
				aria-label={`${label}: попередні`}
				onClick={() => scroll(-1)}
				disabled={edge.start}
				className={cn(arrow, '-left-4', edge.start && 'invisible')}
			>
				<ChevronLeft className='size-5' aria-hidden />
			</button>
			<div
				ref={row}
				role='region'
				aria-label={label}
				tabIndex={0}
				// The page's smooth scroll (Lenis) takes every wheel event that has a vertical part,
				// and a sideways swipe on a touchpad has one: the row moved in jerks.
				data-lenis-prevent-horizontal
				onScroll={measure}
				className={cn(
					'grid snap-x snap-mandatory grid-flow-col gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
					columns
				)}
			>
				{children}
			</div>
			<button
				type='button'
				aria-label={`${label}: наступні`}
				onClick={() => scroll(1)}
				disabled={edge.end}
				className={cn(arrow, '-right-4', edge.end && 'invisible')}
			>
				<ChevronRight className='size-5' aria-hidden />
			</button>
		</div>
	)
}
