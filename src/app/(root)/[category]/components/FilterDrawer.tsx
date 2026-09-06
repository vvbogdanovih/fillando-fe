'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { productsCount } from '@/common/utils'

interface FilterDrawerProps {
	open: boolean
	onClose: () => void
	/**
	 * Products in the current narrowing — `pagination.total` of the listing query, the same
	 * figure as the «Знайдено» line. `undefined` while nothing has loaded yet.
	 */
	total: number | undefined
	/** A new set of filters is on its way: the number on the button is stale until it lands. */
	isFetching: boolean
	/** Removes every filter the shopper set; omitted when there is nothing to remove. */
	onClearAll?: () => void
	/** Shown at every width (a landing has no sidebar column), or below `md` only. */
	alwaysAvailable?: boolean
	children: ReactNode
}

/**
 * The mobile filter drawer: header, a scrolling body for the sidebar, and a sticky footer with
 * «Показати N товарів».
 *
 * Filters apply the moment they are ticked (the URL is the only state), so the button does not
 * *apply* anything — it confirms and closes, and its number is what the shopper will find behind
 * it. While a fetch is in flight that number would be the previous narrowing's, so the button
 * drops it and says so with `aria-busy` (TD-0008 §5.4.5).
 */
export const FilterDrawer = ({
	open,
	onClose,
	total,
	isFetching,
	onClearAll,
	alwaysAvailable = false,
	children
}: FilterDrawerProps) => {
	const visibility = alwaysAvailable ? '' : 'md:hidden'
	const showCount = !isFetching && total !== undefined

	return (
		<div
			className={`fixed inset-0 z-50 ${visibility} ${
				open ? 'pointer-events-auto' : 'pointer-events-none'
			}`}
			aria-hidden={!open}
		>
			<div
				className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
					open ? 'opacity-100' : 'opacity-0'
				}`}
				onClick={onClose}
			/>
			<div
				role='dialog'
				aria-modal='true'
				aria-label='Фільтри'
				className={`bg-background absolute top-0 bottom-0 left-0 flex w-80 max-w-[85vw] flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
					open ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				<div className='border-border/50 flex items-center justify-between border-b px-4 py-3'>
					<span className='text-sm font-semibold'>Фільтри</span>
					<button
						type='button'
						className='text-muted-foreground hover:text-foreground transition-colors'
						onClick={onClose}
						aria-label='Закрити фільтри'
					>
						<X size={20} />
					</button>
				</div>
				<div className='min-h-0 flex-1 overflow-y-auto p-4' data-lenis-prevent>
					{children}
				</div>
				<div className='border-border/50 bg-background flex items-center gap-3 border-t px-4 py-3'>
					<button
						type='button'
						onClick={onClose}
						aria-busy={isFetching}
						className='bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors'
					>
						{showCount ? `Показати ${productsCount(total)}` : 'Показати товари'}
					</button>
					{onClearAll && (
						<button
							type='button'
							onClick={onClearAll}
							className='text-muted-foreground hover:text-foreground shrink-0 text-sm underline-offset-4 transition-colors hover:underline'
						>
							Очистити
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
