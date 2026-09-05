'use client'

import { ColorSwatch } from '@/common/components/ColorSwatch'

/** One family present in the category, as the catalogue API returns it. */
export interface ColorOption {
	family: string
	count: number
	hex_stops: string[]
}

/** Family → Ukrainian label; shared with the active-filter chips above the grid. */
export const FAMILY_LABELS: Record<string, string> = {
	black: 'Чорний',
	white: 'Білий',
	gray: 'Сірий',
	red: 'Червоний',
	orange: 'Помаранчевий',
	yellow: 'Жовтий',
	green: 'Зелений',
	blue: 'Синій',
	purple: 'Фіолетовий',
	pink: 'Рожевий',
	brown: 'Коричневий',
	gold: 'Золотий',
	silver: 'Срібний',
	transparent: 'Прозорий',
	multicolor: 'Багатокольоровий'
}

interface ColorFilterProps {
	options: ColorOption[]
	/** Comma-separated families from the URL, exactly as `?color_family=` carries them. */
	currentValue: string
	onChange: (value: string) => void
	idPrefix?: string
}

/**
 * Colour filter as swatch circles.
 *
 * The circle is painted from `hex_stops` through the same rule the admin previews with, so a
 * colour gaining a fifth stop needs no change here (TD-0002 §5.2.2). Selection is expressed in
 * the same comma-separated form the other filters use, so `ProductService.getCatalog` parses it
 * identically.
 */
export const ColorFilter = ({
	options,
	currentValue,
	onChange,
	idPrefix = ''
}: ColorFilterProps) => {
	const selected = currentValue ? currentValue.split(',').filter(Boolean) : []

	const toggle = (family: string) => {
		const next = selected.includes(family)
			? selected.filter(f => f !== family)
			: [...selected, family]
		onChange(next.join(','))
	}

	if (options.length === 0) return null

	return (
		<fieldset>
			<legend className='mb-3 text-sm font-medium'>Колір</legend>
			<div className='flex flex-wrap gap-2'>
				{options.map(option => {
					const isOn = selected.includes(option.family)
					const label = FAMILY_LABELS[option.family] ?? option.family
					return (
						<button
							key={option.family}
							id={`${idPrefix}color-${option.family}`}
							type='button'
							onClick={() => toggle(option.family)}
							aria-pressed={isOn}
							title={`${label} — ${option.count}`}
							className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
								isOn
									? 'border-primary bg-primary/10 text-foreground'
									: 'border-border/60 text-muted-foreground hover:border-primary/50'
							}`}
						>
							<ColorSwatch
								hexStops={option.hex_stops}
								family={option.family}
								size={16}
							/>
							<span>{label}</span>
							<span className='text-muted-foreground/70'>{option.count}</span>
						</button>
					)
				})}
			</div>
		</fieldset>
	)
}
