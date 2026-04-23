'use client'

import { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import { PriceRangeFilter } from './PriceRangeFilter'
import { AttributeFilter } from './AttributeFilter'

interface FilterSidebarProps {
	requiredAttributes: RequiredAttribute[]
	priceRange: { min: number; max: number }
	filterOptions: Record<string, string[]>
	searchParams: Record<string, string>
	onParamsChange: (changes: Record<string, string | null>) => void
}

export const FilterSidebar = ({
	requiredAttributes,
	priceRange,
	filterOptions,
	searchParams,
	onParamsChange
}: FilterSidebarProps) => {
	const currentMin =
		searchParams.price_min !== undefined ? Number(searchParams.price_min) : priceRange.min
	const currentMax =
		searchParams.price_max !== undefined ? Number(searchParams.price_max) : priceRange.max

	return (
		<div className='bg-card border-border/50 overflow-hidden rounded-xl border shadow-lg shadow-black/10'>
			<div className='border-border/50 border-b px-4 py-3'>
				<h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
					Фільтри
				</h2>
			</div>
			<div className='divide-border/50 divide-y'>
				<div className='px-4 py-4'>
					<PriceRangeFilter
						min={priceRange.min}
						max={priceRange.max}
						currentMin={currentMin}
						currentMax={currentMax}
						onChange={(min, max) =>
							onParamsChange({ price_min: String(min), price_max: String(max) })
						}
					/>
				</div>
				{requiredAttributes.map(attr => (
					<div key={attr.key} className='px-4 py-4'>
						<AttributeFilter
							attribute={attr}
							options={filterOptions[attr.key] ?? []}
							currentValue={searchParams[attr.key] ?? ''}
							onChange={value => onParamsChange({ [attr.key]: value || null })}
						/>
					</div>
				))}
			</div>
		</div>
	)
}
