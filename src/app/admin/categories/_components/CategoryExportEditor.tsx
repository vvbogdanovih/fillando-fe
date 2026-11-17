'use client'
import { ui } from './admin-ui'
import { SettingsCard } from './SettingsCard'
import { useCategoryDraft, useDraftIssue, type ExportDraft } from './category-drafts'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { categoryTreeApi } from '../category-tree.api'
import { CatalogChangedError, categoryError } from '../category-tree.utils'
import type { CategoryExportRead } from '../category-export.schema'

/**
 * The Google taxonomy of a v2 product category (Plan-0010 B10) — the one feed setting a category
 * has. Title, highlights and custom labels follow the feed's own rules: the per-category keys and
 * static labels were removed (owner, 04.11.2026) as interface complexity without a use.
 */
export function CategoryExportEditor({
	categoryId,
	revision,
	disabled
}: {
	categoryId: string
	revision: number
	disabled: boolean
}) {
	const [opened, setOpened] = useState(false)
	const current = useQuery({
		queryKey: ['category-export', categoryId, revision],
		enabled: opened,
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const result = await categoryTreeApi.categoryExport(categoryId)
			if (result.revision !== revision) throw new CatalogChangedError()
			return result
		}
	})
	return (
		<SettingsCard
			title='Google Shopping'
			description='Категорія Google, до якої товарний фід відносить товари цієї категорії.'
			open={opened}
			onToggle={() => setOpened(!opened)}
		>
			{opened && current.isLoading && <p className='text-sm'>Завантаження…</p>}
			{opened && current.error && <p role='alert'>{categoryError(current.error).message}</p>}
			{opened && current.data && <ExportForm data={current.data} disabled={disabled} />}
		</SettingsCard>
	)
}

function ExportForm({ data, disabled }: { data: CategoryExportRead; disabled: boolean }) {
	const [value, setValue] = useCategoryDraft<ExportDraft>(data.category_id, 'export', {
		id: String(data.google_product_category?.id ?? ''),
		path: data.google_product_category?.path ?? ''
	})
	const issue = useDraftIssue(data.category_id, 'export')
	return (
		<div className='space-y-4' role='group' aria-label='Категорія Google'>
			<fieldset disabled={disabled} className='space-y-4'>
				<div className='flex flex-wrap gap-2 text-sm'>
					<label className='w-40'>
						ID категорії Google
						<input
							className={ui.input}
							inputMode='numeric'
							value={value.id}
							onChange={event => setValue({ ...value, id: event.target.value })}
						/>
					</label>
					<label className='min-w-64 flex-1'>
						Шлях категорії Google
						<input
							className={ui.input}
							value={value.path}
							onChange={event => setValue({ ...value, path: event.target.value })}
						/>
					</label>
				</div>
				<p className='text-xs text-gray-500'>
					У фід іде лише ID; шлях — підказка для адмінки. Фід оновиться протягом кількох
					хвилин після збереження.
				</p>
				{issue && <p role='alert'>{issue.message}</p>}
			</fieldset>
		</div>
	)
}
