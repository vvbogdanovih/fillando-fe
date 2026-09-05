'use client'

import { useRef, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { ArrowLeftIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
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
import { useLandingMatchCount } from './useLandingMatchCount'

interface LandingFormProps {
	initial: Landing | null
	onClose: () => void
}

type ImageState =
	| { status: 'none' }
	| { status: 'existing'; url: string }
	| { status: 'pending'; file: File; preview: string }
	| { status: 'removed' }

/** Amber past the length Google truncates at — a warning, not a validation error. */
const CharCounter = ({ value, limit }: { value: string; limit: number }) => (
	<span className={`text-xs ${value.length > limit ? 'text-amber-600' : 'text-gray-400'}`}>
		{value.length}/{limit}
	</span>
)

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
	<Card className='h-fit'>
		<CardHeader className='border-b'>
			<CardTitle className='text-base'>{title}</CardTitle>
		</CardHeader>
		<CardContent className='space-y-4 pt-5'>{children}</CardContent>
	</Card>
)

export const LandingForm = ({ initial, onClose }: LandingFormProps) => {
	const queryClient = useQueryClient()
	const fileInputRef = useRef<HTMLInputElement>(null)

	const [image, setImage] = useState<ImageState>(
		initial?.image ? { status: 'existing', url: initial.image } : { status: 'none' }
	)

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
					image: initial.image,
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
					image: null,
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
	const filters = watch('filters') ?? {}
	const categorySlug = categories.find(c => c._id === categoryId)?.slug

	// The same count the listing shows and the API refuses to publish on — asked here so the
	// editor is told before saving rather than by a 409 afterwards.
	const { total: matchCount, isKnown: isCountKnown } = useLandingMatchCount(categoryId, filters)
	const wouldPublishNothing = status === 'active' && isCountKnown && matchCount === 0

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return
		setImage({ status: 'pending', file, preview: URL.createObjectURL(file) })
		// Reset the input so re-picking the same file after an error still fires a change.
		event.target.value = ''
	}

	const { mutate: save } = useMutation({
		mutationFn: async (values: LandingFormValues) => {
			const saved = initial
				? await landingsApi.update(initial._id, values)
				: await landingsApi.create(values)

			// The image needs an id to be keyed under, so it goes up after the landing exists
			// and its URL comes back in a second PATCH — the same order the category form uses.
			if (image.status === 'pending') {
				const url = await landingsApi.uploadImage(saved._id, image.file)
				return landingsApi.update(saved._id, { image: url })
			}
			if (image.status === 'removed' && initial) {
				return landingsApi.update(saved._id, { image: null })
			}
			return saved
		},
		onSuccess: () => {
			// Refetched rather than patched into the cache: `product_count` is computed server
			// side and a filter change is exactly what moves it, so the stored number would be
			// stale the moment it matters.
			void queryClient.invalidateQueries({ queryKey: ['landings', 'admin'] })
			toast.success(initial ? 'Лендінг оновлено' : 'Лендінг створено')
			onClose()
		},
		onError: (error: Error) => toast.error(error.message)
	})

	return (
		<form onSubmit={handleSubmit(values => save(values))} className='space-y-6 p-6'>
			<div className='flex items-center justify-between gap-3'>
				<div className='flex items-center gap-3'>
					<Button type='button' size='icon-sm' variant='ghost' onClick={onClose}>
						<ArrowLeftIcon className='size-4' />
					</Button>
					<h1 className='text-2xl font-semibold tracking-tight'>
						{initial ? `Редагування: ${initial.h1}` : 'Новий лендінг'}
					</h1>
				</div>
				<div className='flex gap-2'>
					<Button type='button' variant='outline' onClick={onClose}>
						Скасувати
					</Button>
					<Button type='submit' disabled={isSubmitting || wouldPublishNothing}>
						{isSubmitting ? 'Збереження...' : 'Зберегти'}
					</Button>
				</div>
			</div>

			<div className='grid gap-6 lg:grid-cols-[1fr_380px]'>
				<div className='space-y-6'>
					<Section title='Адреса та заголовки'>
						<div className='grid gap-4 sm:grid-cols-2'>
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
									<p className='text-destructive text-xs'>
										{errors.category_id.message}
									</p>
								)}
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='landing-slug'>Адреса</Label>
								<Input
									id='landing-slug'
									placeholder='pla-silk'
									{...register('slug')}
								/>
								<span className='font-mono text-xs text-gray-400'>
									/{categorySlug ?? '…'}/{slug || '…'}
								</span>
								{errors.slug && (
									<p className='text-destructive text-xs'>
										{errors.slug.message}
									</p>
								)}
							</div>
						</div>

						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='landing-h1'>H1</Label>
							<Input
								id='landing-h1'
								placeholder='PLA Silk філамент'
								{...register('h1')}
							/>
							<p className='text-xs text-gray-400'>
								Заголовок сторінки для покупця — те, що він бачить першим.
							</p>
							{errors.h1 && (
								<p className='text-destructive text-xs'>{errors.h1.message}</p>
							)}
						</div>

						<div className='flex flex-col gap-1.5'>
							<div className='flex items-center justify-between'>
								<Label htmlFor='landing-title'>Title</Label>
								<CharCounter
									value={watch('title') ?? ''}
									limit={TITLE_SOFT_LIMIT}
								/>
							</div>
							<Input
								id='landing-title'
								placeholder='PLA Silk філамент — купити в Україні | Fillando'
								{...register('title')}
							/>
							<p className='text-xs text-gray-400'>
								Рядок у видачі Google. Довше {TITLE_SOFT_LIMIT} символів — обріже.
							</p>
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
					</Section>

					<Section title='Контент'>
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
							<p className='text-xs text-gray-400'>
								Розмітка обох текстів санітизується на записі — так само, як описи
								товарів. Дозволені лише безпечні теги.
							</p>
						</div>

						<div className='flex flex-col gap-1.5'>
							<Label>Зображення плитки</Label>
							<div className='flex items-center gap-3'>
								{image.status === 'existing' || image.status === 'pending' ? (
									<Image
										src={
											image.status === 'existing' ? image.url : image.preview
										}
										alt=''
										width={72}
										height={72}
										className='size-18 rounded-lg border border-gray-200 object-cover'
										unoptimized
									/>
								) : (
									<div className='flex size-18 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400'>
										немає
									</div>
								)}
								<div className='flex gap-2'>
									<Button
										type='button'
										size='sm'
										variant='outline'
										onClick={() => fileInputRef.current?.click()}
									>
										<UploadIcon className='size-3.5' />
										Обрати
									</Button>
									{(image.status === 'existing' ||
										image.status === 'pending') && (
										<Button
											type='button'
											size='sm'
											variant='ghost'
											onClick={() =>
												setImage(
													image.status === 'existing'
														? { status: 'removed' }
														: { status: 'none' }
												)
											}
										>
											Прибрати
										</Button>
									)}
								</div>
								<input
									ref={fileInputRef}
									type='file'
									accept='image/webp,image/jpeg,image/png'
									className='hidden'
									aria-label='Зображення плитки'
									onChange={handleFileSelect}
								/>
							</div>
							<p className='text-xs text-gray-400'>
								Показується плиткою в блоці «Популярні види» на сторінці категорії.
								Завантажується після збереження лендінга.
							</p>
						</div>
					</Section>

					<Section title={`FAQ (${faqArray.fields.length})`}>
						<div className='flex justify-end'>
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
					</Section>
				</div>

				<div className='space-y-6'>
					<Section title='Закріплені фільтри'>
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
					</Section>

					<Section title='Публікація'>
						<div className='flex flex-col gap-1.5'>
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
							{status === 'draft' && (
								<p className='text-xs text-gray-400'>
									Чернетка недоступна публічно і не потрапляє в sitemap.
								</p>
							)}
						</div>

						{/*
						 * Blocked here as well as on the server: a published landing matching
						 * nothing enters the sitemap as an empty page, and finding that out from
						 * a 409 after writing the whole form is worse than being told now.
						 */}
						{wouldPublishNothing && (
							<p className='text-destructive text-xs'>
								Під закріплені фільтри не підпадає жоден товар — публікувати такий
								лендінг не можна. Збережіть чернеткою або змініть фільтри.
							</p>
						)}

						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='landing-order'>Порядок</Label>
							<Input
								id='landing-order'
								type='number'
								min={0}
								{...register('order', { valueAsNumber: true })}
							/>
							<p className='text-xs text-gray-400'>
								Менше число — вище в списку і в блоці «Популярні види».
							</p>
						</div>
					</Section>
				</div>
			</div>
		</form>
	)
}
