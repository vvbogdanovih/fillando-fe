'use client'

import { useState } from 'react'
import { type UseFieldArrayReturn, type FieldErrors } from 'react-hook-form'
import { PlusIcon, XIcon } from 'lucide-react'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Button } from '@/common/components/ui/button'
import { toAttrKey } from '@/common/utils'
import { layoutAttributes, type AttributeField } from '../products.utils'
import type { ProductFormValues } from '../products.schema'
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

	// Paired by key, never by position — see `layoutAttributes` for why that matters.
	const { required, custom } = layoutAttributes(
		requiredAttrs,
		fields as unknown as AttributeField[]
	)

	/** A required attribute the product does not carry yet is appended, not written over. */
	const setRequiredValue = (row: (typeof required)[number], value: string) => {
		const entry = { k: toAttrKey(row.attr.label), l: row.attr.label, v: value }
		if (row.index === null) append(entry)
		else update(row.index, entry)
	}

	/** A second (third…) value of the same dimension — its own row, so it can be edited or dropped. */
	const setExtraValue = (row: (typeof required)[number], index: number, value: string) =>
		update(index, { k: toAttrKey(row.attr.label), l: row.attr.label, v: value })

	const addExtraValue = (row: (typeof required)[number]) =>
		append({ k: toAttrKey(row.attr.label), l: row.attr.label, v: '' })

	const handleAddClick = () => {
		const trimmedLabel = staging.label.trim()
		const trimmedValue = staging.value.trim()

		if (!trimmedLabel) {
			setStaging(s => ({ ...s, error: 'Введіть назву атрибута' }))
			return
		}

		const key = toAttrKey(trimmedLabel)
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

			{/* Required attributes from category */}
			{requiredAttrs.length > 0 && (
				<div className='flex flex-col gap-3'>
					<p className='text-xs font-medium text-gray-500'>
						Обов'язкові атрибути підкатегорії
					</p>
					{required.map(row => {
						const attr = row.attr
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
										value={row.value}
										onChange={e => setRequiredValue(row, e.target.value)}
										aria-invalid={
											row.index !== null &&
											!!errors.attributes?.[row.index]?.v
										}
									/>
									{row.index !== null && errors.attributes?.[row.index]?.v && (
										<p className='text-destructive text-xs'>
											{errors.attributes[row.index]?.v?.message as string}
										</p>
									)}
									{row.extra.map(({ field, index }) => (
										<div
											key={`${field.k}-${index}`}
											className='flex items-center gap-2'
										>
											<Input
												placeholder='Ще одне значення'
												value={String(field.v ?? '')}
												onChange={e =>
													setExtraValue(row, index, e.target.value)
												}
												aria-label={`${attr.label}, додаткове значення`}
											/>
											<Button
												type='button'
												size='icon-xs'
												variant='ghost'
												onClick={() => remove(index)}
												aria-label={`Видалити значення ${String(field.v ?? '')}`}
											>
												<XIcon className='size-3' />
											</Button>
										</div>
									))}
									{row.index !== null && (
										<button
											type='button'
											onClick={() => addExtraValue(row)}
											className='text-muted-foreground hover:text-foreground w-fit text-xs underline-offset-2 hover:underline'
										>
											+ ще значення
										</button>
									)}
								</div>
							</div>
						)
					})}
				</div>
			)}

			{/* Custom attributes */}
			{custom.length > 0 && (
				<div className='flex flex-col gap-2'>
					{requiredAttrs.length > 0 && (
						<p className='text-xs font-medium text-gray-500'>Власні атрибути</p>
					)}
					{custom.map(({ field, index }) => (
						<div key={`${field.k}-${index}`} className='flex items-center gap-2'>
							<span className='w-40 shrink-0 truncate text-xs text-gray-700'>
								{field.l}
							</span>
							<span className='font-mono text-xs text-gray-400'>{field.k}</span>
							<span className='flex-1 text-xs text-gray-600'>{String(field.v)}</span>
							<Button
								type='button'
								size='icon-xs'
								variant='ghost'
								onClick={() => remove(index)}
							>
								<XIcon className='size-3' />
							</Button>
						</div>
					))}
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
