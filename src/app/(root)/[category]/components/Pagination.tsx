'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/common/utils/shad-cn.utils'
import { buttonVariants } from '@/common/components/ui/button'

interface PaginationProps {
	pagination: { total: number; page: number; limit: number; totalPages: number }
}

/**
 * Pages are `<Link href>`, not buttons.
 *
 * A crawler follows anchors; it does not click. While these were `<button onClick>` calling
 * `router.replace`, page 2 and beyond existed only after a click, so nothing past the first
 * page of any category was reachable — and `replace` also meant the back button skipped over
 * every page the visitor had walked through.
 *
 * The component builds its own hrefs from the current URL rather than taking a callback: the
 * catalogue and the search page had identical copies of that logic, and the only thing worse
 * than one place to get pagination URLs wrong is two.
 */
export const Pagination = ({ pagination }: PaginationProps) => {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const { page, totalPages } = pagination

	const hrefForPage = (target: number) => {
		const next = new URLSearchParams(searchParams.toString())
		// Page 1 is the bare address. Keeping `?page=1` would give the canonical page a second
		// URL for Google to pick between.
		if (target <= 1) next.delete('page')
		else next.set('page', String(target))
		const query = next.toString()
		return query ? `${pathname}?${query}` : pathname
	}

	const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
		p => p === 1 || p === totalPages || Math.abs(p - page) <= 2
	)

	const withEllipsis: (number | 'ellipsis')[] = []
	pages.forEach((p, i) => {
		if (i > 0 && p - pages[i - 1] > 1) withEllipsis.push('ellipsis')
		withEllipsis.push(p)
	})

	const linkClass = (isCurrent: boolean, extra?: string) =>
		cn(
			buttonVariants({ variant: isCurrent ? 'default' : 'outline', size: 'sm' }),
			isCurrent && 'pointer-events-none',
			extra
		)

	/** At the ends there is nowhere to go, so render a disabled control instead of a dead link. */
	const edgeClass = cn(
		buttonVariants({ variant: 'outline', size: 'sm' }),
		'pointer-events-none opacity-50'
	)

	return (
		<nav className='flex items-center justify-center gap-1' aria-label='Сторінки каталогу'>
			{page > 1 ? (
				<Link
					href={hrefForPage(page - 1)}
					rel='prev'
					aria-label='Попередня сторінка'
					className={buttonVariants({ variant: 'outline', size: 'sm' })}
				>
					←
				</Link>
			) : (
				<span className={edgeClass} aria-hidden='true'>
					←
				</span>
			)}

			{withEllipsis.map((item, i) =>
				item === 'ellipsis' ? (
					<span key={`e-${i}`} className='text-muted-foreground px-2 text-sm'>
						…
					</span>
				) : (
					<Link
						key={item}
						href={hrefForPage(item)}
						aria-label={`Сторінка ${item}`}
						aria-current={item === page ? 'page' : undefined}
						className={linkClass(item === page, 'min-w-9')}
					>
						{item}
					</Link>
				)
			)}

			{page < totalPages ? (
				<Link
					href={hrefForPage(page + 1)}
					rel='next'
					aria-label='Наступна сторінка'
					className={buttonVariants({ variant: 'outline', size: 'sm' })}
				>
					→
				</Link>
			) : (
				<span className={edgeClass} aria-hidden='true'>
					→
				</span>
			)}
		</nav>
	)
}
