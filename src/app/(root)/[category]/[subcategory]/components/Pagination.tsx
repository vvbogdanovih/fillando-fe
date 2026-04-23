'use client'

import { cn } from '@/common/utils/shad-cn.utils'
import { Button } from '@/common/components/ui/button'

interface PaginationProps {
	pagination: { total: number; page: number; limit: number; totalPages: number }
	onPageChange: (page: number) => void
}

export const Pagination = ({ pagination, onPageChange }: PaginationProps) => {
	const { page, totalPages } = pagination

	const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
		p => p === 1 || p === totalPages || Math.abs(p - page) <= 2
	)

	const withEllipsis: (number | 'ellipsis')[] = []
	pages.forEach((p, i) => {
		if (i > 0 && p - pages[i - 1] > 1) withEllipsis.push('ellipsis')
		withEllipsis.push(p)
	})

	return (
		<div className='mt-8 flex items-center justify-center gap-1'>
			<Button
				variant='outline'
				size='sm'
				onClick={() => onPageChange(page - 1)}
				disabled={page === 1}
			>
				←
			</Button>
			{withEllipsis.map((item, i) =>
				item === 'ellipsis' ? (
					<span key={`e-${i}`} className='text-muted-foreground px-2 text-sm'>
						…
					</span>
				) : (
					<Button
						key={item}
						variant={item === page ? 'default' : 'outline'}
						size='sm'
						className={cn('min-w-9', item === page && 'pointer-events-none')}
						onClick={() => onPageChange(item)}
					>
						{item}
					</Button>
				)
			)}
			<Button
				variant='outline'
				size='sm'
				onClick={() => onPageChange(page + 1)}
				disabled={page === totalPages}
			>
				→
			</Button>
		</div>
	)
}
