'use client'

import Link from 'next/link'
import { PlusIcon, PencilIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/common/components/ui/button'
import { UI_URLS } from '@/common/constants'
import { productsApi } from './products.api'

export const Products = () => {
	const { data: products = [], isLoading } = useQuery({
		queryKey: ['products'],
		queryFn: () => productsApi.getAll()
	})

	return (
		<div className='flex h-full flex-col'>
			<div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
				<h1 className='text-lg font-semibold text-gray-900'>Продукти</h1>
				<Button asChild size='sm'>
					<Link href={UI_URLS.ADMIN.CREATE_PRODUCT}>
						<PlusIcon className='size-4' />
						Новий продукт
					</Link>
				</Button>
			</div>

			{isLoading && (
				<div className='flex flex-1 items-center justify-center'>
					<p className='text-sm text-gray-400'>Завантаження...</p>
				</div>
			)}

			{!isLoading && products.length === 0 && (
				<div className='flex flex-1 items-center justify-center'>
					<p className='text-sm text-gray-400'>Немає продуктів</p>
				</div>
			)}

			{!isLoading && products.length > 0 && (
				<div className='overflow-x-auto'>
					<table className='w-full text-sm'>
						<thead>
							<tr className='border-b border-gray-200 bg-gray-50'>
								<th className='px-6 py-3 text-left text-xs font-medium text-gray-500'>
									Назва
								</th>
								<th className='px-6 py-3 text-left text-xs font-medium text-gray-500'>
									Тип варіантів
								</th>
								<th className='px-6 py-3' />
							</tr>
						</thead>
						<tbody className='divide-y divide-gray-200'>
							{products.map(product => (
								<tr key={product._id} className='hover:bg-gray-50'>
									<td className='px-6 py-4 font-medium text-gray-900'>
										{product.name}
									</td>
									<td className='px-6 py-4 text-gray-500'>
										{product.variant_type
											? product.variant_type.label
											: 'Без варіантів'}
									</td>
									<td className='px-6 py-4 text-right'>
										<Button asChild size='sm' variant='ghost'>
											<Link href={UI_URLS.ADMIN.EDIT_PRODUCT(product._id)}>
												<PencilIcon className='size-4' />
												Редагувати
											</Link>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
