'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/common/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card'
import { Input } from '@/common/components/ui/input'
import { landingsApi } from './landings.api'
import { LandingTable } from './_components/LandingTable'
import { filterLandings } from './_components/landing-search'
import { LandingForm } from './_components/LandingForm'
import type { AdminLanding } from './landings.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; landing: AdminLanding }

export const Landings = () => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })
	// Survives opening the form: the component stays mounted and only swaps what it renders.
	const [query, setQuery] = useState('')

	const {
		data: landings = [],
		isLoading,
		isError,
		refetch
	} = useQuery({ queryKey: ['landings', 'admin'], queryFn: () => landingsApi.getAll() })

	// «Показано N з M · активних K», as the artboard draws it: N follows the search, M and K are
	// over the whole list — K says how many a visitor can actually reach, whatever is typed.
	const visible = filterLandings(landings, query)
	const activeCount = landings.filter(l => l.status === 'active').length

	// Keep the open form pointing at the cached copy, so a change elsewhere is reflected.
	const selected =
		panel.mode === 'edit'
			? (landings.find(l => l._id === panel.landing._id) ?? panel.landing)
			: null

	// The form is a two-column layout of its own, so it takes the screen rather than squeezing
	// the table into a side panel.
	if (panel.mode !== 'closed') {
		return (
			<LandingForm
				key={panel.mode === 'edit' ? panel.landing._id : 'create'}
				initial={selected}
				onClose={() => setPanel({ mode: 'closed' })}
			/>
		)
	}

	return (
		<div className='p-6'>
			<Card className='h-fit'>
				<CardHeader className='border-b'>
					<div className='flex items-center justify-between gap-3'>
						<CardTitle>
							Лендінги
							<span className='ml-2 text-sm font-normal text-gray-400'>
								Показано {visible.length} з {landings.length} · активних{' '}
								{activeCount}
							</span>
						</CardTitle>
						{/* Locked until the list is on screen: creating against a cache that never
						    loaded would leave it holding that one landing, and writing to the
						    cache also clears the error the screen is showing. */}
						<Button
							variant='outline'
							disabled={isLoading || isError}
							onClick={() => setPanel({ mode: 'create' })}
						>
							<PlusIcon className='size-4' />
							Новий лендінг
						</Button>
					</div>
				</CardHeader>

				<CardContent className='space-y-4 pt-5'>
					<p className='max-w-3xl text-sm text-gray-500'>
						Лендінг — індексована сторінка каталогу із закріпленими фільтрами, власним
						H1, текстом і FAQ. Категорії лишаються плоскими: це окрема сутність, а не
						підкатегорія, тож той самий товар може потрапити на кілька лендінгів.
					</p>

					{!isLoading && !isError && (
						<div className='relative max-w-sm'>
							<SearchIcon className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
							<Input
								type='search'
								value={query}
								onChange={e => setQuery(e.target.value)}
								placeholder='Пошук: H1, адреса, статус'
								aria-label='Пошук лендінгу'
								className='pl-9'
							/>
						</div>
					)}

					{isLoading ? (
						<p className='text-sm text-gray-500'>Завантаження...</p>
					) : isError ? (
						<div className='space-y-2'>
							<p className='text-sm text-gray-500'>Помилка завантаження лендінгів</p>
							<Button variant='outline' size='sm' onClick={() => refetch()}>
								Спробувати знову
							</Button>
						</div>
					) : (
						<LandingTable
							landings={visible}
							query={query}
							onSelect={landing => setPanel({ mode: 'edit', landing })}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
