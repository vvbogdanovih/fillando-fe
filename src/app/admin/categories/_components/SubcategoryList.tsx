'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, Trash2Icon, PlusIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { categoriesApi } from '../categories.api'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { SubcategoryForm } from './SubcategoryForm'
import type { Category, Subcategory, SubcategoryFormValues } from '../categories.schema'

interface SubcategoryListProps {
	category: Category
}

export const SubcategoryList = ({ category }: SubcategoryListProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)
	const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null | undefined>(
		undefined // undefined = closed, null = new, Subcategory = editing
	)

	const syncToCache = (updated: Category) => {
		queryClient.setQueryData<Category[]>(['categories'], prev =>
			prev ? prev.map(c => (c._id === updated._id ? updated : c)) : [updated]
		)
	}

	const { mutate: createSub, isPending: isCreating } = useMutation({
		mutationFn: (data: SubcategoryFormValues) =>
			categoriesApi.createSubcategory(category._id, data),
		onSuccess: updated => {
			syncToCache(updated)
			setEditingSubcategory(undefined)
			toast.success('Підкатегорію додано')
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Помилка при створенні підкатегорії')
		}
	})

	const { mutate: updateSub, isPending: isUpdating } = useMutation({
		mutationFn: ({ subId, data }: { subId: string; data: SubcategoryFormValues }) =>
			categoriesApi.updateSubcategory(category._id, subId, data),
		onSuccess: updated => {
			syncToCache(updated)
			setEditingSubcategory(undefined)
			toast.success('Підкатегорію збережено')
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Помилка при оновленні підкатегорії')
		}
	})

	const { mutate: deleteSub, isPending: isDeleting } = useMutation({
		mutationFn: (subId: string) => categoriesApi.deleteSubcategory(category._id, subId),
		onSuccess: (_, subId) => {
			queryClient.setQueryData<Category[]>(['categories'], prev =>
				prev
					? prev.map(c =>
							c._id === category._id
								? {
										...c,
										subcategories: c.subcategories.filter(s => s._id !== subId)
									}
								: c
						)
					: []
			)
			setDeletingId(null)
			toast.success('Підкатегорію видалено')
		}
	})

	const handleSubFormSubmit = (data: SubcategoryFormValues) => {
		if (editingSubcategory) {
			updateSub({ subId: editingSubcategory._id, data })
		} else {
			createSub(data)
		}
	}

	const isFormOpen = editingSubcategory !== undefined
	const isPendingForm = isCreating || isUpdating

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex items-center justify-between'>
				<h3 className='text-sm font-semibold text-gray-700'>
					Підкатегорії ({category.subcategories.length})
				</h3>
				<Button size='xs' variant='outline' onClick={() => setEditingSubcategory(null)}>
					<PlusIcon className='size-3' />
					Додати
				</Button>
			</div>

			{category.subcategories.length === 0 && (
				<p className='text-muted-foreground text-sm'>Підкатегорій немає</p>
			)}

			<div className='flex flex-col gap-1'>
				{category.subcategories.map(sub => (
					<div
						key={sub._id}
						className='flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2'
					>
						<div className='min-w-0'>
							<p className='truncate text-sm font-medium text-gray-800'>{sub.name}</p>
							<p className='truncate text-xs text-gray-400'>{sub.slug}</p>
							{sub.required_attributes.length > 0 && (
								<p className='mt-0.5 text-xs text-gray-400'>
									{sub.required_attributes.length} атр.
								</p>
							)}
						</div>
						<div className='flex shrink-0 gap-1'>
							<Button
								size='icon-xs'
								variant='ghost'
								onClick={() => setEditingSubcategory(sub)}
								title='Редагувати'
							>
								<PencilIcon className='size-3.5' />
							</Button>
							<Button
								size='icon-xs'
								variant='ghost'
								onClick={() => setDeletingId(sub._id)}
								title='Видалити'
							>
								<Trash2Icon className='text-destructive size-3.5' />
							</Button>
						</div>
					</div>
				))}
			</div>

			<SubcategoryForm
				open={isFormOpen}
				onOpenChange={open => !open && setEditingSubcategory(undefined)}
				initial={editingSubcategory ?? null}
				onSubmit={handleSubFormSubmit}
				isPending={isPendingForm}
			/>

			<DeleteConfirmDialog
				open={!!deletingId}
				onOpenChange={open => !open && setDeletingId(null)}
				title='Видалити підкатегорію?'
				description='Товари, що посилаються на цю підкатегорію, матимуть недійсний subcategory_id — каскадного видалення немає.'
				onConfirm={() => deletingId && deleteSub(deletingId)}
				isPending={isDeleting}
			/>
		</div>
	)
}
