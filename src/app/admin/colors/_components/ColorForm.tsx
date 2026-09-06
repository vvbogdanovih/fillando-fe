'use client'

import { useEffect, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent
} from '@dnd-kit/core'
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@/common/components/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { stopsLabel } from './color-labels'
import { toSlug } from '@/common/utils'
import { colorsApi } from '../colors.api'
import {
	COLOR_FAMILIES,
	COLOR_FAMILY_LABELS,
	colorFormSchema,
	type AdminColor,
	type Color,
	type ColorFormValues
} from '../colors.schema'

interface ColorFormProps {
	initial: Color | null
	onClose: () => void
}

/** Six is where a 24px circle stops being readable, so the dictionary caps stops there. */
const MAX_STOPS = 6

/** Stops are bare strings and may repeat, so the sortable id is the position, not the value. */
const stopId = (index: number) => `stop-${index}`

/**
 * One draggable stop row (artboard «Діалог кольору»: «Перетягуванням змінюється порядок»).
 * The grip is the only drag handle, so the colour picker and the HEX input keep their own
 * pointer behaviour; the arrow buttons stay as the keyboard-reachable way to reorder.
 */
const SortableStopRow = ({ id, children }: { id: string; children: ReactNode }) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging
	} = useSortable({ id })
	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={
				isDragging ? 'flex items-center gap-2 opacity-60' : 'flex items-center gap-2'
			}
		>
			<button
				type='button'
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				className='text-muted-foreground hover:text-foreground flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing'
				aria-label='Перетягнути, щоб змінити порядок'
				title='Перетягуванням змінюється порядок'
			>
				<GripVerticalIcon className='size-4' />
			</button>
			{children}
		</div>
	)
}
const DEFAULT_STOP = '#000000'

export const ColorForm = ({ initial, onClose }: ColorFormProps) => {
	const queryClient = useQueryClient()

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors, isSubmitting }
	} = useForm<ColorFormValues>({
		resolver: zodResolver(colorFormSchema),
		defaultValues: initial
			? {
					name_en: initial.name_en,
					name_uk: initial.name_uk,
					slug: initial.slug,
					family: initial.family,
					hex_stops: initial.hex_stops,
					order: initial.order
				}
			: {
					name_en: '',
					name_uk: '',
					slug: '',
					family: 'black',
					hex_stops: [DEFAULT_STOP],
					order: 0
				}
	})

	// `useFieldArray` needs objects, but a stop is a bare string, so the array is driven
	// manually through `watch` + `setValue` instead.
	const stops = watch('hex_stops') ?? []
	const family = watch('family')
	const nameEn = watch('name_en')

	// The API derives the slug from `name_en` when it is blank; previewing it here means the
	// admin sees the address before saving rather than after.
	useEffect(() => {
		if (initial) return
		setValue('slug', nameEn ? toSlug(nameEn) : '')
	}, [nameEn, initial, setValue])

	const setStops = (next: string[]) =>
		setValue('hex_stops', next, { shouldValidate: true, shouldDirty: true })

	const moveStop = (index: number, direction: -1 | 1) => {
		const target = index + direction
		if (target < 0 || target >= stops.length) return
		const next = [...stops]
		;[next[index], next[target]] = [next[target], next[index]]
		setStops(next)
	}

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)

	const handleStopDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return
		const from = Number(String(active.id).replace('stop-', ''))
		const to = Number(String(over.id).replace('stop-', ''))
		if (Number.isNaN(from) || Number.isNaN(to)) return
		setStops(arrayMove(stops, from, to))
	}

	const { mutate: save } = useMutation({
		mutationFn: (values: ColorFormValues) =>
			initial ? colorsApi.update(initial._id, values) : colorsApi.create(values),
		onSuccess: saved => {
			const cached = queryClient.getQueryData<AdminColor[]>(['colors'])
			if (cached) {
				// The write endpoints answer with the dictionary row alone, so the usage count
				// has to be carried over from the row already on screen — a colour just created
				// has none yet, and saving one must never blank its «Варіантів» cell.
				const previous = cached.find(c => c._id === saved._id)
				queryClient.setQueryData<AdminColor[]>(
					['colors'],
					[
						...cached.filter(c => c._id !== saved._id),
						{ ...saved, variant_count: previous?.variant_count ?? 0 }
					]
				)
			} else {
				// Nothing to merge into: the list is still loading or failed to load. Seeding it
				// with this single row would show a dictionary of one — and `setQueryData`
				// resolves the query to success, so it would also erase the error notice.
				void queryClient.invalidateQueries({ queryKey: ['colors'] })
			}
			toast.success(initial ? 'Колір оновлено' : 'Колір створено')
			onClose()
		},
		onError: (error: Error) => toast.error(error.message)
	})

	return (
		// The component is mounted only while open, so the dialog opens with it; `onOpenChange`
		// covers Esc, the corner cross and a click on the overlay alike.
		<Dialog open onOpenChange={open => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<DialogHeader>
					<DialogTitle>{initial ? 'Редагувати колір' : 'Новий колір'}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(values => save(values))}>
					{/* The stop rows make this form taller than a short viewport; the body
					    scrolls so the save button never leaves the screen. */}
					<div className='max-h-[60vh] space-y-5 overflow-y-auto pr-1'>
						{/* Live preview: the swatch, the label and the address the shopper will
						    get, all painted and built by the same rules as the storefront. */}
						<div className='flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4'>
							<ColorSwatch hexStops={stops} family={family} size={56} />
							<div className='min-w-0 text-sm'>
								<p className='text-xs text-gray-500'>
									Прев'ю на сайті · {stopsLabel(stops.length)}
								</p>
								<p className='mt-0.5 font-medium text-gray-900'>
									{watch('name_uk') || 'Назва українською'}{' '}
									<span className='font-normal text-gray-400'>
										({nameEn || 'English name'})
									</span>
								</p>
								<p className='mt-0.5 font-mono text-xs text-gray-400'>
									{watch('slug') || (nameEn ? toSlug(nameEn) : 'slug')}
								</p>
							</div>
						</div>

						{/* Canonical English leads, as on the artboard: it is the unique key the
						    migration matches on, and the slug is derived from it. */}
						<div className='grid grid-cols-2 gap-4'>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='color-name-en'>Name EN (канон)</Label>
								<Input
									id='color-name-en'
									placeholder='Black'
									{...register('name_en')}
								/>
								<p className='text-xs text-gray-400'>
									Як у виробника — унікальне, використовується у slug.
								</p>
								{errors.name_en && (
									<p className='text-destructive text-xs'>
										{errors.name_en.message}
									</p>
								)}
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='color-name-uk'>Назва укр</Label>
								<Input
									id='color-name-uk'
									placeholder='Чорний'
									{...register('name_uk')}
								/>
								<p className='text-xs text-gray-400'>
									На сайті показуватиметься «
									{(watch('name_uk') || 'Зелений Bambu').trim()} (
									{(nameEn || 'Bambu Green').trim()})».
								</p>
								{errors.name_uk && (
									<p className='text-destructive text-xs'>
										{errors.name_uk.message}
									</p>
								)}
							</div>
						</div>

						<div className='grid grid-cols-2 gap-4'>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='color-slug'>Slug</Label>
								<Input id='color-slug' placeholder='black' {...register('slug')} />
								<p className='text-xs text-gray-400'>
									Порожній — сервер згенерує з англійської назви
								</p>
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label>Родина</Label>
								<Select
									value={family}
									onValueChange={value =>
										setValue('family', value as ColorFormValues['family'], {
											shouldDirty: true
										})
									}
								>
									<SelectTrigger className='bg-white text-black'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{COLOR_FAMILIES.map(value => (
											<SelectItem key={value} value={value}>
												{COLOR_FAMILY_LABELS[value]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className='text-xs text-gray-400'>За нею фільтрує каталог</p>
							</div>
						</div>

						{/* Stops: order matters — the first one is the primary colour. */}
						<div className='flex flex-col gap-2'>
							<div className='flex items-center justify-between'>
								<Label>Кольори ({stops.length}/6)</Label>
								<Button
									type='button'
									size='sm'
									variant='outline'
									disabled={stops.length >= MAX_STOPS}
									onClick={() => setStops([...stops, DEFAULT_STOP])}
								>
									<PlusIcon className='size-3.5' />
									Додати
								</Button>
							</div>

							<p className='text-muted-foreground text-xs'>
								Перетягуванням за ручку змінюється порядок; стрілки роблять те саме
								з клавіатури.
							</p>
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={handleStopDragEnd}
							>
								<SortableContext
									items={stops.map((_, index) => stopId(index))}
									strategy={verticalListSortingStrategy}
								>
									{stops.map((stop, index) => (
										<SortableStopRow key={stopId(index)} id={stopId(index)}>
											<span className='w-6 shrink-0 text-xs text-gray-400'>
												{index + 1}
											</span>
											<input
												type='color'
												aria-label={`Колір ${index + 1}`}
												value={
													/^#[0-9a-fA-F]{6}$/.test(stop)
														? stop
														: DEFAULT_STOP
												}
												onChange={e => {
													const next = [...stops]
													next[index] = e.target.value
													setStops(next)
												}}
												className='h-9 w-12 shrink-0 cursor-pointer rounded border border-gray-200 bg-white'
											/>
											<Input
												value={stop}
												aria-label={`HEX ${index + 1}`}
												onChange={e => {
													const next = [...stops]
													next[index] = e.target.value
													setStops(next)
												}}
												className='font-mono'
											/>
											{/* Arrows beside the drag handle: the keyboard-reachable way to reorder. */}
											<Button
												type='button'
												size='icon-sm'
												variant='ghost'
												title='Вище'
												disabled={index === 0}
												onClick={() => moveStop(index, -1)}
											>
												<ArrowUpIcon className='size-3.5' />
											</Button>
											<Button
												type='button'
												size='icon-sm'
												variant='ghost'
												title='Нижче'
												disabled={index === stops.length - 1}
												onClick={() => moveStop(index, 1)}
											>
												<ArrowDownIcon className='size-3.5' />
											</Button>
											<Button
												type='button'
												size='icon-sm'
												variant='ghost'
												title='Видалити'
												disabled={stops.length <= 1}
												onClick={() =>
													setStops(stops.filter((_, i) => i !== index))
												}
											>
												<Trash2Icon className='text-destructive size-3.5' />
											</Button>
										</SortableStopRow>
									))}
								</SortableContext>
							</DndContext>
							{errors.hex_stops && (
								<p className='text-destructive text-xs'>
									{errors.hex_stops.message ??
										errors.hex_stops.find?.(Boolean)?.message ??
										'Перевірте формат кольорів'}
								</p>
							)}
							<p className='text-xs text-gray-400'>
								Перший колір — основний: його бере фід і будь-яке місце, де потрібен
								один колір.{' '}
								{stops.length === 1
									? 'Один колір — суцільний кружечок.'
									: family === 'multicolor'
										? 'Кілька кольорів у родині «Багатокольорові» — конічний градієнт.'
										: 'Кілька кольорів — лінійний градієнт.'}
							</p>
						</div>

						<div className='flex w-32 flex-col gap-1.5'>
							<Label htmlFor='color-order'>Порядок</Label>
							<Input
								id='color-order'
								type='number'
								min={0}
								{...register('order', { valueAsNumber: true })}
							/>
						</div>
					</div>

					<DialogFooter className='mt-5'>
						<Button type='button' variant='outline' onClick={onClose}>
							Скасувати
						</Button>
						<Button type='submit' disabled={isSubmitting}>
							{isSubmitting ? 'Збереження...' : 'Зберегти'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
