'use client'

import { useQuery } from '@tanstack/react-query'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { colorsApi } from '@/app/admin/colors/colors.api'

/** Sentinel: Radix Select cannot hold an empty string as a value. */
const NONE = '__none__'

interface ColorSelectProps {
	value: string | null
	onChange: (colorId: string | null) => void
	id?: string
}

/**
 * Picks a variant's colour from the dictionary.
 *
 * Without it a new variant could never get a `color_id`, so it would be missing from the swatch
 * filter and would fall back to rendering the raw `v_value` — which the colour migration turns
 * into the English name. The admin sets the id; `color_family` is derived server-side, never
 * sent from here (TD-0002 §5.2.2).
 */
export const ColorSelect = ({ value, onChange, id }: ColorSelectProps) => {
	// Same query key as the colours screen, so editing the dictionary refreshes this list too.
	const { data: colors = [], isLoading } = useQuery({
		queryKey: ['colors'],
		queryFn: () => colorsApi.getAll()
	})

	const sorted = [...colors].sort(
		(a, b) => a.order - b.order || a.name_uk.localeCompare(b.name_uk, 'uk')
	)
	const selected = sorted.find(c => c._id === value) ?? null

	return (
		<Select value={value ?? NONE} onValueChange={next => onChange(next === NONE ? null : next)}>
			<SelectTrigger id={id} className='bg-white text-black' aria-label='Колір варіанта'>
				{selected ? (
					<span className='flex min-w-0 items-center gap-2'>
						<ColorSwatch
							hexStops={selected.hex_stops}
							family={selected.family}
							size={16}
						/>
						<span className='truncate'>
							{selected.name_uk} ({selected.name_en})
						</span>
					</span>
				) : (
					<SelectValue placeholder={isLoading ? 'Завантаження…' : 'Без кольору'} />
				)}
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={NONE}>Без кольору</SelectItem>
				{sorted.map(color => (
					<SelectItem key={color._id} value={color._id}>
						<span className='flex items-center gap-2'>
							<ColorSwatch
								hexStops={color.hex_stops}
								family={color.family}
								size={16}
							/>
							{color.name_uk} ({color.name_en})
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
