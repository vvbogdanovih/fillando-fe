'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import { productsApi } from '../products.api'
import type { ProductVariantFull } from '../products.schema'
import { VariantModal } from './VariantModal'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

const STATUS_LABELS: Record<ProductVariantFull['status'], string> = {
	active: 'Активний',
	draft: 'Чернетка',
	archived: 'Архівний'
}

const STATUS_CLASSES: Record<ProductVariantFull['status'], string> = {
	active: 'border-green-200 bg-green-50 text-green-700',
	draft: 'border-gray-200 bg-gray-50 text-gray-600',
	archived: 'border-red-200 bg-red-50 text-red-700'
}

interface VariantsSectionProps {
	productId: string
	hasVariants: boolean
	/** Value of the variant-type attribute at the product level (e.g. "Red" for Color) */
	variantTypeAttrValue?: string
}

type ModalState = { mode: 'add' } | { mode: 'edit'; variant: ProductVariantFull } | null

export const VariantsSection = ({
	productId,
	hasVariants,
	variantTypeAttrValue
}: VariantsSectionProps) => {
	const queryClient = useQueryClient()
	const [modalState, setModalState] = useState<ModalState>(null)
	const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null)

	const { data: variants = [], isLoading } = useQuery({
		queryKey: ['variants', productId],
		queryFn: () => productsApi.getVariants(productId)
	})

	const deleteMutation = useMutation({
		mutationFn: (variantId: string) => productsApi.deleteVariant(productId, variantId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['variants', productId] })
			toast.success('Варіант видалено')
			setDeletingVariantId(null)
		},
		onError: err => {
			toast.error(err instanceof Error ? err.message : 'Помилка видалення')
		}
	})

	const deletingVariant = variants.find(v => v._id === deletingVariantId)

	const handleModalSuccess = () => {
		queryClient.invalidateQueries({ queryKey: ['variants', productId] })
		setModalState(null)
	}

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<div className='flex items-center justify-between'>
				<h2 className='text-sm font-semibold text-gray-900'>Варіанти</h2>
				<Button type='button' size='sm' onClick={() => setModalState({ mode: 'add' })}>
					<PlusIcon className='size-4' />
					Додати варіант
				</Button>
			</div>

			{isLoading && <p className='text-sm text-gray-400'>Завантаження...</p>}

			{!isLoading && variants.length === 0 && (
				<p className='text-sm text-gray-400'>Немає варіантів. Додайте перший.</p>
			)}

			{!isLoading && variants.length > 0 && (
				<div className='overflow-x-auto'>
					<table className='w-full text-sm'>
						<thead>
							<tr className='border-b border-gray-200'>
								{hasVariants && (
									<th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>
										Значення
									</th>
								)}
								<th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>
									SKU
								</th>
								<th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>
									Ціна
								</th>
								<th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>
									Кількість
								</th>
								<th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>
									Статус
								</th>
								<th className='py-2 pr-4 text-left text-xs font-medium text-gray-500'>
									Фото
								</th>
								<th className='py-2' />
							</tr>
						</thead>
						<tbody className='divide-y divide-gray-100'>
							{variants.map(variant => (
								<tr key={variant._id} className='hover:bg-gray-50'>
									{hasVariants && (
										<td className='py-3 pr-4 font-medium text-gray-900'>
											{variant.v_value ?? '—'}
										</td>
									)}
									<td className='py-3 pr-4 font-mono text-xs text-gray-700'>
										{variant.sku}
									</td>
									<td className='py-3 pr-4 text-gray-700'>₴{variant.price}</td>
									<td className='py-3 pr-4 text-gray-700'>{variant.stock}</td>
									<td className='py-3 pr-4'>
										<Badge
											variant='outline'
											className={STATUS_CLASSES[variant.status]}
										>
											{STATUS_LABELS[variant.status]}
										</Badge>
									</td>
									<td className='py-3 pr-4'>
										{variant.images.length > 0 ? (
											<div className='flex items-center gap-1.5'>
												<img
													src={variant.images[0]}
													alt={variant.sku}
													className='size-8 rounded object-cover'
												/>
												{variant.images.length > 1 && (
													<span className='text-xs text-gray-400'>
														+{variant.images.length - 1}
													</span>
												)}
											</div>
										) : (
											<span className='text-xs text-gray-400'>—</span>
										)}
									</td>
									<td className='py-3'>
										<div className='flex items-center justify-end gap-1'>
											<Button
												type='button'
												size='icon-xs'
												variant='ghost'
												onClick={() =>
													setModalState({ mode: 'edit', variant })
												}
											>
												<PencilIcon className='size-3' />
											</Button>
											<Button
												type='button'
												size='icon-xs'
												variant='ghost'
												className='text-red-500 hover:text-red-700'
												onClick={() => setDeletingVariantId(variant._id)}
											>
												<Trash2Icon className='size-3' />
											</Button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<VariantModal
				open={modalState !== null}
				mode={modalState?.mode ?? 'add'}
				variant={modalState?.mode === 'edit' ? modalState.variant : undefined}
				productId={productId}
				hasVariants={hasVariants}
				variantTypeAttrValue={variantTypeAttrValue}
				hasExistingVariants={variants.length > 0}
				onClose={() => setModalState(null)}
				onSuccess={handleModalSuccess}
			/>

			<DeleteConfirmDialog
				open={deletingVariantId !== null}
				onOpenChange={open => !open && setDeletingVariantId(null)}
				title='Видалити варіант?'
				description={
					deletingVariant
						? `Варіант "${deletingVariant.sku}" буде видалено назавжди.`
						: 'Цю дію не можна скасувати.'
				}
				onConfirm={() => deletingVariantId && deleteMutation.mutate(deletingVariantId)}
				isPending={deleteMutation.isPending}
			/>
		</section>
	)
}
