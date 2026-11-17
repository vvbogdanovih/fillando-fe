'use client'
import { ui } from './admin-ui'
import { SettingsCard } from './SettingsCard'
import { uploadEntityImage } from '@/common/services/entity-image.service'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HtmlEditor } from '@/app/admin/landings/_components/HtmlEditor'
import { COLOR_FAMILIES, COLOR_FAMILY_LABELS } from '@/app/admin/colors/colors.schema'
import { categoryTreeApi, type CategoryCommand } from '../category-tree.api'
import { CatalogChangedError, categoryError } from '../category-tree.utils'
import type { TypedDefinition } from '../typed-product.schema'
import type { TypedLanding, TypedLandingBody, TypedPins } from '../typed-landing.schema'
import { SlugChange } from './SlugChange'

const button = 'rounded border px-3 py-2 text-sm disabled:opacity-50'
const TITLE_SOFT_LIMIT = 60
const META_SOFT_LIMIT = 160
const emptyPins = (): TypedPins => ({
	attributes: [],
	category_ids: [],
	brand_ids: [],
	color_families: []
})

/** Plain-language form of a stored value for a checkbox label. */
function valueLabel(definition: TypedDefinition, value: string | number | boolean) {
	if (definition.value_type === 'enum')
		return definition.options.find(option => option.id === value)?.label ?? String(value)
	if (typeof value === 'boolean') return value ? 'Так' : 'Ні'
	return definition.unit ? `${value} ${definition.unit}` : String(value)
}

/**
 * Landings of a v2 product category (Plan-0010 F07): the SEO pages that pin part of the catalogue.
 * The list shows each page's storefront count; the form edits copy, pins, order and status
 * through the shared persisted-key command flow. A published page keeps its address.
 */
export function TypedLandingsEditor({
	categoryId,
	categorySlug,
	revision,
	disabled,
	onSubmit
}: {
	categoryId: string
	categorySlug: string
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const [opened, setOpened] = useState(false)
	const [selected, setSelected] = useState<string | 'new' | ''>('')
	const list = useQuery({
		queryKey: ['typed-landings', categoryId, revision],
		enabled: opened,
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const result = await categoryTreeApi.typedLandings(categoryId)
			if (result.revision !== revision) throw new CatalogChangedError()
			return result
		}
	})
	const config = useQuery({
		queryKey: ['category-configuration', categoryId, revision],
		enabled: opened,
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: () => categoryTreeApi.configuration(categoryId)
	})
	const definitions: TypedDefinition[] = config.data?.definitions ?? []
	const current = list.data?.items.find(item => item._id === selected)
	return (
		<SettingsCard
			title='Посадкові сторінки'
			description='Окремі сторінки з закріпленим фільтром: власна адреса, заголовки, тексти й питання.'
			open={opened}
			onToggle={() => setOpened(!opened)}
		>
			{opened && (
				<>
					<p className='text-sm text-gray-500'>
						Сторінка закріплює частину каталогу категорії і має власні заголовки й
						тексти. Адреса: /{categorySlug}/адреса-сторінки. Опублікувати можна лише
						сторінку з активними товарами.
					</p>
					{list.isLoading && <p className='text-sm'>Завантаження сторінок…</p>}
					{list.error && <p role='alert'>{categoryError(list.error).message}</p>}
					{list.data?.truncated && (
						<p role='status' className='text-sm text-amber-700'>
							Показано перші 500 посадкових сторінок категорії; решта тут не
							відображається.
						</p>
					)}
					{list.data && (
						<>
							<ul className='divide-y rounded border text-sm'>
								{list.data.items.map(item => (
									<li
										key={item._id}
										className='flex flex-wrap items-center gap-2 p-2'
									>
										<button
											type='button'
											className='min-w-0 flex-1 text-left'
											aria-pressed={selected === item._id}
											onClick={() => setSelected(item._id)}
										>
											<span className='font-medium'>{item.h1}</span>{' '}
											<span className='text-gray-500'>/{item.slug}</span>
										</button>
										<span>
											{item.status === 'active' ? 'Активна' : 'Чернетка'}
										</span>
										<span className={item.product_count ? '' : 'text-red-700'}>
											товарів: {item.product_count}
										</span>
										{item.contract_version !== 2 && (
											<span className='text-amber-700'>
												не переведена на новий каталог
											</span>
										)}
									</li>
								))}
								{!list.data.items.length && (
									<li className='p-2 text-gray-500'>Сторінок ще немає.</li>
								)}
							</ul>
							<button
								type='button'
								className={button}
								disabled={disabled}
								onClick={() => setSelected('new')}
							>
								Створити посадкову сторінку
							</button>
						</>
					)}
					{config.error && <p role='alert'>{categoryError(config.error).message}</p>}
					{config.data && (selected === 'new' || current) && (
						<TypedLandingForm
							key={`${selected}:${revision}`}
							categoryId={categoryId}
							categorySlug={categorySlug}
							landing={current ?? null}
							definitions={definitions}
							revision={revision}
							disabled={disabled}
							onSubmit={onSubmit}
						/>
					)}
				</>
			)}
		</SettingsCard>
	)
}

function TypedLandingForm({
	categoryId,
	categorySlug,
	landing,
	definitions,
	revision,
	disabled,
	onSubmit
}: {
	categoryId: string
	categorySlug: string
	landing: TypedLanding | null
	definitions: TypedDefinition[]
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const [values, setValues] = useState({
		slug: landing?.slug ?? '',
		h1: landing?.h1 ?? '',
		title: landing?.title ?? '',
		meta_description: landing?.meta_description ?? '',
		intro_html: landing?.intro_html ?? '',
		bottom_html: landing?.bottom_html ?? '',
		image: landing?.image ?? '',
		order: String(landing?.order ?? 0),
		status: landing?.status ?? ('draft' as 'draft' | 'active')
	})
	const [faq, setFaq] = useState(landing?.faq ?? [])
	const [pins, setPins] = useState<TypedPins>(landing?.filters_v2 ?? emptyPins())
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [error, setError] = useState('')
	const [uploading, setUploading] = useState(false)
	// What the form opened with: the address change reloads the form, so it waits while anything
	// here is unsaved.
	const [initial] = useState(() => JSON.stringify([values, faq, pins]))
	const dirty = JSON.stringify([values, faq, pins]) !== initial
	const filterable = definitions
		.filter(definition => definition.filter_enabled && definition.semantic !== 'color')
		.sort((a, b) => a.order - b.order)
	const colourAxis = definitions.some(definition => definition.semantic === 'color')
	const attributeFilters = pins.attributes
	// Values of the category's products (drafts included) — the choices a pin can take.
	const preview = useQuery({
		queryKey: ['landing-pin-preview', categoryId, revision, JSON.stringify(attributeFilters)],
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: () => categoryTreeApi.filterPreview(categoryId, attributeFilters)
	})
	const facets = new Map((preview.data?.facets ?? []).map(facet => [facet.key, facet]))
	const set = (key: keyof typeof values) => (value: string) =>
		setValues(current => ({ ...current, [key]: value }))
	const pinnedValues = (key: string) => {
		const filter = attributeFilters.find(item => item.key === key)
		return filter && 'values' in filter ? filter.values : []
	}
	const toggle = (key: string, value: string | number | boolean) =>
		setPins(current => {
			const others = current.attributes.filter(item => item.key !== key)
			const chosen = pinnedValues(key)
			const next = chosen.includes(value)
				? chosen.filter(item => item !== value)
				: [...chosen, value]
			return {
				...current,
				attributes: next.length ? [...others, { key, values: next }] : others
			}
		})
	const setRange = (key: string, bound: 'min' | 'max', text: string) =>
		setPins(current => {
			const existing = current.attributes.find(item => item.key === key)
			const range = existing && !('values' in existing) ? { ...existing } : { key }
			const number = text.trim() === '' ? undefined : Number(text)
			const next: { key: string; min?: number; max?: number } = { ...range, [bound]: number }
			if (next.min === undefined) delete next.min
			if (next.max === undefined) delete next.max
			const others = current.attributes.filter(item => item.key !== key)
			return {
				...current,
				attributes:
					next.min === undefined && next.max === undefined ? others : [...others, next]
			}
		})
	const published = landing?.status === 'active'
	const submit = () => {
		setError('')
		if (
			attributeFilters.some(
				filter =>
					!('values' in filter) &&
					[filter.min, filter.max].some(
						value => value !== undefined && !Number.isFinite(value)
					)
			)
		)
			return setError('Перевірте межі діапазону.')
		if (!Number.isSafeInteger(Number(values.order)) || Number(values.order) < 0)
			return setError('Порядок — ціле невідʼємне число.')
		const body: TypedLandingBody = {
			expected_revision: revision,
			slug: values.slug.trim(),
			h1: values.h1.trim(),
			title: values.title.trim(),
			meta_description: values.meta_description.trim(),
			intro_html: values.intro_html,
			bottom_html: values.bottom_html,
			faq: faq.filter(item => item.q.trim() || item.a.trim()),
			filters_v2: pins,
			image: values.image.trim() || null,
			order: Number(values.order),
			status: values.status
		}
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug))
			return setError('Адреса: малі латинські літери, цифри й дефіс.')
		if (!body.h1 || !body.title || !body.meta_description)
			return setError('Заповніть H1, title і опис для пошуку.')
		if (body.faq.some(item => !item.q.trim() || !item.a.trim()))
			return setError('Кожне питання FAQ має мати відповідь.')
		onSubmit(
			landing
				? { type: 'landing-update', id: landing._id, body }
				: { type: 'landing-create', body: { ...body, category_id: categoryId } }
		)
	}
	return (
		<form
			className='space-y-4 rounded border p-4'
			aria-label={landing ? `Сторінка ${landing.slug}` : 'Нова посадкова сторінка'}
			onSubmit={event => {
				event.preventDefault()
				submit()
			}}
		>
			<fieldset disabled={disabled} className='space-y-3'>
				<label className='block text-sm'>
					Адреса сторінки
					<input
						className={ui.input}
						value={values.slug}
						readOnly={published}
						onChange={event => set('slug')(event.target.value)}
					/>
				</label>
				{published && landing && (
					<div className='flex flex-wrap items-center gap-2'>
						<p className='text-xs text-gray-500'>
							Адресу опублікованої сторінки змінює окрема операція з перенаправленням.
						</p>
						<SlugChange
							target='landings'
							id={landing._id}
							slug={landing.slug}
							prefix={`/${categorySlug}/`}
							revision={revision}
							disabled={disabled || dirty}
							onSubmit={onSubmit}
						/>
						{dirty && (
							<p className='w-full text-xs text-gray-500'>
								Спершу збережіть сторінку: зміна адреси скине незбережені зміни.
							</p>
						)}
					</div>
				)}
				<label className='block text-sm'>
					H1
					<input
						className={ui.input}
						value={values.h1}
						onChange={event => set('h1')(event.target.value)}
					/>
				</label>
				<label className='block text-sm'>
					Title (до {TITLE_SOFT_LIMIT} символів)
					<input
						className={ui.input}
						value={values.title}
						onChange={event => set('title')(event.target.value)}
					/>
					<span
						className={
							values.title.length > TITLE_SOFT_LIMIT
								? 'text-xs text-amber-700'
								: 'text-xs text-gray-500'
						}
					>
						{values.title.length} / {TITLE_SOFT_LIMIT}
					</span>
				</label>
				<label className='block text-sm'>
					Опис для пошуку (до {META_SOFT_LIMIT} символів)
					<textarea
						className={ui.textarea}
						rows={2}
						value={values.meta_description}
						onChange={event => set('meta_description')(event.target.value)}
					/>
					<span
						className={
							values.meta_description.length > META_SOFT_LIMIT
								? 'text-xs text-amber-700'
								: 'text-xs text-gray-500'
						}
					>
						{values.meta_description.length} / {META_SOFT_LIMIT}
					</span>
				</label>
				<fieldset className='space-y-2 rounded border p-3' aria-label='Закріплені фільтри'>
					<legend className='px-1 text-sm font-medium'>Закріплені фільтри</legend>
					{!filterable.length && !colourAxis && (
						<p className='text-sm text-gray-500'>
							У категорії немає характеристик із фільтром — увімкніть фільтр у
							налаштуваннях характеристик.
						</p>
					)}
					{filterable.map(definition =>
						definition.filter_type === 'range' ? (
							<div
								key={definition.key}
								className='flex flex-wrap items-end gap-2 text-sm'
							>
								<span className='w-full'>
									{definition.label}
									{definition.unit ? `, ${definition.unit}` : ''}
								</span>
								{(['min', 'max'] as const).map(bound => {
									const filter = attributeFilters.find(
										item => item.key === definition.key
									)
									const value =
										filter && !('values' in filter) ? filter[bound] : undefined
									return (
										<label key={bound}>
											{bound === 'min' ? 'від' : 'до'}
											<input
												className={ui.input}
												type='number'
												step='any'
												aria-label={`${definition.label}: ${bound === 'min' ? 'від' : 'до'}`}
												value={value ?? ''}
												onChange={event =>
													setRange(
														definition.key,
														bound,
														event.target.value
													)
												}
											/>
										</label>
									)
								})}
							</div>
						) : (
							<div key={definition.key} className='text-sm'>
								<p>{definition.label}</p>
								<div className='flex flex-wrap gap-x-4 gap-y-1'>
									{[
										...new Set([
											...(definition.value_type === 'enum'
												? definition.options.map(option => option.id)
												: (facets
														.get(definition.key)
														?.values.map(row => row.value) ?? [])),
											...pinnedValues(definition.key)
										])
									].map(value => (
										<label
											key={String(value)}
											className='flex items-center gap-1'
										>
											<input
												type='checkbox'
												checked={pinnedValues(definition.key).includes(
													value
												)}
												onChange={() => toggle(definition.key, value)}
											/>
											{valueLabel(definition, value)}
										</label>
									))}
								</div>
							</div>
						)
					)}
					{colourAxis && (
						<div className='text-sm'>
							<p>Колір (родина)</p>
							<div className='flex flex-wrap gap-x-4 gap-y-1'>
								{COLOR_FAMILIES.map(family => (
									<label key={family} className='flex items-center gap-1'>
										<input
											type='checkbox'
											checked={pins.color_families.includes(family)}
											onChange={() =>
												setPins(current => ({
													...current,
													color_families: current.color_families.includes(
														family
													)
														? current.color_families.filter(
																item => item !== family
															)
														: [...current.color_families, family]
												}))
											}
										/>
										{COLOR_FAMILY_LABELS[family]}
									</label>
								))}
							</div>
						</div>
					)}
					{preview.data && (
						<p className='text-xs text-gray-500'>
							За характеристиками знайдено варіантів (разом із чернетками):{' '}
							{preview.data.total_variants}. Остаточна кількість для покупця — у
							списку після збереження.
						</p>
					)}
				</fieldset>
				<div className='text-sm'>
					<p>Текст над товарами</p>
					<HtmlEditor value={values.intro_html} onChange={set('intro_html')} />
				</div>
				<div className='text-sm'>
					<p>Текст під товарами</p>
					<HtmlEditor value={values.bottom_html} onChange={set('bottom_html')} />
				</div>
				<fieldset className='space-y-2' aria-label='Питання й відповіді'>
					<legend className='text-sm font-medium'>FAQ</legend>
					{faq.map((item, index) => (
						<div key={index} className='space-y-1 rounded border p-2'>
							<input
								className={ui.input}
								aria-label={`Питання ${index + 1}`}
								value={item.q}
								onChange={event =>
									setFaq(current =>
										current.map((row, i) =>
											i === index ? { ...row, q: event.target.value } : row
										)
									)
								}
							/>
							<textarea
								className={ui.textarea}
								aria-label={`Відповідь ${index + 1}`}
								rows={2}
								value={item.a}
								onChange={event =>
									setFaq(current =>
										current.map((row, i) =>
											i === index ? { ...row, a: event.target.value } : row
										)
									)
								}
							/>
							<button
								type='button'
								className={button}
								onClick={() =>
									setFaq(current => current.filter((_, i) => i !== index))
								}
							>
								Прибрати питання
							</button>
						</div>
					))}
					<button
						type='button'
						className={button}
						onClick={() => setFaq(current => [...current, { q: '', a: '' }])}
					>
						Додати питання
					</button>
				</fieldset>
				<div className='space-y-2 text-sm'>
					<label className='block'>
						Зображення плитки (необовʼязково)
						<input
							className={ui.input}
							value={values.image}
							placeholder='https://…'
							onChange={event => set('image')(event.target.value)}
						/>
					</label>
					{values.image && (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={values.image}
							alt='Зображення плитки'
							className='size-20 rounded border object-cover'
						/>
					)}
					<div className='flex flex-wrap items-center gap-2'>
						{/* The same S3 upload the old landing form had (Plan-0010 F07 gap). */}
						<label className={button}>
							{uploading ? 'Завантаження…' : 'Завантажити зображення'}
							<input
								type='file'
								accept='image/webp,image/jpeg,image/png'
								className='sr-only'
								disabled={uploading}
								onChange={event => {
									const file = event.target.files?.[0]
									event.target.value = ''
									if (!file) return
									setUploading(true)
									setError('')
									uploadEntityImage('landing', landing?._id ?? categoryId, file)
										.then(url => set('image')(url))
										.catch(() => setError('Не вдалося завантажити зображення.'))
										.finally(() => setUploading(false))
								}}
							/>
						</label>
						{values.image && (
							<button
								type='button'
								className={button}
								onClick={() => set('image')('')}
							>
								Прибрати зображення
							</button>
						)}
					</div>
				</div>
				<div className='flex flex-wrap gap-3'>
					<label className='block text-sm'>
						Порядок
						<input
							className={ui.input}
							type='number'
							min={0}
							step={1}
							value={values.order}
							onChange={event => set('order')(event.target.value)}
						/>
					</label>
					<label className='block text-sm'>
						Статус
						<select
							className={ui.input}
							value={values.status}
							onChange={event => set('status')(event.target.value)}
						>
							<option value='draft'>Чернетка</option>
							<option value='active'>Активна</option>
						</select>
					</label>
				</div>
				{error && <p role='alert'>{error}</p>}
				<div className='flex flex-wrap gap-2'>
					<button type='submit' className={button}>
						{landing ? 'Зберегти сторінку' : 'Створити сторінку'}
					</button>
					{landing && landing.status === 'draft' && (
						<button
							type='button'
							className={button}
							disabled={confirmDelete}
							onClick={() => setConfirmDelete(true)}
						>
							Видалити чернетку сторінки
						</button>
					)}
				</div>
				{landing && confirmDelete && (
					// On a row of its own, the first button left in place and switched off: a double
					// click must not land on the confirmation.
					<div className='flex flex-wrap items-center justify-end gap-2 rounded bg-red-50 p-2 text-sm'>
						<span className='mr-auto text-red-800'>
							Сторінку /{landing.slug} буде видалено назавжди.
						</span>
						<button
							type='button'
							className={button}
							onClick={() => setConfirmDelete(false)}
						>
							Скасувати
						</button>
						<button
							type='button'
							className={`${button} border-red-300 text-red-700`}
							onClick={() =>
								onSubmit({
									type: 'landing-delete',
									id: landing._id,
									body: { expected_revision: revision }
								})
							}
						>
							Так, видалити сторінку /{landing.slug}
						</button>
					</div>
				)}
			</fieldset>
		</form>
	)
}
