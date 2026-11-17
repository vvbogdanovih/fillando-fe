import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StorefrontSettings } from './StorefrontSettings'

const { admin, save, tree, typedLandings, typedProducts, typedProduct } = vi.hoisted(() => ({
	admin: vi.fn(),
	save: vi.fn(),
	tree: vi.fn(),
	typedLandings: vi.fn(),
	typedProducts: vi.fn(),
	typedProduct: vi.fn()
}))
vi.mock('./storefront.api', () => ({ storefrontApi: { admin, save } }))
vi.mock('../categories/category-tree.api', () => ({
	categoryTreeApi: { tree, typedLandings, typedProducts, typedProduct }
}))
const filament = '000000000000000000000001'
const group = '000000000000000000000002'
/** What the backend answers before anything is saved (TD-0015). */
const content = {
	strip: ['Відправляємо Новою Поштою щодня', 'Доставка 1–3 дні'],
	banner: {
		eyebrow: 'Fillando',
		title: 'Усе для того, що ви створюєте',
		accent: 'створюєте',
		text: 'Ціни й наявність видно одразу.',
		button_label: 'До каталогу',
		button_href: '/catalog'
	},
	side_promo: {
		title: 'Купуєте оптом?',
		text: 'Залиште заявку.',
		button_label: 'Заповнити форму',
		action: 'wholesale-form' as const,
		button_href: null
	},
	band: {
		title: 'Прайс-лист',
		text: 'Усі товари на одній сторінці.',
		button_label: 'Відкрити прайс-лист',
		button_href: '/price-sheet'
	}
}
const renderSettings = () =>
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<StorefrontSettings />
		</QueryClientProvider>
	)
const item = (_id: string, name: string, kind: 'group' | 'product') => ({
	_id,
	name,
	kind,
	status: 'active' as const,
	parent_id: null,
	slug: name,
	order: 0,
	attribute_contract_version: 2
})
beforeEach(() => {
	vi.resetAllMocks()
	tree.mockResolvedValue({
		revision: 3,
		items: [item(filament, 'Філамент', 'product'), item(group, 'Електротовари', 'group')]
	})
	typedLandings.mockResolvedValue({
		category_id: filament,
		revision: 3,
		items: [
			{
				_id: '000000000000000000000040',
				h1: 'PLA філамент',
				status: 'active',
				contract_version: 2
			}
		]
	})
	admin.mockResolvedValueOnce({ revision: 3, ...content, collections: [] })
	admin.mockResolvedValue({ revision: 4, ...content, collections: [] })
	save.mockResolvedValue({ operation_id: '4c897974-e257-4a09-845f-01d605877811', revision: 4 })
})
afterEach(cleanup)

it('adds a landing collection and keeps the outcome after the remount', async () => {
	renderSettings()
	// The home page has no category tiles any more (TD-0015): the menu is the tree itself.
	expect(await screen.findByRole('region', { name: 'Добірки на головній' })).toBeInTheDocument()
	expect(screen.queryByRole('checkbox', { name: 'Філамент' })).toBeNull()
	fireEvent.click(screen.getByRole('button', { name: 'Додати добірку' }))
	fireEvent.change(screen.getByLabelText('Назва'), { target: { value: 'PLA' } })
	await screen.findByRole('option', { name: 'PLA філамент' })
	fireEvent.change(screen.getByLabelText('Посадкова сторінка'), {
		target: { value: '000000000000000000000040' }
	})
	// The /catalog intro is storefront copy in code, not a setting (owner, 2026-11-03).
	expect(screen.queryByText(/Текст над каталогом/)).toBeNull()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти вітрину' }))
	await waitFor(() => expect(save).toHaveBeenCalled())
	expect(save.mock.calls[0][0]).toEqual({
		expected_revision: 3,
		...content,
		collections: [
			{ title: 'PLA', category_id: filament, landing_id: '000000000000000000000040' }
		]
	})
	expect(save.mock.calls[0][0]).not.toHaveProperty('home_category_ids')
	expect(await screen.findByRole('status')).toHaveTextContent('Налаштування вітрини збережено.')
})

it('edits the home page copy and sends it whole: strip, banner, side card, no band', async () => {
	renderSettings()
	const strip = await screen.findByRole('region', { name: 'Смужка над шапкою' })
	fireEvent.click(within(strip).getByRole('button', { name: 'Прибрати рядок 1' }))
	fireEvent.click(within(strip).getByRole('button', { name: 'Додати рядок' }))
	fireEvent.change(within(strip).getByLabelText('Рядок 2'), {
		target: { value: 'Консультація 7 днів' }
	})
	const banner = screen.getByRole('region', { name: 'Банер' })
	fireEvent.change(within(banner).getByLabelText('Заголовок'), {
		target: { value: 'Усе для дому й майстерні' }
	})
	fireEvent.change(within(banner).getByLabelText(/Виділити в заголовку/), {
		target: { value: 'майстерні' }
	})
	const promo = screen.getByRole('region', { name: 'Картка праворуч від банера' })
	fireEvent.change(within(promo).getByLabelText('Кнопка відкриває'), {
		target: { value: 'link' }
	})
	fireEvent.change(within(promo).getByLabelText('Адреса на сайті'), {
		target: { value: '/wholesale' }
	})
	fireEvent.click(screen.getByRole('checkbox', { name: 'Показувати смугу' }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти вітрину' }))
	await waitFor(() => expect(save).toHaveBeenCalled())
	expect(save.mock.calls[0][0]).toEqual({
		expected_revision: 3,
		strip: ['Доставка 1–3 дні', 'Консультація 7 днів'],
		banner: { ...content.banner, title: 'Усе для дому й майстерні', accent: 'майстерні' },
		side_promo: { ...content.side_promo, action: 'link', button_href: '/wholesale' },
		band: null,
		collections: []
	})
})

it('says what the server would refuse in the copy before sending it', async () => {
	renderSettings()
	const banner = await screen.findByRole('region', { name: 'Банер' })
	fireEvent.change(within(banner).getByLabelText(/Виділити в заголовку/), {
		target: { value: 'чого немає' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти вітрину' }))
	expect(await screen.findByRole('status')).toHaveTextContent(
		'Банер: виділене має бути частиною заголовка.'
	)
	fireEvent.change(within(banner).getByLabelText(/Виділити в заголовку/), {
		target: { value: '' }
	})
	fireEvent.change(within(banner).getByLabelText('Кнопка: адреса на сайті'), {
		target: { value: 'https://example.com' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти вітрину' }))
	expect(await screen.findByRole('status')).toHaveTextContent(
		'адреса на цьому сайті, що починається з «/»'
	)
	const strip = screen.getByRole('region', { name: 'Смужка над шапкою' })
	fireEvent.change(within(banner).getByLabelText('Кнопка: адреса на сайті'), {
		target: { value: '/catalog' }
	})
	fireEvent.click(within(strip).getByRole('button', { name: 'Додати рядок' }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти вітрину' }))
	expect(await screen.findByRole('status')).toHaveTextContent('Порожній рядок смужки')
	expect(save).not.toHaveBeenCalled()
})

it('refuses a backslash in a button address: a browser reads `/\\host` as `//host` (audit 11.11)', async () => {
	renderSettings()
	const banner = await screen.findByRole('region', { name: 'Банер' })
	fireEvent.change(within(banner).getByLabelText('Кнопка: адреса на сайті'), {
		target: { value: '/\\evil.example' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти вітрину' }))
	expect(await screen.findByRole('status')).toHaveTextContent(
		'адреса на цьому сайті, що починається з «/»'
	)
	expect(save).not.toHaveBeenCalled()
})

it('builds a product collection in the chosen order, names of saved products read back', async () => {
	admin.mockReset().mockResolvedValue({
		revision: 3,
		...content,
		collections: [
			{
				id: '6f1c2b8e-5d0a-4c7e-9b2f-0a1b2c3d4e5f',
				title: 'Вибір магазину',
				category_id: null,
				landing_id: null,
				product_ids: ['000000000000000000000050']
			}
		]
	})
	typedProduct.mockResolvedValue({ name: 'Bambu Lab PLA Basic' })
	typedProducts.mockResolvedValue({
		category_id: filament,
		revision: 3,
		items: [
			{ id: '000000000000000000000050', name: 'Bambu Lab PLA Basic' },
			{ id: '000000000000000000000051', name: 'Kingroon PETG' }
		],
		next_cursor: null
	})
	renderSettings()
	expect(await screen.findByText('1. Bambu Lab PLA Basic')).toBeInTheDocument()
	// Already listed products are not offered again.
	await screen.findByRole('option', { name: 'Kingroon PETG' })
	expect(screen.queryByRole('option', { name: 'Bambu Lab PLA Basic' })).toBeNull()
	fireEvent.change(screen.getByLabelText('Товар'), {
		target: { value: '000000000000000000000051' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Додати товар' }))
	fireEvent.click(screen.getByRole('button', { name: 'Вище: Kingroon PETG' }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти вітрину' }))
	await waitFor(() => expect(save).toHaveBeenCalled())
	expect(save.mock.calls[0][0].collections).toEqual([
		{
			id: '6f1c2b8e-5d0a-4c7e-9b2f-0a1b2c3d4e5f',
			title: 'Вибір магазину',
			category_id: null,
			landing_id: null,
			product_ids: ['000000000000000000000051', '000000000000000000000050']
		}
	])
})
