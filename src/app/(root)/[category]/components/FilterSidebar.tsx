'use client'

import { useState } from 'react'
import { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@/common/components/ui/accordion'
import { attributeValueLabel } from '../filter-labels'
import type { FacetValue } from '../catalog.api'
import { PriceRangeFilter } from './PriceRangeFilter'
import { AttributeFilter } from './AttributeFilter'
import { ColorFilter, type ColorOption } from './ColorFilter'

interface FilterSidebarProps {
	/** The dimensions with a control — pinned ones are excluded by the caller. */
	requiredAttributes: RequiredAttribute[]
	/** Every dimension of the category, pinned included: the pinned chips need their labels. */
	allAttributes: RequiredAttribute[]
	priceRange: { min: number; max: number }
	/** Per dimension key, every value of the category with its narrowed count. */
	facets: Record<string, FacetValue[]>
	colorOptions: ColorOption[]
	/** Dimensions the landing fixes: shown, but not adjustable. */
	pinnedFilters?: Record<string, string[]>
	searchParams: Record<string, string>
	onParamsChange: (changes: Record<string, string | null>) => void
	idPrefix?: string
}

const PRICE_GROUP = 'price'
const COLOR_GROUP = 'color_family'

/** Fewer values than this and the group filters nothing, so it is not shown (TD-0008 §3.3). */
const MIN_VALUES = 2

/**
 * The filter groups as an accordion, every group open until the shopper closes it.
 *
 * The accordion is controlled and remembers the groups that are *closed*, not the ones that are
 * open: the list of groups changes after the first render — the SSR page carries no facets on a
 * client navigation, and the compatibility fallback can add groups later — and a group that
 * appears after mount must arrive open, which an uncontrolled `defaultValue` (read once) would
 * not give it. Nothing here reaches the URL; it is screen state only (TD-0002 §5.4 stays intact).
 *
 * A dimension with fewer than two values in the category is not rendered at all: one checkbox
 * that cannot narrow anything is worse than none. That is why «Діаметр» (always `1.75`) is
 * absent, and why «Котушка в комплекті» stays absent until the refill split gives it a second
 * value — the rule follows the data. It is judged over the category, not the narrowing, so a
 * group never disappears under the shopper's cursor; on a landing this can show a group whose
 * every value is zero, which is the honest answer («армованого TPU немає»).
 */
export const FilterSidebar = ({
	requiredAttributes,
	allAttributes,
	priceRange,
	facets,
	colorOptions,
	pinnedFilters,
	searchParams,
	onParamsChange,
	idPrefix = ''
}: FilterSidebarProps) => {
	const [closed, setClosed] = useState<string[]>([])

	const currentMin =
		searchParams.price_min !== undefined ? Number(searchParams.price_min) : priceRange.min
	const currentMax =
		searchParams.price_max !== undefined ? Number(searchParams.price_max) : priceRange.max

	const shownAttributes = requiredAttributes.filter(
		attr => (facets[attr.key] ?? []).length >= MIN_VALUES
	)
	const showColor = colorOptions.length >= MIN_VALUES

	const groups = [
		PRICE_GROUP,
		...(showColor ? [COLOR_GROUP] : []),
		...shownAttributes.map(attr => attr.key)
	]
	const open = groups.filter(group => !closed.includes(group))

	const selectedCount = (key: string) =>
		(searchParams[key] ?? '').split(',').filter(Boolean).length

	const trigger = (label: string, count: number) => (
		<AccordionTrigger className='py-3 text-sm font-semibold hover:no-underline'>
			<span>
				{label}
				{count > 0 && <span className='text-primary ml-1.5 font-normal'>· {count}</span>}
			</span>
		</AccordionTrigger>
	)

	return (
		<div className='bg-card border-border/50 overflow-hidden rounded-xl border shadow-lg shadow-black/10'>
			<div className='border-border/50 border-b px-4 py-3'>
				<h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
					Фільтри
				</h2>
			</div>
			{pinnedFilters && Object.keys(pinnedFilters).length > 0 && (
				<div className='border-border/50 border-b px-4 py-4'>
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
			<Accordion
				type='multiple'
				value={open}
				onValueChange={next => setClosed(groups.filter(group => !next.includes(group)))}
				className='px-4'
			>
				<AccordionItem value={PRICE_GROUP} className='border-border/50'>
					{trigger(
						'Ціна',
						searchParams.price_min !== undefined || searchParams.price_max !== undefined
							? 1
							: 0
					)}
					<AccordionContent>
						<PriceRangeFilter
							min={priceRange.min}
							max={priceRange.max}
							currentMin={currentMin}
							currentMax={currentMax}
							onChange={(min, max) =>
								onParamsChange({ price_min: String(min), price_max: String(max) })
							}
						/>
					</AccordionContent>
				</AccordionItem>
				{/* Colour sits above the attribute filters: it is the dimension shoppers reach
				    for first, and it lives on the variant rather than in `attributes`. */}
				{showColor && (
					<AccordionItem value={COLOR_GROUP} className='border-border/50'>
						{trigger('Колір', selectedCount(COLOR_GROUP))}
						<AccordionContent>
							<ColorFilter
								options={colorOptions}
								currentValue={searchParams.color_family ?? ''}
								onChange={value => onParamsChange({ color_family: value || null })}
								idPrefix={idPrefix}
								showLegend={false}
							/>
						</AccordionContent>
					</AccordionItem>
				)}
				{shownAttributes.map(attr => (
					<AccordionItem key={attr.key} value={attr.key} className='border-border/50'>
						{trigger(attr.label, selectedCount(attr.key))}
						<AccordionContent>
							<AttributeFilter
								attribute={attr}
								options={facets[attr.key] ?? []}
								currentValue={searchParams[attr.key] ?? ''}
								onChange={value => onParamsChange({ [attr.key]: value || null })}
								idPrefix={idPrefix}
							/>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	)
}
