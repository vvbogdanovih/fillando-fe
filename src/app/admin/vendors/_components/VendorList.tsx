'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, Trash2Icon, PlusIcon, StoreIcon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { vendorsApi } from '../vendors.api'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import type { Vendor } from '../vendors.schema'

interface VendorListProps {
	vendors: Vendor[]
	selectedId: string | null
	onSelect: (vendor: Vendor | null) => void
	onCreate: () => void
}

export const VendorList = ({ vendors, selectedId, onSelect, onCreate }: VendorListProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)

	const { mutate: deleteVendor, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => vendorsApi.delete(id),
		onSuccess: (_, id) => {
			queryClient.setQueryData<Vendor[]>(['vendors'], prev =>
				prev ? prev.filter(v => v._id !== id) : []
			)
			setDeletingId(null)
			if (selectedId === id) onSelect(null)
		}
	})

	const sorted = [...vendors].sort((a, b) => a.name.localeCompare(b.name))

	return (
		<div className='flex h-full flex-col border-r border-gray-200 bg-white'>
			<div className='flex items-center justify-between border-b border-gray-200 px-4 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>Вендори</h2>
				<Button size='sm' onClick={onCreate}>
					<PlusIcon className='size-4' />
					Додати
				</Button>
			</div>

			<div className='flex-1 overflow-y-auto'>
				{sorted.length === 0 && (
					<p className='px-4 py-6 text-center text-sm text-gray-400'>Вендорів немає</p>
				)}

				{sorted.map(vendor => (
					<div
						key={vendor._id}
						onClick={() => onSelect(vendor)}
						className={`flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 ${
							selectedId === vendor._id ? 'bg-gray-100' : ''
						}`}
					>
						{/* Icon */}
						<div className='mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100'>
							<StoreIcon className='size-4 text-gray-400' />
						</div>

						{/* Info */}
						<div className='min-w-0 flex-1'>
							<p className='truncate text-sm font-medium text-gray-900'>
								{vendor.name}
							</p>
							<p className='truncate text-xs text-gray-400'>{vendor.slug}</p>
						</div>

						{/* Actions */}
						<div className='flex shrink-0 gap-1' onClick={e => e.stopPropagation()}>
							<Button
								size='icon-sm'
								variant='ghost'
								onClick={() => onSelect(vendor)}
								title='Редагувати'
							>
								<PencilIcon className='size-3.5' />
							</Button>
							<Button
								size='icon-sm'
								variant='ghost'
								onClick={() => setDeletingId(vendor._id)}
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
				title='Видалити вендора?'
				description="Всі товари, пов'язані з цим вендором, матимуть недійсні посилання. Переконайтесь, що жоден продукт не використовує цього вендора перед видаленням."
				onConfirm={() => deletingId && deleteVendor(deletingId)}
				isPending={isDeleting}
			/>
		</div>
	)
}
