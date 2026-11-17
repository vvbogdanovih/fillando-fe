'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { UI_URLS } from '@/common/constants/ui-routes.constants'
import { cn } from '@/common/utils/shad-cn.utils'
import { variantLabel, type PublicColor } from '@/common/utils/color.utils'

export interface SwitchableVariant {
	id: string
	name: string
	slug: string
	stock: number
	v_value: string | null
	color: PublicColor | null
}
interface VariantSwitcherProps {
	variants: SwitchableVariant[]
	currentSlug: string
	axisLabel: string
}

/** All choices have real hrefs in the initial HTML, including non-colour variants. */
export const VariantSwitcher = ({ variants, currentSlug, axisLabel }: VariantSwitcherProps) => {
	if (variants.length <= 1) return null
	const current = variants.find(v => v.slug === currentSlug)
	const useSwatches = variants.every(v => v.color)
	const choices = variants.map(sibling => {
		const label = variantLabel(sibling) ?? sibling.name
		const isOut = sibling.stock <= 0
		const isCurrent = sibling.slug === currentSlug
		const hint = isOut ? `${label} — немає в наявності` : label
		return (
			<Link
				key={sibling.id}
				href={UI_URLS.PRODUCT(sibling.slug)}
				prefetch={false}
				title={hint}
				aria-label={label}
				aria-current={isCurrent ? 'page' : undefined}
				className={cn(
					useSwatches
						? 'flex size-10 items-center justify-center rounded-full ring-2 ring-offset-2 transition-all'
						: 'flex items-center rounded-md px-3 py-2 text-sm hover:bg-gray-100',
					useSwatches &&
						(isCurrent ? 'ring-green-600' : 'ring-transparent hover:ring-gray-300'),
					!useSwatches && isCurrent && 'bg-gray-100 font-medium',
					isOut && 'opacity-40'
				)}
			>
				{useSwatches ? (
					<ColorSwatch
						hexStops={sibling.color?.hex_stops ?? []}
						family={sibling.color?.family}
						size={32}
						title={hint}
					/>
				) : (
					<>
						{label}
						{isOut && <span className='ml-2 text-xs'>— немає в наявності</span>}
					</>
				)}
			</Link>
		)
	})
	return (
		<div>
			<p className='text-muted-foreground mb-2 text-sm'>
				{axisLabel}:
				{useSwatches && (
					<span className='text-foreground ml-1 font-medium'>
						{current ? variantLabel(current) : ''}
					</span>
				)}
			</p>
			{useSwatches ? (
				<div className='flex flex-wrap gap-2'>{choices}</div>
			) : (
				<details className='group rounded-md border'>
					<summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm [&::-webkit-details-marker]:hidden'>
						<span>
							{current ? (variantLabel(current) ?? current.name) : 'Оберіть варіант'}
						</span>
						<ChevronDown className='size-4 opacity-50 group-open:rotate-180' />
					</summary>
					<nav
						aria-label={axisLabel}
						className='max-h-[360px] overflow-y-auto border-t p-1'
					>
						{choices}
					</nav>
				</details>
			)}
		</div>
	)
}
