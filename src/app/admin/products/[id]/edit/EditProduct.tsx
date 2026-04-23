'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { UI_URLS } from '@/common/constants'
import { productsApi } from '../../products.api'
import { ProductEditForm } from '../../_components/ProductEditForm'
import { VariantsSection } from '../../_components/VariantsSection'

interface EditProductProps {
	id: string
}

export const EditProduct = ({ id }: EditProductProps) => {
	const {
		data: product,
		isLoading,
		isError
	} = useQuery({
		queryKey: ['product', id],
		queryFn: () => productsApi.getById(id)
	})

	return (
		<div className='flex h-full flex-col'>
			<div className='flex items-center gap-3 border-b border-gray-200 px-6 py-4'>
				<Button asChild size='icon-sm' variant='ghost'>
					<Link href={UI_URLS.ADMIN.PRODUCTS}>
						<ArrowLeftIcon className='size-4' />
					</Link>
				</Button>
				<h1 className='text-lg font-semibold text-gray-900'>
					{isLoading
						? 'Завантаження...'
						: product
							? `Редагування: ${product.name}`
							: 'Продукт'}
				</h1>
			</div>

			{isLoading && (
				<div className='flex flex-1 items-center justify-center'>
					<p className='text-sm text-gray-400'>Завантаження...</p>
				</div>
			)}

			{isError && (
				<div className='flex flex-1 items-center justify-center'>
					<p className='text-sm text-red-500'>Помилка завантаження продукту</p>
				</div>
			)}

			{product && (
				<div className='w-full max-w-7xl px-8 py-8'>
					<div className='flex flex-col gap-6'>
						<ProductEditForm product={product} />
						<VariantsSection
							productId={id}
							hasVariants={!!product.variant_type}
							variantTypeAttrValue={
								product.variant_type
									? String(
											product.attributes.find(
												a => a.k === product.variant_type?.key
											)?.v ?? ''
										)
									: undefined
							}
						/>
					</div>
				</div>
			)}
		</div>
	)
}
