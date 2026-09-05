'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from '@/common/components/ui/dropdown-menu'
import { ColorSwatch } from '@/common/components/ColorSwatch'
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
	/** «Колір», «Довжина» — whatever the product calls its axis. */
	axisLabel: string
}

/**
 * Choosing between a product's variants — swatches when the axis is colour, a dropdown when it
 * is anything else.
 *
 * It sits above the buy button, not below it: the colour is part of the decision, and a
 * shopper who picks one after pressing «Додати в кошик» has added the wrong thing (Plan-0005
 * C5). Out-of-stock variants stay reachable but muted, which the dropdown already did and the
 * swatch row keeps — the mock does not show that state, and losing it would hide half the
 * catalogue's reality.
 */
export const VariantSwitcher = ({ variants, currentSlug, axisLabel }: VariantSwitcherProps) => {
	const router = useRouter()

	// Swatches only where every variant resolved to a dictionary colour: a half-painted row
	// would read as "these three have no colour" rather than "the dictionary has a gap".
	const useSwatches = variants.length > 1 && variants.every(v => v.color)
	const current = variants.find(v => v.slug === currentSlug)

	if (variants.length <= 1) return null

	if (useSwatches) {
		return (
			<div>
				<p className='text-muted-foreground mb-2 text-sm'>
					{axisLabel}:{' '}
					<span className='text-foreground font-medium'>
						{current ? variantLabel(current) : ''}
					</span>
				</p>
				<div className='flex flex-wrap gap-2'>
					{variants.map(sibling => {
						const label = variantLabel(sibling) ?? sibling.name
						const isCurrent = sibling.slug === currentSlug
						const isOut = sibling.stock <= 0
						return (
							<button
								key={sibling.id}
								type='button'
								onClick={() => router.push(`/products/${sibling.slug}`)}
								title={isOut ? `${label} — немає в наявності` : label}
								aria-label={label}
								aria-current={isCurrent ? 'true' : undefined}
								className={cn(
									'flex size-10 items-center justify-center rounded-full ring-2 ring-offset-2 transition-all',
									isCurrent
										? 'ring-green-600'
										: 'ring-transparent hover:ring-gray-300',
									isOut && 'opacity-40'
								)}
							>
								<ColorSwatch
									hexStops={sibling.color?.hex_stops ?? []}
									family={sibling.color?.family}
									size={32}
									title={label}
								/>
							</button>
						)
					})}
				</div>
			</div>
		)
	}

	return (
		<div>
			<p className='text-muted-foreground mb-2 text-sm'>{axisLabel}:</p>
			<DropdownMenu>
				<DropdownMenuTrigger className='border-input flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus:outline-none focus-visible:outline-none'>
					<span>{current ? (variantLabel(current) ?? current.name) : ''}</span>
					<ChevronDown className='size-4 opacity-50' />
				</DropdownMenuTrigger>
				<DropdownMenuContent
					className='max-h-[360px] min-w-(--radix-dropdown-menu-trigger-width) bg-white'
					align='start'
					sideOffset={4}
				>
					<DropdownMenuRadioGroup
						value={currentSlug}
						onValueChange={slug => router.push(`/products/${slug}`)}
					>
						{variants.map(sibling => (
							<DropdownMenuRadioItem
								key={sibling.id}
								value={sibling.slug}
								className={sibling.stock <= 0 ? 'text-muted-foreground/50' : ''}
							>
								{variantLabel(sibling) ?? sibling.name}
								{sibling.stock <= 0 && (
									<span className='text-muted-foreground/40 ml-2 text-xs'>
										— немає в наявності
									</span>
								)}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
