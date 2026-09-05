'use client'

import { Checkbox } from '@/common/components/ui/checkbox'
import { Label } from '@/common/components/ui/label'
import { RequiredAttribute } from '@/app/admin/categories/categories.schema'
import { attributeValueLabel } from '../filter-labels'

interface AttributeFilterProps {
	attribute: RequiredAttribute
	options: string[]
	currentValue: string
	onChange: (value: string) => void
	idPrefix?: string
}

export const AttributeFilter = ({
	attribute,
	options,
	currentValue,
	onChange,
	idPrefix = ''
}: AttributeFilterProps) => {
	const selected = currentValue ? currentValue.split(',').filter(Boolean) : []

	const toggle = (option: string) => {
		const next = selected.includes(option)
			? selected.filter(v => v !== option)
			: [...selected, option]
		onChange(next.join(','))
	}

	if (options.length === 0) return null

	if (attribute.filter_type === 'multi-select') {
		return (
			<div className='space-y-2'>
				<p className='text-sm font-semibold'>{attribute.label}</p>
				<div className='space-y-1.5'>
					{options.map(option => (
						<div key={option} className='flex items-center gap-2'>
							<Checkbox
								id={`${idPrefix}${attribute.key}-${option}`}
								checked={selected.includes(option)}
								onCheckedChange={() => toggle(option)}
							/>
							<Label
								htmlFor={`${idPrefix}${attribute.key}-${option}`}
								className='cursor-pointer text-sm font-normal'
							>
								{attributeValueLabel(attribute.key, option)}
								{attribute.unit ? ` ${attribute.unit}` : ''}
							</Label>
						</div>
					))}
				</div>
			</div>
		)
	}

	return null
}
