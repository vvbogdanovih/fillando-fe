import { devices, expect, test } from '@playwright/test'
import {
	createCategory,
	createProduct,
	feedCategory,
	publish,
	purgesSettled,
	storefrontHtml
} from './real-api'

/**
 * The «Каталог» menu under touch on Android (P10, owner decisions 31.10 and 02.11.2026): a tap on
 * the chevron opens the panel and leaves it open long enough to tap a category — the browser's
 * emulated mouse events must not close it again — a second tap closes it, and «Каталог» itself
 * stays a link. The phone's menu opens the same branches. A real device stays in the release
 * checklist В; this is the emulated part.
 */
const { defaultBrowserType: _tablet, ...tablet } = devices['Galaxy Tab S4 landscape']
const { defaultBrowserType: _phone, ...phone } = devices['Pixel 7']
void [_tablet, _phone]

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ request }) => {
	const group = await createCategory(request, {
		name: 'Сенсорний розділ',
		slug: 'e2e-touch',
		kind: 'group',
		parent_id: null
	})
	const leaf = await feedCategory(request, {
		name: 'Сенсорна категорія',
		slug: 'e2e-touch-leaf',
		parent_id: group
	})
	await createProduct(request, {
		category_id: leaf.id,
		name: 'Сенсорний товар',
		variant_axis: null,
		attributes_v2: [leaf.brand('Тач')],
		variants: [{ variant_value: null, price: 90, stock: 3 }]
	})
	for (const id of [group, leaf.id]) await publish(request, id)
	await purgesSettled(request)
	await storefrontHtml(request, '/', html => html.includes('Сенсорна категорія'))
})

test.describe('an Android tablet', () => {
	test.use(tablet)
	test('a tap opens the panel to a category, a second tap closes it, «Каталог» is a link', async ({
		page
	}) => {
		await page.goto('/')
		const chevron = page.getByRole('button', { name: 'Категорії каталогу' })
		await chevron.tap()
		await expect(chevron).toHaveAttribute('aria-expanded', 'true')
		await chevron.tap()
		await expect(chevron).toHaveAttribute('aria-expanded', 'false')
		// Opened again, the panel stays open for the next tap: the category is reached.
		await chevron.tap()
		await page.getByRole('link', { name: 'Сенсорна категорія', exact: true }).tap()
		await expect(page).toHaveURL(/\/e2e-touch-leaf$/)
		await page.getByRole('link', { name: 'Каталог', exact: true }).tap()
		await expect(page).toHaveURL(/\/catalog$/)
	})
})

test.describe('an Android phone', () => {
	test.use(phone)
	test('the menu opens the branch with taps and reaches the category', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('button', { name: 'Меню' }).tap()
		await page.getByRole('button', { name: 'Розгорнути: Сенсорний розділ' }).tap()
		await page.getByRole('link', { name: 'Сенсорна категорія', exact: true }).tap()
		await expect(page).toHaveURL(/\/e2e-touch-leaf$/)
	})
})
