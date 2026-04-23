'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { vendorsApi } from '../vendors.api'
import { vendorFormSchema, type VendorFormValues, type Vendor } from '../vendors.schema'
import { toSlug } from '@/common/utils'

interface VendorFormProps {
	initial: Vendor | null
	onClose: () => void
}

export const VendorForm = ({ initial, onClose }: VendorFormProps) => {
	const queryClient = useQueryClient()
	const isEditMode = !!initial
	// Tracks whether the user has manually edited the slug field
	const slugLockedRef = useRef(false)

	const {
		register,
		handleSubmit,
		setError,
		watch,
		setValue,
		formState: { errors }
	} = useForm<VendorFormValues>({
		resolver: zodResolver(vendorFormSchema),
		defaultValues: {
			name: initial?.name ?? '',
			slug: initial?.slug ?? ''
		}
	})

	const watchedName = watch('name')

	// Auto-generate slug from name in create mode, unless the user has manually edited it
	useEffect(() => {
		if (!isEditMode && !slugLockedRef.current) {
			setValue('slug', toSlug(watchedName), { shouldValidate: false })
		}
	}, [watchedName, isEditMode, setValue])

	const syncToCache = (updated: Vendor) => {
		queryClient.setQueryData<Vendor[]>(['vendors'], prev => {
			if (!prev) return [updated]
			const exists = prev.find(v => v._id === updated._id)
			return exists
				? prev.map(v => (v._id === updated._id ? updated : v))
				: [...prev, updated]
		})
	}

	const handle409Error = (message: string) => {
		const lower = message.toLowerCase()
		if (lower.includes('slug')) {
			setError('slug', { message: 'Цей slug вже використовується.' })
		} else if (lower.includes('name')) {
			setError('name', { message: 'Вендор з такою назвою вже існує.' })
		} else {
			setError('name', { message: 'Вендор з такою назвою вже існує.' })
			setError('slug', { message: 'Або цей slug вже використовується.' })
		}
	}

	const { mutate: saveVendor, isPending: isSaving } = useMutation({
		mutationFn: async (values: VendorFormValues) => {
			const slugChanged = !isEditMode || values.slug !== initial.slug
			if (slugChanged) {
				const { available } = await vendorsApi.checkSlugAvailability(values.slug)
				if (!available) throw Object.assign(new Error('slug_taken'), { field: 'slug' })
			}
			return isEditMode ? vendorsApi.update(initial._id, values) : vendorsApi.create(values)
		},
		onSuccess: updated => {
			syncToCache(updated)
			toast.success(isEditMode ? 'Вендора збережено' : 'Вендора створено')
			if (!isEditMode) onClose()
		},
		onError: (err: Error) => {
			if (err.message === 'slug_taken') {
				setError('slug', { message: 'Цей slug вже використовується.' })
			} else if (
				err.message.includes('409') ||
				err.message.toLowerCase().includes('conflict') ||
				err.message.toLowerCase().includes('already exists')
			) {
				handle409Error(err.message)
			} else {
				toast.error(err.message || 'Помилка збереження')
			}
		}
	})

	const slugField = register('slug')

	return (
		<div className='flex h-full flex-col overflow-y-auto bg-white'>
			{/* Header */}
			<div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>
					{isEditMode ? `Редагування: ${initial.name}` : 'Новий вендор'}
				</h2>
				<Button size='icon-sm' variant='ghost' onClick={onClose}>
					<XIcon className='size-4' />
				</Button>
			</div>

			<div className='p-6'>
				<form
					onSubmit={handleSubmit(vals => saveVendor(vals))}
					className='flex flex-col gap-4'
				>
					{/* Name */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='vendor-name'>Назва</Label>
						<Input
							id='vendor-name'
							placeholder='Наприклад: Fillando'
							{...register('name')}
							aria-invalid={!!errors.name}
						/>
						{errors.name && (
							<p className='text-destructive text-xs'>{errors.name.message}</p>
						)}
					</div>

					{/* Slug */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='vendor-slug'>Slug</Label>
						<Input
							id='vendor-slug'
							placeholder='fillando'
							{...slugField}
							onChange={e => {
								slugLockedRef.current = true
								slugField.onChange(e)
							}}
							aria-invalid={!!errors.slug}
						/>
						{errors.slug && (
							<p className='text-destructive text-xs'>{errors.slug.message}</p>
						)}
						{!isEditMode && (
							<p className='text-muted-foreground text-xs'>
								Генерується автоматично з назви. Можна редагувати вручну.
							</p>
						)}
					</div>

					{/* Submit */}
					<div className='flex gap-2'>
						<Button type='submit' disabled={isSaving}>
							{isSaving ? 'Збереження...' : isEditMode ? 'Зберегти' : 'Створити'}
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={onClose}
							disabled={isSaving}
						>
							Скасувати
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}
