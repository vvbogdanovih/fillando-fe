'use client'

import { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import { attributeValueLabel } from '../filter-labels'
import { PriceRangeFilter } from './PriceRangeFilter'
import { AttributeFilter } from './AttributeFilter'
import { ColorFilter, type ColorOption } from './ColorFilter'

interface FilterSidebarProps {
	/** The dimensions with a control — pinned ones are excluded by the caller. */
	requiredAttributes: RequiredAttribute[]
	/** Every dimension of the category, pinned included: the pinned chips need their labels. */
	allAttributes: RequiredAttribute[]
	priceRange: { min: number; max: number }
	filterOptions: Record<string, string[]>
	colorOptions: ColorOption[]
	/** Dimensions the landing fixes: shown, but not adjustable. */
	pinnedFilters?: Record<string, string[]>
	searchParams: Record<string, string>
	onParamsChange: (changes: Record<string, string | null>) => void
	idPrefix?: string
}

export const FilterSidebar = ({
	requiredAttributes,
	allAttributes,
	priceRange,
	filterOptions,
	colorOptions,
	pinnedFilters,
	searchParams,
	onParamsChange,
	idPrefix = ''
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
				{pinnedFilters && Object.keys(pinnedFilters).length > 0 && (
					<div className='px-4 py-4'>
						<p className='text-muted-foreground mb-2 text-sm font-medium'>
							Закріплено сторінкою
						</p>
						<div className='flex flex-wrap gap-1.5'>
							{Object.entries(pinnedFilters).map(([key, values]) => (
								<span
									key={key}
									className='border-border/60 text-muted-foreground rounded-full border px-2 py-1 text-xs'
								>
									{allAttributes.find(a => a.key === key)?.label ?? key}:{' '}
									{values.map(v => attributeValueLabel(key, v)).join(', ')}
								</span>
							))}
						</div>
					</div>
				)}
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
				{/* Colour sits above the attribute filters: it is the dimension shoppers reach
				    for first, and it lives on the variant rather than in `attributes`. */}
				{colorOptions.length > 0 && (
					<div className='px-4 py-4'>
						<ColorFilter
							options={colorOptions}
							currentValue={searchParams.color_family ?? ''}
							onChange={value => onParamsChange({ color_family: value || null })}
							idPrefix={idPrefix}
						/>
					</div>
				)}
				{requiredAttributes.map(attr => (
					<div key={attr.key} className='px-4 py-4'>
						<AttributeFilter
							attribute={attr}
							options={filterOptions[attr.key] ?? []}
							currentValue={searchParams[attr.key] ?? ''}
							onChange={value => onParamsChange({ [attr.key]: value || null })}
							idPrefix={idPrefix}
						/>
					</div>
				))}
			</div>
		</div>
	)
}
