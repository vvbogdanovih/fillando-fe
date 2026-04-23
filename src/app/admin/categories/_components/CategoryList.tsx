'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, Trash2Icon, PlusIcon, ImageIcon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import { categoriesApi } from '../categories.api'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import type { Category } from '../categories.schema'

interface CategoryListProps {
	categories: Category[]
	selectedId: string | null
	onSelect: (category: Category | null) => void
	onCreate: () => void
}

export const CategoryList = ({ categories, selectedId, onSelect, onCreate }: CategoryListProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)

	const { mutate: deleteCategory, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => categoriesApi.delete(id),
		onSuccess: (_, id) => {
			queryClient.setQueryData<Category[]>(['categories'], prev =>
				prev ? prev.filter(c => c._id !== id) : []
			)
			setDeletingId(null)
			if (selectedId === id) onSelect(null)
		}
	})

	const sorted = [...categories].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order
		return a.name.localeCompare(b.name)
	})

	return (
		<div className='flex h-full flex-col border-r border-gray-200 bg-white'>
			<div className='flex items-center justify-between border-b border-gray-200 px-4 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>Категорії</h2>
				<Button size='sm' onClick={onCreate}>
					<PlusIcon className='size-4' />
					Додати
				</Button>
			</div>

			<div className='flex-1 overflow-y-auto'>
				{sorted.length === 0 && (
					<p className='px-4 py-6 text-center text-sm text-gray-400'>Категорій немає</p>
				)}

				{sorted.map(category => (
					<div
						key={category._id}
						onClick={() => onSelect(category)}
						className={`flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 ${
							selectedId === category._id ? 'bg-gray-100' : ''
						}`}
					>
						{/* Thumbnail */}
						<div className='mt-0.5 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100'>
							{category.image ? (
								<img
									src={category.image}
									alt={category.name}
									className='size-full object-cover'
								/>
							) : (
								<ImageIcon className='size-4 text-gray-400' />
							)}
						</div>

						{/* Info */}
						<div className='min-w-0 flex-1'>
							<p className='truncate text-sm font-medium text-gray-900'>
								{category.name}
							</p>
							<p className='truncate text-xs text-gray-400'>{category.slug}</p>
							<div className='mt-1 flex items-center gap-2'>
								<Badge variant='secondary' className='text-xs'>
									{category.subcategories.length} підкат.
								</Badge>
								<span className='text-xs text-gray-400'>
									order: {category.order}
								</span>
							</div>
						</div>

						{/* Actions */}
						<div className='flex shrink-0 gap-1' onClick={e => e.stopPropagation()}>
							<Button
								size='icon-sm'
								variant='ghost'
								onClick={() => onSelect(category)}
								title='Редагувати'
							>
								<PencilIcon className='size-3.5' />
							</Button>
							<Button
								size='icon-sm'
								variant='ghost'
								onClick={() => setDeletingId(category._id)}
								title='Видалити'
							>
								<Trash2Icon className='text-destructive size-3.5' />
							</Button>
						</div>
					</div>
				))}
			</div>

			<DeleteConfirmDialog
				open={!!deletingId}
				onOpenChange={open => !open && setDeletingId(null)}
				title='Видалити категорію?'
				description={`Разом із категорією будуть видалені всі її підкатегорії. Товари, що посилаються на цю категорію, матимуть недійсні посилання — каскадного видалення немає.`}
				onConfirm={() => deletingId && deleteCategory(deletingId)}
				isPending={isDeleting}
			/>
		</div>
	)
}
