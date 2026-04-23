'use client'

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter
} from '@/common/components/ui/dialog'
import {
	subcategoryFormSchema,
	type SubcategoryFormValues,
	type Subcategory
} from '../categories.schema'

interface SubcategoryFormProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	initial?: Subcategory | null
	onSubmit: (data: SubcategoryFormValues) => void
	isPending: boolean
}

export const SubcategoryForm = ({
	open,
	onOpenChange,
	initial,
	onSubmit,
	isPending
}: SubcategoryFormProps) => {
	const {
		register,
		control,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors }
	} = useForm<SubcategoryFormValues>({
		resolver: zodResolver(subcategoryFormSchema),
		defaultValues: {
			name: '',
			slug: '',
			required_attributes: []
		}
	})

	const { fields, append, remove } = useFieldArray({
		control,
		name: 'required_attributes'
	})

	// Populate form when editing
	useEffect(() => {
		if (open) {
			if (initial) {
				reset({
					name: initial.name,
					slug: initial.slug,
					required_attributes: initial.required_attributes.map(a => ({
						label: a.label,
						filter_type: a.filter_type,
						unit: a.unit
					}))
				})
			} else {
				reset({ name: '', slug: '', required_attributes: [] })
			}
		}
	}, [open, initial, reset])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
				<DialogHeader>
					<DialogTitle>
						{initial ? 'Редагувати підкатегорію' : 'Нова підкатегорія'}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
					{/* Name */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='sub-name'>Назва</Label>
						<Input
							id='sub-name'
							placeholder='Назва підкатегорії'
							{...register('name')}
							aria-invalid={!!errors.name}
						/>
						{errors.name && (
							<p className='text-destructive text-xs'>{errors.name.message}</p>
						)}
					</div>

					{/* Slug */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='sub-slug'>Slug</Label>
						<Input
							id='sub-slug'
							placeholder='pid-kategoriya'
							{...register('slug')}
							aria-invalid={!!errors.slug}
						/>
						{errors.slug && (
							<p className='text-destructive text-xs'>{errors.slug.message}</p>
						)}
					</div>

					{/* Required attributes */}
					<div className='flex flex-col gap-2'>
						<div className='flex items-center justify-between'>
							<Label>Обов'язкові атрибути</Label>
							<Button
								type='button'
								size='xs'
								variant='outline'
								onClick={() =>
									append({ label: '', filter_type: 'multi-select', unit: null })
								}
							>
								<PlusIcon className='size-3' />
								Додати
							</Button>
						</div>

						{fields.length === 0 && (
							<p className='text-muted-foreground text-xs'>Атрибутів немає</p>
						)}

						{fields.map((field, index) => (
							<div
								key={field.id}
								className='rounded-md border border-gray-200 bg-gray-50 p-3'
							>
								<div className='mb-2 flex items-center justify-between'>
									<span className='text-xs font-medium text-gray-600'>
										Атрибут {index + 1}
									</span>
									<Button
										type='button'
										size='icon-xs'
										variant='ghost'
										onClick={() => remove(index)}
									>
										<Trash2Icon className='text-destructive size-3' />
									</Button>
								</div>

								<div className='flex flex-col gap-2'>
									{/* Label */}
									<div className='flex flex-col gap-1'>
										<Label htmlFor={`attr-label-${index}`} className='text-xs'>
											Label
										</Label>
										<Input
											id={`attr-label-${index}`}
											placeholder='Наприклад: Виробник'
											{...register(`required_attributes.${index}.label`)}
											aria-invalid={
												!!errors.required_attributes?.[index]?.label
											}
										/>
										{errors.required_attributes?.[index]?.label && (
											<p className='text-destructive text-xs'>
												{errors.required_attributes[index].label?.message}
											</p>
										)}
									</div>

									{/* filter_type + unit */}
									<div className='flex gap-2'>
										<div className='flex flex-1 flex-col gap-1'>
											<Label className='text-xs'>Тип фільтру</Label>
											<Select
												value={watch(
													`required_attributes.${index}.filter_type`
												)}
												onValueChange={val =>
													setValue(
														`required_attributes.${index}.filter_type`,
														val as 'multi-select' | 'range',
														{ shouldValidate: true }
													)
												}
											>
												<SelectTrigger className='w-full'>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='multi-select'>
														multi-select
													</SelectItem>
													<SelectItem value='range'>range</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className='flex flex-1 flex-col gap-1'>
											<Label
												htmlFor={`attr-unit-${index}`}
												className='text-xs'
											>
												Одиниця (optional)
											</Label>
											<Input
												id={`attr-unit-${index}`}
												placeholder='мм, кг...'
												{...register(`required_attributes.${index}.unit`, {
													setValueAs: v => (v === '' ? null : v)
												})}
											/>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>

					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Скасувати
						</Button>
						<Button type='submit' disabled={isPending}>
							{isPending ? 'Збереження...' : 'Зберегти'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
