'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, PencilIcon, TriangleAlertIcon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import { DeleteConfirmDialog } from '@/app/admin/vendors/_components/DeleteConfirmDialog'
import { categoriesApi } from '@/app/admin/categories/categories.api'
import { revalidateStorefront } from '@/common/services/revalidate.service'
import { landingsApi } from '../landings.api'
import { hasContent, type AdminLanding } from '../landings.schema'
import { attributeLabel, buildAttributeLabels } from './landing-attributes'

interface LandingTableProps {
	landings: AdminLanding[]
	onSelect: (landing: AdminLanding) => void
}

export const LandingTable = ({ landings, onSelect }: LandingTableProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)

	// Two things come from the categories: the public address as the visitor sees it, and the
	// human label behind each pinned attribute key.
	const { data: categories = [] } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getAll()
	})
	const slugById = new Map(categories.map(c => [c._id, c.slug]))
	const labels = buildAttributeLabels(categories)

	const { mutate: deleteLanding, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => landingsApi.delete(id),
		onSuccess: (_, id) => {
			// Also drops the tile in «Популярні види» on the category page, which would otherwise
			// keep pointing at an address that now 404s.
			void revalidateStorefront('landings')
			queryClient.setQueryData<AdminLanding[]>(['landings', 'admin'], prev =>
				prev ? prev.filter(l => l._id !== id) : []
			)
			setDeletingId(null)
		},
		onError: (error: Error) => {
			toast.error(error.message)
			setDeletingId(null)
		}
	})

	const sorted = [...landings].sort((a, b) => a.order - b.order || a.h1.localeCompare(b.h1, 'uk'))

	if (sorted.length === 0) {
		return (
			<p className='py-6 text-center text-sm text-gray-400'>
				Лендінгів немає. Стартовий набір створює скрипт seed-landings.js.
			</p>
		)
	}

	return (
		<>
			<div className='overflow-x-auto'>
				<table className='w-full min-w-[900px] text-sm'>
					<thead>
						<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
							<th className='px-3 py-2'>Адреса</th>
							<th className='px-3 py-2'>H1</th>
							<th className='px-3 py-2'>Закріплені фільтри</th>
							<th className='px-3 py-2 text-right'>Товарів</th>
							<th className='px-3 py-2'>Контент</th>
							<th className='px-3 py-2'>Статус</th>
							<th className='px-3 py-2 text-right'>Порядок</th>
							<th className='px-3 py-2 text-right'>Дії</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map(landing => {
							const written = hasContent(landing)
							const pinned = Object.entries(landing.filters)
							return (
								<tr
									key={landing._id}
									onClick={() => onSelect(landing)}
									className='cursor-pointer border-b transition-colors hover:bg-gray-50'
								>
									<td className='px-3 py-2 font-mono text-xs whitespace-nowrap text-gray-500'>
										/{slugById.get(landing.category_id) ?? '…'}/{landing.slug}
									</td>
									<td className='px-3 py-2 font-medium text-gray-900'>
										{landing.h1}
									</td>

									{/* Human labels, not the derived keys: the editor pinned
									    «Тип пластику», not `polymer`. */}
									<td className='px-3 py-2'>
										{pinned.length === 0 ? (
											<span className='text-xs text-gray-400'>
												вся категорія
											</span>
										) : (
											<div className='flex flex-wrap gap-1.5'>
												{pinned.map(([key, values]) => (
													<Badge
														key={key}
														variant='outline'
														className='text-xs'
													>
														{attributeLabel(
															labels,
															landing.category_id,
															key
														)}
														: {values.join(', ')}
													</Badge>
												))}
											</div>
										)}
									</td>

									{/*
									 * A zero here is a page that would be indexed empty. The API
									 * refuses to publish on it, so the column and the guard are
									 * the same number.
									 */}
									<td
										className={`px-3 py-2 text-right tabular-nums ${
											landing.product_count === 0
												? 'text-destructive font-medium'
												: 'font-medium text-gray-900'
										}`}
									>
										{landing.product_count}
									</td>

									{/* The column the mock exists for: which of the fourteen are
									    still without text. */}
									<td className='px-3 py-2'>
										<span
											className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${
												written ? 'text-emerald-600' : 'text-amber-600'
											}`}
										>
											{written ? (
												<CheckIcon className='size-3.5' />
											) : (
												<TriangleAlertIcon className='size-3.5' />
											)}
											{written ? 'готовий' : 'порожній'}
										</span>
									</td>

									<td className='px-3 py-2'>
										<Badge
											variant={
												landing.status === 'active'
													? 'default'
													: 'secondary'
											}
											className='text-xs whitespace-nowrap'
										>
											{landing.status === 'active'
												? 'Опубліковано'
												: 'Чернетка'}
										</Badge>
									</td>
									<td className='px-3 py-2 text-right text-gray-600 tabular-nums'>
										{landing.order}
									</td>

									<td className='px-3 py-2' onClick={e => e.stopPropagation()}>
										<div className='flex justify-end gap-1'>
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
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			<DeleteConfirmDialog
				open={!!deletingId}
				onOpenChange={open => !open && setDeletingId(null)}
				title='Видалити лендінг?'
				description='Сторінка перестане відповідати, а її адреса зникне з sitemap. Текст відновити не вийде.'
				onConfirm={() => deletingId && deleteLanding(deletingId)}
				isPending={isDeleting}
			/>
		</>
	)
}
