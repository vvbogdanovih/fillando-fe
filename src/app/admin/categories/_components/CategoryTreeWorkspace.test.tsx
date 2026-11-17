import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryTreeWorkspace } from './CategoryTreeWorkspace'
import type { TreeItem } from '../category-tree.api'
const { tree, capabilities, execute, status, categoryExport } = vi.hoisted(() => ({
	tree: vi.fn(),
	capabilities: vi.fn(),
	execute: vi.fn(),
	status: vi.fn(),
	categoryExport: vi.fn()
}))
vi.mock('./TypedProductEditor', () => ({
	TypedProductEditor: () => <div>Редактор товарів</div>
}))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { tree, capabilities, execute, status, categoryExport }
}))
const root = '000000000000000000000001',
	child = '000000000000000000000002',
	other = '000000000000000000000003'
const key = '4c897974-e257-4a09-845f-01d605877811'
const item = (_id: string, name: string, parent_id: string | null = null): TreeItem => ({
	_id,
	name,
	parent_id,
	kind: 'group',
	status: 'draft',
	slug: name.toLowerCase(),
	order: 0,
	attribute_contract_version: 2
})
const items = [item(root, 'Електротовари'), item(child, 'Автоматика', root), item(other, 'Дім')]
function mount(props: { productsOnly?: boolean } = {}) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	})
	return render(
		<QueryClientProvider client={client}>
			<CategoryTreeWorkspace {...props} />
		</QueryClientProvider>
	)
}
beforeEach(() => {
	vi.resetAllMocks()
	sessionStorage.clear()
	tree.mockResolvedValue({ revision: 7, items })
	capabilities.mockResolvedValue({ draft_writes_enabled: true, legacy_writes_enabled: false })
})
afterEach(cleanup)
describe('category tree admin workflow', () => {
	it('creates a product draft under the chosen group with the loaded revision', async () => {
		execute.mockResolvedValue({ operation_id: key, revision: 8, category_id: child })
		mount()
		const create = await screen.findByRole('button', { name: 'Створити категорію' })
		await waitFor(() => expect(create).toBeEnabled())
		fireEvent.click(create)
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'Електроковдри' } })
		fireEvent.change(screen.getByLabelText(/Адреса \(slug\)/), {
			target: { value: 'electric-blankets' }
		})
		fireEvent.change(screen.getByLabelText('Тип категорії'), { target: { value: 'product' } })
		fireEvent.change(screen.getByLabelText('Батьківська група'), { target: { value: other } })
		fireEvent.click(screen.getByRole('button', { name: 'Створити чернетку' }))
		await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
		expect(execute.mock.calls[0][0]).toMatchObject({
			key: expect.any(String),
			command: {
				type: 'create',
				body: {
					name: 'Електроковдри',
					slug: 'electric-blankets',
					kind: 'product',
					parent_id: other,
					expected_revision: 7,
					order: 0
				}
			}
		})
		await waitFor(() =>
			expect(sessionStorage.getItem('fillando-category-pending-operation-v1')).toBeNull()
		)
	})
	it('edits a name without sending a new slug and excludes descendants from parent choices', async () => {
		execute.mockResolvedValue({ operation_id: key, revision: 8, category_id: root })
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Електротовари/ }))
		expect(screen.getAllByRole('option').map(option => option.getAttribute('value'))).toEqual([
			'',
			other
		])
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'Електрика' } })
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
		expect(execute.mock.calls[0][0].command).toEqual({
			type: 'details',
			id: root,
			body: { name: 'Електрика', expected_revision: 7 }
		})
	})
	it('moves a draft and preserves a known revision conflict as a visible error without retrying', async () => {
		execute.mockRejectedValue({
			status: 409,
			details: { details: { code: 'CATEGORY_REVISION_CONFLICT' } }
		})
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Автоматика/ }))
		fireEvent.change(screen.getByLabelText('Батьківська група'), { target: { value: other } })
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await screen.findByText(
			'«Розташування» не збережено: Каталог уже змінився. Оновіть дерево перед наступною зміною.'
		)
		expect(execute).toHaveBeenCalledTimes(1)
		expect(execute.mock.calls[0][0].command).toEqual({
			type: 'move',
			id: child,
			body: { parent_id: other, order: 0, expected_revision: 7 }
		})
		expect(sessionStorage.getItem('fillando-category-pending-operation-v1')).toBeNull()
	})
	it('saves every unsaved block from the header, in page order, each on the revision before it', async () => {
		// One «Зберегти» and «Опублікувати» in the page's header (owner, 2026-11-09).
		execute
			.mockResolvedValueOnce({ operation_id: key, revision: 8, category_id: child })
			.mockRejectedValueOnce({
				status: 409,
				details: { details: { code: 'CATEGORY_REVISION_CONFLICT' } }
			})
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Автоматика/ }))
		await waitFor(() => expect(screen.getByLabelText('Назва')).toBeEnabled())
		expect(screen.queryByRole('button', { name: 'Зберегти' })).not.toBeInTheDocument()
		fireEvent.change(screen.getByLabelText('Порядок'), { target: { value: '2' } })
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'АВР' } })
		expect(screen.getByText('Не збережено: Назва й зображення · Розташування')).toBeVisible()
		expect(screen.getByText('Є незбережені зміни')).toBeVisible()
		// Publication publishes what is saved: it waits for the save.
		expect(screen.getByRole('button', { name: 'Опублікувати' })).toBeDisabled()
		expect(screen.getByText('Спершу збережіть зміни.')).toBeVisible()
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await screen.findByText(/«Розташування» не збережено/)
		expect(execute.mock.calls.map(call => call[0].command)).toEqual([
			{ type: 'details', id: child, body: { name: 'АВР', expected_revision: 7 } },
			{ type: 'move', id: child, body: { parent_id: root, order: 2, expected_revision: 8 } }
		])
		expect(screen.getByText(/^Збережено: Назва й зображення\./)).toBeVisible()
		// The saved block is clean; the refused one keeps what was typed, after the refresh too.
		await waitFor(() => expect(screen.getByText('Не збережено: Розташування')).toBeVisible())
		expect(screen.getByLabelText('Порядок')).toHaveValue(2)
		// «Скасувати» drops it: the block shows the server value again.
		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
		expect(screen.getByLabelText('Порядок')).toHaveValue(0)
		expect(screen.queryByText(/^Не збережено/)).not.toBeInTheDocument()
	})
	it('retains an uncertain operation across remount and checks status without issuing another mutation', async () => {
		execute.mockRejectedValue(Error('network disconnected'))
		const view = mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Автоматика/ }))
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'АВР' } })
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await screen.findByRole('button', { name: 'Перевірити стан операції' })
		const stored = JSON.parse(sessionStorage.getItem('fillando-category-pending-operation-v1')!)
		expect(stored.command.body.name).toBe('АВР')
		view.unmount()
		mount()
		const check = await screen.findByRole('button', { name: 'Перевірити стан операції' })
		expect(screen.getByRole('button', { name: 'Створити категорію' })).toBeDisabled()
		status.mockResolvedValue({
			operation_id: stored.key,
			status: 'completed',
			result_revision: 8,
			error_code: null
		})
		fireEvent.click(check)
		await screen.findByText('Операцію виконано. Дерево оновлено.')
		expect(status).toHaveBeenCalledWith(stored.key)
		expect(execute).toHaveBeenCalledTimes(1)
	})
	it('retries only the exact persisted command after an unknown result', async () => {
		const operation = {
			key,
			command: { type: 'details', id: root, body: { name: 'Updated', expected_revision: 7 } }
		}
		sessionStorage.setItem('fillando-category-pending-operation-v1', JSON.stringify(operation))
		execute.mockResolvedValue({ operation_id: key, revision: 8, category_id: root })
		mount()
		fireEvent.click(await screen.findByRole('button', { name: 'Повторити той самий запит' }))
		await waitFor(() => expect(execute).toHaveBeenCalledWith(operation))
	})
	it('keeps active categories and a disabled rollout read-only', async () => {
		capabilities.mockResolvedValue({
			draft_writes_enabled: false,
			legacy_writes_enabled: false
		})
		tree.mockResolvedValue({ revision: 7, items: [{ ...items[0], status: 'active' }] })
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Електротовари/ }))
		expect(screen.getByRole('button', { name: 'Створити категорію' })).toBeDisabled()
		expect(screen.getByLabelText('Назва')).toBeDisabled()
		expect(execute).not.toHaveBeenCalled()
	})

	it('edits a published category and moves it only under a published group', async () => {
		execute.mockResolvedValue({ operation_id: key, revision: 8, category_id: root })
		const published = {
			...item('000000000000000000000004', 'Опублікована група'),
			status: 'active' as const
		}
		tree.mockResolvedValue({
			revision: 7,
			items: [
				{ ...items[0], status: 'active', image: 'https://cdn.example.com/old.png' },
				items[2],
				published
			]
		})
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Електротовари/ }))
		expect(screen.getByText(/Категорія опублікована/)).toBeInTheDocument()
		await waitFor(() => expect(screen.getByLabelText('Назва')).toBeEnabled())
		// The draft group «Дім» would hide it from the storefront: only the root and public groups.
		const parent = screen.getByLabelText('Батьківська група')
		expect(parent).toBeEnabled()
		expect([...parent.querySelectorAll('option')].map(option => option.value)).toEqual([
			'',
			published._id
		])
		expect(screen.queryByRole('button', { name: 'Видалити чернетку' })).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати зображення' }))
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await waitFor(() =>
			expect(execute).toHaveBeenLastCalledWith({
				key: expect.any(String),
				command: {
					type: 'details',
					id: root,
					body: { name: 'Електротовари', image: null, expected_revision: 7 }
				}
			})
		)
		fireEvent.change(screen.getByLabelText('Порядок'), { target: { value: '3' } })
		// A saved block shows the server's value from then on: the tree answers with the new order.
		tree.mockResolvedValue({
			revision: 7,
			items: [
				{
					...items[0],
					status: 'active',
					image: 'https://cdn.example.com/old.png',
					order: 3
				},
				items[2],
				published
			]
		})
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await waitFor(() =>
			expect(execute).toHaveBeenLastCalledWith({
				key: expect.any(String),
				command: {
					type: 'move',
					id: root,
					body: { parent_id: null, order: 3, expected_revision: 7 }
				}
			})
		)
		await waitFor(() => expect(screen.getByLabelText('Батьківська група')).toBeEnabled())
		await waitFor(() => expect(screen.getByLabelText('Порядок')).toHaveValue(3))
		fireEvent.change(screen.getByLabelText('Батьківська група'), {
			target: { value: published._id }
		})
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await waitFor(() =>
			expect(execute).toHaveBeenLastCalledWith({
				key: expect.any(String),
				command: {
					type: 'move',
					id: root,
					body: { parent_id: published._id, order: 3, expected_revision: 7 }
				}
			})
		)
	})

	it('only links the category page to its products on the «Товари» screen', async () => {
		// Products are edited in one place (owner, 2026-11-05): no second editor on the category page.
		const product = {
			...item(child, 'Філамент'),
			kind: 'product' as const,
			status: 'active' as const
		}
		tree.mockResolvedValue({ revision: 7, items: [product] })
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Філамент/ }))
		expect(
			await screen.findByRole('link', { name: 'Товари цієї категорії →' })
		).toHaveAttribute('href', `/admin/products?category=${child}`)
		expect(screen.queryByText('Редактор товарів')).not.toBeInTheDocument()
	})

	it('opens the products view on the category from the link', async () => {
		const first = { ...item(child, 'Філамент'), kind: 'product' as const }
		const second = { ...item(other, 'Електроковдри'), kind: 'product' as const }
		tree.mockResolvedValue({ revision: 7, items: [first, second] })
		render(
			<QueryClientProvider
				client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
			>
				<CategoryTreeWorkspace productsOnly initialCategoryId={other} />
			</QueryClientProvider>
		)
		await waitFor(() =>
			expect(screen.getByRole('button', { name: /^Категорія:/ })).toHaveTextContent(
				'Електроковдри'
			)
		)
	})

	it('opens the product editor of a published v2 category in the products view', async () => {
		// A migrated, published category: structure is read-only, its products are editable.
		const product = {
			...item(child, 'Філамент'),
			kind: 'product' as const,
			status: 'active' as const
		}
		const legacy = {
			...item(other, 'Старий розділ'),
			kind: 'product' as const,
			attribute_contract_version: 1
		}
		tree.mockResolvedValue({ revision: 7, items: [product, legacy] })
		mount({ productsOnly: true })
		// The categories are a folded filter over the list (owner, 2026-11-03): the first editable
		// one is chosen at once, the others wait behind «Категорія: …».
		const filter = await screen.findByRole('button', { name: /^Категорія:/ })
		await waitFor(() => expect(filter).toHaveTextContent('Філамент'))
		expect(filter).toHaveAttribute('aria-expanded', 'false')
		expect(screen.queryByRole('button', { name: /^Старий розділ/ })).not.toBeInTheDocument()
		expect(await screen.findByText('Редактор товарів')).toBeInTheDocument()
		expect(screen.queryByText(/ще не підготовлена/)).not.toBeInTheDocument()
		fireEvent.click(filter)
		fireEvent.click(screen.getByRole('button', { name: /^Старий розділ/ }))
		expect(filter).toHaveAttribute('aria-expanded', 'false')
		expect(filter).toHaveTextContent('Старий розділ')
		expect(screen.getByText(/ще не підготовлена до нового редактора/)).toBeInTheDocument()
		expect(screen.queryByText('Редактор товарів')).not.toBeInTheDocument()
	})

	it('deletes an empty draft after an explicit confirmation and converts its kind', async () => {
		execute.mockResolvedValue({ operation_id: key, revision: 8, category_id: other })
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Дім/ }))
		const remove = screen.getByRole('button', { name: 'Видалити чернетку' })
		await waitFor(() => expect(remove).toBeEnabled())
		fireEvent.click(remove)
		fireEvent.click(screen.getByRole('button', { name: 'Так, видалити «Дім» назавжди' }))
		await waitFor(() =>
			expect(execute).toHaveBeenCalledWith({
				key: expect.any(String),
				command: { type: 'delete', id: other, body: { expected_revision: 7 } }
			})
		)
		expect(await screen.findByText('Чернетку категорії видалено.')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: /^Електротовари/ }))
		// A group with subcategories can be neither converted nor deleted.
		expect(
			screen.getByRole('button', { name: 'Перетворити на товарну категорію' })
		).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Видалити чернетку' })).toBeDisabled()
		fireEvent.click(screen.getByRole('button', { name: /^Автоматика/ }))
		fireEvent.click(screen.getByRole('button', { name: 'Перетворити на товарну категорію' }))
		await waitFor(() =>
			expect(execute).toHaveBeenLastCalledWith({
				key: expect.any(String),
				command: {
					type: 'convert',
					id: child,
					body: { kind: 'product', expected_revision: 7 }
				}
			})
		)
	})
})

const pendingKey = 'fillando-category-pending-operation-v1'
const openDraft = async (name: RegExp) => {
	fireEvent.click(await screen.findByRole('button', { name }))
	await waitFor(() => expect(screen.getByLabelText('Назва')).toBeEnabled())
}

describe('publication from the header', () => {
	const published = {
		...item(root, 'Філамент'),
		kind: 'product' as const,
		status: 'active' as const
	}
	it('asks before taking a published category off the storefront; a double-click cancels', async () => {
		execute.mockResolvedValue({
			operation_id: key,
			revision: 8,
			category_id: root,
			action: 'unpublish',
			changed_variants: 301,
			skipped_products: null
		})
		tree.mockResolvedValue({ revision: 7, items: [published] })
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Філамент/ }))
		const trigger = screen.getByRole('button', { name: 'Зняти з публікації' })
		await waitFor(() => expect(trigger).toBeEnabled())
		fireEvent.click(trigger)
		// The first click sends nothing: it says what will happen, and the trigger itself is
		// «Скасувати» where it stood — the second click of a double-click lands on that.
		expect(execute).not.toHaveBeenCalled()
		expect(
			screen.getByText(
				'Категорія та всі її SKU зникнуть із сайту й товарного фіду; повторна публікація відкриє чернетки SKU всіх товарів із повними даними.'
			)
		).toBeVisible()
		expect(trigger).toHaveTextContent('Скасувати')
		fireEvent.click(trigger)
		expect(
			screen.queryByRole('button', { name: 'Так, зняти з публікації' })
		).not.toBeInTheDocument()
		expect(execute).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Зняти з публікації' }))
		fireEvent.click(screen.getByRole('button', { name: 'Так, зняти з публікації' }))
		await waitFor(() =>
			expect(execute).toHaveBeenCalledWith({
				key: expect.any(String),
				command: {
					type: 'publication',
					id: root,
					body: { action: 'unpublish', expected_revision: 7 }
				}
			})
		)
		expect(execute).toHaveBeenCalledTimes(1)
		expect(
			await screen.findByText('Знято з публікації. Варіантів повернуто в чернетки: 301.')
		).toBeVisible()
	})
	it('publishes with one click', async () => {
		execute.mockResolvedValue({
			operation_id: key,
			revision: 8,
			category_id: other,
			action: 'publish',
			changed_variants: 0,
			skipped_products: []
		})
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Дім/ }))
		const publish = screen.getByRole('button', { name: 'Опублікувати' })
		await waitFor(() => expect(publish).toBeEnabled())
		fireEvent.click(publish)
		await waitFor(() =>
			expect(execute).toHaveBeenCalledWith({
				key: expect.any(String),
				command: {
					type: 'publication',
					id: other,
					body: { action: 'publish', expected_revision: 7 }
				}
			})
		)
	})
})

describe('the header’s «Зберегти» and what the server answers', () => {
	it('names the block that cannot be sent and sends nothing: a Google path without its ID', async () => {
		const product = {
			...item(child, 'Філамент'),
			kind: 'product' as const,
			status: 'active' as const
		}
		tree.mockResolvedValue({ revision: 7, items: [product] })
		categoryExport.mockResolvedValue({
			category_id: child,
			revision: 7,
			name: 'Філамент',
			status: 'active',
			google_product_category: { id: 499682, path: 'Electronics > 3D Printer Accessories' }
		})
		mount()
		fireEvent.click(await screen.findByRole('button', { name: /^Філамент/ }))
		fireEvent.click(screen.getByRole('button', { name: 'Google Shopping' }))
		const id = await screen.findByLabelText('ID категорії Google')
		await waitFor(() => expect(id).toBeEnabled())
		// The ID cleared to be retyped, the path still there: half an edit, not «no category».
		fireEvent.change(id, { target: { value: '' } })
		// The card may be folded by the time «Зберегти» is pressed: the header names it.
		fireEvent.click(screen.getByRole('button', { name: 'Google Shopping' }))
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		expect(
			await screen.findByText(
				'«Google Shopping» не збережено: Категорія Google: числовий ID і шлях разом, або обидва порожні.'
			)
		).toBeVisible()
		expect(execute).not.toHaveBeenCalled()
		expect(screen.getByText('Не збережено: Google Shopping')).toBeVisible()
	})
	it('counts a block the server finds unchanged as saved and goes on with the rest', async () => {
		execute
			.mockRejectedValueOnce({
				status: 409,
				details: { details: { code: 'CATEGORY_DETAILS_UNCHANGED' } }
			})
			.mockResolvedValueOnce({ operation_id: key, revision: 8, category_id: child })
		mount()
		await openDraft(/^Автоматика/)
		// A trailing space is unsaved on the page and no change for the server (the name is sent
		// trimmed): it used to stop the chain with «Змін немає» and leave the block unsaved for good.
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'Автоматика ' } })
		fireEvent.change(screen.getByLabelText('Порядок'), { target: { value: '2' } })
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await screen.findByText('Зміни збережено. Чернетка ще не опублікована у магазині.')
		expect(execute.mock.calls.map(call => call[0].command)).toEqual([
			{ type: 'details', id: child, body: { name: 'Автоматика', expected_revision: 7 } },
			// A refusal writes nothing: the next block goes on the same revision.
			{ type: 'move', id: child, body: { parent_id: root, order: 2, expected_revision: 7 } }
		])
		await waitFor(() => expect(screen.queryByText(/^Не збережено/)).not.toBeInTheDocument())
		expect(sessionStorage.getItem(pendingKey)).toBeNull()
	})
	it('settles the draft once a lost answer is confirmed by the operation’s status', async () => {
		execute.mockRejectedValue(Error('network disconnected'))
		mount()
		await openDraft(/^Автоматика/)
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'АВР ' } })
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		const check = await screen.findByRole('button', { name: 'Перевірити стан операції' })
		// The key is kept, so — and only then — the message points at the operation's status.
		expect(
			screen.getByText(
				'«Назва й зображення» не збережено: Результат запиту потребує перевірки. Перевірте стан операції нижче.'
			)
		).toBeVisible()
		const stored = JSON.parse(sessionStorage.getItem(pendingKey)!)
		status.mockResolvedValue({
			operation_id: stored.key,
			status: 'completed',
			result_revision: 8,
			error_code: null
		})
		// The server stores the trimmed name, so the draft («АВР ») never equals it by itself.
		tree.mockResolvedValue({
			revision: 8,
			items: [items[0], { ...items[1], name: 'АВР' }, items[2]]
		})
		await waitFor(() => expect(check).toBeEnabled())
		fireEvent.click(check)
		await screen.findByText('Операцію виконано. Дерево оновлено.')
		await waitFor(() => expect(screen.queryByText(/^Не збережено/)).not.toBeInTheDocument())
		expect(screen.getByLabelText('Назва')).toHaveValue('АВР')
		expect(execute).toHaveBeenCalledTimes(1)
	})
	it('says a refusal that released the key plainly, without «check the operation»', async () => {
		execute.mockRejectedValue({ status: 409, details: { details: { code: 'SOMETHING_NEW' } } })
		mount()
		await openDraft(/^Автоматика/)
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'АВР' } })
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await screen.findByText(
			'«Назва й зображення» не збережено: Запит не виконано. Оновіть дерево й спробуйте ще раз.'
		)
		expect(sessionStorage.getItem(pendingKey)).toBeNull()
		expect(screen.queryByRole('button', { name: 'Перевірити стан операції' })).toBeNull()
	})
	it('locks «Скасувати» while the save is on its way', async () => {
		let answer: (receipt: unknown) => void = () => {}
		execute.mockReturnValue(new Promise(resolve => (answer = resolve)))
		mount()
		await openDraft(/^Автоматика/)
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'АВР' } })
		const discard = screen.getByRole('button', { name: 'Скасувати' })
		expect(discard).toBeEnabled()
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		// Dropping the drafts now would not stop the commands already built from them.
		await waitFor(() => expect(discard).toBeDisabled())
		answer({ operation_id: key, revision: 8, category_id: child })
		await screen.findByText('Зміни збережено. Чернетка ще не опублікована у магазині.')
	})
})

describe('unsaved edits and the ways to lose them', () => {
	it('drops the unsaved edits of a category that was deleted', async () => {
		execute.mockResolvedValue({ operation_id: key, revision: 8, category_id: other })
		mount()
		await openDraft(/^Дім/)
		fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'Дім і сад' } })
		expect(screen.getByText('Є незбережені зміни')).toBeVisible()
		fireEvent.click(screen.getByRole('button', { name: 'Видалити чернетку' }))
		fireEvent.click(screen.getByRole('button', { name: 'Так, видалити «Дім» назавжди' }))
		await screen.findByText('Чернетку категорії видалено.')
		// Nothing is left to save them into (the mocked tree still lists the row, so a kept
		// draft would still be marked — and the browser would ask before leaving for good).
		await waitFor(() =>
			expect(screen.queryByText('Є незбережені зміни')).not.toBeInTheDocument()
		)
		const leaving = new Event('beforeunload', { cancelable: true })
		window.dispatchEvent(leaving)
		expect(leaving.defaultPrevented).toBe(false)
	})
	it('asks before an in-app link leaves unsaved edits behind', async () => {
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
		const link = document.createElement('a')
		link.href = '/admin/products'
		// jsdom cannot navigate: whatever passes the guard stops here.
		link.addEventListener('click', event => event.preventDefault())
		document.body.append(link)
		const followed = () => {
			const click = new MouseEvent('click', { bubbles: true, cancelable: true })
			let reached = false
			const mark = () => (reached = true)
			link.addEventListener('click', mark)
			link.dispatchEvent(click)
			link.removeEventListener('click', mark)
			return reached
		}
		try {
			mount()
			await openDraft(/^Автоматика/)
			// Nothing unsaved: a link is just a link.
			expect(followed()).toBe(true)
			expect(confirm).not.toHaveBeenCalled()
			fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'АВР' } })
			// The router never sees a click the admin took back.
			expect(followed()).toBe(false)
			expect(confirm).toHaveBeenCalledWith('Є незбережені зміни. Перейти без збереження?')
			confirm.mockReturnValue(true)
			expect(followed()).toBe(true)
			expect(confirm).toHaveBeenCalledTimes(2)
		} finally {
			link.remove()
			confirm.mockRestore()
		}
	})
})

describe('two-step actions of a draft', () => {
	it('turns the trigger into «Скасувати» where it stands: a double-click never confirms', async () => {
		mount()
		await openDraft(/^Дім/)
		const remove = screen.getByRole('button', { name: 'Видалити чернетку' })
		fireEvent.click(remove)
		expect(remove).toHaveTextContent('Скасувати')
		expect(screen.getByRole('button', { name: 'Так, видалити «Дім» назавжди' })).toBeVisible()
		// The neighbour moves when the trigger's caption shrinks: it is locked meanwhile.
		expect(
			screen.getByRole('button', { name: 'Перетворити на товарну категорію' })
		).toBeDisabled()
		fireEvent.click(remove)
		expect(screen.queryByRole('button', { name: /^Так, видалити/ })).not.toBeInTheDocument()
		expect(remove).toHaveTextContent('Видалити чернетку')
		expect(execute).not.toHaveBeenCalled()
	})
	it('asks before a draft product category becomes a group: its characteristics are not kept', async () => {
		execute.mockResolvedValue({ operation_id: key, revision: 8, category_id: other })
		tree.mockResolvedValue({ revision: 7, items: [{ ...items[2], kind: 'product' }] })
		mount()
		await openDraft(/^Дім/)
		const convert = screen.getByRole('button', { name: 'Перетворити на групу' })
		fireEvent.click(convert)
		expect(execute).not.toHaveBeenCalled()
		expect(convert).toHaveTextContent('Скасувати')
		expect(screen.getByText('Характеристики цієї категорії не збережуться.')).toBeVisible()
		expect(screen.getByRole('button', { name: 'Видалити чернетку' })).toBeDisabled()
		fireEvent.click(screen.getByRole('button', { name: 'Так, перетворити на групу' }))
		await waitFor(() =>
			expect(execute).toHaveBeenCalledWith({
				key: expect.any(String),
				command: {
					type: 'convert',
					id: other,
					body: { kind: 'group', expected_revision: 7 }
				}
			})
		)
	})
})
