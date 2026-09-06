'use client'

import { useState } from 'react'
import { Checkbox } from '@/common/components/ui/checkbox'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import { productsCount } from '@/common/utils'
import { attributeValueLabel } from '../filter-labels'
import type { FacetValue } from '../catalog.api'

/** Values shown before «Показати ще»; the artboard's longest group has six. */
export const VISIBLE_LIMIT = 8
/** A search box appears above the list once it is longer than this. */
export const SEARCH_THRESHOLD = 10

interface AttributeFilterProps {
	attribute: RequiredAttribute
	/** Every value of the category, in server order, with its narrowed count (TD-0008 §5.3). */
	options: FacetValue[]
	/** Comma-separated values from the URL, exactly as `?<key>=` carries them. */
	currentValue: string
	onChange: (value: string) => void
	idPrefix?: string
}

/**
 * One filter dimension as a list of checkboxes. The heading lives on the accordion trigger in
 * `FilterSidebar`, so this renders the list only.
 *
 * Three things the list does on top of ticking values:
 *
 * - **A count after every value**, from the facets: how many variants carry it under every other
 *   active filter. Zero is kept, muted and still clickable — hiding it would make the list jump
 *   on every click, and a deep link to such a combination would otherwise show an empty grid
 *   with no explanation. The tooltip says what the number means; it is not "what you will get",
 *   because within a dimension the filter is an OR.
 * - **«Показати ще N»** after `VISIBLE_LIMIT` values, and **a search box** above
 *   `SEARCH_THRESHOLD`, matching the shopper's label and the raw value alike.
 * - **A selected value is always visible**, whatever the search or the limit says: a tick the
 *   shopper cannot see is a tick they cannot remove.
 *
 * `filter_type: 'range'` renders the same list; no dimension has the numeric spread a slider
 * needs (TD-0008 §3.3), and an unrendered dimension would silently vanish from the sidebar.
 */
export const AttributeFilter = ({
	attribute,
	options,
	currentValue,
	onChange,
	idPrefix = ''
}: AttributeFilterProps) => {
	const [query, setQuery] = useState('')
	const [expanded, setExpanded] = useState(false)

	const selected = currentValue ? currentValue.split(',').filter(Boolean) : []

	const toggle = (option: string) => {
		const next = selected.includes(option)
			? selected.filter(v => v !== option)
			: [...selected, option]
		onChange(next.join(','))
	}

	if (options.length === 0) return null

	const searchable = options.length > SEARCH_THRESHOLD
	const needle = query.trim().toLowerCase()
	const matches = (option: FacetValue) =>
		needle === '' ||
		option.value.toLowerCase().includes(needle) ||
		attributeValueLabel(attribute.key, option.value).toLowerCase().includes(needle)

	const searched = options.filter(matches)
	const collapsible = !needle && searched.length > VISIBLE_LIMIT
	const visible =
		collapsible && !expanded
			? searched.filter(
					(option, index) => index < VISIBLE_LIMIT || selected.includes(option.value)
				)
			: searched
	// Selected values the search hid: shown first, so they can still be unticked.
	const hiddenSelected = options.filter(
		option => selected.includes(option.value) && !visible.includes(option)
	)
	const rows = [...hiddenSelected, ...visible]
	const remaining = searched.length - visible.length

	return (
		<div className='space-y-2'>
			{searchable && (
				<Input
					type='search'
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder='Пошук у групі'
					aria-label={`Пошук у групі «${attribute.label}»`}
					className='h-8 text-sm'
				/>
			)}
			{rows.length === 0 && (
				<p className='text-muted-foreground text-sm'>Нічого не знайдено</p>
			)}
			<div className='space-y-1.5'>
				{rows.map(option => {
					const id = `${idPrefix}${attribute.key}-${option.value}`
					const isZero = option.count === 0
					return (
						<div
							key={option.value}
							className='flex items-center gap-2'
							title={
								option.count === null
									? undefined
									: `${productsCount(option.count)} із цим значенням`
							}
						>
							<Checkbox
								id={id}
								checked={selected.includes(option.value)}
								onCheckedChange={() => toggle(option.value)}
							/>
							<Label
								htmlFor={id}
								className={`cursor-pointer text-sm font-normal ${
									isZero ? 'text-muted-foreground' : ''
								}`}
							>
								{attributeValueLabel(attribute.key, option.value)}
								{attribute.unit ? ` ${attribute.unit}` : ''}
								{option.count !== null && (
									<span className='text-muted-foreground ml-1'>
										({option.count})
									</span>
								)}
							</Label>
						</div>
					)
				})}
			</div>
			{collapsible && (
				<button
					type='button'
					onClick={() => setExpanded(open => !open)}
					className='text-primary text-sm hover:underline'
				>
					{expanded ? 'Згорнути' : `Показати ще ${remaining}`}
				</button>
			)}
		</div>
	)
}
