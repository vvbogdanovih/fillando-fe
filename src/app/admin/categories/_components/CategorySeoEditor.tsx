'use client'
import { ui } from './admin-ui'
import { SettingsCard } from './SettingsCard'
import { seoValue, useCategoryDraft, type SeoDraft } from './category-drafts'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HtmlEditor } from '@/app/admin/landings/_components/HtmlEditor'
import { categoryTreeApi } from '../category-tree.api'
import { CatalogChangedError, categoryError } from '../category-tree.utils'
import type { CategorySeo } from '../category-seo.schema'

const TITLE_SOFT_LIMIT = 60
const DESCRIPTION_SOFT_LIMIT = 160
const SITE_HOST = 'fillando.com'

/** The storefront's own fallbacks (typed listing metadata), so the preview shows what Google gets. */
export function effectiveSnippet(name: string, seo: CategorySeo) {
	return {
		// The root layout's title template appends the site name to a category title.
		title: `${seo.title?.trim() || `${name} — купити у Fillando`} | Fillando`,
		description:
			seo.description?.trim() ||
			`${name} у магазині Fillando: ціни, наявність і доставка по Україні.`,
		h1: seo.h1?.trim() || name
	}
}

const cut = (text: string, limit: number) =>
	text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text

/**
 * Managed SEO copy of a v2 category (Plan-0010 F05): title, description, H1 and the text around
 * the listing, with a search-result preview that applies the storefront's fallbacks. A content
 * edit — allowed on published categories; saved through the shared persisted-key commands.
 */
export function CategorySeoEditor({
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
		queryKey: ['category-seo', categoryId, revision],
		enabled: opened,
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const result = await categoryTreeApi.categorySeo(categoryId)
			if (result.revision !== revision) throw new CatalogChangedError()
			return result
		}
	})
	return (
		<SettingsCard
			title='Сторінка категорії на сайті'
			description='Заголовок і опис для Google, заголовок H1 і тексти над і під товарами.'
			open={opened}
			onToggle={() => setOpened(!opened)}
		>
			{opened && current.isLoading && <p className='text-sm'>Завантаження…</p>}
			{opened && current.error && <p role='alert'>{categoryError(current.error).message}</p>}
			{opened && current.data && <SeoForm data={current.data} disabled={disabled} />}
		</SettingsCard>
	)
}

function SeoForm({
	data,
	disabled
}: {
	data: { category_id: string; name: string; slug: string; status: string; seo: CategorySeo }
	disabled: boolean
}) {
	const [seo, setSeo] = useCategoryDraft<SeoDraft>(data.category_id, 'seo', {
		title: data.seo.title ?? '',
		description: data.seo.description ?? '',
		h1: data.seo.h1 ?? '',
		intro_html: data.seo.intro_html ?? '',
		bottom_html: data.seo.bottom_html ?? ''
	})
	const set = (key: keyof SeoDraft) => (value: string) =>
		setSeo(current => ({ ...current, [key]: value }))
	const snippet = effectiveSnippet(data.name, seoValue(seo))
	return (
		<div className='space-y-3' role='group' aria-label='SEO категорії'>
			<div
				className='rounded border bg-white p-3 text-sm'
				role='group'
				aria-label='Попередній перегляд у пошуку'
			>
				<p className='text-xs text-gray-500'>
					{SITE_HOST} › {data.slug}
				</p>
				<p className='text-base text-blue-800'>{cut(snippet.title, TITLE_SOFT_LIMIT)}</p>
				<p className='text-gray-700'>{cut(snippet.description, DESCRIPTION_SOFT_LIMIT)}</p>
				<p className='mt-1 text-xs text-gray-500'>H1 сторінки: {snippet.h1}</p>
			</div>
			<fieldset disabled={disabled} className='space-y-3'>
				<label className='block text-sm'>
					Title (порожнє — «{data.name} — купити у Fillando»)
					<input
						className={ui.input}
						value={seo.title}
						onChange={event => set('title')(event.target.value)}
					/>
				</label>
				<p
					className={
						seo.title.length > TITLE_SOFT_LIMIT
							? 'text-xs text-amber-700'
							: 'text-xs text-gray-500'
					}
				>
					{seo.title.length} / {TITLE_SOFT_LIMIT}
				</p>
				<label className='block text-sm'>
					Опис для пошуку (порожнє — типовий опис із назвою категорії)
					<textarea
						className={ui.textarea}
						rows={2}
						value={seo.description}
						onChange={event => set('description')(event.target.value)}
					/>
				</label>
				<p
					className={
						seo.description.length > DESCRIPTION_SOFT_LIMIT
							? 'text-xs text-amber-700'
							: 'text-xs text-gray-500'
					}
				>
					{seo.description.length} / {DESCRIPTION_SOFT_LIMIT}
				</p>
				<label className='block text-sm'>
					H1 (порожнє — назва категорії)
					<input
						className={ui.input}
						value={seo.h1}
						onChange={event => set('h1')(event.target.value)}
					/>
				</label>
				<div className='text-sm'>
					<p>Текст над товарами</p>
					{/* The fieldset's lock does not reach a rich-text editor: without `readOnly` text
					    typed while a save runs was dropped with the saved draft. */}
					<HtmlEditor
						value={seo.intro_html}
						onChange={set('intro_html')}
						readOnly={disabled}
					/>
				</div>
				<div className='text-sm'>
					<p>Текст під товарами</p>
					<HtmlEditor
						value={seo.bottom_html}
						onChange={set('bottom_html')}
						readOnly={disabled}
					/>
				</div>
				<p className='text-xs text-gray-500'>
					{data.status === 'active'
						? 'Категорія опублікована: зміни одразу з’являться на сайті.'
						: 'Категорія — чернетка: тексти з’являться після публікації.'}{' '}
					Адреса сторінки звичайним збереженням не змінюється.
				</p>
			</fieldset>
		</div>
	)
}
