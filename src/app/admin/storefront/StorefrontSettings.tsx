'use client'
import { ui } from '@/app/admin/categories/_components/admin-ui'
import { useId, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { categoryTreeApi, type TreeItem } from '../categories/category-tree.api'
import { storefrontApi } from './storefront.api'
import type {
	StorefrontAdmin,
	StorefrontCollection,
	StorefrontContent,
	StorefrontSettingsBody
} from './storefront.schema'

/** The server's limits (fillando-be `storefront-limits.ts`): collections, products of one. */
const COLLECTIONS_MAX = 12
const COLLECTION_PRODUCTS_MAX = 24
/** The strip's lines (fillando-be `storefrontContentSchema`). */
const STRIP_MAX = 4
/**
 * A button goes somewhere on this site, as the server requires: `/…`, never a scheme or `//host`,
 * and no backslash — a browser reads `/\host` as `//host` (audit 11.11).
 */
const internalHref = (href: string) => /^\/(?!\/)[^\s\\]*$/.test(href.trim())
const contentOf = (settings: StorefrontAdmin): StorefrontContent => ({
	strip: settings.strip,
	banner: settings.banner,
	side_promo: settings.side_promo,
	band: settings.band
})
/** What the server would refuse in the home page's copy, said before the request. */
function contentProblem(content: StorefrontContent) {
	const { banner, side_promo, band } = content
	if (content.strip.some(line => !line.trim()))
		return 'Порожній рядок смужки: заповніть або приберіть.'
	if (!banner.title.trim()) return 'Банер: потрібен заголовок.'
	if (banner.accent.trim() && !banner.title.includes(banner.accent.trim()))
		return 'Банер: виділене має бути частиною заголовка.'
	if (!banner.button_label.trim() || !internalHref(banner.button_href))
		return 'Банер: кнопці потрібні підпис і адреса на цьому сайті, що починається з «/».'
	if (!side_promo.title.trim() || !side_promo.button_label.trim())
		return 'Картка праворуч: потрібні заголовок і підпис кнопки.'
	if (side_promo.action === 'link' && !internalHref(side_promo.button_href ?? ''))
		return 'Картка праворуч: адреса на цьому сайті, що починається з «/».'
	if (
		band &&
		(!band.title.trim() || !band.button_label.trim() || !internalHref(band.button_href))
	)
		return 'Смуга: потрібні заголовок, підпис кнопки й адреса на цьому сайті, що починається з «/».'
	return null
}
const MESSAGES: Record<string, string> = {
	SETTINGS_CATEGORY_INVALID:
		'Одна з вибраних категорій уже недоступна (архівна або стара). Оновіть сторінку.',
	SETTINGS_LANDING_INVALID: 'Посадкова сторінка не належить вибраній категорії.',
	SETTINGS_PRODUCT_INVALID:
		'Один із товарів добірки вже недоступний (видалений або в архівній категорії). Оновіть сторінку.',
	SETTINGS_DUPLICATE_PRODUCT: 'Товар доданий у добірку двічі.',
	SETTINGS_UNCHANGED: 'Змін немає.',
	CATEGORY_REVISION_CONFLICT: 'Каталог уже змінився. Оновіть сторінку перед збереженням.',
	CATALOG_DRAFT_WRITES_DISABLED: 'Записи нового каталогу ще не ввімкнені.',
	CATALOG_WRITE_IN_PROGRESS: 'Каталог зараз оновлюється. Спробуйте ще раз.'
}
const errorOf = (error: unknown) => {
	const value = error as { status?: number; details?: { details?: { code?: string } } }
	const code = value?.details?.details?.code
	return {
		status: value?.status,
		message:
			(code && MESSAGES[code]) ||
			(value?.status === 400
				? 'Перевірте поля.'
				: 'Результат невідомий. Спробуйте зберегти ще раз.')
	}
}

/**
 * Storefront settings (Plan-0010 F05/F11, TD-0015): the home page's copy — the strip above the
 * header, the banner, the card beside it, the band — and curated collections (a category, one of
 * its typed landings or a product list). Only categories of the new catalogue can be chosen.
 */
export function StorefrontSettings() {
	// Lives here: a save bumps the revision and remounts the form, which must not drop the outcome.
	const [message, setMessage] = useState('')
	const settings = useQuery({
		queryKey: ['storefront-settings-admin'],
		queryFn: storefrontApi.admin,
		retry: false,
		refetchOnWindowFocus: false
	})
	const tree = useQuery({
		queryKey: ['category-tree'],
		queryFn: categoryTreeApi.tree,
		retry: false,
		refetchOnWindowFocus: false
	})
	if (settings.isLoading || tree.isLoading) return <p className='p-4 text-sm'>Завантаження…</p>
	if (settings.isError || tree.isError)
		return (
			<p role='alert' className='p-4'>
				Не вдалося завантажити налаштування. Нова структура каталогу ще не ввімкнена або
				сервер недоступний.
			</p>
		)
	return (
		<SettingsForm
			key={settings.data!.revision}
			initial={settings.data!}
			message={message}
			setMessage={setMessage}
			categories={tree.data!.items.filter(
				item => item.attribute_contract_version === 2 && item.status !== 'archived'
			)}
		/>
	)
}

function SettingsForm({
	initial,
	categories,
	message,
	setMessage
}: {
	initial: StorefrontAdmin
	categories: TreeItem[]
	message: string
	setMessage: (message: string) => void
}) {
	const client = useQueryClient()
	const [content, setContent] = useState<StorefrontContent>(contentOf(initial))
	const [collections, setCollections] = useState<StorefrontCollection[]>(initial.collections)
	const [pending, setPending] = useState<{ key: string; body: string } | null>(null)
	const [busy, setBusy] = useState(false)
	const move = <T,>(list: T[], index: number, step: number) => {
		const next = [...list]
		const [item] = next.splice(index, 1)
		next.splice(index + step, 0, item)
		return next
	}
	const dirty =
		JSON.stringify(content) !== JSON.stringify(contentOf(initial)) ||
		JSON.stringify(collections) !== JSON.stringify(initial.collections)
	const banner = content.banner,
		promo = content.side_promo,
		band = content.band
	const setBanner = (patch: Partial<StorefrontContent['banner']>) =>
		setContent(current => ({ ...current, banner: { ...current.banner, ...patch } }))
	const setPromo = (patch: Partial<StorefrontContent['side_promo']>) =>
		setContent(current => ({ ...current, side_promo: { ...current.side_promo, ...patch } }))
	const setBand = (patch: Partial<NonNullable<StorefrontContent['band']>>) =>
		setContent(current => ({ ...current, band: current.band && { ...current.band, ...patch } }))
	async function save() {
		const body: StorefrontSettingsBody = {
			expected_revision: initial.revision,
			...content,
			collections: collections.map(item => ({ ...item, title: item.title.trim() }))
		}
		const problem = contentProblem(content)
		if (problem) return setMessage(problem)
		if (body.collections.some(item => !item.title))
			return setMessage('Кожна добірка має назву.')
		if (body.collections.some(item => item.category_id === null && !item.product_ids?.length))
			return setMessage('Додайте в добірку товарів хоча б один товар.')
		const serialized = JSON.stringify(body)
		// An unknown outcome is retried with the same key, so the server answers the first result.
		const key = pending?.body === serialized ? pending.key : crypto.randomUUID()
		setPending({ key, body: serialized })
		setMessage('')
		setBusy(true)
		try {
			await storefrontApi.save(body, key)
			setPending(null)
			setMessage('Налаштування вітрини збережено.')
			await client.invalidateQueries({ queryKey: ['storefront-settings-admin'] })
		} catch (error) {
			const failure = errorOf(error)
			if ([400, 404, 409].includes(failure.status ?? 0)) setPending(null)
			setMessage(failure.message)
		} finally {
			setBusy(false)
		}
	}
	return (
		// The admin's common look (owner, 2026-11-09): a page heading, a header that stays on screen
		// with the save, and one white card per block with its one-sentence purpose.
		<section className='w-full max-w-6xl space-y-4 p-4' aria-label='Налаштування вітрини'>
			<header className='sticky top-14 z-20 space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:top-0'>
				<div>
					<h1 className='text-xl font-semibold'>Вітрина</h1>
					<p className={ui.hint}>
						Тексти головної сторінки й смужки над шапкою, добірки товарів.
					</p>
				</div>
				{(dirty || pending) && (
					<div className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-2 text-sm'>
						<p>
							{pending ? 'Результат збереження невідомий.' : 'Є незбережені зміни.'}
						</p>
						<div className='flex gap-2'>
							<button
								type='button'
								className={ui.button}
								disabled={busy}
								onClick={() => {
									setContent(contentOf(initial))
									setCollections(initial.collections)
									setPending(null)
									setMessage('')
								}}
							>
								Скасувати
							</button>
							<button
								type='button'
								className={ui.primary}
								disabled={busy}
								onClick={() => void save()}
							>
								{pending ? 'Зберегти ще раз' : 'Зберегти вітрину'}
							</button>
						</div>
					</div>
				)}
				{message && (
					<p role='status' className='text-sm text-gray-700'>
						{message}
					</p>
				)}
			</header>
			<fieldset disabled={busy} className='space-y-4'>
				<section className={ui.card} aria-label='Смужка над шапкою'>
					<div>
						<h2 className={ui.cardTitle}>Смужка над шапкою</h2>
						<p className={ui.hint}>
							Короткі обіцянки магазину над шапкою на кожній сторінці, поруч телефон.
							Без рядків смужки немає.
						</p>
					</div>
					{content.strip.map((line, index) => (
						<div key={index} className='flex items-end gap-2'>
							<label className={`${ui.label} flex-1`}>
								Рядок {index + 1}
								<input
									className={ui.input}
									maxLength={60}
									value={line}
									onChange={event =>
										setContent(current => ({
											...current,
											strip: current.strip.map((value, i) =>
												i === index ? event.target.value : value
											)
										}))
									}
								/>
							</label>
							<button
								type='button'
								className={`${ui.arrow} mb-2`}
								aria-label={`Прибрати рядок ${index + 1}`}
								onClick={() =>
									setContent(current => ({
										...current,
										strip: current.strip.filter((_, i) => i !== index)
									}))
								}
							>
								<X size={16} aria-hidden />
							</button>
						</div>
					))}
					<div>
						<button
							type='button'
							className={ui.button}
							disabled={content.strip.length >= STRIP_MAX}
							onClick={() =>
								setContent(current => ({
									...current,
									strip: [...current.strip, '']
								}))
							}
						>
							Додати рядок
						</button>
					</div>
				</section>
				<section className={ui.card} aria-label='Банер'>
					<div>
						<h2 className={ui.cardTitle}>Банер</h2>
						<p className={ui.hint}>
							Перше, що бачить покупець на головній. Заголовок банера — головний
							заголовок сторінки для Google.
						</p>
					</div>
					<div className='grid gap-3 sm:grid-cols-2'>
						<label className={ui.label}>
							Надзаголовок (необов’язково)
							<input
								className={ui.input}
								maxLength={60}
								value={banner.eyebrow}
								onChange={event => setBanner({ eyebrow: event.target.value })}
							/>
						</label>
						<label className={ui.label}>
							Заголовок
							<input
								className={ui.input}
								maxLength={80}
								value={banner.title}
								onChange={event => setBanner({ title: event.target.value })}
							/>
						</label>
						<label className={ui.label}>
							Виділити в заголовку (необов’язково)
							<input
								className={ui.input}
								maxLength={80}
								placeholder='Частина заголовка, яку підсвітити'
								value={banner.accent}
								onChange={event => setBanner({ accent: event.target.value })}
							/>
						</label>
						<label className={`${ui.label} sm:col-span-2`}>
							Текст
							<textarea
								className={ui.textarea}
								rows={2}
								maxLength={200}
								value={banner.text}
								onChange={event => setBanner({ text: event.target.value })}
							/>
						</label>
						<label className={ui.label}>
							Кнопка: підпис
							<input
								className={ui.input}
								maxLength={40}
								value={banner.button_label}
								onChange={event => setBanner({ button_label: event.target.value })}
							/>
						</label>
						<label className={ui.label}>
							Кнопка: адреса на сайті
							<input
								className={ui.input}
								maxLength={300}
								placeholder='/catalog'
								value={banner.button_href}
								onChange={event => setBanner({ button_href: event.target.value })}
							/>
						</label>
					</div>
				</section>
				<section className={ui.card} aria-label='Картка праворуч від банера'>
					<div>
						<h2 className={ui.cardTitle}>Картка праворуч від банера</h2>
						<p className={ui.hint}>
							Друга пропозиція поруч із банером: форма оптової заявки або перехід на
							сторінку сайту.
						</p>
					</div>
					<div className='grid gap-3 sm:grid-cols-2'>
						<label className={ui.label}>
							Заголовок
							<input
								className={ui.input}
								maxLength={60}
								value={promo.title}
								onChange={event => setPromo({ title: event.target.value })}
							/>
						</label>
						<label className={ui.label}>
							Кнопка: підпис
							<input
								className={ui.input}
								maxLength={40}
								value={promo.button_label}
								onChange={event => setPromo({ button_label: event.target.value })}
							/>
						</label>
						<label className={`${ui.label} sm:col-span-2`}>
							Текст
							<textarea
								className={ui.textarea}
								rows={2}
								maxLength={160}
								value={promo.text}
								onChange={event => setPromo({ text: event.target.value })}
							/>
						</label>
						<label className={ui.label}>
							Кнопка відкриває
							<select
								className={ui.input}
								value={promo.action}
								onChange={event =>
									setPromo(
										event.target.value === 'link'
											? {
													action: 'link',
													button_href: promo.button_href ?? ''
												}
											: { action: 'wholesale-form', button_href: null }
									)
								}
							>
								<option value='wholesale-form'>Форму оптової заявки</option>
								<option value='link'>Сторінку сайту</option>
							</select>
						</label>
						{promo.action === 'link' && (
							<label className={ui.label}>
								Адреса на сайті
								<input
									className={ui.input}
									maxLength={300}
									placeholder='/wholesale'
									value={promo.button_href ?? ''}
									onChange={event =>
										setPromo({ button_href: event.target.value })
									}
								/>
							</label>
						)}
					</div>
				</section>
				<section className={ui.card} aria-label='Смуга між стрічками'>
					<div>
						<h2 className={ui.cardTitle}>Смуга між стрічками</h2>
						<p className={ui.hint}>
							Вузька смуга на всю ширину між «Новинками» й добірками — наприклад,
							прайс-лист.
						</p>
					</div>
					<label className='flex items-center gap-2 text-sm'>
						<input
							type='checkbox'
							checked={band !== null}
							onChange={event =>
								setContent(current => ({
									...current,
									band: event.target.checked
										? (contentOf(initial).band ?? {
												title: '',
												text: '',
												button_label: '',
												button_href: ''
											})
										: null
								}))
							}
						/>
						Показувати смугу
					</label>
					{band && (
						<div className='grid gap-3 sm:grid-cols-2'>
							<label className={ui.label}>
								Заголовок
								<input
									className={ui.input}
									maxLength={60}
									value={band.title}
									onChange={event => setBand({ title: event.target.value })}
								/>
							</label>
							<label className={`${ui.label} sm:col-span-2`}>
								Текст
								<input
									className={ui.input}
									maxLength={160}
									value={band.text}
									onChange={event => setBand({ text: event.target.value })}
								/>
							</label>
							<label className={ui.label}>
								Кнопка: підпис
								<input
									className={ui.input}
									maxLength={40}
									value={band.button_label}
									onChange={event =>
										setBand({ button_label: event.target.value })
									}
								/>
							</label>
							<label className={ui.label}>
								Кнопка: адреса на сайті
								<input
									className={ui.input}
									maxLength={300}
									placeholder='/price-sheet'
									value={band.button_href}
									onChange={event => setBand({ button_href: event.target.value })}
								/>
							</label>
						</div>
					)}
				</section>
				<section className={ui.card} aria-label='Добірки на головній'>
					<div>
						<h2 className={ui.cardTitle}>Добірки на головній</h2>
						<p className={ui.hint}>
							Стрічка товарів категорії або однієї з її посадкових сторінок із
							переходом на неї — або вибрані вами товари в заданому порядку. Товари з
							неопублікованих категорій на сайті не показуються.
						</p>
					</div>
					{collections.map((item, index) => (
						<CollectionRow
							key={item.id ?? `new-${index}`}
							item={item}
							index={index}
							count={collections.length}
							categories={categories}
							onChange={next =>
								setCollections(current =>
									current.map((row, i) => (i === index ? next : row))
								)
							}
							onMove={step => setCollections(current => move(current, index, step))}
							onRemove={() =>
								setCollections(current => current.filter((_, i) => i !== index))
							}
						/>
					))}
					<div className='flex flex-wrap gap-2'>
						<button
							type='button'
							className={ui.button}
							disabled={!categories.length || collections.length >= COLLECTIONS_MAX}
							onClick={() =>
								setCollections(current => [
									...current,
									{ title: '', category_id: categories[0]._id, landing_id: null }
								])
							}
						>
							Додати добірку
						</button>
						<button
							type='button'
							className={ui.button}
							disabled={!categories.length || collections.length >= COLLECTIONS_MAX}
							onClick={() =>
								setCollections(current => [
									...current,
									{
										title: '',
										category_id: null,
										landing_id: null,
										product_ids: []
									}
								])
							}
						>
							Додати добірку товарів
						</button>
					</div>
				</section>
			</fieldset>
		</section>
	)
}

function CollectionRow({
	item,
	index,
	count,
	categories,
	onChange,
	onMove,
	onRemove
}: {
	item: StorefrontCollection
	index: number
	count: number
	categories: TreeItem[]
	onChange: (item: StorefrontCollection) => void
	onMove: (step: number) => void
	onRemove: () => void
}) {
	const uid = useId()
	const category = categories.find(row => row._id === item.category_id)
	const landings = useQuery({
		queryKey: ['storefront-collection-landings', item.category_id],
		enabled: category?.kind === 'product',
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: () => categoryTreeApi.typedLandings(item.category_id!)
	})
	const controls = (
		<>
			<button
				type='button'
				className={ui.arrow}
				disabled={index === 0}
				onClick={() => onMove(-1)}
				aria-label='Добірка вище'
			>
				<ChevronUp size={16} aria-hidden />
			</button>
			<button
				type='button'
				className={ui.arrow}
				disabled={index === count - 1}
				onClick={() => onMove(1)}
				aria-label='Добірка нижче'
			>
				<ChevronDown size={16} aria-hidden />
			</button>
			<button type='button' className={ui.button} onClick={onRemove}>
				Прибрати
			</button>
		</>
	)
	if (item.category_id === null)
		return (
			<div
				className='space-y-3 rounded-lg border border-gray-200 p-3 text-sm'
				role='group'
				aria-label={`Добірка ${index + 1}`}
			>
				<div className='flex flex-wrap items-end gap-2'>
					<label className='min-w-48 flex-1'>
						Назва
						<input
							className={ui.input}
							value={item.title}
							onChange={event => onChange({ ...item, title: event.target.value })}
						/>
					</label>
					{controls}
				</div>
				<ProductListPicker
					value={item.product_ids ?? []}
					categories={categories.filter(row => row.kind === 'product')}
					onChange={product_ids => onChange({ ...item, product_ids })}
				/>
			</div>
		)
	return (
		<div
			className='flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-3 text-sm'
			role='group'
			aria-label={`Добірка ${index + 1}`}
		>
			<label className='min-w-48 flex-1'>
				Назва
				<input
					className={ui.input}
					value={item.title}
					onChange={event => onChange({ ...item, title: event.target.value })}
				/>
			</label>
			<div className='min-w-48 flex-1'>
				<label htmlFor={`${uid}-category`}>Категорія</label>
				<select
					id={`${uid}-category`}
					className={ui.input}
					value={item.category_id ?? ''}
					onChange={event =>
						onChange({ ...item, category_id: event.target.value, landing_id: null })
					}
				>
					{categories.map(row => (
						<option key={row._id} value={row._id}>
							{row.name}
							{row.kind === 'group' ? ' (група)' : ''}
						</option>
					))}
				</select>
			</div>
			<div className='min-w-48 flex-1'>
				<label htmlFor={`${uid}-landing`}>Посадкова сторінка</label>
				<select
					id={`${uid}-landing`}
					className={ui.input}
					value={item.landing_id ?? ''}
					disabled={category?.kind !== 'product'}
					onChange={event =>
						onChange({ ...item, landing_id: event.target.value || null })
					}
				>
					<option value=''>Уся категорія</option>
					{(landings.data?.items ?? [])
						.filter(row => row.contract_version === 2)
						.map(row => (
							<option key={row._id} value={row._id}>
								{row.h1}
								{row.status === 'active' ? '' : ' (чернетка)'}
							</option>
						))}
				</select>
				{landings.data?.truncated && (
					<p className='mt-1 text-xs text-gray-500'>
						У списку — перші 500 сторінок категорії.
					</p>
				)}
			</div>
			{controls}
		</div>
	)
}

/**
 * The products of a curated collection, in order: pick a category, then one of its products. Names
 * of products saved earlier are read back one by one (at most 24).
 */
function ProductListPicker({
	value,
	categories,
	onChange
}: {
	value: string[]
	categories: TreeItem[]
	onChange: (value: string[]) => void
}) {
	const uid = useId()
	const [source, setSource] = useState(categories[0]?._id ?? '')
	const [choice, setChoice] = useState('')
	const [known, setKnown] = useState<Record<string, string>>({})
	const products = useQuery({
		queryKey: ['storefront-collection-products', source],
		enabled: !!source,
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const items: { id: string; name: string }[] = []
			let cursor: string | undefined
			do {
				const page = await categoryTreeApi.typedProducts(source, cursor)
				items.push(...page.items)
				cursor = page.next_cursor ?? undefined
			} while (cursor)
			return items
		}
	})
	const saved = useQuery({
		queryKey: ['storefront-collection-names', value.filter(id => !known[id])],
		enabled: value.some(id => !known[id]),
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () =>
			Object.fromEntries(
				await Promise.all(
					value
						.filter(id => !known[id])
						.map(async id => {
							try {
								return [id, (await categoryTreeApi.typedProduct(id)).name]
							} catch {
								return [id, 'Недоступний товар']
							}
						})
				)
			) as Record<string, string>
	})
	const names = { ...saved.data, ...known }
	const move = (index: number, step: number) => {
		const next = [...value]
		const [id] = next.splice(index, 1)
		next.splice(index + step, 0, id)
		onChange(next)
	}
	return (
		<div className='space-y-2'>
			<div className='flex flex-wrap items-end gap-2'>
				<div className='min-w-48 flex-1'>
					<label htmlFor={`${uid}-source`}>Категорія товару</label>
					<select
						id={`${uid}-source`}
						className={ui.input}
						value={source}
						onChange={event => {
							setSource(event.target.value)
							setChoice('')
						}}
					>
						{categories.map(row => (
							<option key={row._id} value={row._id}>
								{row.name}
								{row.status === 'draft' ? ' (чернетка)' : ''}
							</option>
						))}
					</select>
				</div>
				<div className='min-w-48 flex-1'>
					<label htmlFor={`${uid}-product`}>Товар</label>
					<select
						id={`${uid}-product`}
						className={ui.input}
						value={choice}
						onChange={event => setChoice(event.target.value)}
					>
						<option value=''>— оберіть товар —</option>
						{(products.data ?? [])
							.filter(row => !value.includes(row.id))
							.map(row => (
								<option key={row.id} value={row.id}>
									{row.name}
								</option>
							))}
					</select>
				</div>
				<button
					type='button'
					className={ui.button}
					disabled={!choice || value.length >= COLLECTION_PRODUCTS_MAX}
					onClick={() => {
						const name = products.data?.find(row => row.id === choice)?.name
						if (name) setKnown(current => ({ ...current, [choice]: name }))
						onChange([...value, choice])
						setChoice('')
					}}
				>
					Додати товар
				</button>
			</div>
			{value.length ? (
				<ol
					className='divide-y rounded-lg border border-gray-200'
					aria-label='Товари добірки'
				>
					{value.map((id, index) => (
						<li key={id} className='flex items-center gap-2 px-3 py-2'>
							<span className='flex-1'>
								{index + 1}. {names[id] ?? '…'}
							</span>
							<button
								type='button'
								className={ui.arrow}
								disabled={index === 0}
								aria-label={`Вище: ${names[id] ?? id}`}
								onClick={() => move(index, -1)}
							>
								<ChevronUp size={16} aria-hidden />
							</button>
							<button
								type='button'
								className={ui.arrow}
								disabled={index === value.length - 1}
								aria-label={`Нижче: ${names[id] ?? id}`}
								onClick={() => move(index, 1)}
							>
								<ChevronDown size={16} aria-hidden />
							</button>
							<button
								type='button'
								className={ui.arrow}
								aria-label={`Прибрати: ${names[id] ?? id}`}
								onClick={() => onChange(value.filter(other => other !== id))}
							>
								<X size={16} aria-hidden />
							</button>
						</li>
					))}
				</ol>
			) : (
				<p className='text-gray-500'>Товарів у добірці ще немає.</p>
			)}
		</div>
	)
}
