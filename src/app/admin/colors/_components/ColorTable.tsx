'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import { ColorSwatch } from '@/common/components/ColorSwatch'
import { DeleteConfirmDialog } from '@/app/admin/vendors/_components/DeleteConfirmDialog'
import { colorsApi } from '../colors.api'
import { COLOR_FAMILY_LABELS, type AdminColor, type ColorFamily } from '../colors.schema'

interface ColorTableProps {
	colors: AdminColor[]
	onSelect: (color: AdminColor) => void
}

/**
 * The dictionary caps stops at six, so this only ever sees 2..6 — one stop prints its hex
 * instead. Ukrainian takes the plural from the last digit: 2-4 «кольори», 5 and up «кольорів».
 */
const stopsLabel = (count: number) => `${count} ${count < 5 ? 'кольори' : 'кольорів'}`

export const ColorTable = ({ colors, onSelect }: ColorTableProps) => {
	const queryClient = useQueryClient()
	const [deletingId, setDeletingId] = useState<string | null>(null)

	const { mutate: deleteColor, isPending: isDeleting } = useMutation({
		mutationFn: (id: string) => colorsApi.delete(id),
		onSuccess: (_, id) => {
			queryClient.setQueryData<AdminColor[]>(['colors'], prev =>
				prev ? prev.filter(c => c._id !== id) : []
			)
			setDeletingId(null)
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

	if (sorted.length === 0) {
		return (
			<p className='py-6 text-center text-sm text-gray-400'>
				Словник порожній. Заповнюється скриптом seed-colors.js або вручну.
			</p>
		)
	}

	return (
		<>
			<div className='overflow-x-auto'>
				<table className='w-full min-w-[860px] text-sm'>
					<thead>
						<tr className='border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase'>
							<th className='w-12 px-3 py-2'>
								<span className='sr-only'>Зразок</span>
							</th>
							<th className='px-3 py-2'>Name EN (канон)</th>
							<th className='px-3 py-2'>Назва укр</th>
							<th className='px-3 py-2'>Slug</th>
							<th className='px-3 py-2'>Родина</th>
							<th className='px-3 py-2'>Кольори нитки</th>
							<th className='px-3 py-2 text-right'>Варіантів</th>
							<th className='px-3 py-2 text-right'>Порядок</th>
							<th className='px-3 py-2 text-right'>Дії</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map(color => (
							<tr
								key={color._id}
								onClick={() => onSelect(color)}
								className='cursor-pointer border-b transition-colors hover:bg-gray-50'
							>
								<td className='px-3 py-2'>
									<ColorSwatch
										hexStops={color.hex_stops}
										family={color.family}
										size={28}
										title={color.name_uk}
									/>
								</td>

								{/* The canonical English name leads: it is unique, it is what the
								    slug and the migration match on. The Ukrainian one is what the
								    shopper sees, so it follows rather than replaces it. */}
								<td className='px-3 py-2 font-medium text-gray-900'>
									{color.name_en}
								</td>
								<td className='px-3 py-2 text-gray-600'>{color.name_uk}</td>
								<td className='px-3 py-2 font-mono text-xs text-gray-500'>
									{color.slug}
								</td>
								<td className='px-3 py-2'>
									<Badge variant='secondary' className='text-xs'>
										{COLOR_FAMILY_LABELS[color.family as ColorFamily] ??
											color.family}
									</Badge>
								</td>

								{/* One chip per stop, in order — the first is the primary colour.
								    A single stop shows its hex, since there is nothing to count. */}
								<td className='px-3 py-2'>
									{/* One line: the chips and their caption belong together, and
									    letting «5 кольорів» wrap made the row taller than the rest. */}
									<div className='flex items-center gap-2 whitespace-nowrap'>
										<span className='flex gap-1'>
											{color.hex_stops.map((stop, index) => (
												<span
													key={`${stop}-${index}`}
													title={stop}
													className='size-3.5 rounded-[3px] border border-black/15'
													style={{ background: stop }}
												/>
											))}
										</span>
										<span
											className={
												color.hex_stops.length === 1
													? 'font-mono text-xs text-gray-500'
													: 'text-xs text-gray-500'
											}
										>
											{color.hex_stops.length === 1
												? color.hex_stops[0]
												: stopsLabel(color.hex_stops.length)}
										</span>
									</div>
								</td>

								{/*
								 * A zero is the reading that matters: it marks a dictionary entry
								 * no variant resolved to, which is what the manual pass over the
								 * unrecognized colour spellings is hunting for — so it is greyed
								 * rather than hidden.
								 */}
								<td
									className={`px-3 py-2 text-right tabular-nums ${
										color.variant_count === 0
											? 'text-gray-400'
											: 'font-medium text-gray-900'
									}`}
								>
									{color.variant_count}
								</td>
								<td className='px-3 py-2 text-right text-gray-600 tabular-nums'>
									{color.order}
								</td>

								<td className='px-3 py-2' onClick={e => e.stopPropagation()}>
									<div className='flex justify-end gap-1'>
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
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<DeleteConfirmDialog
				open={!!deletingId}
				onOpenChange={open => !open && setDeletingId(null)}
				title='Видалити колір?'
				description='Якщо на цей колір ще посилаються варіанти товарів, сервер відмовить — спершу перепризначте їх.'
				onConfirm={() => deletingId && deleteColor(deletingId)}
				isPending={isDeleting}
			/>
		</>
	)
}
