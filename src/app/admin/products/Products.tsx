'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Badge } from '@/common/components/ui/badge'
import { Button } from '@/common/components/ui/button'
import { UI_URLS } from '@/common/constants'
import { productsApi } from './products.api'
import { vendorsApi } from '../vendors/vendors.api'
import { categoriesApi } from '../categories/categories.api'
import { DeleteConfirmDialog } from './_components/DeleteConfirmDialog'

function formatDate(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return '—'
	return date.toLocaleDateString('uk-UA')
}

export const Products = () => {
	const queryClient = useQueryClient()
	const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

	const {
		data: products = [],
		isLoading,
		isError,
		isFetching,
		refetch
	} = useQuery({
		queryKey: ['products'],
		queryFn: () => productsApi.getAll()
	})

	const { data: vendors = [] } = useQuery({
		queryKey: ['vendors'],
		queryFn: () => vendorsApi.getAll()
	})

	const { data: categories = [] } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getWithSubcategories()
	})

	const vendorMap = useMemo(() => new Map(vendors.map(v => [v._id, v.name])), [vendors])

	const categoryMap = useMemo(() => {
		const map = new Map<string, string>()
		for (const cat of categories) {
			map.set(cat._id, cat.name)
			for (const sub of cat.subcategories) {
				map.set(sub._id, `${cat.name} / ${sub.name}`)
			}
		}
		return map
	}, [categories])

	const deleteMutation = useMutation({
		mutationFn: (id: string) => productsApi.deleteProduct(id),
		onSuccess: () => {
			toast.success('Продукт видалено')
			queryClient.invalidateQueries({ queryKey: ['products'] })
			setDeleteTarget(null)
		},
		onError: () => {
			toast.error('Не вдалося видалити продукт')
		}
	})

	return (
		<div className='p-6'>
			<Card>
				<CardHeader className='border-b'>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle>Продукти</CardTitle>
						<div className='flex items-center gap-4'>
							<span className='text-muted-foreground text-xs'>
								Всього: {products.length}
								{isFetching && !isLoading ? ' • Оновлення...' : ''}
							</span>
							<Button asChild size='sm'>
								<Link href={UI_URLS.ADMIN.CREATE_PRODUCT}>
									<PlusIcon className='size-4' />
									Новий продукт
								</Link>
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className='pt-5'>
					{isLoading ? (
						<div className='space-y-3'>
							{Array.from({ length: 6 }).map((_, index) => (
								<div
									key={index}
									className='h-14 animate-pulse rounded-md bg-gray-100'
								/>
							))}
						</div>
					) : isError ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>
								Не вдалося завантажити список продуктів
							</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : products.length === 0 ? (
						<div className='flex flex-col items-center justify-center py-12'>
							<p className='text-sm text-gray-500'>Продуктів ще немає</p>
							<Button asChild size='sm' className='mt-3'>
								<Link href={UI_URLS.ADMIN.CREATE_PRODUCT}>
									<PlusIcon className='size-4' />
									Створити перший продукт
								</Link>
							</Button>
						</div>
					) : (
						<div className='overflow-x-auto'>
							<table className='w-full min-w-[800px] text-sm'>
								<thead>
									<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
										<th className='w-10 px-3 py-2'>#</th>
										<th className='px-3 py-2'>Назва</th>
										<th className='px-3 py-2'>Категорія</th>
										<th className='px-3 py-2'>Вендор</th>
										<th className='px-3 py-2'>Варіанти</th>
										<th className='px-3 py-2'>Створено</th>
										<th className='px-3 py-2' />
									</tr>
								</thead>
								<tbody>
									{products.map((product, index) => (
										<tr key={product._id} className='border-b hover:bg-gray-50'>
											<td className='px-3 py-3 text-gray-400'>{index + 1}</td>
											<td className='px-3 py-3 font-medium text-gray-900'>
												{product.name}
											</td>
											<td className='px-3 py-3 text-gray-500'>
												{categoryMap.get(product.subcategory_id) ??
													categoryMap.get(product.category_id) ??
													'—'}
											</td>
											<td className='px-3 py-3 text-gray-500'>
												{(product.vendor_id &&
													vendorMap.get(product.vendor_id)) ??
													'—'}
											</td>
											<td className='px-3 py-3'>
												{product.variant_type ? (
													<Badge variant='secondary'>
														{product.variant_type.label}
													</Badge>
												) : (
													<span className='text-gray-400'>
														Без варіантів
													</span>
												)}
											</td>
											<td className='px-3 py-3 text-gray-500'>
												{formatDate(product.createdAt)}
											</td>
											<td className='px-3 py-3 text-right'>
												<div className='flex items-center justify-end gap-1'>
													<Button asChild size='sm' variant='ghost'>
														<Link
															href={UI_URLS.ADMIN.EDIT_PRODUCT(
																product._id
															)}
														>
															<PencilIcon className='size-4' />
														</Link>
													</Button>
													<Button
														size='sm'
														variant='ghost'
														className='text-destructive hover:text-destructive'
														onClick={() =>
															setDeleteTarget({
																id: product._id,
																name: product.name
															})
														}
													>
														<TrashIcon className='size-4' />
													</Button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>

			<DeleteConfirmDialog
				open={!!deleteTarget}
				onOpenChange={open => !open && setDeleteTarget(null)}
				title='Видалити продукт?'
				description={`Продукт "${deleteTarget?.name}" буде видалено назавжди. Цю дію неможливо скасувати.`}
				onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
				isPending={deleteMutation.isPending}
			/>
		</div>
	)
}
