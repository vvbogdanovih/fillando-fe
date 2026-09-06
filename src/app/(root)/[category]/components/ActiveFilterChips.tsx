'use client'

import { LockIcon, XIcon } from 'lucide-react'
import type { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import { formatUah } from '@/common/utils'
import { attributeValueLabel } from '../filter-labels'
import { FAMILY_LABELS } from './ColorFilter'

interface ActiveFilterChipsProps {
	/** Every dimension of the category, pinned ones included — the source of the labels. */
	attributes: RequiredAttribute[]
	/** Dimensions the landing fixes. Shown with a lock and no way to clear them. */
	pinnedFilters: Record<string, string[]>
	searchParams: Record<string, string>
	onParamsChange: (changes: Record<string, string | null>) => void
}

const CHIP = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm'

/** Parameters that shape the listing without narrowing it. Everything else is a filter. */
const NON_FILTER_KEYS = new Set(['page', 'limit', 'sort', 'category_id'])
const PRICE_KEYS = ['price_min', 'price_max']

/**
 * Every query parameter that narrows the listing and is the shopper's to remove. The backend
 * treats any key it does not reserve as an attribute filter, so a `?material=PLA` from an old
 * link narrows the grid just as `?polymer=PLA` does — and «Очистити все» has to remove it too,
 * or the shopper is left with a filtered page and no filter in sight.
 */
export const clearableFilterKeys = (
	searchParams: Record<string, string>,
	pinnedFilters: Record<string, string[]>
): string[] =>
	Object.keys(searchParams).filter(
		key => !NON_FILTER_KEYS.has(key) && !(key in pinnedFilters) && searchParams[key] !== ''
	)

/**
 * What is currently narrowing the listing, as a row above the grid.
 *
 * Two kinds of chip, and the difference is the point. A landing's pinned filters are part of
 * the address — removing one would put the visitor on a listing the URL does not describe — so
 * they carry a lock and no ✕. Everything the visitor chose themselves is removable from here,
 * which on mobile is the only place it is visible at all: the sidebar lives behind a drawer.
 *
 * «Очистити все» removes every removable chip at once — including a key the category does not
 * list as a dimension, which gets a chip with its raw name so the narrowing is never invisible.
 */
export const ActiveFilterChips = ({
	attributes,
	pinnedFilters,
	searchParams,
	onParamsChange
}: ActiveFilterChipsProps) => {
	const labelOf = (key: string) => attributes.find(a => a.key === key)?.label ?? key

	const pinned = Object.entries(pinnedFilters).filter(([, values]) => values.length > 0)

	const chosen = attributes
		.filter(attr => !(attr.key in pinnedFilters))
		.flatMap(attr => {
			const raw = searchParams[attr.key]
			if (!raw) return []
			const values = raw.split(',').filter(Boolean)
			if (values.length === 0) return []
			return [
				{
					key: attr.key,
					label: attr.label,
					text: values.map(v => attributeValueLabel(attr.key, v)).join(', ')
				}
			]
		})

	const families = (searchParams.color_family ?? '').split(',').filter(Boolean)
	if (families.length > 0) {
		chosen.push({
			key: 'color_family',
			label: 'Колір',
			text: families.map(f => FAMILY_LABELS[f] ?? f).join(', ')
		})
	}

	const hasPrice = searchParams.price_min !== undefined || searchParams.price_max !== undefined

	// Narrowing the sidebar cannot name: not a dimension, not colour, not price.
	const known = new Set([...attributes.map(a => a.key), 'color_family', ...PRICE_KEYS])
	for (const key of clearableFilterKeys(searchParams, pinnedFilters)) {
		if (!known.has(key)) {
			chosen.push({ key, label: key, text: searchParams[key].split(',').join(', ') })
		}
	}

	if (pinned.length === 0 && chosen.length === 0 && !hasPrice) return null

	const clearable = clearableFilterKeys(searchParams, pinnedFilters)
	const clearAll = () => onParamsChange(Object.fromEntries(clearable.map(key => [key, null])))

	return (
		<div className='mb-4 space-y-2'>
			<div className='flex flex-wrap items-center gap-2'>
				{pinned.map(([key, values]) => (
					<span
						key={key}
						className={`${CHIP} border-border/60 bg-muted text-muted-foreground`}
						title='Фільтр цієї сторінки — зняти не можна'
					>
						<LockIcon className='size-3' aria-hidden />
						{labelOf(key)}: {values.map(v => attributeValueLabel(key, v)).join(', ')}
					</span>
				))}

				{chosen.map(chip => (
					<button
						key={chip.key}
						type='button'
						onClick={() => onParamsChange({ [chip.key]: null })}
						className={`${CHIP} border-border/60 hover:border-primary hover:text-primary transition-colors`}
						aria-label={`Прибрати фільтр ${chip.label}: ${chip.text}`}
					>
						{chip.label}: {chip.text}
						<XIcon className='size-3' aria-hidden />
					</button>
				))}

				{hasPrice && (
					<button
						type='button'
						onClick={() => onParamsChange({ price_min: null, price_max: null })}
						className={`${CHIP} border-border/60 hover:border-primary hover:text-primary transition-colors`}
						aria-label='Прибрати фільтр за ціною'
					>
						Ціна: {formatUah(Number(searchParams.price_min ?? 0))} –{' '}
						{formatUah(Number(searchParams.price_max ?? 0))}
						<XIcon className='size-3' aria-hidden />
					</button>
				)}

				{clearable.length > 0 && (
					<button
						type='button'
						onClick={clearAll}
						className='text-muted-foreground hover:text-primary ml-1 text-sm underline-offset-4 transition-colors hover:underline'
					>
						Очистити все
					</button>
				)}
			</div>

			{pinned.length > 0 && (
				<p className='text-muted-foreground text-xs'>
					Закріплені фільтри сторінки зняти не можна · додаткові — можна
				</p>
			)}
		</div>
	)
}
