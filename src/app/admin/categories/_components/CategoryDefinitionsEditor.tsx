'use client'
import { CategoryFilterPreview } from './CategoryFilterPreview'
import { ui } from './admin-ui'
import { useCategoryDraft, useDraftIssue } from './category-drafts'
import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/common/utils/shad-cn.utils'
import { categoryTreeApi, type TreeItem } from '../category-tree.api'
import {
	copyDefinitions,
	newDefinition,
	type DefinitionInput,
	type CategoryConfiguration,
	type DefinitionUsage,
	type KeyUsage
} from '../category-definitions.schema'
import { describeUsage, plural } from '../category-tree.utils'
const button = 'rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50'
const valueTypes = { string: 'Текст', number: 'Число', boolean: 'Так/ні', enum: 'Список варіантів' }
const hint = 'text-xs text-gray-500'
const badge = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
const semantics = {
	generic: 'Звичайна',
	color: 'Колір',
	size: 'Розмір',
	material: 'Матеріал',
	brand: 'Бренд'
}
/** «Список варіантів, кг · кілька значень» — the type a used characteristic keeps. Its meaning
 * stays editable on its own row (owner, 2026-11-08), the colour aside. */
const typeSummary = (definition: DefinitionInput) =>
	[
		definition.semantic === 'color'
			? 'Колір зі словника'
			: `${valueTypes[definition.value_type]}${definition.unit ? `, ${definition.unit}` : ''}`,
		definition.multiple ? 'кілька значень' : ''
	]
		.filter(Boolean)
		.join(' · ')
/** «2 · 1 посадкова» — who holds an option, in the options' «Товари» column. */
const optionUsageText = (usage: { products: number; landings: number }) =>
	[
		String(usage.products),
		usage.landings ? plural(usage.landings, 'посадкова', 'посадкові', 'посадкових') : ''
	]
		.filter(Boolean)
		.join(' · ')
/** A row's identity for its open state: the saved key, or the position of an unsaved one. */
const rowId = (definition: DefinitionInput, index: number) => definition.key ?? `new-${index}`
const isUsed = (usage: { products: number; variants: number; landings: number } | undefined) =>
	!!usage && usage.products + usage.variants + usage.landings > 0
export function CategoryDefinitionsEditor({
	category,
	items,
	revision,
	disabled
}: {
	category: TreeItem
	items: TreeItem[]
	revision: number
	disabled: boolean
}) {
	const query = useQuery({
		queryKey: ['category-configuration', category._id, revision],
		queryFn: () => categoryTreeApi.configuration(category._id),
		retry: false,
		refetchOnWindowFocus: false
	})
	// Exact per-key usage: what the server will refuse is shown before saving, not after.
	const usage = useQuery({
		queryKey: ['category-definition-usage', category._id, revision],
		queryFn: () => categoryTreeApi.definitionUsage(category._id),
		retry: false,
		refetchOnWindowFocus: false
	})
	if (query.isLoading || usage.isLoading)
		return <p className='p-4'>Завантаження характеристик…</p>
	if (query.isError || !query.data)
		return (
			<div role='alert' className='p-4'>
				Не вдалося завантажити характеристики.{' '}
				<button className={button} onClick={() => void query.refetch()}>
					Повторити завантаження
				</button>
			</div>
		)
	if (query.data.revision !== revision)
		return (
			<p role='alert' className='p-4'>
				Каталог змінився. Натисніть «Оновити дерево», щоб завантажити актуальні
				налаштування.
			</p>
		)
	return (
		<DefinitionsForm
			key={`${category._id}:${query.data.revision}`}
			config={query.data}
			usage={usage.data?.revision === query.data.revision ? usage.data : undefined}
			usageFailed={usage.isError || usage.data?.revision !== query.data.revision}
			items={items}
			disabled={disabled || query.isFetching}
		/>
	)
}
function DefinitionsForm({
	config,
	usage,
	usageFailed,
	items,
	disabled
}: {
	config: CategoryConfiguration
	usage?: DefinitionUsage
	usageFailed: boolean
	items: TreeItem[]
	disabled: boolean
}) {
	// The page's draft (saved by the header's «Зберегти», owner 2026-11-09), not this form's state.
	const [definitions, setDefinitions, dirty] = useCategoryDraft<DefinitionInput[]>(
		config.category_id,
		'definitions',
		config.definitions
	)
	const issue = useDraftIssue(config.category_id, 'definitions')
	const published = config.status === 'active'
	const saved = new Map(config.definitions.map(definition => [definition.key, definition]))
	const usageOf = new Map<string, KeyUsage>(usage?.keys.map(item => [item.key, item]) ?? [])
	const anyUsed = [...usageOf.values()].some(isUsed)
	const [copySource, setCopySource] = useState(''),
		[copying, setCopying] = useState(false),
		[error, setError] = useState('')
	// A list of one-line summaries; «Редагувати» unfolds one characteristic's whole form (owner,
	// 2026-11-04: eleven open forms in a row were «візуальна каша»). Saving stays one request.
	const [open, setOpen] = useState<Set<string>>(new Set())
	const locked = disabled || copying
	const toggle = (id: string) =>
		setOpen(previous => {
			const next = new Set(previous)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	const update = (index: number, patch: Partial<DefinitionInput>) =>
		setDefinitions(previous =>
			previous.map((value, position) => (position === index ? { ...value, ...patch } : value))
		)
	// Order is the position: arrows move a row, the stored `order` follows (owner, 2026-11-07:
	// numbers to type were part of the «каша»).
	const moveDefinition = (index: number, delta: number) =>
		setDefinitions(previous => {
			const next = [...previous]
			const [moved] = next.splice(index, 1)
			next.splice(index + delta, 0, moved)
			return next.map((value, position) =>
				value.order === position ? value : { ...value, order: position }
			)
		})
	const updateOption = (
		index: number,
		optionIndex: number,
		patch: Partial<DefinitionInput['options'][number]>
	) =>
		update(index, {
			options: definitions[index].options.map((value, position) =>
				position === optionIndex ? { ...value, ...patch } : value
			)
		})
	const moveOption = (index: number, optionIndex: number, delta: number) => {
		const next = [...definitions[index].options]
		const [moved] = next.splice(optionIndex, 1)
		next.splice(optionIndex + delta, 0, moved)
		update(index, {
			options: next.map((value, position) =>
				value.order === position ? value : { ...value, order: position }
			)
		})
	}
	const changeType = (index: number, type: DefinitionInput['value_type']) => {
		const value = definitions[index]
		update(index, {
			value_type: type,
			unit: type === 'boolean' ? null : value.unit,
			filter_type: value.filter_enabled
				? type === 'number' && !value.multiple
					? 'range'
					: 'multi-select'
				: null,
			options:
				type === 'enum'
					? value.options.length
						? value.options
						: [{ label: '', order: 0 }]
					: []
		})
	}
	async function copy() {
		setCopying(true)
		setError('')
		try {
			const source = await categoryTreeApi.configuration(copySource)
			if (source.revision !== config.revision)
				throw Error('Каталог змінився. Оновіть дерево перед копіюванням.')
			setDefinitions(copyDefinitions(source.definitions))
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Не вдалося скопіювати налаштування.')
		} finally {
			setCopying(false)
		}
	}
	return (
		<section
			className='space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
			aria-label='Характеристики категорії'
		>
			<div>
				<h3 className='font-semibold text-gray-900'>Характеристики та фільтри</h3>
				<p className='mt-0.5 text-sm text-gray-500'>
					Які дані заповнюються в кожному товарі цієї категорії і які з них стають
					фільтрами в каталозі сайту.
				</p>
			</div>
			{(error || issue) && (
				<p role='alert' className='text-sm text-red-700'>
					{error || issue?.message}
				</p>
			)}
			{/* Only the inputs and actions are disabled: a read-only category still unfolds to be read. */}
			<div className='space-y-4'>
				{/* Copying replaces every characteristic: offered only while nothing uses them. */}
				{!anyUsed && (
					<fieldset
						disabled={locked}
						className='flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3'
					>
						<label className='min-w-48 flex-1 text-sm'>
							Скопіювати з категорії
							<select
								className={ui.input}
								value={copySource}
								onChange={event => setCopySource(event.target.value)}
							>
								<option value=''>Оберіть категорію</option>
								{items
									.filter(
										item =>
											item._id !== config.category_id &&
											item.kind === 'product' &&
											item.attribute_contract_version === 2
									)
									.map(item => (
										<option value={item._id} key={item._id}>
											{item.name}
										</option>
									))}
							</select>
						</label>
						<button
							className={button}
							disabled={!copySource || anyUsed}
							onClick={() => void copy()}
						>
							Замінити налаштування копією
						</button>
						<p className='w-full text-xs text-gray-500'>
							{anyUsed
								? 'Копія замінила б характеристики, які вже мають товари або посадкові сторінки, — для цієї категорії вона недоступна.'
								: 'Буде створено незалежну копію. Поточні поля у формі заміняться; база зміниться лише після збереження.'}
						</p>
					</fieldset>
				)}
				{!definitions.length && (
					<p className='text-sm text-gray-500'>
						Характеристик ще немає. Додайте потрібні для цієї категорії.
					</p>
				)}
				{definitions.length > 0 && (
					<ul
						className='divide-y overflow-hidden rounded-lg border'
						aria-label='Список характеристик'
					>
						{definitions.map((definition, index) => {
							const id = rowId(definition, index)
							const original = definition.key ? saved.get(definition.key) : undefined
							const keyUsage = definition.key
								? usageOf.get(definition.key)
								: undefined
							const used = isUsed(keyUsage)
							// The unit of a held value is part of it: locked while a product or SKU has one.
							const unitLocked =
								!!original &&
								!!keyUsage &&
								keyUsage.products + keyUsage.variants > 0
							const removable = !used
							const pinned = (keyUsage?.pins ?? 0) > 0
							// The colour is filtered by its dictionary family, whatever the flag says.
							const colour = definition.semantic === 'color'
							// SKUs vary by it: a variation stays required (owner, 2026-11-06).
							const axisInUse =
								!!original?.is_required && (keyUsage?.variants ?? 0) > 0
							// In a published category every product must stay complete (server rule).
							const requiredBlocked =
								published &&
								!original?.is_required &&
								(original
									? (keyUsage?.missing ?? 0) > 0
									: (usage?.products ?? 0) > 0)
							const changed =
								!original || JSON.stringify(original) !== JSON.stringify(definition)
							const isOpen = open.has(id) || !!issue?.rows?.includes(index)
							const panelId = `definition-panel-${index}`
							return (
								<li key={definition.key ?? `new-${index}`} className='bg-white'>
									<div className='flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5'>
										<span className='w-6 text-right text-xs text-gray-400 tabular-nums'>
											{index + 1}
										</span>
										{/* The order of the page's table and of the filters. */}
										<span className='flex gap-1'>
											<button
												type='button'
												className={ui.arrow}
												aria-label={`Вище: ${definition.label.trim() || `характеристика ${index + 1}`}`}
												disabled={locked || index === 0}
												onClick={() => moveDefinition(index, -1)}
											>
												<ChevronUp className='size-4' />
											</button>
											<button
												type='button'
												className={ui.arrow}
												aria-label={`Нижче: ${definition.label.trim() || `характеристика ${index + 1}`}`}
												disabled={
													locked || index === definitions.length - 1
												}
												onClick={() => moveDefinition(index, 1)}
											>
												<ChevronDown className='size-4' />
											</button>
										</span>
										<div className='min-w-40 flex-1'>
											<p className='text-sm font-medium text-gray-900'>
												{definition.label.trim() || 'Без назви'}
												{definition.is_required && (
													<span
														className='text-red-600'
														title='Обов’язкова'
													>
														{' '}
														*
													</span>
												)}
											</p>
											<p className={hint}>
												{valueTypes[definition.value_type]}
												{definition.unit
													? `, ${definition.unit}`
													: ''} ·{' '}
												{!definition.key
													? 'нова'
													: used
														? describeUsage(keyUsage!)
														: 'не використовується'}
											</p>
										</div>
										<div className='flex flex-wrap gap-1'>
											{(definition.filter_enabled || colour) && (
												<span
													className={`${badge} bg-emerald-50 text-emerald-800`}
												>
													Фільтр
													{definition.filter_type === 'range'
														? ' · діапазон'
														: ''}
												</span>
											)}
											{definition.visible_in_specs && (
												<span
													className={`${badge} bg-blue-50 text-blue-800`}
												>
													На сторінці товару
												</span>
											)}
											{definition.multiple && (
												<span
													className={`${badge} bg-gray-100 text-gray-600`}
												>
													Кілька значень
												</span>
											)}
											{definition.semantic !== 'generic' && (
												<span
													className={`${badge} bg-violet-50 text-violet-800`}
												>
													{semantics[definition.semantic]}
												</span>
											)}
										</div>
										{changed && (
											<span
												className={`${badge} bg-amber-100 text-amber-900`}
											>
												{original ? 'змінено' : 'не збережено'}
											</span>
										)}
										<button
											type='button'
											className={button}
											aria-expanded={isOpen}
											aria-controls={panelId}
											aria-label={`${isOpen ? 'Згорнути' : 'Редагувати'} ${definition.label.trim() || `характеристику ${index + 1}`}`}
											onClick={() => toggle(id)}
										>
											{isOpen ? 'Згорнути' : 'Редагувати'}
										</button>
									</div>
									{isOpen && (
										<fieldset
											id={panelId}
											disabled={locked}
											className='space-y-4 border-t bg-white p-4 text-sm'
											aria-label={`Характеристика ${index + 1}`}
										>
											<div className='grid gap-x-4 gap-y-3 sm:grid-cols-[8rem_1fr] sm:items-center'>
												<label
													htmlFor={`${panelId}-label`}
													className='text-gray-600'
												>
													Назва
												</label>
												<input
													id={`${panelId}-label`}
													className={ui.field}
													value={definition.label}
													maxLength={200}
													onChange={event =>
														update(index, { label: event.target.value })
													}
												/>
												<span className='text-gray-600'>Тип</span>
												{used ? (
													// What the data already holds cannot change: said, not offered as a locked field.
													<p className='text-gray-900'>
														{typeSummary(definition)}
													</p>
												) : (
													<div className='flex flex-wrap items-center gap-3'>
														<select
															aria-label='Тип значення'
															className={ui.field}
															value={definition.value_type}
															disabled={colour}
															onChange={event =>
																changeType(
																	index,
																	event.target
																		.value as DefinitionInput['value_type']
																)
															}
														>
															{Object.entries(valueTypes).map(
																([value, label]) => (
																	<option
																		key={value}
																		value={value}
																	>
																		{label}
																	</option>
																)
															)}
														</select>
														{definition.value_type !== 'boolean' &&
															!colour && (
																<input
																	aria-label='Одиниця вимірювання'
																	placeholder='Одиниця, напр. кг'
																	className={ui.field}
																	maxLength={50}
																	value={definition.unit ?? ''}
																	onChange={event =>
																		update(index, {
																			unit:
																				event.target
																					.value || null
																		})
																	}
																/>
															)}
														{!colour && (
															<label className='flex items-center gap-2'>
																<input
																	type='checkbox'
																	checked={definition.multiple}
																	onChange={event =>
																		update(index, {
																			multiple:
																				event.target
																					.checked,
																			filter_type:
																				definition.filter_enabled
																					? event.target
																							.checked
																						? 'multi-select'
																						: definition.filter_type
																					: null
																		})
																	}
																/>
																Кілька значень
															</label>
														)}
													</div>
												)}
												{used &&
													!unitLocked &&
													definition.value_type !== 'boolean' &&
													!colour && (
														<>
															<label
																htmlFor={`${panelId}-unit`}
																className='text-gray-600'
															>
																Одиниця
															</label>
															<input
																id={`${panelId}-unit`}
																className={ui.field}
																maxLength={50}
																value={definition.unit ?? ''}
																onChange={event =>
																	update(index, {
																		unit:
																			event.target.value ||
																			null
																	})
																}
															/>
														</>
													)}
												{!(used && colour) && (
													<>
														<label
															htmlFor={`${panelId}-semantic`}
															className='text-gray-600'
														>
															Призначення
														</label>
														<div>
															<select
																id={`${panelId}-semantic`}
																className={ui.field}
																value={definition.semantic}
																onChange={event => {
																	const semantic = event.target
																		.value as DefinitionInput['semantic']
																	// A colour is one dictionary colour per SKU, filtered by its family:
																	// no type, unit or filter of its own.
																	update(
																		index,
																		semantic === 'color'
																			? {
																					semantic,
																					value_type:
																						'string',
																					unit: null,
																					multiple: false,
																					filter_enabled: false,
																					filter_type:
																						null,
																					options: []
																				}
																			: { semantic }
																	)
																}}
															>
																<option value='generic'>
																	Звичайна характеристика
																</option>
																{/* A used characteristic never becomes the colour: its values are not dictionary colours. */}
																{!used && (
																	<option value='color'>
																		Колір
																	</option>
																)}
																<option value='size'>Розмір</option>
																<option value='material'>
																	Матеріал
																</option>
																<option value='brand'>Бренд</option>
															</select>
															{definition.semantic === 'brand' && (
																<p className={`${hint} mt-1`}>
																	Бренд для фіду Google і розмітки
																	сторінки: товар без нього не
																	потрапить у Google Merchant.
																</p>
															)}
														</div>
													</>
												)}
											</div>
											<div className='space-y-2 border-t pt-4'>
												<label className='flex items-center gap-2'>
													<input
														type='checkbox'
														checked={definition.visible_in_specs}
														onChange={event =>
															update(index, {
																visible_in_specs:
																	event.target.checked
															})
														}
													/>
													У таблиці на сторінці товару
												</label>
												<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
													<label className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={
																definition.filter_enabled || colour
															}
															disabled={pinned || colour}
															onChange={event =>
																update(index, {
																	filter_enabled:
																		event.target.checked,
																	filter_type: event.target
																		.checked
																		? definition.value_type ===
																				'number' &&
																			!definition.multiple
																			? 'range'
																			: 'multi-select'
																		: null
																})
															}
														/>
														У фільтрах
													</label>
													{colour ? (
														<span className={hint}>
															для кольору вмикається сам
														</span>
													) : pinned ? (
														<span className={hint}>
															закріплено на{' '}
															{plural(
																keyUsage?.pins ?? 0,
																'посадковій сторінці',
																'посадкових сторінках',
																'посадкових сторінках'
															)}
														</span>
													) : null}
													{/* A list or text is always filtered by values; only one number chooses. */}
													{definition.filter_enabled &&
														definition.value_type === 'number' &&
														!definition.multiple &&
														(pinned ? (
															<span className={hint}>
																·{' '}
																{definition.filter_type === 'range'
																	? 'діапазон від–до'
																	: 'вибір значень'}
															</span>
														) : (
															<select
																aria-label='Спосіб фільтрації'
																className={ui.field}
																value={
																	definition.filter_type ??
																	'range'
																}
																onChange={event =>
																	update(index, {
																		filter_type: event.target
																			.value as
																			| 'range'
																			| 'multi-select'
																	})
																}
															>
																<option value='range'>
																	діапазон від–до
																</option>
																<option value='multi-select'>
																	вибір значень
																</option>
															</select>
														))}
												</div>
												<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
													<label className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={definition.is_required}
															disabled={
																(requiredBlocked &&
																	!definition.is_required) ||
																axisInUse
															}
															onChange={event =>
																update(index, {
																	is_required:
																		event.target.checked
																})
															}
														/>
														Обов’язкова
													</label>
													{axisInUse ? (
														<span className={hint}>
															за нею варіюються {keyUsage?.variants}{' '}
															SKU
														</span>
													) : requiredBlocked &&
													  !definition.is_required ? (
														<span className={hint}>
															{original
																? `немає значення в ${plural(keyUsage?.missing ?? 0, 'товарі', 'товарах', 'товарах')}`
																: `її ще немає в ${plural(usage?.products ?? 0, 'товарі', 'товарах', 'товарах')}`}
														</span>
													) : null}
												</div>
											</div>
											{definition.value_type === 'enum' && (
												<div className='space-y-1.5 border-t pt-4'>
													<div className='flex items-center gap-2 text-xs text-gray-500'>
														<span className='w-14 shrink-0' />
														<span className='flex-1'>Варіанти</span>
														<span className='w-36 shrink-0 text-right'>
															Товари
														</span>
														<span className='w-8 shrink-0' />
													</div>
													{definition.options.map(
														(option, optionIndex) => {
															const optionUsage = option.id
																? keyUsage?.options.find(
																		item =>
																			item.id === option.id
																	)
																: undefined
															const name =
																option.label.trim() ||
																`варіант ${optionIndex + 1}`
															return (
																<div
																	className='flex items-center gap-2'
																	key={
																		option.id ??
																		`new-${optionIndex}`
																	}
																>
																	<span className='flex w-14 shrink-0 gap-1'>
																		<button
																			type='button'
																			className={ui.arrow}
																			aria-label={`Вище: ${name}`}
																			disabled={
																				optionIndex === 0
																			}
																			onClick={() =>
																				moveOption(
																					index,
																					optionIndex,
																					-1
																				)
																			}
																		>
																			<ChevronUp className='size-4' />
																		</button>
																		<button
																			type='button'
																			className={ui.arrow}
																			aria-label={`Нижче: ${name}`}
																			disabled={
																				optionIndex ===
																				definition.options
																					.length -
																					1
																			}
																			onClick={() =>
																				moveOption(
																					index,
																					optionIndex,
																					1
																				)
																			}
																		>
																			<ChevronDown className='size-4' />
																		</button>
																	</span>
																	<input
																		aria-label={`Варіант ${optionIndex + 1}`}
																		className={cn(
																			ui.field,
																			'flex-1'
																		)}
																		value={option.label}
																		maxLength={200}
																		onChange={event =>
																			updateOption(
																				index,
																				optionIndex,
																				{
																					label: event
																						.target
																						.value
																				}
																			)
																		}
																	/>
																	<span className='w-36 shrink-0 text-right text-xs text-gray-500'>
																		{optionUsage &&
																		isUsed(optionUsage)
																			? optionUsageText(
																					optionUsage
																				)
																			: ''}
																	</span>
																	<span className='w-8 shrink-0'>
																		{/* Only what nothing uses can go; a used option can be renamed. */}
																		{!(
																			optionUsage &&
																			isUsed(optionUsage)
																		) && (
																			<button
																				type='button'
																				className={ui.arrow}
																				aria-label={`Видалити варіант: ${name}`}
																				onClick={() =>
																					update(index, {
																						options:
																							definition.options
																								.filter(
																									(
																										_,
																										position
																									) =>
																										position !==
																										optionIndex
																								)
																								.map(
																									(
																										value,
																										position
																									) => ({
																										...value,
																										order: position
																									})
																								)
																					})
																				}
																			>
																				<X className='size-4' />
																			</button>
																		)}
																	</span>
																</div>
															)
														}
													)}
													<button
														type='button'
														className={`${button} mt-1`}
														disabled={definition.options.length >= 200}
														onClick={() =>
															update(index, {
																options: [
																	...definition.options,
																	{
																		label: '',
																		order: definition.options
																			.length
																	}
																]
															})
														}
													>
														+ Додати варіант
													</button>
												</div>
											)}
											{removable && (
												<div className='flex justify-end border-t pt-4'>
													<button
														type='button'
														className={button}
														onClick={() =>
															setDefinitions(previous =>
																previous
																	.filter(
																		(_, position) =>
																			position !== index
																	)
																	.map((value, position) =>
																		value.order === position
																			? value
																			: {
																					...value,
																					order: position
																				}
																	)
															)
														}
													>
														Прибрати характеристику
													</button>
												</div>
											)}
										</fieldset>
									)}
								</li>
							)
						})}
					</ul>
				)}
				{/* Google Merchant refuses an item without a brand (`missing_brand`, owner 2026-11-08). */}
				{!definitions.some(
					definition => definition.semantic === 'brand' && definition.is_required
				) && (
					<p className='rounded-lg bg-amber-50 p-3 text-sm'>
						Немає обов’язкової характеристики з призначенням «Бренд»: товари цієї
						категорії не потраплять у Google Merchant.
					</p>
				)}
				{published && (
					<p className='rounded-lg bg-amber-50 p-3 text-sm'>
						Категорія опублікована: збережені зміни одразу з’являться на сайті (фільтри,
						характеристики товарів) і в товарному фіді.
					</p>
				)}
				{usageFailed && (
					<p className='text-sm text-amber-700'>
						Не вдалося перевірити, що використовує кожна характеристика. Сервер
						перевірить зміни під час збереження.
					</p>
				)}
				<fieldset disabled={locked} className='flex flex-wrap gap-2'>
					<button
						className={button}
						disabled={definitions.length >= 100}
						onClick={() => {
							// A new characteristic opens at once: there is nothing to summarise yet.
							setOpen(previous => new Set(previous).add(`new-${definitions.length}`))
							setDefinitions(previous => [
								...previous,
								{ ...newDefinition(), order: previous.length }
							])
						}}
					>
						Додати характеристику
					</button>
				</fieldset>
			</div>
			<CategoryFilterPreview config={config} disabled={dirty || copying} />
		</section>
	)
}
