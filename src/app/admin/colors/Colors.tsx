'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { colorsApi } from './colors.api'
import { ColorTable } from './_components/ColorTable'
import { ColorForm } from './_components/ColorForm'
import type { AdminColor } from './colors.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; color: AdminColor }

export const Colors = () => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: colors = [],
		isLoading,
		isError,
		refetch
	} = useQuery({ queryKey: ['colors'], queryFn: () => colorsApi.getAll() })

	// Keep the open form pointing at the cached copy, so an edit elsewhere is reflected.
	const selected =
		panel.mode === 'edit' ? (colors.find(c => c._id === panel.color._id) ?? panel.color) : null

	return (
		<div className='p-6'>
			<Card className='h-fit'>
				<CardHeader className='border-b'>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle>
							Кольори
							<span className='ml-2 text-sm font-normal text-gray-400'>
								{colors.length}
							</span>
						</CardTitle>
						{/*
						 * Locked until the dictionary is on screen. Creating against a list that
						 * never loaded would leave the cache holding that one colour — and
						 * writing to the cache also resolves the query, so the failure notice
						 * would disappear with it.
						 */}
						<Button
							variant='outline'
							disabled={isLoading || isError}
							onClick={() => setPanel({ mode: 'create' })}
						>
							<PlusIcon className='size-4' />
							Новий колір
						</Button>
					</div>
				</CardHeader>

				<CardContent className='space-y-4 pt-5'>
					{/*
					 * The paragraph the artboard puts above the table. Two of these sentences are
					 * not decoration: the family drives the storefront's swatch filter, and
					 * changing it rewrites color_family on every variant of that colour — a bulk
					 * write with no undo, triggered by an ordinary-looking select.
					 */}
					<p className='max-w-3xl text-sm text-gray-500'>
						Словник — єдине джерело правди для назв кольорів і для фільтра в каталозі.
						Родина визначає, у яку групу swatch-фільтра потрапляє колір; зміна родини
						одразу перезаписує її на всіх варіантах товарів із цим кольором. Кольорів
						нитки в одному записі може бути скільки треба — від одного до шести.
					</p>

					{isLoading ? (
						<p className='text-sm text-gray-500'>Завантаження...</p>
					) : isError ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>Помилка завантаження кольорів</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : (
						<ColorTable
							colors={colors}
							onSelect={color => setPanel({ mode: 'edit', color })}
						/>
					)}
				</CardContent>
			</Card>

			{/* Mounted only while open, and keyed by colour, so `useForm` starts from the right
			    defaults on every open rather than keeping the previous colour's values. */}
			{panel.mode !== 'closed' && (
				<ColorForm
					key={panel.mode === 'edit' ? panel.color._id : 'create'}
					initial={selected}
					onClose={() => setPanel({ mode: 'closed' })}
				/>
			)}
		</div>
	)
}
