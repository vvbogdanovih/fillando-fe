'use client'

import { useState } from 'react'
import { ChevronDownIcon, SearchIcon } from 'lucide-react'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { Checkbox } from '@/common/components/ui/checkbox'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/common/components/ui/popover'
import { productsCount } from '@/common/utils'
import type { ColorOption } from './ColorFilter'

interface ColorSearchDropdownProps {
	options: ColorOption[]
	/** Families currently ticked, in URL order. */
	selected: string[]
	/** Same toggle the swatch chips call, so the two controls can never disagree. */
	onToggle: (family: string) => void
	/** Family → label, as the chips show it. */
	labelOf: (family: string) => string
	idPrefix?: string
}

/**
 * A second way into the colour filter: a searchable multi-select above the swatch chips.
 *
 * It is a duplicate on purpose, not a replacement (the owner's call, 2026-09-07): with fifteen
 * families the chips are the quickest way to *see* what is there, but typing three letters is
 * the quickest way to *reach* one — and the list only grows. Both controls edit the same
 * comma-separated `?color_family=`, through the same toggle, so a tick here shows up on the chip
 * below at once and vice versa.
 *
 * The popover stays open across ticks (Radix closes it only on an outside click or Escape), which
 * is what a multi-select needs; the search matches the Ukrainian label and the family key, so
 * «син» and «blue» both find «Синій». Zero-count families stay listed and tickable for the same
 * reason the chips keep them.
 */
export const ColorSearchDropdown = ({
	options,
	selected,
	onToggle,
	labelOf,
	idPrefix = ''
}: ColorSearchDropdownProps) => {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')

	const needle = query.trim().toLowerCase()
	const rows = options.filter(
		option =>
			needle === '' ||
			labelOf(option.family).toLowerCase().includes(needle) ||
			option.family.toLowerCase().includes(needle)
	)

	return (
		<Popover
			open={open}
			onOpenChange={next => {
				setOpen(next)
				if (!next) setQuery('')
			}}
		>
			<PopoverTrigger asChild>
				<button
					type='button'
					aria-label='Знайти колір за назвою'
					className='border-input bg-background text-muted-foreground hover:border-primary/50 focus-visible:ring-ring flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none'
				>
					<SearchIcon className='size-4 shrink-0' aria-hidden />
					<span className='flex-1 truncate text-left'>
						{selected.length > 0
							? `Обрано: ${selected.map(labelOf).join(', ')}`
							: 'Знайти колір…'}
					</span>
					<ChevronDownIcon
						className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
						aria-hidden
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent
				className='w-(--radix-popover-trigger-width) min-w-64 p-2'
				onOpenAutoFocus={event => {
					// Focus goes to the search box, not the first checkbox: typing is the point.
					event.preventDefault()
					const input = (event.currentTarget as HTMLElement | null)?.querySelector?.(
						'input[type="search"]'
					) as HTMLInputElement | null
					input?.focus()
				}}
			>
				<Input
					type='search'
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder='Назва кольору'
					aria-label='Пошук кольору'
					className='mb-2 h-8 text-sm'
					autoFocus
				/>
				{rows.length === 0 && (
					<p className='text-muted-foreground px-1 py-2 text-sm'>Нічого не знайдено</p>
				)}
				<ul className='max-h-64 space-y-0.5 overflow-y-auto' aria-label='Кольори'>
					{rows.map(option => {
						const id = `${idPrefix}color-pick-${option.family}`
						const label = labelOf(option.family)
						const isOn = selected.includes(option.family)
						return (
							<li
								key={option.family}
								className='hover:bg-muted/60 flex items-center gap-2 rounded-sm px-1.5 py-1.5'
								title={`${label} — ${productsCount(option.count)} із цим кольором`}
							>
								<Checkbox
									id={id}
									checked={isOn}
									onCheckedChange={() => onToggle(option.family)}
								/>
								<Label
									htmlFor={id}
									className={`flex-1 cursor-pointer font-normal ${
										option.count === 0 && !isOn ? 'text-muted-foreground' : ''
									}`}
								>
									<ColorSwatch
										hexStops={option.hex_stops}
										family={option.family}
										size={16}
									/>
									<span className='flex-1 truncate'>{label}</span>
									<span className='text-muted-foreground/70 text-xs'>
										{option.count}
									</span>
								</Label>
							</li>
						)
					})}
				</ul>
			</PopoverContent>
		</Popover>
	)
}
