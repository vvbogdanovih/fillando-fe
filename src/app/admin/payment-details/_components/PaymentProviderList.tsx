'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, Trash2Icon, PlusIcon, CheckCircle2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import { DeleteConfirmDialog } from '@/app/admin/vendors/_components/DeleteConfirmDialog'
import { paymentProvidersApi } from '../payment-providers.api'
import type { PaymentProvider } from '../payment-providers.schema'

interface PaymentProviderListProps {
	records: PaymentProvider[]
	editingId: string | null
	onEdit: (row: PaymentProvider | null) => void
	onCreate: () => void
}

export const PaymentProviderList = ({
	records,
	editingId,
	onEdit,
	onCreate
}: PaymentProviderListProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)

	const { mutate: deleteRecord, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => paymentProvidersApi.delete(id),
		onSuccess: (_, id) => {
			void queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
			setDeletingId(null)
			if (editingId === id) onEdit(null)
			toast.success('Провайдера видалено')
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Помилка видалення')
		}
	})

	const { mutate: activateRecord, isPending: isActivating } = useMutation({
		mutationFn: (id: string) => paymentProvidersApi.activate(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
			toast.success('Активного провайдера оновлено')
		},
		onError: (err: Error) => {
			toast.error(err.message || 'Помилка активації')
		}
	})

	const sorted = [...records].sort(
		(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
	)

	return (
		<div className='flex h-full min-h-0 flex-1 flex-col bg-white'>
			<div className='flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6'>
				<h2 className='text-sm font-semibold text-gray-900'>Ключі оплати</h2>
				<Button size='sm' onClick={onCreate}>
					<PlusIcon className='size-4' />
					Додати
				</Button>
			</div>

			<div className='min-h-0 flex-1 overflow-auto'>
				{sorted.length === 0 ? (
					<div className='flex flex-col items-center justify-center gap-4 px-4 py-16 text-center'>
						<p className='max-w-sm text-sm text-gray-500'>
							Ще немає жодного набору ключів. Додайте ключі мерчанта, щоб увімкнути
							онлайн-оплату на сайті.
						</p>
						<Button size='sm' onClick={onCreate}>
							<PlusIcon className='size-4' />
							Додати перший запис
						</Button>
					</div>
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full min-w-[720px] border-collapse text-left text-sm'>
							<thead>
								<tr className='border-b border-gray-200 bg-gray-50 text-xs font-medium tracking-wide text-gray-500 uppercase'>
									<th className='px-4 py-3 sm:px-6'>Назва</th>
									<th className='px-4 py-3'>Public key</th>
									<th className='px-4 py-3'>Режим</th>
									<th className='px-4 py-3'>Статус</th>
									<th className='px-4 py-3 text-right sm:px-6'>Дії</th>
								</tr>
							</thead>
							<tbody>
								{sorted.map(row => {
									const active = row.is_active
									return (
										<tr
											key={row._id}
											className={`border-b border-gray-100 transition-colors hover:bg-gray-50/80 ${
												editingId === row._id ? 'bg-gray-50' : ''
											}`}
										>
											<td className='max-w-[200px] px-4 py-3 font-medium text-gray-900 sm:px-6'>
												<span className='line-clamp-2' title={row.label}>
													{row.label}
												</span>
											</td>
											<td className='px-4 py-3'>
												<code
													className='text-xs text-gray-700 sm:text-sm'
													title={row.public_key}
												>
													{row.public_key}
												</code>
											</td>
											<td className='px-4 py-3'>
												{row.sandbox ? (
													<Badge variant='secondary'>Sandbox</Badge>
												) : (
													<span className='text-xs text-gray-500'>
														Production
													</span>
												)}
											</td>
											<td className='px-4 py-3'>
												{active ? (
													<Badge
														variant='default'
														className='shrink-0 gap-1'
													>
														<CheckCircle2Icon className='size-3' />
														Активний
													</Badge>
												) : (
													<span className='text-xs text-gray-400'>—</span>
												)}
											</td>
											<td className='px-4 py-3 text-right sm:px-6'>
												<div className='flex flex-wrap justify-end gap-1'>
													{!active && (
														<Button
															size='sm'
															variant='secondary'
															className='h-8'
															disabled={isActivating}
															onClick={() => activateRecord(row._id)}
														>
															Зробити активним
														</Button>
													)}
													<Button
														size='sm'
														variant='outline'
														className='h-8'
														onClick={() => onEdit(row)}
													>
														<PencilIcon className='size-3.5' />
														Ред.
													</Button>
													<Button
														size='icon-sm'
														variant='ghost'
														onClick={() => setDeletingId(row._id)}
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
				)}
			</div>

			<DeleteConfirmDialog
				open={!!deletingId}
				onOpenChange={open => !open && setDeletingId(null)}
				title='Видалити ключі?'
				description='Цю дію неможливо скасувати. Набір ключів буде остаточно видалено.'
				onConfirm={() => deletingId && deleteRecord(deletingId)}
				isPending={isDeleting}
			/>
		</div>
	)
}
