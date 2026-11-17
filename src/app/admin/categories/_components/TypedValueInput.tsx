'use client'
import { useQuery } from '@tanstack/react-query'
import type { TypedDefinition } from '../typed-product.schema'
import { colorsApi } from '@/app/admin/colors/colors.api'
import { swatchBackground } from '@/common/components/ColorSwatch'
import { ui } from './admin-ui'
/**
 * `hideLabel`: the field's caption is already printed above it (a characteristic's name, a
 * variant's SKU), so the label stays only for screen readers and `getByLabel`.
 */
export function ValueInput({
	definition,
	label,
	value,
	onChange,
	hideLabel = false
}: {
	definition: TypedDefinition
	label: string
	value: string
	onChange: (value: string) => void
	hideLabel?: boolean
}) {
	if (definition.semantic === 'color')
		return <ColorInput label={label} value={value} onChange={onChange} hideLabel={hideLabel} />
	return (
		<label className='block min-w-0 flex-1 text-sm'>
			<span className={hideLabel ? 'sr-only' : ''}>{label}</span>
			{definition.value_type === 'boolean' || definition.value_type === 'enum' ? (
				<select
					className={ui.input}
					value={value}
					onChange={event => onChange(event.target.value)}
				>
					<option value=''>Не задано</option>
					{definition.value_type === 'boolean' ? (
						<>
							<option value='true'>Так</option>
							<option value='false'>Ні</option>
						</>
					) : (
						[...definition.options]
							.sort((a, b) => a.order - b.order)
							.map(option => (
								<option key={option.id} value={option.id}>
									{option.label}
								</option>
							))
					)}
				</select>
			) : (
				<input
					className={ui.input}
					type={definition.value_type === 'number' ? 'number' : 'text'}
					step='any'
					// What goes in, from the definition itself: «Число, А» — never a made-up example.
					placeholder={
						definition.value_type === 'number'
							? `Число${definition.unit ? `, ${definition.unit}` : ''}`
							: undefined
					}
					value={value}
					onChange={event => onChange(event.target.value)}
				/>
			)}
		</label>
	)
}

/**
 * A colour axis stores the dictionary id (TD-0013 B08): the value is picked from the colour
 * dictionary, never typed, so the SKU name, swatch and family filter stay consistent.
 */
function ColorInput({
	label,
	value,
	onChange,
	hideLabel
}: {
	label: string
	value: string
	onChange: (value: string) => void
	hideLabel: boolean
}) {
	const colors = useQuery({ queryKey: ['colors-admin'], queryFn: colorsApi.getAll })
	const current = colors.data?.find(color => color._id === value)
	const known = !!current
	return (
		<label className='flex min-w-0 flex-1 items-end gap-2 text-sm'>
			<span
				aria-hidden
				className='mb-1 size-8 shrink-0 rounded-full border border-gray-300'
				style={{
					background: current
						? swatchBackground(current.hex_stops, current.family)
						: 'repeating-linear-gradient(45deg,#f3f4f6 0 4px,#fff 4px 8px)'
				}}
			/>
			<span className='min-w-0 flex-1'>
				<span className={hideLabel ? 'sr-only' : ''}>{label}</span>
				<select
					className={ui.input}
					value={value}
					onChange={event => onChange(event.target.value)}
				>
					<option value=''>
						{colors.isLoading ? 'Завантаження кольорів…' : 'Не задано'}
					</option>
					{value && !known && !colors.isLoading && (
						<option value={value}>Невідомий колір ({value})</option>
					)}
					{[...(colors.data ?? [])]
						.sort((a, b) => a.name_uk.localeCompare(b.name_uk, 'uk'))
						.map(color => (
							<option key={color._id} value={color._id}>
								{color.name_uk === color.name_en
									? color.name_uk
									: `${color.name_uk} (${color.name_en})`}
							</option>
						))}
				</select>
			</span>
		</label>
	)
}
