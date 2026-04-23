'use client'

import { useState } from 'react'
import { type UseFieldArrayReturn, type FieldErrors } from 'react-hook-form'
import { PlusIcon, XIcon } from 'lucide-react'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Button } from '@/common/components/ui/button'
import { toSlug } from '@/common/utils'
import type { ProductFormValues, AttributeItem } from '../products.schema'
import type { RequiredAttribute } from '../../categories/categories.schema'

interface AttributesBlockProps {
	fieldArray: UseFieldArrayReturn<ProductFormValues, 'attributes'>
	errors: FieldErrors<ProductFormValues>
	requiredAttrs: RequiredAttribute[]
}

// Staging state for the new-attribute form
interface StagingAttr {
	label: string
	value: string
	error: string | null
}

const EMPTY_STAGING: StagingAttr = { label: '', value: '', error: null }

export const AttributesBlock = ({ fieldArray, errors, requiredAttrs }: AttributesBlockProps) => {
	const { fields, append, remove, update } = fieldArray
	const [staging, setStaging] = useState<StagingAttr>(EMPTY_STAGING)

	// Indices that belong to required attributes (pre-populated from subcategory)
	const requiredCount = requiredAttrs.length

	const handleAddClick = () => {
		const trimmedLabel = staging.label.trim()
		const trimmedValue = staging.value.trim()

		if (!trimmedLabel) {
			setStaging(s => ({ ...s, error: 'Введіть назву атрибута' }))
			return
		}

		const key = toSlug(trimmedLabel)
		const duplicate = fields.some(f => f.k === key)

		if (duplicate) {
			setStaging(s => ({ ...s, error: 'Атрибут з такою назвою вже існує' }))
			return
		}

		append({ k: key, l: trimmedLabel, v: trimmedValue })
		setStaging(EMPTY_STAGING)
	}

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<h2 className='text-sm font-semibold text-gray-900'>Атрибути</h2>

			{/* Required attributes from subcategory */}
			{requiredAttrs.length > 0 && (
				<div className='flex flex-col gap-3'>
					<p className='text-xs font-medium text-gray-500'>
						Обов'язкові атрибути підкатегорії
					</p>
					{requiredAttrs.map((attr, i) => {
						const fieldIndex = i
						const field = fields[fieldIndex] as AttributeItem | undefined
						return (
							<div key={attr.key} className='flex items-start gap-3'>
								<div className='flex w-48 shrink-0 flex-col gap-1'>
									<span className='text-xs font-medium text-gray-700'>
										{attr.label}
									</span>
									{attr.unit && (
										<span className='text-muted-foreground text-[11px]'>
											({attr.unit})
										</span>
									)}
								</div>
								<div className='flex flex-1 flex-col gap-1'>
									<Input
										placeholder='Значення'
										value={(field?.v as string) ?? ''}
										onChange={e =>
											update(fieldIndex, {
												k: toSlug(attr.label),
												l: attr.label,
												v: e.target.value
											})
										}
										aria-invalid={!!errors.attributes?.[fieldIndex]?.v}
									/>
									{errors.attributes?.[fieldIndex]?.v && (
										<p className='text-destructive text-xs'>
											{errors.attributes[fieldIndex]?.v?.message as string}
										</p>
									)}
								</div>
							</div>
						)
					})}
				</div>
			)}

			{/* Custom attributes */}
			{fields.length > requiredCount && (
				<div className='flex flex-col gap-2'>
					{requiredAttrs.length > 0 && (
						<p className='text-xs font-medium text-gray-500'>Власні атрибути</p>
					)}
					{fields.slice(requiredCount).map((field, relIndex) => {
						const absIndex = requiredCount + relIndex
						return (
							<div key={field.id} className='flex items-center gap-2'>
								<span className='w-40 shrink-0 truncate text-xs text-gray-700'>
									{field.l}
								</span>
								<span className='font-mono text-xs text-gray-400'>{field.k}</span>
								<span className='flex-1 text-xs text-gray-600'>
									{String(field.v)}
								</span>
								<Button
									type='button'
									size='icon-xs'
									variant='ghost'
									onClick={() => remove(absIndex)}
								>
									<XIcon className='size-3' />
								</Button>
							</div>
						)
					})}
				</div>
			)}

			{/* Add new attribute */}
			<div className='flex flex-col gap-2 rounded-md border border-dashed border-gray-200 p-3'>
				<p className='text-xs font-medium text-gray-500'>Додати атрибут</p>
				<div className='flex gap-2'>
					<div className='flex flex-1 flex-col gap-1'>
						<Label className='sr-only'>Назва</Label>
						<Input
							placeholder='Назва (укр.)'
							value={staging.label}
							onChange={e =>
								setStaging(s => ({ ...s, label: e.target.value, error: null }))
							}
							aria-invalid={!!staging.error}
						/>
					</div>
					<div className='flex flex-1 flex-col gap-1'>
						<Label className='sr-only'>Значення</Label>
						<Input
							placeholder='Значення'
							value={staging.value}
							onChange={e => setStaging(s => ({ ...s, value: e.target.value }))}
						/>
					</div>
					<Button type='button' size='sm' variant='outline' onClick={handleAddClick}>
						<PlusIcon className='size-3.5' />
						Додати
					</Button>
				</div>
				{staging.error && <p className='text-destructive text-xs'>{staging.error}</p>}
			</div>
		</section>
	)
}
