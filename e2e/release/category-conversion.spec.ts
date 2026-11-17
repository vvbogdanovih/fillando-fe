import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
	ADMIN,
	API,
	createCategory,
	activate,
	createProduct,
	defineCharacteristics,
	ok,
	publish,
	revision,
	typedDraft
} from './real-api'

/**
 * Plan-0010 §5 «Товарна категорія → група» (owner decision 31.10.2026): without an explicit
 * distribution of its products the conversion is refused and nothing changes; a plan that would
 * lose values cannot run; a plan the catalogue outgrew is refused at execution; an executable plan
 * turns the category into a group and every product and SKU keeps its id, SKU, address and price.
 */

type TreeRow = { _id: string; slug: string; kind: string; parent_id: string | null }
const tree = async (request: APIRequestContext) =>
	(
		await ok<{ items: TreeRow[] }>(
			await request.get(`${API}/categories/admin/tree?limit=1000`, { headers: ADMIN })
		)
	).items
/** The category's kind once the catalogue is readable again (reads answer 503 during a write). */
const kindOf = async (request: APIRequestContext, id: string) => {
	const response = await request.get(`${API}/categories/admin/tree?limit=1000`, {
		headers: ADMIN
	})
	if (response.status() === 503) return 'writing'
	return (await ok<{ items: TreeRow[] }>(response)).items.find(row => row._id === id)?.kind
}

const LAMP_TRAITS = [
	// The variation axis: only a required characteristic can be one (owner, 2026-11-06).
	{ label: 'Потужність', value_type: 'number' as const, unit: 'Вт', is_required: true },
	{ label: 'Призначення', value_type: 'string' as const }
]

async function lampCategory(request: APIRequestContext, name: string, slug: string) {
	const id = await createCategory(request, { name, slug, kind: 'product', parent_id: null })
	return { id, keys: await defineCharacteristics(request, id, LAMP_TRAITS) }
}

/** Every SKU of the products, as the admin API reports it — what must survive the conversion. */
async function skus(request: APIRequestContext, products: string[]) {
	const rows = []
	for (const id of products) {
		const draft = await typedDraft(request, id)
		for (const variant of draft.variants)
			rows.push({
				product: id,
				id: variant.id,
				sku: variant.sku,
				slug: variant.slug,
				status: variant.status,
				price: draft.details.variants.find(row => row.id === variant.id)?.price
			})
	}
	return rows.sort((a, b) => a.sku.localeCompare(b.sku))
}

async function openWizard(page: Page) {
	await page.goto('/admin/categories')
	await page.getByRole('button', { name: /^Світильники/ }).click()
	const wizard = page.getByRole('region', { name: 'Перетворення на групу' })
	await wizard.getByRole('button', { name: 'Перетворити на групу з розподілом товарів' }).click()
	await expect(wizard.getByRole('button', { name: 'Перевірити план' })).toBeVisible()
	return wizard
}

test('a product category becomes a group only by an executable plan, losing nothing', async ({
	page,
	request
}) => {
	const lamps = await lampCategory(request, 'Світильники', 'e2e-lamps')
	const desk = await lampCategory(request, 'Настільні лампи', 'e2e-desk-lamps')
	const floor = await lampCategory(request, 'Підлогові лампи', 'e2e-floor-lamps')
	const bare = await createCategory(request, {
		name: 'Без характеристик',
		slug: 'e2e-bare',
		kind: 'product',
		parent_id: null
	})
	const lamp = (name: string, use: string, powers: number[]) =>
		createProduct(request, {
			category_id: lamps.id,
			name,
			variant_axis: { key: lamps.keys['Потужність'] },
			attributes_v2: [{ k: lamps.keys['Призначення'], v: use }],
			variants: powers.map((power, index) => ({
				variant_value: power,
				price: 400 + 100 * index,
				stock: 2
			}))
		})
	const products = [
		await lamp('Лампа Ранок', 'настільна', [5, 7]),
		await lamp('Лампа Вечір', 'підлогова', [9, 12]),
		await lamp('Лампа Ніч', 'настільна', [3])
	]
	for (const id of [lamps.id, desk.id, floor.id, bare]) await publish(request, id)
	const before = await skus(request, products)
	expect(before).toHaveLength(5)
	expect(before.every(row => row.status === 'active')).toBe(true)

	// Without a distribution: refused, nothing written.
	const refused = await request.post(`${API}/categories/${lamps.id}/admin/conversion`, {
		headers: { ...ADMIN, 'Idempotency-Key': crypto.randomUUID() },
		data: { kind: 'group', expected_revision: await revision(request) }
	})
	expect(refused.status()).toBe(409)
	expect((await tree(request)).find(row => row._id === lamps.id)?.kind).toBe('product')
	expect(await skus(request, products)).toEqual(before)

	await page.setExtraHTTPHeaders(ADMIN)
	let wizard = await openWizard(page)
	// A plan that would drop the products' values does not run.
	await wizard.getByLabel('Усі товари й сторінки в').selectOption({ label: 'Без характеристик' })
	await wizard.getByRole('button', { name: 'Призначити всім' }).click()
	await wizard.getByRole('button', { name: 'Перевірити план' }).click()
	await expect(wizard.getByText('План не виконується — виправте:')).toBeVisible()
	await expect(
		wizard.getByRole('button', { name: 'Перетворити на групу', exact: true })
	).toHaveCount(0)

	// An executable plan, then the catalogue changes before it runs: refused at execution.
	await wizard.getByLabel('Усі товари й сторінки в').selectOption({ label: 'Настільні лампи' })
	await wizard.getByRole('button', { name: 'Призначити всім' }).click()
	await wizard
		.getByLabel('Категорія для «Лампа Вечір»')
		.selectOption({ label: 'Підлогові лампи' })
	const planned = page.waitForResponse(
		response =>
			response.url().endsWith(`/categories/${lamps.id}/admin/conversion-plan`) &&
			response.request().method() === 'POST'
	)
	await wizard.getByRole('button', { name: 'Перевірити план' }).click()
	const plan = (await (await planned).json()) as { plan_id: string }
	await expect(wizard).toContainText('3 товари, 5 варіантів')
	const late = await lamp('Лампа Пізня', 'настільна', [4])
	// Added to a published category: a draft until made active.
	await activate(request, late)
	products.push(late)
	// The admin's screen is behind the catalogue: refused, the reason on screen.
	await wizard.getByRole('button', { name: 'Перетворити на групу', exact: true }).click()
	await wizard.getByRole('button', { name: 'Так, перетворити «Світильники» на групу' }).click()
	await expect(
		page.getByText('Каталог уже змінився. Оновіть дерево перед наступною зміною.')
	).toBeVisible()
	// Even at the current revision the stored plan no longer covers the products: refused.
	const stale = await request.post(`${API}/categories/${lamps.id}/admin/conversion`, {
		headers: { ...ADMIN, 'Idempotency-Key': crypto.randomUUID() },
		data: { kind: 'group', plan_id: plan.plan_id, expected_revision: await revision(request) }
	})
	expect(stale.status()).toBe(409)
	expect(await stale.text()).toMatch(/CONVERSION_PLAN_(STALE|CHANGED|BLOCKED)/)
	expect((await tree(request)).find(row => row._id === lamps.id)?.kind).toBe('product')

	// Checked again with the new product: runs, and every SKU keeps its identity and price.
	const current = await skus(request, products)
	wizard = await openWizard(page)
	await wizard.getByLabel('Усі товари й сторінки в').selectOption({ label: 'Настільні лампи' })
	await wizard.getByRole('button', { name: 'Призначити всім' }).click()
	await wizard
		.getByLabel('Категорія для «Лампа Вечір»')
		.selectOption({ label: 'Підлогові лампи' })
	await wizard.getByRole('button', { name: 'Перевірити план' }).click()
	await expect(wizard).toContainText('4 товари, 6 варіантів')
	await wizard.getByRole('button', { name: 'Перетворити на групу', exact: true }).click()
	await wizard.getByRole('button', { name: 'Так, перетворити «Світильники» на групу' }).click()
	await expect.poll(() => kindOf(request, lamps.id), { timeout: 30_000 }).toBe('group')
	const rows = await tree(request)
	expect(rows.find(row => row._id === desk.id)?.parent_id).toBe(lamps.id)
	expect(rows.find(row => row._id === floor.id)?.parent_id).toBe(lamps.id)
	expect(await skus(request, products)).toEqual(current)
	const placed = await Promise.all(products.map(id => typedDraft(request, id)))
	expect(placed.map(draft => (draft as unknown as { category_id: string }).category_id)).toEqual([
		desk.id,
		floor.id,
		desk.id,
		desk.id
	])

	// The shop: the group is a hub (Plan-0010 P20) — its new sub-categories, and its «Новинки»
	// strip carries every one of its products, one card each (owner, 2026-11-14; within a strip of
	// 8); every SKU's address is checked below, unchanged.
	await page.setExtraHTTPHeaders({})
	await expect
		.poll(
			async () => {
				await page.goto('/e2e-lamps')
				return page.locator('#novynky article').count()
			},
			{ timeout: 30_000 }
		)
		.toBe(new Set(current.map(row => row.product)).size)
	const sections = page.getByRole('navigation', { name: 'Розділи: Світильники' })
	await expect(sections.getByRole('link', { name: /Настільні лампи/ })).toHaveAttribute(
		'href',
		'/e2e-desk-lamps'
	)
	await expect(sections.getByRole('link', { name: /Підлогові лампи/ })).toHaveAttribute(
		'href',
		'/e2e-floor-lamps'
	)
	for (const row of current) {
		const response = await page.goto(`/products/${row.slug}`)
		expect(response?.status()).toBe(200)
	}
	await expect(page.getByRole('navigation', { name: 'Хлібні крихти' })).toContainText(
		'Світильники'
	)
})
