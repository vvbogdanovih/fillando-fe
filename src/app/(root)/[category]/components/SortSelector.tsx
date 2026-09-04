'use client'

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'

/**
 * The values the catalogue API understands. `newest` is its default, so it is represented by
 * the absence of the parameter rather than by `?sort=newest` — one ordering should not have two
 * URLs.
 */
export const SORT_OPTIONS = [
	{ value: 'newest', label: 'Спочатку нові' },
	{ value: 'price_asc', label: 'Спочатку дешевші' },
	{ value: 'price_desc', label: 'Спочатку дорожчі' }
] as const

export type SortValue = (typeof SORT_OPTIONS)[number]['value']

interface SortSelectorProps {
	value: SortValue
	/** `null` clears the parameter, which is what the default ordering means. */
	onChange: (sort: string | null) => void
}

export const SortSelector = ({ value, onChange }: SortSelectorProps) => {
	return (
		<div className='flex items-center gap-2'>
			<span className='text-muted-foreground text-sm whitespace-nowrap'>Сортування:</span>
			<Select value={value} onValueChange={next => onChange(next === 'newest' ? null : next)}>
				<SelectTrigger
					size='sm'
					className='w-[180px] bg-white text-black'
					aria-label='Порядок сортування товарів'
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{SORT_OPTIONS.map(option => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
