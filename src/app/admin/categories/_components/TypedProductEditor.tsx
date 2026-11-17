'use client'
import { ValueInput } from './TypedValueInput'
import { ActivationGaps, newProductGaps, ProductReadiness, skuGaps } from './ProductReadiness'
import { ProductVariantsEditor } from './ProductVariantsEditor'
import {
	ProductDescriptionEditor,
	ProductPromotionEditor,
	ProductPurchaseNoticeEditor,
	PurchaseNoticeFields
} from './ProductDetailsEditor'
import { ProductTransferPanel, type TransferTarget } from './ProductTransferPanel'
import { vendorsApi } from '../../vendors/vendors.api'
import { ImageDropzone, type ImageUploadItem } from '../../products/_components/ImageDropzone'
import {
	DescriptionBlock,
	type DescriptionValue
} from '../../products/_components/DescriptionBlock'
import { productsApi } from '../../products/products.api'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { categoryTreeApi, type CategoryCommand } from '../category-tree.api'
import {
	purchaseNoticeInput,
	supplierIdInput,
	typedProductCreateBodySchema,
	type TypedDefinition,
	type TypedProduct
} from '../typed-product.schema'
import { CatalogChangedError, categoryError } from '../category-tree.utils'
import { isAxisCandidate } from '../category-definitions.schema'
import { ui } from './admin-ui'
import { productScope, useCategoryDraft, useDirtyScopes, useDraftIssue } from './category-drafts'
import {
	characteristicsBase,
	characteristicsValues,
	problemText,
	useProductSave,
	type CharacteristicsDraft,
	type NoticeDraft
} from './product-drafts'
const button = ui.button
const pagerButton =
	'min-w-8 rounded-md border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent'
/** «1 варіант», «3 варіанти», «12 варіантів». */
/** Products per page of the list — the backend's page size. */
const PAGE_SIZE = 25
/** The first, the last and the neighbours of the current page; `null` is a gap («…»). */
export function pageWindow(page: number, pages: number): (number | null)[] {
	const shown = Array.from({ length: pages }, (_, index) => index + 1).filter(
		number => number === 1 || number === pages || Math.abs(number - page) <= 1
	)
	return shown.flatMap((number, index) =>
		index > 0 && number - shown[index - 1] > 1 ? [null, number] : [number]
	)
}
export function variantCount(count: number) {
	const tail = count % 10,
		teen = count % 100 >= 11 && count % 100 <= 14
	const word =
		tail === 1 && !teen ? 'варіант' : tail >= 2 && tail <= 4 && !teen ? 'варіанти' : 'варіантів'
	return `${count} ${word}`
}
/**
 * The products of one v2 category on the «Товари» screen — the one place products are edited
 * (the category page links here, owner 2026-11-05): the list on the left, the selected product's
 * editor on the right (stacked on narrow screens).
 */
function ProductsFrame({ children }: { children: ReactNode }) {
	return (
		<section className='min-w-0 space-y-3' aria-label='Товари категорії'>
			{children}
		</section>
	)
}
export function TypedProductEditor({
	categoryId,
	initialProductId,
	revision,
	disabled,
	onSubmit,
	message = '',
	transferTargets = []
}: {
	categoryId: string
	initialProductId?: string
	/** Other editable v2 product categories this category's products may move to (F04). */
	transferTargets?: TransferTarget[]
	revision: number
	disabled: boolean
	/** The last save's outcome: shown in the product's header, which stays on screen. */
	message?: string
	/** `onSuccess` runs once the command is confirmed, before the page reloads its data. */
	onSubmit: (command: CategoryCommand, onSuccess?: () => void) => void
}) {
	const [pageNumber, setPageNumber] = useState(1),
		[selected, setSelected] = useState(initialProductId ?? ''),
		[creating, setCreating] = useState(false),
		[search, setSearch] = useState(''),
		[query, setQuery] = useState(''),
		// «Скасувати» of the header: the description editor keeps its text in its own state, so
		// dropping the draft alone would leave the dropped text on screen.
		[discards, setDiscards] = useState(0)
	// The search runs on the server over the whole category — a page holds only 25 — after a pause
	// in typing, and starts again from page 1. Only a changed search does that: the timer used to
	// run on mount too and sent whoever had already opened another page back to the first.
	useEffect(() => {
		const next = search.trim()
		if (next === query) return
		const timer = setTimeout(() => {
			setQuery(next)
			setPageNumber(1)
		}, 300)
		return () => clearTimeout(timer)
	}, [search, query])
	const page = useQuery({
		queryKey: ['typed-products', categoryId, revision, pageNumber, query],
		retry: false,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
		queryFn: async () => {
			const result = await categoryTreeApi.typedProductPage(
				categoryId,
				pageNumber,
				query || undefined
			)
			if (result.revision !== revision || result.category_id !== categoryId)
				throw new CatalogChangedError()
			return result
		}
	})
	// The supplier of an existing product is editable, as in the old product form.
	const vendors = useQuery({
		queryKey: ['typed-product-create-vendors'],
		queryFn: vendorsApi.getAll,
		enabled: !!selected,
		retry: false,
		refetchOnWindowFocus: false
	})
	const product = useQuery({
		queryKey: ['typed-product', selected, revision],
		enabled: !!selected,
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const result = await categoryTreeApi.typedProduct(selected)
			if (
				result.revision !== revision ||
				result.category_id !== categoryId ||
				result.product_id !== selected
			)
				throw new CatalogChangedError()
			return result
		}
	})
	// One «Зберегти» in the product's header (owner, 2026-11-09); the list marks unsaved products.
	const save = useProductSave(product.data && !product.isError ? product.data : null)
	const dirty = useDirtyScopes()
	const items = page.data?.items ?? []
	const pages = Math.max(1, Math.ceil((page.data?.total ?? 0) / PAGE_SIZE))
	const goTo = (number: number) => {
		setPageNumber(number)
		setSelected('')
	}
	const blocked = disabled || product.isFetching || page.isError
	return (
		<ProductsFrame>
			<div className='grid min-w-0 items-start gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]'>
				<div className={`${ui.card} xl:sticky xl:top-4`}>
					<div className='flex items-center justify-between gap-2'>
						<h3 className={ui.cardTitle}>Товари</h3>
						{page.data && (
							<span className={`${ui.badge} bg-gray-100 text-gray-700`}>
								{page.data.total}
							</span>
						)}
					</div>
					<button
						type='button'
						className={`${creating ? button : ui.primary} w-full`}
						disabled={disabled}
						onClick={() => {
							setCreating(!creating)
							setSelected('')
						}}
					>
						{creating ? 'Скасувати створення товару' : 'Створити товар'}
					</button>
					{/* While a search is typed, asked or being replaced by the whole list, the box stays:
					    its own short result must not take it away from under the cursor. */}
					{((page.data?.total ?? 0) > 5 || search || query || page.isPlaceholderData) && (
						<label className='block'>
							<span className='sr-only'>Пошук товару</span>
							<input
								className={ui.input}
								type='search'
								placeholder='Пошук за назвою…'
								value={search}
								onChange={event => setSearch(event.target.value)}
							/>
						</label>
					)}
					{page.isLoading && <p className={ui.hint}>Завантаження товарів…</p>}
					{page.error && (
						<p role='alert' className='text-sm text-red-700'>
							{categoryError(page.error).message}
						</p>
					)}
					{page.data && !page.isError && (
						<>
							{!items.length && (
								<p className={ui.hint}>
									{query
										? 'Нічого не знайдено.'
										: 'Товарів у категорії ще немає.'}
								</p>
							)}
							<ul className='-mx-2 max-h-[60vh] space-y-0.5 overflow-auto'>
								{items.map(item => (
									<li key={item.id}>
										<button
											type='button'
											className={`w-full rounded-md border-l-2 px-3 py-2 text-left text-sm break-words disabled:opacity-50 ${
												selected === item.id
													? 'border-blue-600 bg-blue-50 font-medium text-gray-900'
													: 'border-transparent text-gray-700 hover:bg-gray-50'
											}`}
											disabled={disabled}
											aria-pressed={selected === item.id}
											onClick={() => {
												setSelected(item.id)
												setCreating(false)
											}}
										>
											{item.name}
											{dirty.includes(productScope(item.id)) && (
												<span className='block text-xs font-medium text-amber-700'>
													Є незбережені зміни
												</span>
											)}
										</button>
									</li>
								))}
							</ul>
							{pages > 1 && (
								<nav
									aria-label='Сторінки товарів'
									aria-busy={page.isFetching}
									className='flex flex-wrap items-center gap-1'
								>
									<button
										type='button'
										className={pagerButton}
										disabled={disabled || pageNumber <= 1}
										aria-label='Попередня сторінка'
										onClick={() => goTo(pageNumber - 1)}
									>
										←
									</button>
									{pageWindow(pageNumber, pages).map((number, index) =>
										number === null ? (
											<span
												key={`gap-${index}`}
												className='px-1 text-gray-400'
											>
												…
											</span>
										) : (
											<button
												key={number}
												type='button'
												className={`${pagerButton} ${number === pageNumber ? 'border-gray-900 bg-gray-900 text-white' : ''}`}
												disabled={disabled}
												aria-current={
													number === pageNumber ? 'page' : undefined
												}
												onClick={() => goTo(number)}
											>
												{number}
											</button>
										)
									)}
									<button
										type='button'
										className={pagerButton}
										disabled={disabled || pageNumber >= pages}
										aria-label='Наступна сторінка'
										onClick={() => goTo(pageNumber + 1)}
									>
										→
									</button>
								</nav>
							)}
						</>
					)}
					<p className='text-xs text-gray-500'>
						Поля беруться з налаштувань категорії. У чернетці категорії товари
						зберігаються як чернетки; в опублікованій зміни одразу видно на сайті.
					</p>
				</div>
				<div className='min-w-0 space-y-4'>
					{/* Without a product's header (created elsewhere, deleted, moved) the outcome sits here. */}
					{message && !(selected && product.data && !creating) && (
						<p role='status' className='rounded-lg bg-blue-50 p-3 text-sm'>
							{message}
						</p>
					)}
					{creating ? (
						<ProductCreatePanel
							categoryId={categoryId}
							revision={revision}
							disabled={disabled}
							onSubmit={onSubmit}
						/>
					) : !selected ? (
						<div className={`${ui.card} py-10 text-center`}>
							<p className={ui.hint}>
								Оберіть товар у списку ліворуч або створіть новий.
							</p>
						</div>
					) : (
						<>
							{product.isLoading && (
								<p className={ui.hint}>Завантаження характеристик…</p>
							)}
							{product.error && (
								<p role='alert' className='text-sm text-red-700'>
									{categoryError(product.error).message}
								</p>
							)}
							{product.data && !product.isError && (
								<>
									<ProductHeader
										product={product.data}
										unsaved={save.unsaved.map(section => section.label)}
										message={message}
										disabled={blocked}
										onSave={() => {
											const command = save.prepare()
											if (command) onSubmit(command, save.saved)
										}}
										onDiscard={() => {
											save.discard()
											setDiscards(count => count + 1)
										}}
									/>
									<ProductReadiness product={product.data} />
									<ProductForm
										key={`${selected}:${revision}`}
										product={product.data}
										vendors={vendors.data}
										disabled={blocked}
										onSubmit={onSubmit}
									/>
									<ProductVariantsEditor
										key={`variants:${selected}:${revision}`}
										product={product.data}
										disabled={blocked}
										message={message}
										onSubmit={onSubmit}
									/>
									<ProductPromotionEditor
										key={`promotion:${selected}:${revision}`}
										product={product.data}
										disabled={blocked}
									/>
									<ProductPurchaseNoticeEditor
										key={`notice:${selected}:${revision}`}
										product={product.data}
										disabled={blocked}
									/>
									<ProductDescriptionEditor
										key={`description:${selected}:${revision}:${discards}`}
										product={product.data}
										disabled={disabled}
									/>
									<ProductTransferPanel
										key={`transfer:${selected}:${revision}`}
										productId={selected}
										targets={transferTargets}
										revision={revision}
										disabled={blocked}
										onSubmit={onSubmit}
									/>
								</>
							)}
						</>
					)}
				</div>
			</div>
		</ProductsFrame>
	)
}
/**
 * The selected product's header: its name, variants and where the change lands, with its page —
 * and, while something is unsaved, which blocks, with «Скасувати» and «Зберегти» (owner,
 * 2026-11-09: one save for the whole product). It stays on screen while the page scrolls.
 */
function ProductHeader({
	product,
	unsaved,
	message,
	disabled,
	onSave,
	onDiscard
}: {
	product: TypedProduct
	unsaved: string[]
	message: string
	disabled: boolean
	onSave: () => void
	onDiscard: () => void
}) {
	const live = product.variants.find(row => row.status === 'active') ?? null
	return (
		<header aria-label='Товар' className={`${ui.card} sticky top-14 z-20 md:top-0`}>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div className='min-w-0 space-y-1'>
					<p className={ui.sectionTitle}>Товар</p>
					<h3 className='text-lg font-semibold break-words text-gray-900'>
						{product.name}
					</h3>
					<p className={ui.hint}>
						{variantCount(product.variants.length)} ·{' '}
						{product.published
							? 'категорія опублікована — збережені зміни одразу на сайті'
							: 'категорія в чернетці — на сайті не видно'}
					</p>
				</div>
				{product.published && live && (
					<a
						className={button}
						href={`/products/${live.slug}`}
						target='_blank'
						rel='noreferrer'
					>
						Відкрити на сайті ↗
					</a>
				)}
			</div>
			{unsaved.length > 0 && (
				<div className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-2 text-sm'>
					<p>Не збережено: {unsaved.join(' · ')}</p>
					<div className='flex gap-2'>
						<button type='button' className={button} onClick={onDiscard}>
							Скасувати
						</button>
						<button
							type='button'
							className={ui.primary}
							disabled={disabled}
							onClick={onSave}
						>
							Зберегти
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
	)
}
function ProductCreatePanel({
	categoryId,
	revision,
	disabled,
	onSubmit
}: {
	categoryId: string
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const config = useQuery({
		queryKey: ['typed-product-create-config', categoryId, revision],
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const result = await categoryTreeApi.configuration(categoryId)
			if (
				result.category_id !== categoryId ||
				result.revision !== revision ||
				result.kind !== 'product' ||
				(result.status !== 'draft' && result.status !== 'active')
			)
				throw Error('Категорія змінилася. Оновіть дерево.')
			return result
		}
	})
	const vendors = useQuery({
		queryKey: ['typed-product-create-vendors'],
		queryFn: vendorsApi.getAll,
		retry: false,
		refetchOnWindowFocus: false
	})
	if (config.isLoading || vendors.isLoading) return <p className={ui.hint}>Завантаження форми…</p>
	if (config.error || vendors.error)
		return (
			<p role='alert' className='text-sm text-red-700'>
				{categoryError(config.error || vendors.error).message}
			</p>
		)
	if (!config.data || !vendors.data) return null
	if (!vendors.data.length)
		return (
			<div className={ui.card}>
				<p>Спочатку додайте постачальника в розділі «Постачальники».</p>
			</div>
		)
	const product: TypedProduct = {
		product_id: '000000000000000000000000',
		category_id: categoryId,
		revision,
		published: config.data.status === 'active',
		name: '',
		definitions: config.data.definitions,
		attributes_v2: [],
		variant_axis: null,
		variants: [
			{ id: '000000000000000000000000', name: '', slug: '', sku: '', variant_value: null }
		]
	}
	return (
		<ProductForm
			product={product}
			creation={{ vendors: vendors.data }}
			disabled={disabled || config.isFetching || vendors.isFetching}
			onSubmit={onSubmit}
		/>
	)
}

/**
 * The characteristics grouped by what they do for the shopper (owner, 2026-11-03: «недостатньо
 * читабельні поля»): a catalogue filter, a line in the product page's specifications, or
 * neither. The category's own settings decide it — the same flags the storefront reads.
 */
export function characteristicGroups(definitions: TypedDefinition[]) {
	return [
		{
			key: 'filters',
			title: 'Фільтри на сайті',
			hint: 'Покупець відбирає за ними товари в каталозі.',
			items: definitions.filter(def => def.filter_enabled)
		},
		{
			key: 'specs',
			title: 'Лише на сторінці товару',
			hint: 'Показуються в характеристиках товару; у фільтрах каталогу їх немає.',
			items: definitions.filter(def => !def.filter_enabled && def.visible_in_specs)
		},
		{
			key: 'hidden',
			title: 'Не показуються покупцю',
			hint: 'Немає ні у фільтрах, ні на сторінці товару.',
			items: definitions.filter(def => !def.filter_enabled && !def.visible_in_specs)
		}
	].filter(group => group.items.length > 0)
}
/** One block of the product form: a heading that says what its fields are for, a separator. */
function FormSection({
	title,
	hint,
	count,
	children
}: {
	title: string
	hint: string
	count?: number
	children: ReactNode
}) {
	const id = useId()
	return (
		<section
			aria-labelledby={id}
			className='@container min-w-0 space-y-3 border-t border-gray-200 pt-5 first-of-type:border-t-0 first-of-type:pt-0'
		>
			<div>
				<h4 id={id} className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
					{title}
					{count !== undefined && (
						<span className={`${ui.badge} bg-gray-100 text-gray-600`}>{count}</span>
					)}
				</h4>
				<p className='mt-0.5 text-xs text-gray-500'>{hint}</p>
			</div>
			{children}
		</section>
	)
}
export function ProductForm({
	product,
	disabled,
	onSubmit,
	creation,
	vendors
}: {
	product: TypedProduct
	creation?: { vendors: { _id: string; name: string }[] }
	/** Editing: the suppliers to choose from (absent → the supplier is not shown). */
	vendors?: { _id: string; name: string }[]
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const [rows, setRows] = useState(product.variants)
	// Editing: the supplier can change, as in the old product form (creation brings its own list).
	const vendorChoices = creation?.vendors ?? vendors
	// A new product is a draft, in a published category too; «Активний» is accepted only for a
	// complete product (owner, 2026-11-15) — the form lists the gaps, the server refuses the same.
	const [createStatus, setCreateStatus] = useState<'active' | 'draft'>('draft')
	const [gaps, setGaps] = useState<string[]>([])
	type Commerce = {
		price: string
		stock: string
		weight: string
		vendor_product_sku: string
		prom_id: string
	}
	const blankCommerce: Commerce = {
		price: '',
		stock: '0',
		weight: '',
		vendor_product_sku: '',
		prom_id: ''
	}
	// Creating («усе одразу», owner 2026-11-15): the blocks of the edit screen, in the form's state.
	const [description, setDescription] = useState<DescriptionValue | null>(null)
	const descriptionRef = useRef<DescriptionValue | null>(null)
	const [notice, setNotice] = useState<NoticeDraft>({ title: '', text: '', badge: '' })
	const [commerce, setCommerce] = useState(new Map<string, Commerce>())
	// Creating: each SKU's photos, picked here and uploaded when the form is submitted (owner,
	// 2026-11-15). The product has no id yet, so they go into a folder this form names itself — a
	// SKU stores full addresses, nothing reads the folder as a product id.
	const [photos, setPhotos] = useState(new Map<string, ImageUploadItem[]>())
	const [uploading, setUploading] = useState(false)
	const folder = useRef('')
	// A required colour is every product's variation (owner, 2026-11-06): a colour is chosen per
	// SKU from the dictionary, never typed into the product.
	const colourAxis = product.definitions.find(
		def => def.semantic === 'color' && def.is_required
	)?.key
	// Editing: the page's draft, saved by the header's «Зберегти» with the other blocks (owner,
	// 2026-11-09). Creating: the form's own state and its own «Створити чернетку товару».
	const base = characteristicsBase(product)
	const [local, setLocal] = useState(base)
	const [stored, setStored] = useCategoryDraft<CharacteristicsDraft>(
		productScope(product.product_id),
		'characteristics',
		base
	)
	const issue = useDraftIssue(productScope(product.product_id), 'characteristics')
	const draft = creation ? local : stored
	const setDraft = creation ? setLocal : setStored
	const [error, setError] = useState('')
	const { name, vendor, axis, variants } = draft
	const attributes = new Map(Object.entries(draft.attributes))
	const setName = (value: string) => setDraft(current => ({ ...current, name: value }))
	const setVendor = (value: string) => setDraft(current => ({ ...current, vendor: value }))
	const setAxis = (value: string) => setDraft(current => ({ ...current, axis: value }))
	const setAttributes = (change: (previous: Map<string, string[]>) => Map<string, string[]>) =>
		setDraft(current => ({
			...current,
			attributes: Object.fromEntries(change(new Map(Object.entries(current.attributes))))
		}))
	type AxisValues = CharacteristicsDraft['variants']
	const setVariants = (change: AxisValues | ((previous: AxisValues) => AxisValues)) =>
		setDraft(current => ({
			...current,
			variants: typeof change === 'function' ? change(current.variants) : change
		}))
	const definitions = [...product.definitions].sort((a, b) => a.order - b.order)
	const axisDefinition = definitions.find(def => def.key === axis)
	/** Each SKU's photos as public addresses, in the order shown; a file goes up once. */
	async function uploadPhotos(picked: ImageUploadItem[][]) {
		folder.current ||= crypto.randomUUID().replaceAll('-', '').slice(0, 24)
		const images: string[][] = []
		for (const [index, list] of picked.entries()) {
			const urls: string[] = []
			for (const image of list) {
				if (image.status === 'uploaded' && image.publicUrl) {
					urls.push(image.publicUrl)
					continue
				}
				if (!image.file) throw Error('Не вдалося прочитати фото. Додайте його повторно.')
				const [publicUrl] = await productsApi.uploadImages(folder.current, [image.file])
				if (!publicUrl) throw Error('Завантаження не повернуло адресу фото.')
				// Kept as uploaded: a submit repeated after a refusal sends the address, not the file.
				const id = rows[index].id
				setPhotos(previous =>
					new Map(previous).set(
						id,
						(previous.get(id) ?? []).map(item =>
							item.id === image.id
								? { ...item, status: 'uploaded' as const, publicUrl }
								: item
						)
					)
				)
				urls.push(publicUrl)
			}
			images.push(urls)
		}
		return images
	}
	function submit(event: FormEvent) {
		event.preventDefault()
		if (disabled || !creation || uploading) return
		setError('')
		setGaps([])
		const picked = rows.map(row => photos.get(row.id) ?? [])
		let command: (images: string[][]) => CategoryCommand
		try {
			// A new product stores nothing yet: every SKU's value is the form's.
			const { attributes_v2, values } = characteristicsValues(
				{ ...product, variant_axis: null },
				draft,
				rows
			)
			const variants = values.map((row, index) => {
				const fields = commerce.get(row.id) ?? blankCommerce
				if (!fields.price.trim() || !fields.stock.trim())
					throw Error(`Вкажіть ціну й залишок варіанта ${index + 1}.`)
				return {
					variant_value: row.variant_value,
					price: Number(fields.price),
					stock: Number(fields.stock),
					// Blank is unknown: the parcel's weight is a warning, never a requirement.
					...(fields.weight.trim() ? { weight_g: Number(fields.weight) } : {}),
					vendor_product_sku: supplierIdInput(fields.vendor_product_sku),
					prom_id: supplierIdInput(fields.prom_id),
					...(product.published ? { status: createStatus } : {})
				}
			})
			if (picked.some(list => list.length > 30))
				throw Error('Для одного варіанта дозволено до 30 фото.')
			const purchase_notice = purchaseNoticeInput(notice)
			const missing =
				createStatus === 'active'
					? [
							...newProductGaps({
								definitions,
								attributes: attributes_v2,
								axisKey: axis || undefined,
								description: description?.html ?? ''
							}),
							...variants.flatMap((row, index) =>
								skuGaps(`варіант ${index + 1}`, {
									price: row.price,
									photos: picked[index].length
								})
							)
						]
					: []
			// Nothing clever: the gaps are named, and the admin fills them or keeps the draft.
			if (missing.length) return setGaps(missing)
			command = images => ({
				type: 'product-create',
				body: typedProductCreateBodySchema.parse({
					expected_revision: product.revision,
					category_id: product.category_id,
					vendor_id: vendor,
					name,
					attributes_v2,
					variant_axis: axis ? { key: axis } : null,
					// What was left empty is not sent: no description, no notice.
					...(description &&
					!newProductGaps({ ...noGaps, description: description.html }).length
						? { description: { ...description, json: { ...description.json } } }
						: {}),
					...(purchase_notice ? { purchase_notice } : {}),
					// A SKU without photos carries no `images`, as before.
					variants: variants.map((row, index) =>
						images[index].length ? { ...row, images: images[index] } : row
					)
				})
			})
			// The fields are checked before anything is uploaded.
			command(picked.map(() => []))
		} catch (error) {
			return setError(problemText(error, 'Перевірте поля товару.'))
		}
		const uploaded = (item: ImageUploadItem) => item.status === 'uploaded' && !!item.publicUrl
		// Nothing to upload — no photos, or all of them went up on an earlier attempt: sent at once.
		if (picked.every(list => list.every(uploaded)))
			return onSubmit(command(picked.map(list => list.map(item => item.publicUrl!))))
		setUploading(true)
		void uploadPhotos(picked)
			.then(images => onSubmit(command(images)))
			.catch(error => setError(problemText(error, 'Не вдалося завантажити фото.')))
			.finally(() => setUploading(false))
	}
	// Asked about the description alone: is there any text in it.
	const noGaps = { definitions: [], attributes: [], axisKey: undefined }
	const commerceInput =
		(variant: { id: string }, field: keyof Commerce) =>
		(event: { target: { value: string } }) =>
			setCommerce(previous => {
				const next = new Map(previous)
				next.set(variant.id, {
					...(next.get(variant.id) ?? blankCommerce),
					[field]: event.target.value
				})
				return next
			})
	const characteristics = definitions.filter(def => def.key !== axis && def.semantic !== 'color')
	// Editing: each SKU's value is edited in its variant window; the values show here only when
	// the axis itself changes — then every SKU needs a value in the new axis, in this one save.
	const axisChanged = !creation && axis !== (product.variant_axis?.key ?? '')
	const field = (def: TypedDefinition) => {
		const values = attributes.get(def.key) ?? []
		const shown = values.length ? values : ['']
		return (
			<div key={def.key} className='min-w-0'>
				<div className='flex flex-wrap items-center gap-2'>
					<span className='text-sm font-medium text-gray-700'>
						{def.label}
						{def.unit ? ` (${def.unit})` : ''}
					</span>
					{def.is_required && (
						<abbr className='text-red-600 no-underline' title='Потрібно для публікації'>
							*<span className='sr-only'> (обов’язкове)</span>
						</abbr>
					)}
				</div>
				{shown.map((value, index) => (
					<div key={index} className='flex items-end gap-2'>
						<ValueInput
							definition={def}
							label={`${def.label} ${index + 1}`}
							hideLabel
							value={value}
							onChange={text =>
								setAttributes(previous => {
									const next = new Map(previous),
										items = [...shown]
									items[index] = text
									next.set(def.key, items)
									return next
								})
							}
						/>
						{def.multiple && shown.length > 1 && (
							<button
								type='button'
								className={`${button} mb-px`}
								aria-label={`Прибрати ${def.label} ${index + 1}`}
								onClick={() =>
									setAttributes(previous => {
										const next = new Map(previous)
										next.set(
											def.key,
											shown.filter((_, i) => i !== index)
										)
										return next
									})
								}
							>
								×
							</button>
						)}
					</div>
				))}
				{def.multiple && (
					<button
						type='button'
						className='mt-1 text-sm text-blue-700 hover:underline'
						onClick={() =>
							setAttributes(previous => {
								const next = new Map(previous)
								next.set(def.key, [...shown, ''])
								return next
							})
						}
					>
						<span aria-hidden>+ </span>Додати значення
					</button>
				)}
			</div>
		)
	}
	// A requirement of an active SKU, marked without changing the field's name: the star is drawn,
	// not written, so «Ціна, грн · варіант 1» stays the label the tests and screen readers find.
	const star = "after:ml-0.5 after:text-red-600 after:content-['*']"
	const legend = (
		<p className='text-xs text-gray-500'>
			<span className='text-red-600'>*</span> — потрібно для публікації
		</p>
	)
	const basics = (
		<FormSection
			title='Основне'
			hint='Назва на сайті, постачальник і ознака, якою відрізняються варіанти.'
		>
			<label className={ui.label}>
				Назва товару
				<input
					className={ui.input}
					value={name}
					maxLength={200}
					required
					onChange={event => setName(event.target.value)}
				/>
			</label>
			<div className='grid min-w-0 gap-4 @lg:grid-cols-2'>
				{vendorChoices && (
					<label className={ui.label}>
						Постачальник
						<select
							className={ui.input}
							value={vendor}
							required={!!creation}
							onChange={event => setVendor(event.target.value)}
						>
							<option value=''>Оберіть постачальника</option>
							{vendorChoices.map(item => (
								<option key={item._id} value={item._id}>
									{item.name}
								</option>
							))}
						</select>
					</label>
				)}
				<div className='min-w-0'>
					<label className={ui.label}>
						Вісь варіантів
						<select
							className={ui.input}
							value={axis}
							onChange={event => {
								setAxis(event.target.value)
								setVariants(Object.fromEntries(rows.map(row => [row.id, ''])))
							}}
						>
							<option value='' disabled={rows.length !== 1 || !!colourAxis}>
								Без варіантної ознаки
							</option>
							{definitions
								// Only what a variation may be built on; the product's own axis stays listed, so
								// a stored one that no longer qualifies is shown and refused on save, not hidden.
								.filter(def =>
									colourAxis
										? def.key === colourAxis
										: isAxisCandidate(def) ||
											def.key === product.variant_axis?.key
								)
								.map(def => (
									<option key={def.key} value={def.key}>
										{def.label}
									</option>
								))}
						</select>
					</label>
					<p className='mt-1 text-xs text-gray-500'>
						Варіація — обов’язкова характеристика: список, число, так/ні або колір. Її
						значення додається до назви кожного варіанта; адреси, артикули, ціни й
						залишки зберігаються.
					</p>
				</div>
			</div>
		</FormSection>
	)
	const groups = characteristicGroups(characteristics).length > 0 && (
		<>
			{characteristicGroups(characteristics).map(group => (
				<FormSection
					key={group.key}
					title={group.title}
					hint={group.hint}
					count={group.items.length}
				>
					{/* Columns follow the card's own width (a container query), not the window's. */}
					<div className='grid min-w-0 gap-x-4 gap-y-5 @lg:grid-cols-2 @3xl:grid-cols-3'>
						{group.items.map(field)}
					</div>
				</FormSection>
			))}
		</>
	)
	const rowList = (
		<ul className='divide-y rounded-md border border-gray-200'>
			{rows.map((variant, index) => (
				<li key={variant.id} className='min-w-0 space-y-3 p-3'>
					<div className='grid min-w-0 gap-2 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center'>
						<div className='min-w-0'>
							<p className='font-mono text-sm font-medium text-gray-900'>
								{creation ? `Варіант ${index + 1}` : variant.sku}
							</p>
							{!creation && (
								<p className='truncate text-xs text-gray-500'>
									/products/{variant.slug}
								</p>
							)}
						</div>
						{axisDefinition ? (
							<ValueInput
								definition={axisDefinition}
								// What to type, as the price and stock fields say it:
								// «Номінальний струм, А · варіант 1».
								label={`${axisDefinition.label}${axisDefinition.unit ? `, ${axisDefinition.unit}` : ''} · ${creation ? `варіант ${index + 1}` : variant.sku}`}
								value={variants[variant.id] ?? ''}
								onChange={value =>
									setVariants(previous => ({
										...previous,
										[variant.id]: value
									}))
								}
							/>
						) : (
							<p className='text-sm text-gray-700'>{name}</p>
						)}
					</div>
					{creation && (
						<>
							<div className='grid min-w-0 gap-3 sm:grid-cols-3'>
								{(['price', 'stock'] as const).map(field => (
									<label key={field} className={ui.label}>
										<span className={field === 'price' ? star : undefined}>
											{field === 'price' ? 'Ціна, грн' : 'Залишок'} · варіант{' '}
											{index + 1}
										</span>
										<input
											className={ui.input}
											type='number'
											required
											min='0'
											max={
												field === 'price'
													? 1000000000
													: Number.MAX_SAFE_INTEGER
											}
											step={field === 'price' ? 'any' : '1'}
											placeholder={field === 'price' ? '0.00' : '0'}
											value={
												commerce.get(variant.id)?.[field] ??
												(field === 'stock' ? '0' : '')
											}
											onChange={commerceInput(variant, field)}
										/>
									</label>
								))}
								<div className='min-w-0 space-y-1'>
									<label className={ui.label}>
										Вага для пошти, г · варіант {index + 1}
										<input
											className={ui.input}
											type='number'
											min='1'
											step='1'
											placeholder='напр. 1220'
											value={commerce.get(variant.id)?.weight ?? ''}
											onChange={commerceInput(variant, 'weight')}
										/>
									</label>
									<p className={ui.hint}>Посилка з упаковкою</p>
								</div>
							</div>
							<div className='grid min-w-0 gap-3 sm:grid-cols-2'>
								{(['vendor_product_sku', 'prom_id'] as const).map(field => (
									<label key={field} className={ui.label}>
										{field === 'prom_id' ? 'ID на Промі' : 'Артикул вендора'}{' '}
										(необов’язково) · варіант {index + 1}
										<input
											className={ui.input}
											maxLength={100}
											value={commerce.get(variant.id)?.[field] ?? ''}
											onChange={commerceInput(variant, field)}
										/>
									</label>
								))}
							</div>
						</>
					)}
					{creation && (
						<div className='min-w-0 space-y-2'>
							<p className='text-sm font-medium text-gray-700'>
								<span className={star}>Фото · варіант {index + 1}</span>{' '}
								<span className='font-normal text-gray-500'>
									(перше — головне, порядок — перетягуванням)
								</span>
							</p>
							<ImageDropzone
								images={photos.get(variant.id) ?? []}
								onChange={images =>
									setPhotos(previous => new Map(previous).set(variant.id, images))
								}
							/>
						</div>
					)}
					{creation && rows.length > 1 && (
						<button
							type='button'
							className={button}
							aria-label={`Прибрати варіант ${index + 1}`}
							onClick={() => {
								setRows(previous => previous.filter(row => row.id !== variant.id))
								setVariants(previous =>
									Object.fromEntries(
										Object.entries(previous).filter(([id]) => id !== variant.id)
									)
								)
								setCommerce(previous => {
									const next = new Map(previous)
									next.delete(variant.id)
									return next
								})
								setPhotos(previous => {
									const next = new Map(previous)
									next.delete(variant.id)
									return next
								})
							}}
						>
							Прибрати варіант
						</button>
					)}
				</li>
			))}
		</ul>
	)
	// Creating: the edit screen's blocks in its order, each a card of its own — «Основне», the
	// description, the characteristics, the SKUs with everything a SKU has, the purchase notice,
	// then the status and the buttons (owner, 2026-11-15: «усе одразу»).
	if (creation)
		return (
			<form className='min-w-0 space-y-4' onSubmit={submit} aria-label='Новий товар'>
				<fieldset disabled={disabled || uploading} className='min-w-0 space-y-4'>
					<div className={ui.card}>
						<div className='flex flex-wrap items-baseline justify-between gap-2'>
							<h3 className={ui.cardTitle}>Новий товар</h3>
							{legend}
						</div>
						{basics}
					</div>
					{/* The edit screen's own editor and card; its heading takes the star here. */}
					<section
						aria-label='Опис товару'
						className="min-w-0 [&_h2]:after:ml-0.5 [&_h2]:after:text-red-600 [&_h2]:after:content-['*']"
					>
						<div
							className={
								disabled || uploading ? 'pointer-events-none opacity-60' : ''
							}
							inert={disabled || uploading}
						>
							<DescriptionBlock
								descriptionRef={descriptionRef}
								onChange={setDescription}
							/>
						</div>
					</section>
					{groups && (
						<div className={ui.card}>
							<h3 className={ui.cardTitle}>Характеристики товару</h3>
							{groups}
						</div>
					)}
					<div className={ui.card}>
						<div>
							<h3 className={ui.cardTitle}>
								Варіанти{axisDefinition ? ` · ${axisDefinition.label}` : ''}
							</h3>
							{/* Once for all rows, never beside a field: next to the value input it
							    read as «type the URL here» (owner, 2026-11-05). */}
							<p className={ui.hint}>
								Артикул і адресу сторінки кожного варіанта буде створено після
								збереження.
							</p>
						</div>
						{rowList}
					</div>
					<PurchaseNoticeFields
						notice={notice}
						onChange={setNotice}
						disabled={false}
						optional
					/>
					<div className={ui.card}>
						<div className='flex flex-wrap items-end justify-end gap-2'>
							{product.published && (
								<label className={`${ui.label} mr-auto`}>
									Статус
									<select
										className={ui.input}
										value={createStatus}
										onChange={event => {
											setCreateStatus(
												event.target.value as 'active' | 'draft'
											)
											setGaps([])
										}}
									>
										<option value='draft'>Чернетка</option>
										<option value='active'>Активний — одразу на сайті</option>
									</select>
								</label>
							)}
							<button
								type='button'
								className={button}
								disabled={!axis || rows.length >= 100}
								onClick={() => {
									setRows(previous => [
										...previous,
										{
											id: crypto
												.randomUUID()
												.replaceAll('-', '')
												.slice(0, 24),
											name: '',
											sku: '',
											slug: '',
											variant_value: null
										}
									])
								}}
							>
								Додати варіант
							</button>
							<button type='submit' className={ui.primary}>
								{/* What it creates: an active product is on the site at once. */}
								{uploading
									? 'Завантаження фото…'
									: createStatus === 'active'
										? 'Створити товар'
										: 'Створити чернетку товару'}
							</button>
						</div>
					</div>
				</fieldset>
				<ActivationGaps gaps={gaps} />
				{error && (
					<p role='alert' className='rounded-md bg-red-50 p-3 text-sm text-red-800'>
						{error}
					</p>
				)}
			</form>
		)
	return (
		<form className={ui.card} onSubmit={submit} aria-label='Характеристики товару'>
			<fieldset disabled={disabled} className='min-w-0 space-y-5'>
				<div className='flex flex-wrap items-baseline justify-between gap-2'>
					<h3 className={ui.cardTitle}>Характеристики товару</h3>
					{characteristics.some(def => def.is_required) && legend}
				</div>
				{basics}
				{groups}
				{axisChanged && (
					<div className='space-y-3 border-t border-gray-200 pt-5'>
						<h4 className='text-sm font-semibold text-gray-900'>
							Варіанти{axisDefinition ? ` · ${axisDefinition.label}` : ''}
						</h4>
						<p className='rounded-md bg-amber-50 p-3 text-sm text-amber-900'>
							Вісь змінено: задайте значення кожного варіанта в новій осі — вони
							збережуться разом з характеристиками.
						</p>
						{rowList}
					</div>
				)}
				<div className='flex flex-wrap items-center justify-end gap-2 border-t pt-4' />
			</fieldset>
			{issue && (
				<p role='alert' className='rounded-md bg-red-50 p-3 text-sm text-red-800'>
					{issue.message}
				</p>
			)}
		</form>
	)
}
