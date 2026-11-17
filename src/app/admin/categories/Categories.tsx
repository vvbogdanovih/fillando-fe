'use client'

import { categoryTreeApi } from './category-tree.api'
import { CategoryTreeWorkspace } from './_components/CategoryTreeWorkspace'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useCategory, useCategoryOptions } from './categories.queries'
import { CategoryList } from './_components/CategoryList'
import { CategoryForm } from './_components/CategoryForm'
import type { CategoryOption } from './categories.schema'

type PanelState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; id: string }

type Mode = 'tree' | 'legacy'
const modes: { id: Mode; label: string }[] = [
	{ id: 'tree', label: 'Дерево категорій' },
	{ id: 'legacy', label: 'Попередній редактор' }
]
const LEGACY_OFF = 'Попередній редактор вимкнено після переходу на новий каталог'

/**
 * The categories mode as one switch (owner, 2026-11-04): two equal segments, a white thumb under
 * the active one, a radio group for assistive tech and the arrow keys. The old editor writes only
 * before the catalogue migration — after it its segment stays in sight but disabled, with the
 * reason beside it, instead of leading to a page that says it is unavailable.
 */
function ModeToggle({
	value,
	onChange,
	legacyAvailable
}: {
	value: Mode
	onChange: (mode: Mode) => void
	legacyAvailable: boolean
}) {
	const buttons = useRef<(HTMLButtonElement | null)[]>([])
	const enabled = (mode: Mode) => mode === 'tree' || legacyAvailable
	const index = modes.findIndex(item => item.id === value)
	const onKeyDown = (event: KeyboardEvent) => {
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
		event.preventDefault()
		const next = (index + 1) % modes.length
		if (!enabled(modes[next].id)) return
		onChange(modes[next].id)
		buttons.current[next]?.focus()
	}
	return (
		<div className='flex flex-wrap items-center gap-3'>
			<div
				role='radiogroup'
				aria-label='Режим категорій'
				onKeyDown={onKeyDown}
				className='relative inline-grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-100 p-0.5'
			>
				<span
					aria-hidden
					className='absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-white shadow-sm transition-transform duration-200'
					style={{ transform: `translateX(${index * 100}%)` }}
				/>
				{modes.map((item, position) => {
					const checked = item.id === value
					const disabled = !enabled(item.id)
					return (
						<button
							key={item.id}
							ref={element => {
								buttons.current[position] = element
							}}
							type='button'
							role='radio'
							aria-checked={checked}
							aria-disabled={disabled || undefined}
							tabIndex={checked ? 0 : -1}
							title={disabled ? LEGACY_OFF : undefined}
							onClick={() => !disabled && onChange(item.id)}
							className={`relative z-10 rounded-md px-4 py-1.5 text-sm transition-colors ${
								disabled
									? 'cursor-not-allowed text-gray-400'
									: checked
										? 'font-medium text-gray-900'
										: 'text-gray-600 hover:text-gray-900'
							}`}
						>
							{item.label}
						</button>
					)
				})}
			</div>
			{!legacyAvailable && <p className='text-xs text-gray-500'>{LEGACY_OFF}.</p>}
		</div>
	)
}

export const Categories = () => {
	const [mode, setMode] = useState<Mode>('tree')
	const capabilities = useQuery({
		queryKey: ['category-tree-capabilities'],
		queryFn: categoryTreeApi.capabilities,
		retry: false
	})
	const legacyAvailable = capabilities.data?.legacy_writes_enabled === true
	const shown: Mode = legacyAvailable ? mode : 'tree'
	return (
		<div className='h-full'>
			<div className='border-b p-3'>
				<ModeToggle value={shown} onChange={setMode} legacyAvailable={legacyAvailable} />
			</div>
			{shown === 'tree' ? <CategoryTreeWorkspace /> : <LegacyCategories />}
		</div>
	)
}
const LegacyCategories = () => {
	const capabilities = useQuery({
		queryKey: ['category-tree-capabilities'],
		queryFn: categoryTreeApi.capabilities,
		retry: false
	})
	const [panel, setPanel] = useState<PanelState>({ mode: 'closed' })

	const {
		data: categories = [],
		isLoading,
		isError,
		refetch
	} = useCategoryOptions(capabilities.data?.legacy_writes_enabled === true)

	// The list carries no characteristics: the edited category is read by id, and a save writes
	// the returned category back under the same key, so the form stays in step with it.
	const selected = useCategory(panel.mode === 'edit' ? panel.id : null)

	const handleSelect = (category: CategoryOption | null) => {
		if (!category) {
			setPanel({ mode: 'closed' })
		} else {
			setPanel({ mode: 'edit', id: category._id })
		}
	}

	const handleCreate = () => setPanel({ mode: 'create' })

	const handleClose = () => setPanel({ mode: 'closed' })

	const isPanelOpen = panel.mode !== 'closed'
	const formKey = panel.mode === 'edit' ? panel.id : 'create'

	if (capabilities.isLoading) return <p className='p-4'>Перевірка доступності редактора…</p>
	if (capabilities.isError || !capabilities.data?.legacy_writes_enabled)
		return (
			<div className='space-y-3 p-4'>
				<p>
					Попередній редактор недоступний під час переходу на новий каталог.
					Використовуйте дерево категорій.
				</p>
				<button
					className='rounded border px-3 py-2'
					onClick={() => void capabilities.refetch()}
				>
					Перевірити доступність
				</button>
			</div>
		)

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
						selectedId={panel.mode === 'edit' ? panel.id : null}
						onSelect={handleSelect}
						onCreate={handleCreate}
					/>
				)}
			</div>

			{/* Right pane: Create / Edit form */}
			{isPanelOpen && (
				<div className='flex-1 border-l border-gray-200'>
					{panel.mode === 'edit' && !selected.data ? (
						<p className='p-6 text-sm text-gray-500'>
							{selected.isError
								? 'Помилка завантаження категорії'
								: 'Завантаження категорії…'}
						</p>
					) : (
						<CategoryForm
							key={formKey}
							initial={panel.mode === 'edit' ? selected.data! : null}
							onClose={handleClose}
						/>
					)}
				</div>
			)}
		</div>
	)
}
