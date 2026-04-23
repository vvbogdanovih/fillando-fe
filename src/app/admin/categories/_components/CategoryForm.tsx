'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { XIcon, UploadIcon, AlertCircleIcon, RefreshCwIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { categoriesApi } from '../categories.api'
import { SubcategoryList } from './SubcategoryList'
import { categoryFormSchema, type CategoryFormValues, type Category } from '../categories.schema'

interface CategoryFormProps {
	initial: Category | null // null = create mode
	onClose: () => void
}

type ImageState =
	| { status: 'none' }
	| { status: 'existing'; url: string }
	| { status: 'pending'; file: File; preview: string }
	| { status: 'uploading' }
	| { status: 'error'; file: File; preview: string; message: string }
	| { status: 'removed' }

export const CategoryForm = ({ initial, onClose }: CategoryFormProps) => {
	const queryClient = useQueryClient()
	const fileInputRef = useRef<HTMLInputElement>(null)

	const [imageState, setImageState] = useState<ImageState>({ status: 'none' })

	const isEditMode = !!initial

	const {
		register,
		handleSubmit,
		setError,
		formState: { errors }
	} = useForm<CategoryFormValues>({
		resolver: zodResolver(categoryFormSchema),
		defaultValues: {
			name: initial?.name ?? '',
			slug: initial?.slug ?? '',
			order: initial?.order ?? 0
		}
	})

	// Populate image state for edit mode
	useEffect(() => {
		if (initial?.image) {
			setImageState({ status: 'existing', url: initial.image })
		} else {
			setImageState({ status: 'none' })
		}
	}, [initial, isEditMode])

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		const preview = URL.createObjectURL(file)
		setImageState({ status: 'pending', file, preview })
		// Reset input so the same file can be re-selected after error
		e.target.value = ''
	}

	const handleRemoveImage = () => {
		if (imageState.status === 'existing') {
			setImageState({ status: 'removed' })
		} else {
			setImageState({ status: 'none' })
		}
	}

	const syncToCache = (updated: Category) => {
		queryClient.setQueryData<Category[]>(['categories'], prev => {
			if (!prev) return [updated]
			const exists = prev.find(c => c._id === updated._id)
			return exists
				? prev.map(c => (c._id === updated._id ? updated : c))
				: [...prev, updated]
		})
	}

	// Run the image upload flow after a category _id is available
	const runImageUpload = async (categoryId: string, file: File): Promise<string | null> => {
		setImageState({ status: 'uploading' })
		try {
			const publicUrl = await categoriesApi.uploadImage(categoryId, file)
			return publicUrl
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Помилка завантаження зображення'
			setImageState({ status: 'error', file, preview: URL.createObjectURL(file), message })
			return null
		}
	}

	const handle409Error = (message: string) => {
		const lower = message.toLowerCase()
		if (lower.includes('slug')) {
			setError('slug', { message: 'Цей slug вже використовується.' })
		} else if (lower.includes('name') || lower.includes('назва')) {
			setError('name', { message: 'Категорія з такою назвою вже існує.' })
		} else {
			// Can't determine which field — flag both
			setError('name', { message: 'Категорія з такою назвою вже існує.' })
			setError('slug', { message: 'Або цей slug вже використовується.' })
		}
	}

	const { mutate: saveCategory, isPending: isSaving } = useMutation({
		mutationFn: async (values: CategoryFormValues) => {
			const payload: CategoryFormValues = {
				name: values.name,
				slug: values.slug,
				...(values.order !== undefined ? { order: values.order } : {})
			}

			let savedCategory: Category

			if (isEditMode) {
				savedCategory = await categoriesApi.update(initial._id, payload)
			} else {
				savedCategory = await categoriesApi.create(payload)
			}

			// Handle image side-effects
			if (imageState.status === 'pending') {
				const publicUrl = await runImageUpload(savedCategory._id, imageState.file)
				if (publicUrl) {
					savedCategory = await categoriesApi.update(savedCategory._id, {
						image: publicUrl
					})
				}
				// If publicUrl is null, upload failed — category saved but no image
				// The error state is already set by runImageUpload
			} else if (imageState.status === 'removed' && isEditMode) {
				savedCategory = await categoriesApi.update(savedCategory._id, { image: null })
			}

			return savedCategory
		},
		onSuccess: updated => {
			syncToCache(updated)
			toast.success(isEditMode ? 'Категорію збережено' : 'Категорію створено')
			if (!isEditMode) {
				onClose()
			}
		},
		onError: (err: Error) => {
			if (
				err.message.includes('409') ||
				err.message.toLowerCase().includes('conflict') ||
				err.message.toLowerCase().includes('already exists') ||
				err.message.toLowerCase().includes('вже існує') ||
				err.message.toLowerCase().includes('slug')
			) {
				handle409Error(err.message)
			} else {
				toast.error(err.message || 'Помилка збереження')
			}
		}
	})

	const retryImageUpload = async () => {
		if (imageState.status !== 'error' || !initial) return
		const { file } = imageState
		const publicUrl = await runImageUpload(initial._id, file)
		if (publicUrl) {
			const updated = await categoriesApi.update(initial._id, { image: publicUrl })
			syncToCache(updated)
			setImageState({ status: 'existing', url: publicUrl })
			toast.success('Зображення завантажено')
		}
	}

	const isPending = isSaving

	return (
		<div className='flex h-full flex-col overflow-y-auto bg-white'>
			{/* Header */}
			<div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>
					{isEditMode ? `Редагування: ${initial.name}` : 'Нова категорія'}
				</h2>
				<Button size='icon-sm' variant='ghost' onClick={onClose}>
					<XIcon className='size-4' />
				</Button>
			</div>

			<div className='flex flex-col gap-6 p-6'>
				{/* Category Form */}
				<form
					onSubmit={handleSubmit(vals => saveCategory(vals))}
					className='flex flex-col gap-4'
				>
					{/* Name */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='cat-name'>Назва</Label>
						<Input
							id='cat-name'
							placeholder='Наприклад: Електроніка'
							{...register('name')}
							aria-invalid={!!errors.name}
						/>
						{errors.name && (
							<p className='text-destructive text-xs'>{errors.name.message}</p>
						)}
					</div>

					{/* Slug */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='cat-slug'>Slug</Label>
						<Input
							id='cat-slug'
							placeholder='elektronika'
							{...register('slug')}
							aria-invalid={!!errors.slug}
						/>
						{errors.slug && (
							<p className='text-destructive text-xs'>{errors.slug.message}</p>
						)}
					</div>

					{/* Order */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='cat-order'>Порядок відображення</Label>
						<Input
							id='cat-order'
							type='number'
							min={0}
							step={1}
							className='w-32'
							placeholder='0'
							{...register('order', {
								setValueAs: v =>
									v === '' || v === undefined ? undefined : Number(v)
							})}
							aria-invalid={!!errors.order}
						/>
						{errors.order && (
							<p className='text-destructive text-xs'>{errors.order.message}</p>
						)}
						<p className='text-muted-foreground text-xs'>
							Менше значення → вище у списку. Однакові значення сортуються за назвою.
						</p>
					</div>

					{/* Image */}
					<div className='flex flex-col gap-1.5'>
						<Label>Зображення (необов'язково)</Label>

						{imageState.status === 'none' || imageState.status === 'removed' ? (
							<button
								type='button'
								onClick={() => fileInputRef.current?.click()}
								className='flex h-24 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-100'
							>
								<UploadIcon className='size-5' />
								Вибрати файл (JPEG, PNG, WebP)
							</button>
						) : imageState.status === 'existing' ? (
							<div className='relative w-fit'>
								<img
									src={imageState.url}
									alt='Preview'
									className='h-24 w-auto rounded-md border object-cover'
								/>
								<div className='mt-1 flex gap-2'>
									<Button
										type='button'
										size='xs'
										variant='outline'
										onClick={() => fileInputRef.current?.click()}
									>
										Замінити
									</Button>
									<Button
										type='button'
										size='xs'
										variant='ghost'
										onClick={handleRemoveImage}
									>
										Видалити
									</Button>
								</div>
							</div>
						) : imageState.status === 'pending' ? (
							<div className='relative w-fit'>
								<img
									src={imageState.preview}
									alt='Preview'
									className='h-24 w-auto rounded-md border object-cover'
								/>
								<p className='mt-1 text-xs text-gray-500'>
									Файл буде завантажено після збереження
								</p>
								<Button
									type='button'
									size='xs'
									variant='ghost'
									className='mt-1'
									onClick={handleRemoveImage}
								>
									Скасувати
								</Button>
							</div>
						) : imageState.status === 'uploading' ? (
							<div className='flex h-24 items-center justify-center rounded-md border bg-gray-50'>
								<p className='text-sm text-gray-500'>Завантаження...</p>
							</div>
						) : imageState.status === 'error' ? (
							<div className='rounded-md border border-red-200 bg-red-50 p-3'>
								<div className='flex items-start gap-2'>
									<AlertCircleIcon className='mt-0.5 size-4 shrink-0 text-red-500' />
									<div className='flex-1'>
										<p className='text-sm font-medium text-red-700'>
											Помилка завантаження зображення
										</p>
										<p className='text-xs text-red-500'>{imageState.message}</p>
										<p className='mt-1 text-xs text-gray-500'>
											Категорію збережено успішно, але зображення не
											завантажено.
										</p>
									</div>
								</div>
								<div className='mt-2 flex gap-2'>
									<Button
										type='button'
										size='xs'
										variant='outline'
										onClick={retryImageUpload}
									>
										<RefreshCwIcon className='size-3' />
										Спробувати знову
									</Button>
									<Button
										type='button'
										size='xs'
										variant='ghost'
										onClick={() => setImageState({ status: 'none' })}
									>
										Відмінити
									</Button>
								</div>
							</div>
						) : null}

						<input
							ref={fileInputRef}
							type='file'
							accept='image/jpeg,image/png,image/webp'
							className='hidden'
							onChange={handleFileSelect}
						/>
					</div>

					{/* Submit */}
					<div className='flex gap-2'>
						<Button type='submit' disabled={isPending}>
							{isPending ? 'Збереження...' : isEditMode ? 'Зберегти' : 'Створити'}
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={onClose}
							disabled={isPending}
						>
							Скасувати
						</Button>
					</div>
				</form>

				{/* Subcategory management — only shown in edit mode */}
				{isEditMode && (
					<>
						<hr className='border-gray-200' />
						<SubcategoryList category={initial} />
					</>
				)}
			</div>
		</div>
	)
}
