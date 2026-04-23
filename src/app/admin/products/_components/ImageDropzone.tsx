'use client'

import { useRef } from 'react'
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent
} from '@dnd-kit/core'
import {
	SortableContext,
	useSortable,
	horizontalListSortingStrategy,
	arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { XIcon, UploadIcon, GripVerticalIcon } from 'lucide-react'

export interface ImageUploadItem {
	id: string // stable local id for dnd-kit key
	status: 'pending' | 'uploading' | 'uploaded' | 'error'
	file?: File
	preview?: string // object URL for local preview
	publicUrl?: string
	errorMessage?: string
}

interface SortableImageProps {
	item: ImageUploadItem
	onRemove: (id: string) => void
}

const SortableImage = ({ item, onRemove }: SortableImageProps) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1
	}

	const src = item.publicUrl ?? item.preview

	return (
		<div
			ref={setNodeRef}
			style={style}
			className='relative flex h-24 w-24 shrink-0 flex-col overflow-hidden rounded-md border border-gray-200'
		>
			{src && <img src={src} alt='preview' className='h-full w-full object-cover' />}

			{item.status === 'uploading' && (
				<div className='absolute inset-0 flex items-center justify-center bg-white/70'>
					<span className='text-[10px] text-gray-500'>Завантаження...</span>
				</div>
			)}

			{item.status === 'error' && (
				<div className='absolute inset-0 flex items-center justify-center bg-red-50/80 p-1'>
					<span className='text-center text-[10px] leading-tight text-red-600'>
						{item.errorMessage ?? 'Помилка'}
					</span>
				</div>
			)}

			{/* Drag handle */}
			<button
				type='button'
				className='absolute top-0.5 left-0.5 cursor-grab rounded bg-white/80 p-0.5 text-gray-500 hover:text-gray-800'
				{...attributes}
				{...listeners}
			>
				<GripVerticalIcon className='size-3' />
			</button>

			{/* Remove */}
			<button
				type='button'
				onClick={() => onRemove(item.id)}
				className='absolute top-0.5 right-0.5 rounded bg-white/80 p-0.5 text-gray-500 hover:text-red-600'
			>
				<XIcon className='size-3' />
			</button>
		</div>
	)
}

interface ImageDropzoneProps {
	images: ImageUploadItem[]
	onChange: (images: ImageUploadItem[]) => void
}

export const ImageDropzone = ({ images, onChange }: ImageDropzoneProps) => {
	const inputRef = useRef<HTMLInputElement>(null)

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

	const handleFiles = (files: FileList | null) => {
		if (!files) return
		const newItems: ImageUploadItem[] = Array.from(files).map(file => ({
			id: crypto.randomUUID(),
			status: 'pending' as const,
			file,
			preview: URL.createObjectURL(file)
		}))
		onChange([...images, ...newItems])
	}

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		handleFiles(e.dataTransfer.files)
	}

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault()
	}

	const handleRemove = (id: string) => {
		onChange(images.filter(img => img.id !== id))
	}

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = images.findIndex(img => img.id === active.id)
		const newIndex = images.findIndex(img => img.id === over.id)
		onChange(arrayMove(images, oldIndex, newIndex))
	}

	return (
		<div className='flex flex-col gap-2'>
			{/* Drop zone */}
			<button
				type='button'
				onClick={() => inputRef.current?.click()}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				className='flex h-16 w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-100'
			>
				<UploadIcon className='size-4' />
				Перетягніть або натисніть для вибору зображень
			</button>

			<input
				ref={inputRef}
				type='file'
				accept='image/jpeg,image/png,image/webp'
				multiple
				className='hidden'
				onChange={e => handleFiles(e.target.files)}
			/>

			{/* Thumbnails */}
			{images.length > 0 && (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={images.map(img => img.id)}
						strategy={horizontalListSortingStrategy}
					>
						<div className='flex flex-wrap gap-2'>
							{images.map(item => (
								<SortableImage key={item.id} item={item} onRemove={handleRemove} />
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</div>
	)
}
