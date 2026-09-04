'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { DeleteConfirmDialog } from '@/app/admin/vendors/_components/DeleteConfirmDialog'
import { colorsApi } from '../colors.api'
import { COLOR_FAMILY_LABELS, type Color, type ColorFamily } from '../colors.schema'

interface ColorListProps {
	colors: Color[]
	selectedId: string | null
	onSelect: (color: Color | null) => void
	onCreate: () => void
}

export const ColorList = ({ colors, selectedId, onSelect, onCreate }: ColorListProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)

	const { mutate: deleteColor, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => colorsApi.delete(id),
		onSuccess: (_, id) => {
			queryClient.setQueryData<Color[]>(['colors'], prev =>
				prev ? prev.filter(c => c._id !== id) : []
			)
			setDeletingId(null)
			if (selectedId === id) onSelect(null)
		},
		onError: (error: Error) => {
			// The API refuses to delete a colour variants still point at, and its message names
			// how many — worth showing verbatim rather than "something went wrong".
			toast.error(error.message)
			setDeletingId(null)
		}
	})

	const sorted = [...colors].sort(
		(a, b) => a.order - b.order || a.name_en.localeCompare(b.name_en)
	)

	return (
		<div className='flex h-full flex-col border-r border-gray-200 bg-white'>
			<div className='flex items-center justify-between border-b border-gray-200 px-4 py-4'>
				<h2 className='text-sm font-semibold text-gray-900'>
					Кольори
					<span className='ml-2 font-normal text-gray-400'>{colors.length}</span>
				</h2>
				<Button size='sm' onClick={onCreate}>
					<PlusIcon className='size-4' />
					Додати
				</Button>
			</div>

			<div className='flex-1 overflow-y-auto'>
				{sorted.length === 0 && (
					<p className='px-4 py-6 text-center text-sm text-gray-400'>
						Словник порожній. Заповнюється скриптом seed-colors.js або вручну.
					</p>
				)}

				{sorted.map(color => (
					<div
						key={color._id}
						onClick={() => onSelect(color)}
						className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 ${
							selectedId === color._id ? 'bg-gray-100' : ''
						}`}
					>
						<ColorSwatch
							hexStops={color.hex_stops}
							family={color.family}
							size={28}
							title={color.name_uk}
						/>

						<div className='min-w-0 flex-1'>
							<p className='truncate text-sm font-medium text-gray-900'>
								{color.name_uk}{' '}
								<span className='font-normal text-gray-400'>({color.name_en})</span>
							</p>
							<div className='mt-1 flex items-center gap-2'>
								<Badge variant='secondary' className='text-xs'>
									{COLOR_FAMILY_LABELS[color.family as ColorFamily] ??
										color.family}
								</Badge>
								<span className='text-xs text-gray-400'>
									{color.hex_stops.length} стоп.
								</span>
							</div>
						</div>

						<div className='flex shrink-0 gap-1' onClick={e => e.stopPropagation()}>
							<Button
								size='icon-sm'
								variant='ghost'
								onClick={() => onSelect(color)}
								title='Редагувати'
							>
								<PencilIcon className='size-3.5' />
							</Button>
							<Button
								size='icon-sm'
								variant='ghost'
								onClick={() => setDeletingId(color._id)}
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
				title='Видалити колір?'
				description='Якщо на цей колір ще посилаються варіанти товарів, сервер відмовить — спершу перепризначте їх.'
				onConfirm={() => deletingId && deleteColor(deletingId)}
				isPending={isDeleting}
			/>
		</div>
	)
}
