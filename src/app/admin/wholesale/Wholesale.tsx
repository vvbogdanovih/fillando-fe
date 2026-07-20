'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Badge } from '@/common/components/ui/badge'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { wholesaleAdminApi } from './wholesale.api'
import type { WholesaleInquiry, WholesaleInquiryStatus } from './wholesale.schema'

type StatusFilter = 'all' | WholesaleInquiryStatus

function formatDateTime(dateString?: string): string {
	if (!dateString) return '—'
	const d = new Date(dateString)
	if (Number.isNaN(d.getTime())) return '—'
	return d.toLocaleString('uk-UA')
}

export function Wholesale() {
	const [page, setPage] = useState(1)
	const [limit, setLimit] = useState(20)
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	const queryClient = useQueryClient()

	const { data, isLoading, isError, refetch, isFetching } = useQuery({
		queryKey: ['admin-wholesale', page, limit, statusFilter],
		queryFn: () =>
			wholesaleAdminApi.getAll({
				page,
				limit,
				status: statusFilter === 'all' ? undefined : statusFilter
			})
	})

	const inquiries = data?.items ?? []
	const total = data?.total ?? 0
	const totalPages = Math.max(1, Math.ceil(total / limit))
	const canPrev = page > 1
	const canNext = page < totalPages

	const statusMutation = useMutation({
		mutationFn: (inquiry: WholesaleInquiry) =>
			wholesaleAdminApi.updateStatus(
				inquiry.id,
				inquiry.status === 'NEW' ? 'PROCESSED' : 'NEW'
			),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['admin-wholesale'] })
		},
		onError: (error: Error) => {
			toast.error(error.message || 'Не вдалося оновити статус заявки')
		}
	})

	return (
		<div className='p-6'>
			<Card>
				<CardHeader className='border-b'>
					<CardTitle>Оптові заявки</CardTitle>
					<div className='mt-4 grid gap-3 sm:grid-cols-[180px_130px]'>
						<Select
							value={statusFilter}
							onValueChange={value => {
								setStatusFilter(value as StatusFilter)
								setPage(1)
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder='Статус' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>Всі</SelectItem>
								<SelectItem value='NEW'>Нові</SelectItem>
								<SelectItem value='PROCESSED'>Опрацьовані</SelectItem>
							</SelectContent>
						</Select>

						<Select
							value={String(limit)}
							onValueChange={value => {
								setLimit(Number(value))
								setPage(1)
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder='Ліміт' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='10'>10 / стор</SelectItem>
								<SelectItem value='20'>20 / стор</SelectItem>
								<SelectItem value='50'>50 / стор</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent className='pt-5'>
					{isLoading ? (
						<p className='text-sm text-gray-500'>Завантаження...</p>
					) : isError ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>Не вдалося завантажити заявки</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : inquiries.length === 0 ? (
						<p className='text-sm text-gray-500'>Заявок поки немає</p>
					) : (
						<div className='space-y-4'>
							<div className='overflow-x-auto'>
								<table className='w-full min-w-[860px] text-sm'>
									<thead>
										<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
											<th className='px-3 py-2'>Дата</th>
											<th className='px-3 py-2'>Ім&apos;я</th>
											<th className='px-3 py-2'>Телефон</th>
											<th className='px-3 py-2'>Email</th>
											<th className='px-3 py-2'>Кількість</th>
											<th className='px-3 py-2'>Коментар</th>
											<th className='px-3 py-2'>Статус</th>
											<th className='px-3 py-2 text-right'>Дії</th>
										</tr>
									</thead>
									<tbody>
										{inquiries.map(inquiry => (
											<tr key={inquiry.id} className='border-b align-top'>
												<td className='px-3 py-2 whitespace-nowrap'>
													{formatDateTime(inquiry.createdAt)}
												</td>
												<td className='px-3 py-2 font-medium'>
													{inquiry.name}
												</td>
												<td className='px-3 py-2 whitespace-nowrap'>
													<a
														href={`tel:${inquiry.phone}`}
														className='hover:text-primary transition-colors'
													>
														{inquiry.phone}
													</a>
												</td>
												<td className='px-3 py-2'>
													<a
														href={`mailto:${inquiry.email}`}
														className='hover:text-primary transition-colors'
													>
														{inquiry.email}
													</a>
												</td>
												<td className='px-3 py-2'>{inquiry.quantity}</td>
												<td className='max-w-[240px] px-3 py-2'>
													{inquiry.comment || '—'}
												</td>
												<td className='px-3 py-2'>
													<Badge
														variant={
															inquiry.status === 'NEW'
																? 'default'
																: 'secondary'
														}
													>
														{inquiry.status === 'NEW'
															? 'Нова'
															: 'Опрацьована'}
													</Badge>
												</td>
												<td className='px-3 py-2 text-right'>
													<Button
														variant='ghost'
														size='sm'
														disabled={statusMutation.isPending}
														onClick={() => statusMutation.mutate(inquiry)}
													>
														{inquiry.status === 'NEW'
															? 'Опрацьовано'
															: 'Повернути в нові'}
													</Button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className='flex items-center justify-between'>
								<p className='text-muted-foreground text-xs'>
									Всього: {total} • Сторінка {page} з {totalPages}
									{isFetching ? ' • Оновлення...' : ''}
								</p>
								<div className='flex gap-2'>
									<Button
										variant='outline'
										size='sm'
										disabled={!canPrev || isFetching}
										onClick={() => setPage(p => Math.max(1, p - 1))}
									>
										Попередня
									</Button>
									<Button
										variant='outline'
										size='sm'
										disabled={!canNext || isFetching}
										onClick={() => setPage(p => Math.min(totalPages, p + 1))}
									>
										Наступна
									</Button>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
