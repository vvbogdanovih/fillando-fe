'use client'

import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Textarea } from '@/common/components/ui/textarea'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { categoriesApi } from '@/app/admin/categories/categories.api'
import { landingsApi } from '../landings.api'
import {
	META_DESCRIPTION_SOFT_LIMIT,
	TITLE_SOFT_LIMIT,
	landingFormSchema,
	type Landing,
	type LandingFormValues
} from '../landings.schema'
import { HtmlEditor } from './HtmlEditor'
import { PinnedFilters } from './PinnedFilters'

interface LandingFormProps {
	initial: Landing | null
	onClose: () => void
}

/** Amber past the length Google truncates at — a warning, not a validation error. */
const CharCounter = ({ value, limit }: { value: string; limit: number }) => (
	<span className={`text-xs ${value.length > limit ? 'text-amber-600' : 'text-gray-400'}`}>
		{value.length}/{limit}
	</span>
)

export const LandingForm = ({ initial, onClose }: LandingFormProps) => {
	const queryClient = useQueryClient()

	const { data: categories = [] } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getAll()
	})

	const {
		register,
		handleSubmit,
		control,
		watch,
		setValue,
		formState: { errors, isSubmitting }
	} = useForm<LandingFormValues>({
		resolver: zodResolver(landingFormSchema),
		defaultValues: initial
			? {
					category_id: initial.category_id,
					slug: initial.slug,
					h1: initial.h1,
					title: initial.title,
					meta_description: initial.meta_description,
					intro_html: initial.intro_html,
					bottom_html: initial.bottom_html,
					faq: initial.faq,
					filters: initial.filters,
					order: initial.order,
					status: initial.status
				}
			: {
					category_id: categories[0]?._id ?? '',
					slug: '',
					h1: '',
					title: '',
					meta_description: '',
					intro_html: '',
					bottom_html: '',
					faq: [],
					filters: {},
					order: 0,
					// New landings start unpublished: an empty SEO page indexed by Google is
					// worse than no page (TD-0002 §5.2.3).
					status: 'draft'
				}
	})

	const faqArray = useFieldArray({ control, name: 'faq' })

	const categoryId = watch('category_id')
	const slug = watch('slug')
	const status = watch('status')
	const categorySlug = categories.find(c => c._id === categoryId)?.slug

	const { mutate: save } = useMutation({
		mutationFn: (values: LandingFormValues) =>
			initial ? landingsApi.update(initial._id, values) : landingsApi.create(values),
		onSuccess: saved => {
			queryClient.setQueryData<Landing[]>(['landings', 'admin'], prev => {
				const rest = (prev ?? []).filter(l => l._id !== saved._id)
				return [...rest, saved]
			})
			toast.success(initial ? 'Лендінг оновлено' : 'Лендінг створено')
			onClose()
		},
		onError: (error: Error) => toast.error(error.message)
	})

	return (
		<form
			onSubmit={handleSubmit(values => save(values))}
			className='flex h-full flex-col bg-white'
		>
			<div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>
					{initial ? 'Редагувати лендінг' : 'Новий лендінг'}
				</h2>
				<Button type='button' size='icon-sm' variant='ghost' onClick={onClose}>
					<XIcon className='size-4' />
				</Button>
			</div>

			<div className='flex-1 space-y-6 overflow-y-auto px-6 py-5'>
				{/* Address */}
				<div className='grid grid-cols-2 gap-4'>
					<div className='flex flex-col gap-1.5'>
						<Label>Категорія</Label>
						<Select
							value={categoryId}
							onValueChange={value =>
								setValue('category_id', value, { shouldDirty: true })
							}
						>
							<SelectTrigger className='bg-white text-black'>
								<SelectValue placeholder='Оберіть категорію' />
							</SelectTrigger>
							<SelectContent>
								{categories.map(category => (
									<SelectItem key={category._id} value={category._id}>
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{errors.category_id && (
							<p className='text-destructive text-xs'>{errors.category_id.message}</p>
						)}
					</div>
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='landing-slug'>Адреса</Label>
						<Input id='landing-slug' placeholder='pla-silk' {...register('slug')} />
						<span className='font-mono text-xs text-gray-400'>
							/{categorySlug ?? '…'}/{slug || '…'}
						</span>
						{errors.slug && (
							<p className='text-destructive text-xs'>{errors.slug.message}</p>
						)}
					</div>
				</div>

				{/* Headings */}
				<div className='flex flex-col gap-1.5'>
					<Label htmlFor='landing-h1'>H1</Label>
					<Input id='landing-h1' placeholder='PLA Silk філамент' {...register('h1')} />
					{errors.h1 && <p className='text-destructive text-xs'>{errors.h1.message}</p>}
				</div>

				<div className='flex flex-col gap-1.5'>
					<div className='flex items-center justify-between'>
						<Label htmlFor='landing-title'>Title</Label>
						<CharCounter value={watch('title') ?? ''} limit={TITLE_SOFT_LIMIT} />
					</div>
					<Input
						id='landing-title'
						placeholder='PLA Silk філамент — купити в Україні | Fillando'
						{...register('title')}
					/>
					{errors.title && (
						<p className='text-destructive text-xs'>{errors.title.message}</p>
					)}
				</div>

				<div className='flex flex-col gap-1.5'>
					<div className='flex items-center justify-between'>
						<Label htmlFor='landing-meta'>Meta description</Label>
						<CharCounter
							value={watch('meta_description') ?? ''}
							limit={META_DESCRIPTION_SOFT_LIMIT}
						/>
					</div>
					<Textarea
						id='landing-meta'
						rows={2}
						placeholder='PLA Silk філамент з шовковим блиском. Понад 20 кольорів, доставка по Україні.'
						{...register('meta_description')}
					/>
					{errors.meta_description && (
						<p className='text-destructive text-xs'>
							{errors.meta_description.message}
						</p>
					)}
				</div>

				{/* Pinned filters */}
				<Controller
					control={control}
					name='filters'
					render={({ field }) => (
						<PinnedFilters
							categoryId={categoryId}
							value={field.value ?? {}}
							onChange={field.onChange}
						/>
					)}
				/>

				{/* Copy */}
				<div className='flex flex-col gap-1.5'>
					<Label>Текст над сіткою</Label>
					<Controller
						control={control}
						name='intro_html'
						render={({ field }) => (
							<HtmlEditor
								value={field.value ?? ''}
								onChange={field.onChange}
								placeholder='Короткий вступ, 1–2 речення'
							/>
						)}
					/>
				</div>

				<div className='flex flex-col gap-1.5'>
					<Label>Текст під сіткою</Label>
					<Controller
						control={control}
						name='bottom_html'
						render={({ field }) => (
							<HtmlEditor
								value={field.value ?? ''}
								onChange={field.onChange}
								placeholder='Основний SEO-текст'
							/>
						)}
					/>
				</div>

				{/* FAQ */}
				<div className='flex flex-col gap-2'>
					<div className='flex items-center justify-between'>
						<Label>FAQ ({faqArray.fields.length})</Label>
						<Button
							type='button'
							size='sm'
							variant='outline'
							onClick={() => faqArray.append({ q: '', a: '' })}
						>
							<PlusIcon className='size-3.5' />
							Додати питання
						</Button>
					</div>
					{faqArray.fields.map((field, index) => (
						<div
							key={field.id}
							className='flex flex-col gap-2 rounded-lg border border-gray-200 p-3'
						>
							<div className='flex items-start gap-2'>
								<Input
									placeholder='Питання'
									aria-label={`Питання ${index + 1}`}
									{...register(`faq.${index}.q`)}
								/>
								<Button
									type='button'
									size='icon-sm'
									variant='ghost'
									title='Видалити'
									onClick={() => faqArray.remove(index)}
								>
									<Trash2Icon className='text-destructive size-3.5' />
								</Button>
							</div>
							<Textarea
								rows={2}
								placeholder='Відповідь'
								aria-label={`Відповідь ${index + 1}`}
								{...register(`faq.${index}.a`)}
							/>
							{errors.faq?.[index] && (
								<p className='text-destructive text-xs'>
									Заповніть питання і відповідь
								</p>
							)}
						</div>
					))}
					<p className='text-xs text-gray-400'>
						Розмітка з відповідей вирізається сервером — це звичайний текст.
					</p>
				</div>

				{/* Publication */}
				<div className='flex items-end gap-4'>
					<div className='flex w-48 flex-col gap-1.5'>
						<Label>Статус</Label>
						<Select
							value={status}
							onValueChange={value =>
								setValue('status', value as LandingFormValues['status'], {
									shouldDirty: true
								})
							}
						>
							<SelectTrigger className='bg-white text-black'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='draft'>Чернетка</SelectItem>
								<SelectItem value='active'>Опубліковано</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='flex w-32 flex-col gap-1.5'>
						<Label htmlFor='landing-order'>Порядок</Label>
						<Input
							id='landing-order'
							type='number'
							min={0}
							{...register('order', { valueAsNumber: true })}
						/>
					</div>
					{status === 'draft' && (
						<p className='pb-2 text-xs text-gray-400'>
							Чернетка недоступна публічно і не потрапляє в sitemap.
						</p>
					)}
				</div>
			</div>

			<div className='flex justify-end gap-2 border-t border-gray-200 px-6 py-4'>
				<Button type='button' variant='outline' onClick={onClose}>
					Скасувати
				</Button>
				<Button type='submit' disabled={isSubmitting}>
					{isSubmitting ? 'Збереження...' : 'Зберегти'}
				</Button>
			</div>
		</form>
	)
}
