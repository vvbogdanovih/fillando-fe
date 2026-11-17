'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Checkbox } from '@/common/components/ui/checkbox'
import { Input } from '@/common/components/ui/input'
import { Slider } from '@/common/components/ui/slider'
import { Label } from '@/common/components/ui/label'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { FAMILY_LABELS } from '@/app/(root)/[category]/components/ColorFilter'
import {
	COLOR_FAMILIES,
	parseBound,
	valueLabel,
	withAttribute,
	type BoundKind,
	type TypedFilterState
} from '../typed-filters'
import type {
	AttributeFacet,
	CountFacet,
	PublicDefinition,
	TypedCatalogResponse,
	TypedScalar
} from '../typed-catalog.types'

interface TypedFiltersProps {
	definitions: PublicDefinition[]
	facets: TypedCatalogResponse['facets'] | null
	filters: TypedFilterState
	onChange: (filters: TypedFilterState) => void
	idPrefix?: string
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
	<fieldset className='border-border/50 border-b pb-4 last:border-b-0 last:pb-0'>
		<legend className='mb-3 text-sm font-semibold'>{title}</legend>
		{children}
	</fieldset>
)

function CheckList<T extends string | number | boolean>({
	idPrefix,
	name,
	options,
	selected,
	onToggle
}: {
	idPrefix: string
	name: string
	options: { value: T; label: string; count: number }[]
	selected: T[]
	onToggle: (value: T) => void
}) {
	return (
		<ul className='space-y-2'>
			{options.map(option => {
				const id = `${idPrefix}${name}-${String(option.value)}`
				const checked = selected.includes(option.value)
				return (
					<li key={String(option.value)} className='flex items-center gap-2'>
						<Checkbox
							id={id}
							checked={checked}
							onCheckedChange={() => onToggle(option.value)}
						/>
						<Label
							htmlFor={id}
							className={`flex flex-1 cursor-pointer justify-between gap-2 text-sm font-normal ${
								option.count === 0 && !checked ? 'text-muted-foreground' : ''
							}`}
						>
							<span>{option.label}</span>
							{/* Counted under every other active filter, not this one (TD-0008). */}
							<span className='text-muted-foreground tabular-nums'>
								{option.count}
							</span>
						</Label>
					</li>
				)
			})}
		</ul>
	)
}

const boundText = (bound?: number) => (bound === undefined ? '' : String(bound))

/**
 * Two inclusive bounds, applied together. Free typing is local, so a half-typed number never
 * becomes an address or a request; the pair applies when the shopper is done with it — Enter, or
 * focus leaving both fields (a click elsewhere, Tab, a phone keypad's «Готово») — and the slider on
 * release. No «Застосувати» button (owner, 2026-11-14): every other filter here applies at once
 * (TD-0008), and a button beside a slider that already had applied read as doing nothing.
 *
 * The form is never recreated when the address changes (review 2026-11-14; it was keyed by the
 * address's bounds, so its own request coming back dropped the focus and whatever was being typed
 * in the other field). It keeps its text while the address says what it asked for, and takes the
 * address's bounds when the address changes to anything else — the range's chip, «Очистити все»,
 * the way back.
 */
function RangeInputs({
	idPrefix,
	name,
	kind,
	unit,
	bounds,
	value,
	address,
	onApply
}: {
	idPrefix: string
	name: string
	kind: BoundKind
	unit: string | null
	bounds: { min: number | null; max: number | null }
	/** The bounds in the address. */
	value: { min?: number; max?: number }
	/** Every filter of the address: a change of it is what the texts are checked against. */
	address: string
	onApply: (value: { min?: number; max?: number }) => void
}) {
	const [min, setMin] = useState(boundText(value.min))
	const [max, setMax] = useState(boundText(value.max))
	// The bounds this form last asked for: how its own request is told from someone else's change.
	const [sent, setSent] = useState(value)
	const [seen, setSeen] = useState(address)
	if (seen !== address) {
		setSeen(address)
		if (value.min !== sent.min || value.max !== sent.max) {
			setSent(value)
			setMin(boundText(value.min))
			setMax(boundText(value.max))
		}
	}
	// Only a bound the address reads back (`parseBound`): a price is never negative, a
	// characteristic may be — anything else would turn the listing's own URL into a 404.
	const parse = (text: string) => {
		const normalised = text.trim().replace(',', '.')
		if (!normalised) return undefined
		return parseBound(String(Number(normalised)), kind) ?? null
	}
	const from = parse(min)
	const to = parse(max)
	const invalid =
		from === null || to === null || (from !== undefined && to !== undefined && from > to)
	// Leaving the fields without a change asks for nothing — judged by the address, not by a note of
	// the last request: a request another navigation replaced never reached the address, and a field
	// compared with the note stayed silent until a digit changed. While a request is on its way (or
	// was lost) the pair is asked for again.
	const send = (next: { min?: number; max?: number }) => {
		const same = (pair: { min?: number; max?: number }) =>
			next.min === pair.min && next.max === pair.max
		if (same(value) && same(sent)) return
		setSent(next)
		onApply(next)
	}
	const apply = () => {
		if (!invalid) send({ min: from ?? undefined, max: to ?? undefined })
	}
	// The slider spans the scope's own bounds (self-excluding, so they hold still while
	// dragging). A thumb left at its end is no bound at all, so dragging back clears the filter
	// instead of writing `price.min=386` into the URL.
	const low = bounds.min
	const high = bounds.max
	const slidable = low !== null && high !== null && low < high
	const clamp = (number: number) => Math.min(high!, Math.max(low!, number))
	const step = slidable && Number.isInteger(low) && Number.isInteger(high) ? 1 : 0.01
	// A phone's decimal keypad has no minus: a full keyboard where the scope goes below zero.
	const inputMode = low !== null && low < 0 ? 'text' : 'decimal'
	const position = slidable
		? [clamp(typeof from === 'number' ? from : low), clamp(typeof to === 'number' ? to : high)]
		: []
	return (
		<form
			className='space-y-3'
			onSubmit={event => {
				event.preventDefault()
				apply()
			}}
			// Leaving the pair, not moving from «від» to «до» (or to a thumb) within it — and not the
			// window or the tab losing focus with the field still in it: «15» on the way to «150»
			// would apply behind the shopper's back.
			onBlur={event => {
				if (!document.hasFocus()) return
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) apply()
			}}
			// Two fields and no submit button: the browser submits nothing on Enter by itself.
			onKeyDown={event => {
				if (event.key === 'Enter' && event.target instanceof HTMLInputElement) apply()
			}}
		>
			{slidable && (
				<Slider
					className='py-2'
					min={low}
					max={high}
					step={step}
					minStepsBetweenThumbs={0}
					value={position}
					thumbLabels={[`${name}: від`, `${name}: до`]}
					onValueChange={([a, b]) => {
						setMin(a === low ? '' : String(a))
						setMax(b === high ? '' : String(b))
					}}
					onValueCommit={([a, b]) => {
						const start = parse(a === low ? '' : String(a))
						const end = parse(b === high ? '' : String(b))
						if (start !== null && end !== null) send({ min: start, max: end })
					}}
				/>
			)}
			<div className='flex items-center gap-2'>
				<Input
					id={`${idPrefix}${name}-min`}
					inputMode={inputMode}
					aria-label={`${name}: від`}
					placeholder={bounds.min === null ? 'від' : `від ${bounds.min}`}
					value={min}
					onChange={event => setMin(event.target.value)}
				/>
				<span aria-hidden>–</span>
				<Input
					id={`${idPrefix}${name}-max`}
					inputMode={inputMode}
					aria-label={`${name}: до`}
					placeholder={bounds.max === null ? 'до' : `до ${bounds.max}`}
					value={max}
					onChange={event => setMax(event.target.value)}
				/>
				{unit && <span className='text-muted-foreground text-sm'>{unit}</span>}
			</div>
			{invalid && (
				<p className='text-destructive text-xs'>Вкажіть числа від меншого до більшого</p>
			)}
		</form>
	)
}

const toggleIn = <T,>(list: T[], value: T) =>
	list.includes(value) ? list.filter(item => item !== value) : [...list, value]

const countOptions = (rows: CountFacet[]) =>
	rows.map(row => ({ value: row.id, label: row.label, count: row.count }))

/**
 * The typed catalogue's filters: price and availability on top (common to every scope), then the
 * category's own configuration (TD-0013 F07) — every filterable characteristic in the category
 * order, a list for discrete values and two bounds for a numeric range. A dimension with fewer
 * than two values over the scope is not offered unless something in it is already chosen — a
 * choice the shopper cannot see is a choice they cannot undo. There is no category dimension:
 * only a product category lists (the whole catalogue and groups are the hub, Plan-0010 P20).
 */
export function TypedFilters({
	definitions,
	facets,
	filters,
	onChange,
	idPrefix = ''
}: TypedFiltersProps) {
	const order = definitions.map(definition => definition.key)
	// What this panel last asked for. The address is the state, but it changes a round trip after
	// the request, and a typed range applies the moment its field loses focus — which is the very
	// click on the next control. That click must build on the range, not on the address still
	// rendered (two quick ticks likewise), so every change starts from the last request; the
	// address's own filters take over as soon as they change.
	const requested = useRef(filters)
	const rendered = JSON.stringify(filters)
	useEffect(() => {
		requested.current = filters
		// By content: the parent parses a new object on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rendered])
	const change = (update: (current: TypedFilterState) => TypedFilterState) => {
		const next = update(requested.current)
		requested.current = next
		onChange(next)
	}
	const facetFor = (key: string): AttributeFacet | undefined =>
		facets?.attributes.find(facet => facet.key === key)
	const sections: ReactNode[] = []

	// Price and availability come first: they exist for every category, group and the whole
	// catalogue (the backend counts them for any scope), unlike the category's own dimensions.
	const price = facets?.price
	if (
		(price && price.min !== null && price.max !== null && price.min < price.max) ||
		filters.price
	)
		sections.push(
			<Section key='price' title='Ціна, ₴'>
				<RangeInputs
					idPrefix={idPrefix}
					name='Ціна'
					kind='price'
					unit='₴'
					bounds={{ min: price?.min ?? null, max: price?.max ?? null }}
					value={filters.price ?? {}}
					address={rendered}
					onApply={range =>
						change(current => ({
							...current,
							price:
								range.min === undefined && range.max === undefined
									? undefined
									: range
						}))
					}
				/>
			</Section>
		)

	if (facets && (facets.in_stock.true > 0 || filters.in_stock))
		sections.push(
			<Section key='stock' title='Наявність'>
				<CheckList
					idPrefix={idPrefix}
					name='in_stock'
					options={[
						{ value: 'yes', label: 'Є в наявності', count: facets.in_stock.true }
					]}
					selected={filters.in_stock ? ['yes'] : []}
					onToggle={() =>
						change(current => ({
							...current,
							in_stock: current.in_stock ? undefined : true
						}))
					}
				/>
			</Section>
		)

	// Dictionary family order (black, white, gray…), the order shoppers know from the swatches.
	const colors = [...(facets?.colors ?? [])].sort(
		(a, b) =>
			(COLOR_FAMILIES as readonly string[]).indexOf(a.family) -
			(COLOR_FAMILIES as readonly string[]).indexOf(b.family)
	)
	// One order for the whole category (owner, 2026-11-07): the colour stands where the admin puts its
	// definition among the characteristics, as in the product's table and the price lists. Without a
	// colour definition (an older backend) it keeps its old place, after price and availability.
	const colourSection =
		colors.length > 1 || filters.color_families.length ? (
			<Section key='colors' title='Колір'>
				<ul className='space-y-2'>
					{colors.map(row => {
						const id = `${idPrefix}color-${row.family}`
						const checked = filters.color_families.includes(row.family)
						return (
							<li key={row.family} className='flex items-center gap-2'>
								<Checkbox
									id={id}
									checked={checked}
									onCheckedChange={() =>
										change(current => ({
											...current,
											color_families: toggleIn(
												current.color_families,
												row.family
											)
										}))
									}
								/>
								<Label
									htmlFor={id}
									className={`flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm font-normal ${
										row.count === 0 && !checked ? 'text-muted-foreground' : ''
									}`}
								>
									<span className='flex items-center gap-2'>
										<ColorSwatch
											hexStops={row.hex_stops}
											family={row.family}
											size={16}
										/>
										{FAMILY_LABELS[row.family] ?? row.family}
									</span>
									<span className='text-muted-foreground tabular-nums'>
										{row.count}
									</span>
								</Label>
							</li>
						)
					})}
				</ul>
			</Section>
		) : null
	const colourDefinition = definitions.some(definition => definition.semantic === 'color')
	if (colourSection && !colourDefinition) sections.push(colourSection)

	for (const definition of [...definitions].sort((a, b) => a.order - b.order)) {
		if (definition.semantic === 'color') {
			if (colourSection) sections.push(colourSection)
			continue
		}
		if (!definition.filter_enabled) continue
		const facet = facetFor(definition.key)
		const current = filters.attributes.find(filter => filter.key === definition.key)
		if (definition.filter_type === 'range') {
			const value: { min?: number; max?: number } =
				current && !('values' in current) ? current : {}
			const spread =
				facet && facet.min !== null && facet.max !== null && facet.min < facet.max
			if (!spread && !current) continue
			sections.push(
				<Section
					key={definition.key}
					title={
						definition.unit
							? `${definition.label}, ${definition.unit}`
							: definition.label
					}
				>
					<RangeInputs
						idPrefix={idPrefix}
						name={definition.label}
						kind='attribute'
						unit={null}
						bounds={{ min: facet?.min ?? null, max: facet?.max ?? null }}
						value={value}
						address={rendered}
						onApply={range =>
							change(current =>
								withAttribute(
									current,
									definition.key,
									{ key: definition.key, ...range },
									order
								)
							)
						}
					/>
				</Section>
			)
			continue
		}
		const selected = current && 'values' in current ? current.values : []
		const options = (facet?.values ?? []).map(row => ({
			value: row.value,
			label: valueLabel(definition, row.value),
			count: row.count
		}))
		// A chosen value is always listed, even when the facet no longer returns it.
		for (const value of selected)
			if (!options.some(option => option.value === value))
				options.push({ value, label: valueLabel(definition, value), count: 0 })
		if (options.length < 2 && !selected.length) continue
		sections.push(
			<Section key={definition.key} title={definition.label}>
				<CheckList<TypedScalar>
					idPrefix={idPrefix}
					name={definition.key}
					options={options}
					selected={selected}
					onToggle={value =>
						change(current => {
							const chosen = current.attributes.find(
								filter => filter.key === definition.key
							)
							return withAttribute(
								current,
								definition.key,
								{
									key: definition.key,
									values: toggleIn(
										chosen && 'values' in chosen ? chosen.values : [],
										value
									)
								},
								order
							)
						})
					}
				/>
			</Section>
		)
	}

	if (facets && (facets.brands.length > 1 || filters.brand_ids.length))
		sections.push(
			<Section key='brands' title='Бренд'>
				<CheckList
					idPrefix={idPrefix}
					name='brand'
					options={countOptions(facets.brands)}
					selected={filters.brand_ids}
					onToggle={id =>
						change(current => ({
							...current,
							brand_ids: toggleIn(current.brand_ids, id)
						}))
					}
				/>
			</Section>
		)

	if (!sections.length)
		return <p className='text-muted-foreground text-sm'>Для цього розділу фільтрів немає.</p>
	return <div className='space-y-4'>{sections}</div>
}
