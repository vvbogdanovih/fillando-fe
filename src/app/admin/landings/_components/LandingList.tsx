'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import { DeleteConfirmDialog } from '@/app/admin/vendors/_components/DeleteConfirmDialog'
import { categoriesApi } from '@/app/admin/categories/categories.api'
import { landingsApi } from '../landings.api'
import type { Landing } from '../landings.schema'

interface LandingListProps {
	landings: Landing[]
	selectedId: string | null
	onSelect: (landing: Landing | null) => void
	onCreate: () => void
}

export const LandingList = ({ landings, selectedId, onSelect, onCreate }: LandingListProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)

	// Only to render the public address as the visitor sees it: /{categorySlug}/{slug}.
	const { data: categories = [] } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getAll()
	})
	const slugById = new Map(categories.map(c => [c._id, c.slug]))

	const { mutate: deleteLanding, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => landingsApi.delete(id),
		onSuccess: (_, id) => {
			queryClient.setQueryData<Landing[]>(['landings', 'admin'], prev =>
				prev ? prev.filter(l => l._id !== id) : []
			)
			setDeletingId(null)
			if (selectedId === id) onSelect(null)
		},
		onError: (error: Error) => {
			toast.error(error.message)
			setDeletingId(null)
		}
	})

	const sorted = [...landings].sort((a, b) => a.order - b.order || a.h1.localeCompare(b.h1, 'uk'))

	return (
		<div className='flex h-full flex-col border-r border-gray-200 bg-white'>
			<div className='flex items-center justify-between border-b border-gray-200 px-4 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>
					Лендінги
					<span className='ml-2 font-normal text-gray-400'>{landings.length}</span>
				</h2>
				<Button size='sm' onClick={onCreate}>
					<PlusIcon className='size-4' />
					Додати
				</Button>
			</div>

			<div className='flex-1 overflow-y-auto'>
				{sorted.length === 0 && (
					<p className='px-4 py-6 text-center text-sm text-gray-400'>
						Лендінгів немає. Стартовий набір створює скрипт seed-landings.js.
					</p>
				)}

				{sorted.map(landing => {
					const categorySlug = slugById.get(landing.category_id)
					const pinned = Object.entries(landing.filters)
					return (
						<div
							key={landing._id}
							onClick={() => onSelect(landing)}
							className={`flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 ${
								selectedId === landing._id ? 'bg-gray-100' : ''
							}`}
						>
							<div className='min-w-0 flex-1'>
								<p className='truncate text-sm font-medium text-gray-900'>
									{landing.h1}
								</p>
								<p className='truncate font-mono text-xs text-gray-400'>
									/{categorySlug ?? '…'}/{landing.slug}
								</p>
								<div className='mt-1 flex flex-wrap items-center gap-1.5'>
									<Badge
										variant={
											landing.status === 'active' ? 'default' : 'secondary'
										}
										className='text-xs'
									>
										{landing.status === 'active' ? 'Опубліковано' : 'Чернетка'}
									</Badge>
									{pinned.map(([key, values]) => (
										<Badge key={key} variant='outline' className='text-xs'>
											{key}: {values.join(', ')}
										</Badge>
									))}
								</div>
							</div>

							<div className='flex shrink-0 gap-1' onClick={e => e.stopPropagation()}>
								<Button
									size='icon-sm'
									variant='ghost'
									onClick={() => onSelect(landing)}
									title='Редагувати'
								>
									<PencilIcon className='size-3.5' />
								</Button>
								<Button
									size='icon-sm'
									variant='ghost'
									onClick={() => setDeletingId(landing._id)}
									title='Видалити'
								>
									<Trash2Icon className='text-destructive size-3.5' />
								</Button>
							</div>
						</div>
					)
				})}
			</div>

			<DeleteConfirmDialog
				open={!!deletingId}
				onOpenChange={open => !open && setDeletingId(null)}
				title='Видалити лендінг?'
				description='Сторінка перестане відповідати, а її адреса зникне з sitemap. Текст відновити не вийде.'
				onConfirm={() => deletingId && deleteLanding(deletingId)}
				isPending={isDeleting}
			/>
		</div>
	)
}
