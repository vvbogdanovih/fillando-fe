'use client'

import { TypedProductEditor } from './TypedProductEditor'
import { CategoryDefinitionsEditor } from './CategoryDefinitionsEditor'
import { CategoryConversionPanel } from './CategoryConversionPanel'
import { TypedLandingsEditor } from './TypedLandingsEditor'
import { CategorySeoEditor } from './CategorySeoEditor'
import { CategoryExportEditor } from './CategoryExportEditor'
import { SlugChange } from './SlugChange'
import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { UI_URLS } from '@/common/constants/ui-routes.constants'
import { ui } from './admin-ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
	categoryTreeApi,
	pendingCategoryCommandSchema,
	type CategoryCommand,
	type PendingCategoryCommand,
	type PublicationReceipt,
	type TreeItem
} from '../category-tree.api'
import { allowedParents, categoryError, treeRows } from '../category-tree.utils'
import { PriceListButton } from '../../products/PriceListButton'
import { categoriesApi } from '../categories.api'
import {
	CategoryDraftsProvider,
	useCategoryDraft,
	useCategorySave,
	useDraftIssue,
	type DetailsDraft,
	type MoveDraft
} from './category-drafts'

const storageKey = 'fillando-category-pending-operation-v1'
const button =
	'rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
const statusLabels = { draft: 'Чернетка', active: 'Активна', archived: 'Архівна' }
/**
 * «Nothing to change» is no failure of a save: the server already holds exactly what the block
 * sends (a trailing space, an emptied editor, an answer that was lost). It wrote nothing, so the
 * revision stays.
 */
const UNCHANGED = ['CATEGORY_DETAILS_UNCHANGED', 'SEO_UNCHANGED', 'EXPORT_UNCHANGED']

type WorkspaceProps = {
	productsOnly?: boolean
	initialCategoryId?: string
	initialProductId?: string
}

/** The category page's unsaved edits live above it (`category-drafts.tsx`, owner 2026-11-09). */
export function CategoryTreeWorkspace(props: WorkspaceProps = {}) {
	return (
		<CategoryDraftsProvider>
			<Workspace {...props} />
		</CategoryDraftsProvider>
	)
}

function Workspace({ productsOnly = false, initialCategoryId, initialProductId }: WorkspaceProps) {
	const client = useQueryClient()
	const [selected, setSelected] = useState<string | null>(initialCategoryId ?? null)
	// The product a save just touched: the editor remounts on the new revision, and without this
	// it would fall back to the bare list after every change.
	const [productFocus, setProductFocus] = useState<{ category: string; product: string } | null>(
		null
	)
	const [creating, setCreating] = useState(false)
	// The products view: the categories are a filter folded over the list (owner, 2026-11-03).
	const [categoriesOpen, setCategoriesOpen] = useState(false)
	const [collapsed, setCollapsed] = useState(new Set<string>())
	const [pending, setPending] = useState<PendingCategoryCommand | null>(null)
	const [restored, setRestored] = useState(false)
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState('')
	const tree = useQuery({
		queryKey: ['category-tree'],
		queryFn: categoryTreeApi.tree,
		refetchOnWindowFocus: false,
		retry: false
	})
	const capabilities = useQuery({
		queryKey: ['category-tree-capabilities'],
		queryFn: categoryTreeApi.capabilities,
		retry: false
	})
	// The products view opens on the first editable product category: with one (the filament
	// today) there is nothing to choose before the product list.
	useEffect(() => {
		if (!productsOnly || selected || !tree.data) return
		const first = tree.data.items.find(
			item =>
				item.kind === 'product' &&
				item.attribute_contract_version === 2 &&
				item.status !== 'archived'
		)
		if (first) setSelected(first._id)
	}, [productsOnly, selected, tree.data])
	useEffect(() => {
		try {
			const saved = sessionStorage.getItem(storageKey)
			if (saved) {
				const value = pendingCategoryCommandSchema.parse(JSON.parse(saved))
				setPending(value)
				setMessage('Є запит без підтвердженого результату. Спочатку перевірте його стан.')
			}
			setRestored(true)
		} catch {
			setMessage(
				'Не вдалося прочитати збережену операцію. Збереження заблоковане, щоб не повторити зміну.'
			)
		}
	}, [])
	const refresh = () =>
		Promise.all([
			client.invalidateQueries({ queryKey: ['category-tree'] }),
			client.invalidateQueries({ queryKey: ['category-tree-capabilities'] })
		])
	const clearPending = () => {
		sessionStorage.removeItem(storageKey)
		setPending(null)
	}
	/**
	 * One command, its key and body persisted before the request: a reload or a timeout retains
	 * them. `null` — not sent at all; a known pre-write refusal may start a new command after a
	 * refresh, an unknown outcome keeps the key.
	 */
	async function send(
		operation: PendingCategoryCommand
	): Promise<
		{ receipt: { revision: number } } | { failure: ReturnType<typeof categoryError> } | null
	> {
		try {
			sessionStorage.setItem(storageKey, JSON.stringify(operation))
			setPending(operation)
		} catch {
			setMessage('Браузер не дозволив зберегти ключ операції. Запит не надіслано.')
			return null
		}
		try {
			const receipt = await categoryTreeApi.execute(operation)
			clearPending()
			return { receipt: receipt as { revision: number } }
		} catch (error) {
			const failure = categoryError(error)
			if (
				[400, 404, 409].includes(failure.status ?? 0) &&
				failure.code !== 'OPERATION_ALREADY_REGISTERED'
			) {
				clearPending()
				return { failure }
			}
			// The key is kept: only now may the message point at the operation's status.
			return { failure: categoryError(error, true) }
		}
	}
	async function execute(operation: PendingCategoryCommand, onSuccess?: () => void) {
		setBusy(true)
		try {
			const result = await send(operation)
			if (!result) return
			if ('failure' in result) {
				const command = operation.command
				let message = result.failure.message
				if (result.failure.code === 'REQUIRED_VALUE' && command.type === 'product') {
					// Refused for the product as a whole, a price edit included: the product on
					// screen knows which required characteristic the sent body lacks, by its name.
					const missing = client
						.getQueryData<{
							definitions: { key: string; label: string; is_required: boolean }[]
						}>(['typed-product', command.id, command.body.expected_revision])
						?.definitions.find(
							definition =>
								definition.is_required &&
								definition.key !== command.body.variant_axis?.key &&
								!command.body.attributes_v2.some(row => row.k === definition.key)
						)
					if (missing)
						message = `Не заповнено обов’язкову характеристику «${missing.label}» — заповніть її в характеристиках товару.`
				}
				setMessage(message)
				await refresh()
				// The product on screen may be older than the stored one without the catalogue having
				// moved: the Prom sync rewrites price and stock, and with them the details token
				// (PRODUCT_DETAILS_CHANGED). Read it again, so the next attempt is made from what is
				// stored now. After a revision change the editor has remounted on its own key.
				await client.invalidateQueries({ queryKey: ['typed-product'] })
				return
			}
			// Before the reload: the caller drops its drafts, so the new data shows at once.
			onSuccess?.()
			const receipt = result.receipt
			const field = (key: string) => {
				const value = (receipt as Record<string, unknown>)[key]
				return typeof value === 'string' ? value : undefined
			}
			const categoryId = field('category_id')
			const productId = field('product_id')
			// A transfer answers with the target category: follow the product there.
			const focusCategory = categoryId && productId ? categoryId : selected
			// A removed product has no page to come back to: the list opens instead.
			if (operation.command.type === 'product-delete') setProductFocus(null)
			else if (productId && focusCategory)
				setProductFocus({ category: focusCategory, product: productId })
			if (operation.command.type === 'delete') setSelected(null)
			else if (categoryId) setSelected(categoryId)
			setCreating(false)
			setMessage(
				'action' in receipt
					? publicationMessage(receipt as PublicationReceipt)
					: operation.command.type === 'slug'
						? 'Адресу змінено; стара адреса перенаправляє на нову.'
						: operation.command.type === 'export'
							? 'Категорію Google збережено; фід оновиться протягом кількох хвилин.'
							: operation.command.type === 'seo'
								? items.find(item => item._id === selected)?.status === 'active'
									? 'SEO збережено й уже діє на сайті.'
									: 'SEO збережено. Категорія ще не опублікована.'
								: operation.command.type === 'landing-delete'
									? 'Чернетку посадкової сторінки видалено.'
									: operation.command.type === 'landing-create' ||
										  operation.command.type === 'landing-update'
										? operation.command.body.status === 'active'
											? 'Посадкову сторінку збережено; вона вже на сайті.'
											: 'Посадкову сторінку збережено як чернетку.'
										: operation.command.type === 'delete'
											? 'Чернетку категорії видалено.'
											: operation.command.type === 'convert'
												? operation.command.body.plan_id
													? 'Категорію перетворено на групу: товари й сторінки перенесено, адреси збережено.'
													: operation.command.body.kind === 'group'
														? 'Категорію перетворено на групу.'
														: 'Категорію перетворено на товарну. Налаштуйте її характеристики.'
												: operation.command.type === 'product-delete'
													? 'Товар видалено разом з його варіантами.'
													: operation.command.type === 'transfer'
														? `Товар перенесено в «${items.find(item => item._id === focusCategory)?.name ?? 'іншу категорію'}».`
														: items.find(item => item._id === selected)
																	?.status === 'active'
															? 'Зміни збережено й уже діють на сайті.'
															: 'Зміни збережено. Чернетка ще не опублікована у магазині.'
			)
			await refresh()
		} finally {
			setBusy(false)
		}
	}
	/**
	 * The header's «Зберегти»: every unsaved block of the category, one command after another in
	 * page order, each with the revision the previous one answered. Nothing is sent while a block
	 * cannot be (its issue is shown in it, and the header names it — it may be folded); a refusal
	 * stops the rest and keeps their drafts. «Nothing to change» (`UNCHANGED`) is no refusal.
	 */
	async function saveAll() {
		if (!tree.data || !active) return
		const commands = save.prepare(tree.data.revision)
		if (!commands) return
		if (!Array.isArray(commands)) {
			setMessage(
				commands.refused
					.map(({ label, message }) => `«${label}» не збережено: ${message}`)
					.join(' ')
			)
			return
		}
		setBusy(true)
		let revision = tree.data.revision
		const done: string[] = []
		try {
			for (const { section, label, command } of commands) {
				const sent = {
					...command,
					body: { ...command.body, expected_revision: revision }
				} as CategoryCommand
				const result = await send({ key: crypto.randomUUID(), command: sent })
				if (!result) return
				if ('failure' in result && !UNCHANGED.includes(result.failure.code ?? '')) {
					save.refused(section, result.failure.message)
					setMessage(
						`${done.length ? `Збережено: ${done.join(', ')}. ` : ''}«${label}» не збережено: ${result.failure.message}`
					)
					return
				}
				save.saved(sent)
				done.push(label)
				if ('receipt' in result) revision = result.receipt.revision
			}
			setMessage(
				active.status === 'active'
					? 'Зміни збережено й уже діють на сайті.'
					: 'Зміни збережено. Чернетка ще не опублікована у магазині.'
			)
		} finally {
			await refresh()
			setBusy(false)
		}
	}
	async function checkStatus() {
		if (!pending) return
		setBusy(true)
		try {
			const operation = await categoryTreeApi.status(pending.key)
			if (operation.status === 'completed') {
				// The block this command saved is not unsaved any more: its draft would otherwise
				// be sent again, to be answered «nothing to change».
				save.saved(pending.command as CategoryCommand)
				clearPending()
				setCreating(false)
				setMessage('Операцію виконано. Дерево оновлено.')
			} else if (['rejected', 'aborted', 'rolled_back'].includes(operation.status)) {
				clearPending()
				setMessage(
					'Операція не застосована або скасована. Оновлене дерево можна редагувати.'
				)
			} else {
				setMessage(
					operation.status === 'recovery_required'
						? 'Потрібне технічне відновлення операції. Збережіть її ключ для діагностики.'
						: 'Операція ще не підтверджена. Перевірте стан пізніше; нова зміна заблокована.'
				)
			}
			await refresh()
		} catch (error) {
			setMessage(
				categoryError(error).status === 404
					? 'Сервер ще не має результату. Можна повторити той самий запит зі збереженим ключем.'
					: 'Не вдалося перевірити стан. Ключ операції збережено.'
			)
		} finally {
			setBusy(false)
		}
	}
	const items = tree.data?.items ?? []
	const active = items.find(item => item._id === selected)
	const save = useCategorySave(productsOnly ? null : (active?._id ?? null))
	const unsavedAnywhere = save.dirtyCategories.length > 0
	// Unsaved edits are kept per category while you move around the tree; leaving the page is
	// the one way to lose them, so the browser asks first.
	useEffect(() => {
		if (!unsavedAnywhere) return
		const warn = (event: BeforeUnloadEvent) => event.preventDefault()
		// A link inside the admin (the sidebar, «Товари цієї категорії →») leaves without
		// `beforeunload` — the router takes the click — so the question is asked before it does.
		const ask = (event: MouseEvent) => {
			const link = event.target instanceof Element ? event.target.closest('a[href]') : null
			if (
				!(link instanceof HTMLAnchorElement) ||
				link.target === '_blank' ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			)
				return
			const next = new URL(link.href, window.location.href)
			// Another site unloads the page (`beforeunload` asks); the same address leaves nothing.
			if (
				next.origin !== window.location.origin ||
				(next.pathname === window.location.pathname &&
					next.search === window.location.search)
			)
				return
			if (window.confirm('Є незбережені зміни. Перейти без збереження?')) return
			event.preventDefault()
			event.stopPropagation()
		}
		window.addEventListener('beforeunload', warn)
		document.addEventListener('click', ask, true)
		return () => {
			window.removeEventListener('beforeunload', warn)
			document.removeEventListener('click', ask, true)
		}
	}, [unsavedAnywhere])
	const writable =
		capabilities.data?.draft_writes_enabled === true &&
		!capabilities.isError &&
		!capabilities.isFetching &&
		!tree.isError &&
		!tree.isFetching &&
		restored &&
		!pending &&
		!busy
	const editable = active?.status === 'draft' && active.attribute_contract_version === 2
	// A published category's content (name, image, menu order, characteristics) is edited in
	// place: after the migration the old admin is closed and the filament is one of these.
	const contentEditable =
		active?.attribute_contract_version === 2 &&
		(active.status === 'draft' || active.status === 'active')
	let rows: ReturnType<typeof treeRows> = [],
		treeError = ''
	try {
		rows = treeRows(items, collapsed)
	} catch {
		treeError = 'Структуру дерева не вдалося перевірити. Оновіть сторінку.'
	}
	const submit = (command: CategoryCommand, onSuccess?: () => void) => {
		if (!writable || treeError) return
		// A deleted category has nothing to save its unsaved edits into, and a group holds neither
		// characteristics nor a Google category: those drafts go with the operation, or they would
		// stay «unsaved» with no block to show or save them.
		const drops =
			(command.type === 'delete' ||
				(command.type === 'convert' && command.body.kind === 'group')) &&
			command.id === active?._id
		void execute(
			{ key: crypto.randomUUID(), command },
			drops
				? () => {
						save.discard(
							command.type === 'delete' ? undefined : ['definitions', 'export']
						)
						onSuccess?.()
					}
				: onSuccess
		)
	}
	const treeList = (
		<>
			{tree.isLoading ? (
				<p className='p-4'>Завантаження дерева…</p>
			) : (
				!rows.length &&
				!tree.isError && <p className='p-4 text-gray-500'>Категорій поки немає.</p>
			)}
			<ul aria-label='Категорії'>
				{rows.map(({ item, depth, hasChildren }) => (
					<li
						key={item._id}
						className={`flex items-center gap-1 border-b p-2 ${selected === item._id ? 'bg-blue-50' : ''}`}
						style={{ paddingLeft: `${Math.min(depth, 8) * 16 + 8}px` }}
					>
						{hasChildren ? (
							<button
								className='w-7 shrink-0'
								aria-label={`${collapsed.has(item._id) ? 'Розгорнути' : 'Згорнути'} ${item.name}`}
								aria-expanded={!collapsed.has(item._id)}
								onClick={() =>
									setCollapsed(previous => {
										const next = new Set(previous)
										if (next.has(item._id)) next.delete(item._id)
										else next.add(item._id)
										return next
									})
								}
							>
								{collapsed.has(item._id) ? '▸' : '▾'}
							</button>
						) : (
							<span className='w-7 shrink-0' />
						)}
						<button
							className='min-w-0 flex-1 text-left'
							aria-pressed={selected === item._id}
							disabled={busy || !!pending}
							onClick={() => {
								setSelected(item._id)
								setCreating(false)
								setCategoriesOpen(false)
							}}
						>
							<span className='block font-medium'>{item.name}</span>
							<span className='text-xs text-gray-500'>
								{productsOnly
									? [
											item.kind === 'group' ? 'Група' : 'Категорія',
											item.status !== 'active' && statusLabels[item.status],
											item.kind === 'product' &&
												item.attribute_contract_version !== 2 &&
												'стара структура'
										]
											.filter(Boolean)
											.join(' · ')
									: `${item.kind === 'group' ? 'Група' : 'Товарна категорія'} · ${statusLabels[item.status]} · рівень ${depth + 1}`}
							</span>
							{save.dirtyCategories.includes(item._id) && (
								<span className='block text-xs font-medium text-amber-700'>
									Є незбережені зміни
								</span>
							)}
						</button>
					</li>
				))}
			</ul>
		</>
	)
	const treePanel = productsOnly ? (
		<div className='rounded-xl border bg-white'>
			<button
				type='button'
				className='flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm'
				aria-expanded={categoriesOpen}
				onClick={() => setCategoriesOpen(open => !open)}
			>
				<span>
					<span className='text-gray-500'>Категорія: </span>
					<span className='font-medium text-gray-900'>
						{active?.name ?? (tree.isLoading ? 'завантаження…' : 'не обрано')}
					</span>
				</span>
				<span aria-hidden className='text-gray-400'>
					{categoriesOpen ? '▴' : '▾'}
				</span>
			</button>
			{categoriesOpen && (
				<div className='max-h-[50vh] overflow-auto border-t'>{treeList}</div>
			)}
		</div>
	) : (
		<div className='max-h-[65vh] overflow-auto rounded-xl border bg-white'>{treeList}</div>
	)
	const productEditor =
		active?.attribute_contract_version === 2 &&
		active.kind === 'product' &&
		active.status !== 'archived' &&
		tree.data &&
		!creating ? (
			<TypedProductEditor
				key={`${active._id}:${tree.data.revision}`}
				categoryId={active._id}
				initialProductId={
					productFocus?.category === active._id
						? productFocus.product
						: active._id === initialCategoryId
							? initialProductId
							: undefined
				}
				revision={tree.data.revision}
				disabled={!writable || !!treeError}
				onSubmit={submit}
				message={message}
				transferTargets={items
					.filter(
						item =>
							item._id !== active._id &&
							item.kind === 'product' &&
							item.attribute_contract_version === 2 &&
							(item.status === 'draft' || item.status === 'active')
					)
					.map(item => ({
						id: item._id,
						name: item.name,
						status: item.status as 'draft' | 'active'
					}))}
			/>
		) : null
	// One place to save and publish (owner, 2026-11-09): the blocks below hold no save buttons.
	const header =
		!productsOnly && active && tree.data && !creating ? (
			<CategoryHeader
				// Its question («Зняти з публікації?») is about this category, not the next one opened.
				key={`${active._id}:header`}
				item={active}
				items={items}
				unsaved={save.unsaved.map(section => section.label)}
				message={message}
				disabled={!writable || !!treeError}
				saving={busy}
				onSave={() => void saveAll()}
				onDiscard={() => {
					save.discard()
					setMessage('')
				}}
				onPublication={action =>
					submit({
						type: 'publication',
						id: active._id,
						body: { action, expected_revision: tree.data!.revision }
					})
				}
			/>
		) : null
	return (
		<section
			// Products and categories are forms, not a dashboard: capped and kept to the left edge,
			// so fields stay a readable width on a wide monitor (owner, 2026-11-03/04).
			className='w-full max-w-6xl space-y-4 p-4'
			aria-label={productsOnly ? 'Товари каталогу' : 'Дерево категорій'}
		>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div className='min-w-0 flex-1'>
					<h2 className='text-xl font-semibold'>
						{productsOnly ? 'Товари каталогу' : 'Дерево категорій'}
					</h2>
					<p className='text-sm text-gray-500'>
						{productsOnly
							? 'Оберіть товар у списку; інша категорія — у фільтрі «Категорія». Характеристики категорії налаштовуються в розділі «Категорії».'
							: 'Групи можуть містити інші групи та товарні категорії. Обмеження глибини немає.'}
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-2'>
					{/* The old products page (and its PDF button) is replaced by this one after bootstrap. */}
					{productsOnly && <PriceListButton />}
					<button className={button} disabled={busy} onClick={() => void refresh()}>
						Оновити дерево
					</button>
					{!productsOnly && (
						<button
							className={button}
							disabled={!writable || !!treeError}
							onClick={() => {
								setCreating(true)
								setSelected(null)
							}}
						>
							Створити категорію
						</button>
					)}
				</div>
			</div>
			{!capabilities.isLoading && !capabilities.data?.draft_writes_enabled && (
				<p className='rounded-lg bg-amber-50 p-3 text-sm'>
					Редагування нового дерева ще не ввімкнено або каталог зараз оновлюється.
					Перегляд доступний; запуск запису потребує підготовленого середовища.
				</p>
			)}
			{(tree.isError || capabilities.isError || treeError) && (
				<p role='alert' className='text-red-700'>
					{treeError ||
						'Не вдалося завантажити актуальний стан каталогу. Оновіть дерево.'}
				</p>
			)}
			{message && !header && !(productsOnly && productEditor) && (
				<p role='status' className='rounded-lg bg-blue-50 p-3 text-sm'>
					{message}
				</p>
			)}
			{pending && (
				<div className='space-y-2 rounded-lg border border-amber-300 p-3'>
					<p className='text-sm break-all'>
						Ключ операції: <code>{pending.key}</code>
					</p>
					<div className='flex flex-wrap gap-2'>
						<button
							className={button}
							disabled={busy}
							onClick={() => void checkStatus()}
						>
							Перевірити стан операції
						</button>
						<button
							className={button}
							disabled={busy}
							// Confirmed this way, the command's block is saved: its draft goes too.
							onClick={() =>
								void execute(pending, () =>
									save.saved(pending.command as CategoryCommand)
								)
							}
						>
							Повторити той самий запит
						</button>
					</div>
				</div>
			)}
			{header}
			<div className={productsOnly ? 'space-y-4' : 'grid gap-4 lg:grid-cols-2'}>
				{treePanel}
				<div className='min-w-0'>
					{productsOnly && productEditor ? (
						productEditor
					) : productsOnly ? (
						<p className='rounded-lg border bg-white p-6 text-sm text-gray-500'>
							{active?.kind === 'group'
								? 'Оберіть товарну категорію всередині групи.'
								: active && active.attribute_contract_version !== 2
									? 'Ця категорія ще не підготовлена до нового редактора товарів.'
									: active?.status === 'archived'
										? 'Категорію архівовано — її товари не редагуються.'
										: active
											? active.name
											: 'Оберіть товарну категорію зі списку.'}
						</p>
					) : creating && tree.data ? (
						<CreateCategory
							key='create'
							items={items}
							revision={tree.data.revision}
							disabled={!writable || !!treeError}
							onSubmit={submit}
						/>
					) : active && tree.data ? (
						<EditCategory
							key={`${active._id}:${tree.data.revision}`}
							item={active}
							items={items}
							revision={tree.data.revision}
							disabled={!writable || !contentEditable || !!treeError}
							slugDisabled={!writable || !!treeError}
							onSubmit={submit}
						/>
					) : (
						<p className='p-4 text-sm text-gray-500'>
							Оберіть категорію для перегляду або створіть нову.
						</p>
					)}
				</div>
			</div>
			{!productsOnly &&
				active?.attribute_contract_version === 2 &&
				active.kind === 'product' &&
				tree.data &&
				!creating && (
					<CategoryDefinitionsEditor
						key={active._id}
						category={active}
						items={items}
						revision={tree.data.revision}
						disabled={!writable || !contentEditable || !!treeError}
					/>
				)}
			{!productsOnly &&
				active?.attribute_contract_version === 2 &&
				active.status !== 'archived' &&
				tree.data &&
				!creating && (
					<CategorySeoEditor
						key={`${active._id}:seo`}
						categoryId={active._id}
						revision={tree.data.revision}
						disabled={!writable || !!treeError}
					/>
				)}
			{!productsOnly &&
				active?.attribute_contract_version === 2 &&
				active.kind === 'product' &&
				active.status !== 'archived' &&
				tree.data &&
				!creating && (
					<CategoryExportEditor
						key={`${active._id}:export`}
						categoryId={active._id}
						revision={tree.data.revision}
						disabled={!writable || !!treeError}
					/>
				)}
			{!productsOnly &&
				active?.attribute_contract_version === 2 &&
				active.kind === 'product' &&
				active.status !== 'archived' &&
				tree.data &&
				!creating && (
					<TypedLandingsEditor
						key={`${active._id}:landings`}
						categoryId={active._id}
						categorySlug={active.slug}
						revision={tree.data.revision}
						disabled={!writable || !!treeError}
						onSubmit={submit}
					/>
				)}
			{/* Products are edited in one place, the «Товари» screen (owner, 2026-11-05): the category
			    page only points there, with this category already chosen. */}
			{!productsOnly &&
				active?.attribute_contract_version === 2 &&
				active.kind === 'product' &&
				active.status !== 'archived' &&
				!creating && (
					<div className={`${ui.card} flex flex-wrap items-center justify-between gap-3`}>
						<div>
							<h3 className={ui.cardTitle}>Товари категорії</h3>
							<p className={ui.hint}>Редагуються в розділі «Товари».</p>
						</div>
						<Link
							href={`${UI_URLS.ADMIN.PRODUCTS}?category=${active._id}`}
							className={ui.button}
						>
							Товари цієї категорії →
						</Link>
					</div>
				)}
		</section>
	)
}
function ParentSelect({
	items,
	value,
	onChange,
	selectedId,
	disabled = false,
	publicOnly = false
}: {
	items: TreeItem[]
	value: string
	onChange: (value: string) => void
	selectedId?: string
	disabled?: boolean
	/** A published category moves only under a published group (or to the root). */
	publicOnly?: boolean
}) {
	const allowed = new Set(allowedParents(items, selectedId, { publicOnly }).map(item => item._id))
	return (
		<label className='block text-sm'>
			Батьківська група
			<select
				className={ui.input}
				value={value}
				disabled={disabled}
				onChange={event => onChange(event.target.value)}
			>
				<option value=''>Корінь каталогу</option>
				{treeRows(items)
					.filter(({ item }) => allowed.has(item._id))
					.map(({ item, depth }) => (
						<option key={item._id} value={item._id}>
							{'—'.repeat(Math.min(depth, 8))} {item.name} (рівень {depth + 1})
						</option>
					))}
			</select>
		</label>
	)
}
function CreateCategory({
	items,
	revision,
	disabled,
	onSubmit
}: {
	items: TreeItem[]
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const [name, setName] = useState(''),
		[slug, setSlug] = useState(''),
		[kind, setKind] = useState<'group' | 'product'>('group'),
		[parent, setParent] = useState(''),
		[order, setOrder] = useState('0')
	const submit = (event: FormEvent) => {
		event.preventDefault()
		if (!name.trim() || !Number.isSafeInteger(Number(order))) return
		onSubmit({
			type: 'create',
			body: {
				name: name.trim(),
				slug,
				kind,
				parent_id: parent || null,
				order: Number(order),
				expected_revision: revision
			}
		})
	}
	return (
		<form onSubmit={submit} className='space-y-4 rounded-xl border p-4'>
			<h3 className='font-semibold'>Нова чернетка категорії</h3>
			<fieldset disabled={disabled} className='space-y-4'>
				<label className='block text-sm'>
					Назва
					<input
						className={ui.input}
						required
						maxLength={200}
						value={name}
						onChange={event => setName(event.target.value)}
					/>
				</label>
				<label className='block text-sm'>
					Адреса (slug)
					<input
						className={ui.input}
						required
						maxLength={200}
						pattern='[a-z0-9]+(-[a-z0-9]+)*'
						value={slug}
						onChange={event => setSlug(event.target.value)}
					/>
					<span className='text-xs text-gray-500'>
						Латинські малі літери, цифри й дефіси. Перейменування або переміщення
						збереже цю адресу.
					</span>
				</label>
				<label className='block text-sm'>
					Тип категорії
					<select
						className={ui.input}
						value={kind}
						onChange={event => setKind(event.target.value as typeof kind)}
					>
						<option value='group'>Група категорій</option>
						<option value='product'>Товарна категорія</option>
					</select>
				</label>
				<ParentSelect items={items} value={parent} onChange={setParent} />
				<label className='block text-sm'>
					Порядок
					<input
						className={ui.input}
						type='number'
						min={0}
						max={Number.MAX_SAFE_INTEGER}
						step={1}
						required
						value={order}
						onChange={event => setOrder(event.target.value)}
					/>
				</label>
				<p className='text-sm text-gray-500'>
					Чернетка не з’явиться у магазині. Налаштування характеристик і автоматичних
					фільтрів буде окремим наступним кроком.
				</p>
				<button className={button} type='submit'>
					Створити чернетку
				</button>
			</fieldset>
		</form>
	)
}
function EditCategory({
	item,
	items,
	revision,
	disabled,
	slugDisabled,
	onSubmit
}: {
	item: TreeItem
	items: TreeItem[]
	revision: number
	/** Content edits: a draft or published v2 category. */
	disabled: boolean
	/** A redirect-backed address change is for published categories too (B07). */
	slugDisabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	const draft = item.status === 'draft' && item.attribute_contract_version === 2
	const published = item.status === 'active' && item.attribute_contract_version === 2
	// The page's drafts, saved by the header's «Зберегти» (owner, 2026-11-09).
	const [details, setDetails] = useCategoryDraft<DetailsDraft>(item._id, 'details', {
		name: item.name,
		image: item.image ?? null
	})
	const [placement, setPlacement] = useCategoryDraft<MoveDraft>(item._id, 'move', {
		parent: item.parent_id ?? '',
		order: String(item.order)
	})
	const detailsIssue = useDraftIssue(item._id, 'details')
	const placementIssue = useDraftIssue(item._id, 'move')
	const [uploading, setUploading] = useState(false),
		[uploadError, setUploadError] = useState('')
	const { name, image } = details
	async function upload(file: File) {
		setUploading(true)
		setUploadError('')
		try {
			const uploaded = await categoriesApi.uploadImage(item._id, file)
			setDetails(current => ({ ...current, image: uploaded }))
		} catch {
			setUploadError('Не вдалося завантажити зображення. Спробуйте інший файл.')
		} finally {
			setUploading(false)
		}
	}
	return (
		<div className='space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
			<h3 className='font-semibold'>Основне</h3>
			<div className='flex flex-wrap items-center gap-2'>
				<p className='text-sm break-all text-gray-500'>Адреса: /{item.slug}</p>
				{item.attribute_contract_version === 2 && item.status !== 'archived' && (
					<SlugChange
						target='categories'
						id={item._id}
						slug={item.slug}
						prefix='/'
						revision={revision}
						disabled={slugDisabled}
						onSubmit={onSubmit}
					/>
				)}
			</div>
			{published && (
				<p className='text-sm'>
					Категорія опублікована: назва, зображення, розташування й характеристики
					змінюються тут і одразу діють на сайті. Перенести її можна лише в опубліковану
					групу або в корінь — адреси категорії, її сторінок і товарів при цьому не
					змінюються. Видалити можна лише чернетку.
				</p>
			)}
			{!draft && !published && (
				<p className='text-sm'>
					Ця категорія доступна тут лише для перегляду
					{item.status === 'archived'
						? ': її архівовано.'
						: '. Зміни старого каталогу потребують міграції.'}
				</p>
			)}
			<div>
				<fieldset disabled={disabled || uploading} className='space-y-3'>
					<label className='block text-sm'>
						Назва
						<input
							className={ui.input}
							required
							maxLength={200}
							value={name}
							onChange={event => setDetails({ ...details, name: event.target.value })}
						/>
					</label>
					<div className='space-y-2 text-sm'>
						<p>Зображення плитки категорії</p>
						{image ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={image}
								alt='Зображення категорії'
								className='size-20 rounded-lg border object-cover'
							/>
						) : (
							<p className='text-gray-500'>Зображення немає.</p>
						)}
						<div className='flex flex-wrap items-center gap-2'>
							<label className={button}>
								{uploading ? 'Завантаження…' : 'Завантажити зображення'}
								<input
									type='file'
									accept='image/webp,image/jpeg,image/png'
									className='sr-only'
									onChange={event => {
										const file = event.target.files?.[0]
										event.target.value = ''
										if (file) void upload(file)
									}}
								/>
							</label>
							{image && (
								<button
									type='button'
									className={button}
									onClick={() => setDetails({ ...details, image: null })}
								>
									Прибрати зображення
								</button>
							)}
						</div>
						{uploadError && (
							<p role='alert' className='text-red-700'>
								{uploadError}
							</p>
						)}
					</div>
					{detailsIssue && (
						<p role='alert' className='text-sm text-red-700'>
							{detailsIssue.message}
						</p>
					)}
				</fieldset>
			</div>
			<div>
				<fieldset disabled={disabled} className='space-y-3'>
					<ParentSelect
						items={items}
						selectedId={item._id}
						value={placement.parent}
						disabled={!draft && !published}
						publicOnly={published}
						onChange={parent => setPlacement({ ...placement, parent })}
					/>
					<label className='block text-sm'>
						Порядок
						<input
							className={ui.input}
							required
							type='number'
							min={0}
							max={Number.MAX_SAFE_INTEGER}
							step={1}
							value={placement.order}
							onChange={event =>
								setPlacement({ ...placement, order: event.target.value })
							}
						/>
					</label>
					{placementIssue && (
						<p role='alert' className='text-sm text-red-700'>
							{placementIssue.message}
						</p>
					)}
				</fieldset>
			</div>
			{draft && (
				<DraftLifecycle
					item={item}
					hasChildren={items.some(other => other.parent_id === item._id)}
					revision={revision}
					disabled={disabled}
					onSubmit={onSubmit}
				/>
			)}
			{(draft || published) && item.kind === 'product' && (
				<CategoryConversionPanel
					item={item}
					items={items}
					revision={revision}
					disabled={disabled}
					onSubmit={onSubmit}
				/>
			)}
		</div>
	)
}

/**
 * Type change and removal of an empty draft (Plan-0010 B02/F02). The server refuses anything in
 * use; the copy says how to empty a category first, because nothing is moved or deleted for you.
 */
function DraftLifecycle({
	item,
	hasChildren,
	revision,
	disabled,
	onSubmit
}: {
	item: TreeItem
	hasChildren: boolean
	revision: number
	disabled: boolean
	onSubmit: (command: CategoryCommand) => void
}) {
	// What cannot be undone asks first: a removal, and a product category becoming a group (its
	// characteristics go). The trigger turns into «Скасувати» where it stands and the confirmation
	// opens on a line of its own, so the second click of a double-click cancels, never confirms;
	// the neighbour, which moves when the caption shrinks, is locked meanwhile.
	const [confirming, setConfirming] = useState<'convert' | 'delete' | null>(null)
	const target = item.kind === 'group' ? 'product' : 'group'
	const toggle = (action: 'convert' | 'delete') =>
		setConfirming(confirming === action ? null : action)
	const convert = () =>
		onSubmit({
			type: 'convert',
			id: item._id,
			body: { kind: target, expected_revision: revision }
		})
	return (
		<section className='space-y-3 border-t pt-4' aria-label='Тип і видалення чернетки'>
			<p className='text-sm text-gray-500'>
				Змінити тип чи видалити можна лише порожню чернетку: без підкатегорій, товарів і
				посадкових сторінок. Товари переносяться в редакторі товару («Перенести в іншу
				категорію»), підкатегорії — зміною батьківської групи.
			</p>
			{hasChildren && <p className='text-sm'>У цієї групи є підкатегорії.</p>}
			<div className='flex flex-wrap gap-2'>
				<button
					type='button'
					className={button}
					disabled={
						confirming === 'delete' ||
						(confirming !== 'convert' && (disabled || hasChildren))
					}
					onClick={() => (target === 'group' ? toggle('convert') : convert())}
				>
					{confirming === 'convert'
						? 'Скасувати'
						: target === 'group'
							? 'Перетворити на групу'
							: 'Перетворити на товарну категорію'}
				</button>
				<button
					type='button'
					className={button}
					disabled={
						confirming === 'convert' ||
						(confirming !== 'delete' && (disabled || hasChildren))
					}
					onClick={() => toggle('delete')}
				>
					{confirming === 'delete' ? 'Скасувати' : 'Видалити чернетку'}
				</button>
				{confirming && (
					<div className='flex w-full flex-wrap items-center gap-2'>
						{confirming === 'convert' && (
							<p className='text-sm'>Характеристики цієї категорії не збережуться.</p>
						)}
						<button
							type='button'
							className={`${button} border-red-300 text-red-700`}
							disabled={disabled}
							onClick={() =>
								confirming === 'convert'
									? convert()
									: onSubmit({
											type: 'delete',
											id: item._id,
											body: { expected_revision: revision }
										})
							}
						>
							{confirming === 'convert'
								? 'Так, перетворити на групу'
								: `Так, видалити «${item.name}» назавжди`}
						</button>
					</div>
				)}
			</div>
		</section>
	)
}

const ISSUE_LABELS: Record<string, string> = {
	REQUIRED_ATTRIBUTE: 'не заповнені обов’язкові характеристики',
	DESCRIPTION_REQUIRED: 'немає опису',
	DRAFT_VARIANT_REQUIRED: 'немає варіантів-чернеток',
	POSITIVE_PRICE_REQUIRED: 'немає ціни',
	VALID_STOCK_REQUIRED: 'некоректний залишок',
	IMAGE_REQUIRED: 'немає фото',
	COLOR_ADAPTER_REQUIRED: 'колір зі словника без кольорової осі',
	COLOR_AXIS_MISMATCH: 'колір SKU не збігається зі значенням осі',
	INVALID_TYPED_DATA: 'некоректні характеристики'
}

function publicationMessage(receipt: PublicationReceipt) {
	if (receipt.changed_variants === null)
		return 'Операцію вже було виконано раніше; дерево оновлено.'
	if (receipt.action === 'unpublish')
		return `Знято з публікації. Варіантів повернуто в чернетки: ${receipt.changed_variants}.`
	const skipped = (receipt.skipped_products ?? []).map(
		product =>
			`«${product.name}» (${product.issues.map(code => ISSUE_LABELS[code] ?? code).join(', ')})`
	)
	return [
		`Опубліковано. Варіантів відкрито покупцям: ${receipt.changed_variants}.`,
		skipped.length ? `Залишились чернетками: ${skipped.join('; ')}.` : ''
	]
		.filter(Boolean)
		.join(' ')
}

/**
 * The category page's header (owner, 2026-11-09: saving and publishing «бігати по всій
 * сторінці»): the name and state, «Опублікувати»/«Зняти з публікації», and — while something is
 * unsaved — which blocks, with «Скасувати» and «Зберегти». It stays on screen while the page
 * scrolls. Publication is a separate, explicit operation with its own key, and it publishes what is
 * saved: while something is unsaved it waits. Publishing a group affects nothing below it;
 * publishing a product category opens only complete products. Taking a category off the storefront
 * asks first, in one sentence; the trigger turns into «Скасувати» where it stands and the
 * confirmation is in a row below it, so a double-click cancels and never confirms.
 */
function CategoryHeader({
	item,
	items,
	unsaved,
	message,
	disabled,
	saving,
	onSave,
	onDiscard,
	onPublication
}: {
	item: TreeItem
	items: TreeItem[]
	unsaved: string[]
	message: string
	disabled: boolean
	/** A save chain is running: its commands are built, dropping the drafts would not stop them. */
	saving: boolean
	onSave: () => void
	onDiscard: () => void
	onPublication: (action: 'publish' | 'unpublish') => void
}) {
	const parent = items.find(row => row._id === item.parent_id)
	const parentPublic = !parent || parent.status === 'active'
	const activeChildren = items.some(row => row.parent_id === item._id && row.status === 'active')
	const typed = item.attribute_contract_version === 2 && item.status !== 'archived'
	const publish = item.status === 'draft'
	const blocked = publish ? !parentPublic : activeChildren
	const [confirming, setConfirming] = useState(false)
	const asking = confirming && !publish
	return (
		<header
			aria-label='Категорія'
			className='sticky top-14 z-20 space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:top-0'
		>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div className='min-w-0'>
					<h3 className='truncate text-lg font-semibold'>{item.name}</h3>
					<p className='text-sm text-gray-600'>
						{publish
							? 'Чернетка — покупці її не бачать.'
							: item.status === 'active'
								? 'Опубліковано у магазині.'
								: statusLabels[item.status]}
						{publish && item.kind === 'product' && typed
							? ' Разом із категорією відкриються лише товари з повними даними.'
							: ''}
					</p>
				</div>
				{typed && (
					<div className='flex flex-col items-end gap-1'>
						<button
							type='button'
							className={button}
							disabled={!asking && (disabled || blocked || unsaved.length > 0)}
							onClick={() =>
								publish ? onPublication('publish') : setConfirming(!confirming)
							}
						>
							{publish ? 'Опублікувати' : asking ? 'Скасувати' : 'Зняти з публікації'}
						</button>
						{(blocked || unsaved.length > 0) && (
							<p className='text-xs text-amber-700'>
								{unsaved.length > 0
									? 'Спершу збережіть зміни.'
									: publish
										? 'Спочатку опублікуйте батьківську групу.'
										: 'Спочатку зніміть з публікації вкладені категорії.'}
							</p>
						)}
					</div>
				)}
			</div>
			{asking && (
				<div className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-2 text-sm'>
					<p>
						{item.kind === 'product'
							? 'Категорія та всі її SKU зникнуть із сайту й товарного фіду; повторна публікація відкриє чернетки SKU всіх товарів із повними даними.'
							: 'Група зникне з сайту.'}
					</p>
					<button
						type='button'
						className={`${button} border-red-300 text-red-700`}
						disabled={disabled || blocked || unsaved.length > 0}
						onClick={() => {
							setConfirming(false)
							onPublication('unpublish')
						}}
					>
						Так, зняти з публікації
					</button>
				</div>
			)}
			{unsaved.length > 0 && (
				<div className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-2 text-sm'>
					<p>Не збережено: {unsaved.join(' · ')}</p>
					<div className='flex gap-2'>
						<button
							type='button'
							className={button}
							disabled={saving}
							onClick={onDiscard}
						>
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
