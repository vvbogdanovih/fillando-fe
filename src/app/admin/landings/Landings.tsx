'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { landingsApi } from './landings.api'
import { LandingList } from './_components/LandingList'
import { LandingForm } from './_components/LandingForm'
import type { Landing } from './landings.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; landing: Landing }

export const Landings = () => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: landings = [],
		isLoading,
		isError,
		refetch
	} = useQuery({ queryKey: ['landings', 'admin'], queryFn: () => landingsApi.getAll() })

	const selected =
		panel.mode === 'edit'
			? (landings.find(l => l._id === panel.landing._id) ?? panel.landing)
			: null

	const isPanelOpen = panel.mode !== 'closed'

	return (
		<div className='flex h-full'>
			<div className={`shrink-0 ${isPanelOpen ? 'w-80' : 'w-full max-w-3xl'} transition-all`}>
				{isLoading ? (
					<div className='flex h-full items-center justify-center text-sm text-gray-400'>
						Завантаження...
					</div>
				) : isError ? (
					<div className='flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500'>
						<p>Помилка завантаження лендінгів</p>
						<button
							onClick={() => refetch()}
							className='text-primary text-sm hover:underline'
						>
							Спробувати знову
						</button>
					</div>
				) : (
					<LandingList
						landings={landings}
						selectedId={panel.mode === 'edit' ? panel.landing._id : null}
						onSelect={landing =>
							setPanel(landing ? { mode: 'edit', landing } : { mode: 'closed' })
						}
						onCreate={() => setPanel({ mode: 'create' })}
					/>
				)}
			</div>

			{isPanelOpen && (
				<div className='flex-1 border-l border-gray-200'>
					<LandingForm
						key={panel.mode === 'edit' ? panel.landing._id : 'create'}
						initial={panel.mode === 'edit' ? selected : null}
						onClose={() => setPanel({ mode: 'closed' })}
					/>
				</div>
			)}
		</div>
	)
}
