'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { colorsApi } from './colors.api'
import { ColorList } from './_components/ColorList'
import { ColorForm } from './_components/ColorForm'
import type { Color } from './colors.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; color: Color }

export const Colors = () => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: colors = [],
		isLoading,
		isError,
		refetch
	} = useQuery({ queryKey: ['colors'], queryFn: () => colorsApi.getAll() })

	// Keep the open panel pointing at the cached copy, so an edit elsewhere is reflected.
	const selected =
		panel.mode === 'edit' ? (colors.find(c => c._id === panel.color._id) ?? panel.color) : null

	const isPanelOpen = panel.mode !== 'closed'

	return (
		<div className='flex h-full'>
			<div className={`shrink-0 ${isPanelOpen ? 'w-80' : 'w-full max-w-2xl'} transition-all`}>
				{isLoading ? (
					<div className='flex h-full items-center justify-center text-sm text-gray-400'>
						Завантаження...
					</div>
				) : isError ? (
					<div className='flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500'>
						<p>Помилка завантаження кольорів</p>
						<button
							onClick={() => refetch()}
							className='text-primary text-sm hover:underline'
						>
							Спробувати знову
						</button>
					</div>
				) : (
					<ColorList
						colors={colors}
						selectedId={panel.mode === 'edit' ? panel.color._id : null}
						onSelect={color =>
							setPanel(color ? { mode: 'edit', color } : { mode: 'closed' })
						}
						onCreate={() => setPanel({ mode: 'create' })}
					/>
				)}
			</div>

			{isPanelOpen && (
				<div className='flex-1 border-l border-gray-200'>
					<ColorForm
						key={panel.mode === 'edit' ? panel.color._id : 'create'}
						initial={panel.mode === 'edit' ? selected : null}
						onClose={() => setPanel({ mode: 'closed' })}
					/>
				</div>
			)}
		</div>
	)
}
