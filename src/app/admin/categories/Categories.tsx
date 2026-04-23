'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { categoriesApi } from './categories.api'
import { CategoryList } from './_components/CategoryList'
import { CategoryForm } from './_components/CategoryForm'
import type { Category } from './categories.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; category: Category }

export const Categories = () => {
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: categories = [],
		isLoading,
		isError,
		refetch
	} = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getWithSubcategories()
	})

	// Keep edit panel category in sync with cache updates
	const selectedCategory =
		panel.mode === 'edit'
			? (categories.find(c => c._id === panel.category._id) ?? panel.category)
			: null

	const handleSelect = (category: Category | null) => {
		if (!category) {
			setPanel({ mode: 'closed' })
		} else {
			setPanel({ mode: 'edit', category })
		}
	}

	const handleCreate = () => setPanel({ mode: 'create' })

	const handleClose = () => setPanel({ mode: 'closed' })

	const isPanelOpen = panel.mode !== 'closed'
	const formKey = panel.mode === 'edit' ? panel.category._id : 'create'

	return (
		<div className='flex h-full'>
			{/* Left pane: Category list */}
			<div className={`shrink-0 ${isPanelOpen ? 'w-72' : 'w-full max-w-md'} transition-all`}>
				{isLoading ? (
					<div className='flex h-full items-center justify-center text-sm text-gray-400'>
						Завантаження...
					</div>
				) : isError ? (
					<div className='flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500'>
						<p>Помилка завантаження категорій</p>
						<button
							onClick={() => refetch()}
							className='text-primary text-sm hover:underline'
						>
							Спробувати знову
						</button>
					</div>
				) : (
					<CategoryList
						categories={categories}
						selectedId={panel.mode === 'edit' ? panel.category._id : null}
						onSelect={handleSelect}
						onCreate={handleCreate}
					/>
				)}
			</div>

			{/* Right pane: Create / Edit form */}
			{isPanelOpen && (
				<div className='flex-1 border-l border-gray-200'>
					<CategoryForm
						key={formKey}
						initial={panel.mode === 'edit' ? selectedCategory : null}
						onClose={handleClose}
					/>
				</div>
			)}
		</div>
	)
}
