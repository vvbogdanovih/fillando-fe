import { test, expect } from '@playwright/test'

/** The rehearsal API and storefront of `playwright.categories.config.ts` (its two web servers). */
const API = 'http://127.0.0.1:19101'
const STOREFRONT = 'http://127.0.0.1:19100'

test('creates nested categories, renames and moves a draft through the real API, then recovers a lost response', async ({
	page,
	request
}) => {
	const before = await (
		await request.get(`${API}/categories/admin/tree`, {
			headers: { 'x-test-role': 'ADMIN' }
		})
	).json()
	await page.setExtraHTTPHeaders({ 'x-test-role': 'ADMIN' })
	await page.goto('/admin/categories')
	await page.getByRole('button', { name: 'Створити категорію', exact: true }).click()
	await page.getByLabel('Назва', { exact: true }).fill('Автоматика')
	await page.getByLabel('Адреса (slug)', { exact: false }).fill('automation')
	await page.getByLabel('Батьківська група').selectOption('000000000000000000000001')
	await page.getByRole('button', { name: 'Створити чернетку' }).click()
	await expect(page.getByRole('button', { name: /^Автоматика/ })).toBeVisible()
	await page.getByRole('button', { name: 'Створити категорію', exact: true }).click()
	await page.getByLabel('Назва', { exact: true }).fill('Автомати вводу резерву')
	await page.getByLabel('Адреса (slug)', { exact: false }).fill('automatic-transfer-switches')
	await page.getByLabel('Тип категорії').selectOption('product')
	const parentOption = page
		.getByLabel('Батьківська група')
		.locator('option')
		.filter({ hasText: 'Автоматика' })
	await page
		.getByLabel('Батьківська група')
		.selectOption((await parentOption.getAttribute('value'))!)
	await page.getByRole('button', { name: 'Створити чернетку' }).click()
	await expect(page.getByRole('button', { name: /^Автомати вводу резерву/ })).toContainText(
		'рівень 3'
	)
	await page.getByLabel('Назва', { exact: true }).fill('АВР для будинку')
	await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
	await expect(page.getByRole('button', { name: /^АВР для будинку/ })).toBeVisible()
	await page.getByLabel('Батьківська група').selectOption('000000000000000000000002')
	await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
	await expect(page.getByRole('button', { name: /^АВР для будинку/ })).toContainText('рівень 2')
	await expect(page.getByText('Адреса: /automatic-transfer-switches')).toBeVisible()
	// Apply on the real server, then lose only the browser acknowledgement.
	await page.route('**/categories/*/admin/details', async route => {
		await route.fetch()
		await route.abort('connectionfailed')
	})
	await page.getByLabel('Назва', { exact: true }).fill('АВР для дому')
	await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
	await expect(page.getByRole('button', { name: 'Перевірити стан операції' })).toBeVisible()
	await page.reload()
	await page.getByRole('button', { name: 'Перевірити стан операції' }).click()
	await expect(page.getByText('Операцію виконано. Дерево оновлено.')).toBeVisible()
	await expect(page.getByRole('button', { name: /^АВР для дому/ })).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Створити категорію', exact: true })
	).toBeEnabled()
	const snapshot = await request.get(`${API}/categories/admin/tree`, {
		headers: { 'x-test-role': 'ADMIN' }
	})
	const body = await snapshot.json()
	expect(body.revision).toBe(before.revision + 5)
	expect(body.items).toHaveLength(before.items.length + 2)
	expect(
		body.items.find((item: { slug: string }) => item.slug === 'automatic-transfer-switches')
	).toMatchObject({
		name: 'АВР для дому',
		parent_id: '000000000000000000000002',
		status: 'draft'
	})
	await page.getByRole('button', { name: /^АВР для дому/ }).click()
	await page.screenshot({ path: '/tmp/fillando-category-workspace-desktop.png', fullPage: true })
	await page.setViewportSize({ width: 390, height: 844 })
	await expect
		.poll(() =>
			page.locator('aside').evaluate(element => element.getBoundingClientRect().right)
		)
		.toBeLessThanOrEqual(0)
	await page.screenshot({ path: '/tmp/fillando-category-workspace-mobile.png', fullPage: true })
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
	).toBe(true)
})

test('configures independent attributes and verifies actual numeric/boolean SKU filters', async ({
	page,
	request
}) => {
	await page.setExtraHTTPHeaders({ 'x-test-role': 'ADMIN' })
	await page.goto('/admin/categories')
	await page.getByRole('button', { name: /^Приклад АВР/ }).click()
	await page.getByText('Перевірити фільтри на товарах', { exact: true }).click()
	await page.getByLabel('Номінальний струм: від').fill('20')
	await page.getByLabel('Номінальний струм: до').fill('40')
	await page.getByRole('checkbox', { name: 'Ні', exact: true }).check()
	await page.getByRole('button', { name: 'Перевірити на товарах' }).click()
	await expect(page.getByText('Знайдено варіантів: 1. Товарів: 1.')).toBeVisible()
	await expect(page.getByText('Номінальний струм: 16 — 63 А', { exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Створити категорію', exact: true }).click()
	await page.getByLabel('Назва', { exact: true }).fill('Автомати для офісу')
	await page.getByLabel('Адреса (slug)', { exact: false }).fill('office-switches')
	await page.getByLabel('Тип категорії').selectOption('product')
	await page.getByRole('button', { name: 'Створити чернетку' }).click()
	await page.getByLabel('Скопіювати з категорії').selectOption('000000000000000000000003')
	await page.getByRole('button', { name: 'Замінити налаштування копією' }).click()
	// One line per characteristic; «Редагувати» unfolds its form (owner, 2026-11-04).
	const characteristics = page.getByRole('list', { name: 'Список характеристик' })
	await expect(characteristics.getByRole('listitem')).toHaveCount(3)
	await characteristics
		.getByRole('button', { name: /^Редагувати / })
		.first()
		.click()
	const first = page.getByRole('group', { name: 'Характеристика 1' })
	await first.getByLabel('Назва', { exact: true }).fill('Струм навантаження')
	const saved = page.waitForResponse(
		response =>
			response.url().endsWith('/admin/definitions') && response.request().method() === 'PATCH'
	)
	await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
	expect((await saved).status()).toBe(200)
	await expect(page.getByRole('button', { name: 'Перевірити стан операції' })).toHaveCount(0)
	// Nothing unsaved: the header's «Зберегти» is gone (owner, 2026-11-09).
	await expect(page.getByRole('button', { name: 'Зберегти', exact: true })).toHaveCount(0)
	await page.reload()
	await page.getByRole('button', { name: /^Автомати для офісу/ }).click()
	await characteristics.getByRole('button', { name: 'Редагувати Струм навантаження' }).click()
	await expect(first.getByLabel('Назва', { exact: true })).toHaveValue('Струм навантаження')
	const tree = await (
		await request.get(`${API}/categories/admin/tree`, {
			headers: { 'x-test-role': 'ADMIN' }
		})
	).json()
	const target = tree.items.find((item: { slug: string }) => item.slug === 'office-switches')
	const configuration = await (
		await request.get(`${API}/categories/${target._id}/admin/configuration`, {
			headers: { 'x-test-role': 'ADMIN' }
		})
	).json()
	expect(configuration.definitions[0].key).not.toBe('current')
	expect(configuration.definitions[2].options[0].id).not.toBe('four')
	expect(configuration.controls.filters).toHaveLength(3)
	await page
		.getByRole('heading', { name: 'Характеристики та фільтри', exact: true })
		.evaluate(element => element.scrollIntoView({ block: 'start' }))
	await page.screenshot({
		path: '/tmp/fillando-category-definitions-desktop.png',
		fullPage: true
	})
	await page.setViewportSize({ width: 390, height: 844 })
	await expect
		.poll(() =>
			page.locator('aside').evaluate(element => element.getBoundingClientRect().right)
		)
		.toBeLessThanOrEqual(0)
	const editor = page.getByRole('region', { name: 'Характеристики категорії' })
	await expect
		.poll(() => editor.evaluate(element => element.scrollWidth <= element.clientWidth))
		.toBe(true)
	await page
		.getByRole('heading', { name: 'Характеристики та фільтри', exact: true })
		.evaluate(element => element.scrollIntoView({ block: 'start' }))
	await page.screenshot({ path: '/tmp/fillando-category-definitions-mobile.png', fullPage: true })
})

test('edits typed product values from category definitions and preserves variant URLs', async ({
	page,
	request
}) => {
	await page.setExtraHTTPHeaders({ 'x-test-role': 'ADMIN' })
	await page.goto('/admin/categories')
	await page.getByRole('button', { name: /^Приклад АВР/ }).click()
	// Products are edited on the «Товари» screen; the category page links there (2026-11-05).
	await page.getByRole('link', { name: 'Товари цієї категорії →', exact: true }).click()
	await page.waitForURL(/\/admin\/products\?category=/)
	await page.getByRole('button', { name: 'АВР тестовий', exact: true }).click()
	await page.getByLabel('Назва товару', { exact: true }).fill('АВР універсальний')
	await page
		.getByRole('combobox', { name: 'Автоматичний режим 1', exact: true })
		.selectOption('false')
	const saved = page.waitForResponse(
		response =>
			response.url().endsWith('/admin/typed-draft') && response.request().method() === 'PATCH'
	)
	// One «Зберегти» in the product's header (owner, 2026-11-09).
	await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
	const response = await saved
	expect(response.status()).toBe(200)
	const receipt = await response.json()
	await expect(
		page.getByText('Зміни збережено. Чернетка ще не опублікована у магазині.')
	).toBeVisible()
	// The SKU's own value is edited in its window, as in the old admin (owner request 02.11.2026).
	await page.getByRole('button', { name: 'Редагувати FL-TEST-0', exact: true }).click()
	await page.getByRole('dialog').getByLabel('Варіант FL-TEST-0', { exact: true }).fill('0')
	const valueSaved = page.waitForResponse(
		r => r.url().endsWith('/admin/typed-draft') && r.request().method() === 'PATCH'
	)
	await page.getByRole('button', { name: 'Зберегти варіант', exact: true }).click()
	expect((await valueSaved).status()).toBe(200)
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await page.reload()
	await page.getByRole('button', { name: 'АВР універсальний', exact: true }).click()
	await page.getByRole('button', { name: 'Редагувати FL-TEST-0', exact: true }).click()
	await expect(
		page.getByRole('dialog').getByLabel('Варіант FL-TEST-0', { exact: true })
	).toHaveValue('0')
	await page.keyboard.press('Escape')
	await expect(
		page.getByRole('combobox', { name: 'Автоматичний режим 1', exact: true })
	).toHaveValue('false')
	const result = await (
		await request.get(`${API}/products/${receipt.product_id}/admin/typed-draft`, {
			headers: { 'x-test-role': 'ADMIN' }
		})
	).json()
	expect(result.variants.find((row: { sku: string }) => row.sku === 'FL-TEST-0')).toMatchObject({
		name: 'АВР універсальний — 0 А',
		slug: 'avr-fixture-0',
		variant_value: 0
	})
	await page.setViewportSize({ width: 390, height: 844 })
	await expect
		.poll(() =>
			page.locator('aside').evaluate(element => element.getBoundingClientRect().right)
		)
		.toBeLessThanOrEqual(0)
	const form = page.getByRole('form', { name: 'Характеристики товару' })
	await expect
		.poll(() => form.evaluate(element => element.scrollWidth <= element.clientWidth))
		.toBe(true)
	await form.evaluate(element => element.scrollIntoView({ block: 'start' }))
	await page.screenshot({ path: '/tmp/fillando-typed-product-mobile.png', fullPage: true })
})

test('creates typed draft variants and recovers a lost creation response without duplicates', async ({
	page,
	request
}) => {
	await page.setExtraHTTPHeaders({ 'x-test-role': 'ADMIN' })
	await page.goto('/admin/categories')
	await page.getByRole('button', { name: /^Приклад АВР/ }).click()
	// Products are edited on the «Товари» screen; the category page links there (2026-11-05).
	await page.getByRole('link', { name: 'Товари цієї категорії →', exact: true }).click()
	await page.waitForURL(/\/admin\/products\?category=/)
	await page.getByRole('button', { name: 'Створити товар', exact: true }).click()
	await page
		.getByRole('combobox', { name: 'Постачальник', exact: true })
		.selectOption('000000000000000000000010')
	await page.getByLabel('Назва товару', { exact: true }).fill('Автомат резерву тест')
	await page
		.getByRole('combobox', { name: 'Вісь варіантів', exact: true })
		.selectOption('current')
	await page
		.getByRole('combobox', { name: 'Автоматичний режим 1', exact: true })
		.selectOption('false')
	await page.getByLabel('Номінальний струм, А · варіант 1', { exact: true }).fill('0')
	await page.getByLabel('Ціна, грн · варіант 1', { exact: true }).fill('1500')
	await page
		.getByRole('form', { name: 'Новий товар' })
		.getByRole('button', { name: 'Додати варіант', exact: true })
		.click()
	await page.getByLabel('Номінальний струм, А · варіант 2', { exact: true }).fill('32')
	await page.getByLabel('Ціна, грн · варіант 2', { exact: true }).fill('2000')
	await page.getByLabel('Залишок · варіант 2', { exact: true }).fill('5')
	await page.setViewportSize({ width: 390, height: 844 })
	await expect
		.poll(() =>
			page.locator('aside').evaluate(element => element.getBoundingClientRect().right)
		)
		.toBeLessThanOrEqual(0)
	const form = page.getByRole('form', { name: 'Новий товар' })
	await expect
		.poll(() => form.evaluate(element => element.scrollWidth <= element.clientWidth))
		.toBe(true)
	await page.screenshot({ path: '/tmp/fillando-create-product-mobile.png', fullPage: true })
	let receipt: { product_id: string } | undefined
	let sent: unknown
	await page.route('**/products/admin/typed-drafts', async route => {
		if (route.request().method() !== 'POST') return route.continue()
		sent = route.request().postDataJSON()
		const response = await route.fetch()
		expect(response.status()).toBe(201)
		receipt = await response.json()
		await route.abort('connectionfailed')
	})
	await page.getByRole('button', { name: 'Створити чернетку товару', exact: true }).click()
	await expect(page.getByRole('button', { name: 'Перевірити стан операції' })).toBeVisible()
	expect(sent).toMatchObject({
		variants: [
			{ variant_value: 0, price: 1500, stock: 0 },
			{ variant_value: 32, price: 2000, stock: 5 }
		]
	})
	await page.reload()
	await page.getByRole('button', { name: 'Перевірити стан операції' }).click()
	await expect(page.getByText('Операцію виконано. Дерево оновлено.')).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Автомат резерву тест', exact: true })
	).toHaveCount(1)
	await page.getByRole('button', { name: 'Автомат резерву тест', exact: true }).click()
	const result = await (
		await request.get(`${API}/products/${receipt!.product_id}/admin/typed-draft`, {
			headers: { 'x-test-role': 'ADMIN' }
		})
	).json()
	expect(result.variants).toHaveLength(2)
	expect(result.variants.map((row: { slug: string }) => row.slug).sort()).toEqual([
		'avtomat-rezervu-test-0-a',
		'avtomat-rezervu-test-32-a'
	])
	expect(result.variants.every((row: { sku: string }) => /^FL-\d{6}$/.test(row.sku))).toBe(true)
	await expect(
		page.getByRole('combobox', { name: 'Автоматичний режим 1', exact: true })
	).toHaveValue('false')
})

test('edits description, price, stock and shipping weight through the real draft API', async ({
	page,
	request
}) => {
	await page.setExtraHTTPHeaders({ 'x-test-role': 'ADMIN' })
	await page.goto('/admin/categories')
	await page.getByRole('button', { name: /^Приклад АВР/ }).click()
	// Products are edited on the «Товари» screen; the category page links there (2026-11-05).
	await page.getByRole('link', { name: 'Товари цієї категорії →', exact: true }).click()
	await page.waitForURL(/\/admin\/products\?category=/)
	await page.getByRole('button', { name: 'Автомат резерву тест', exact: true }).click()
	// The description has its own card; a SKU's price, stock and weight are edited in its window.
	const editor = page.getByRole('region', { name: 'Опис товару', exact: true })
	await editor.locator('.ql-editor').fill('Автомат резерву для дому. Тестовий опис.')
	const saved = page.waitForResponse(
		r => r.url().endsWith('/admin/typed-draft') && r.request().method() === 'PATCH'
	)
	await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
	const response = await saved
	expect(response.status()).toBe(200)
	const receipt = await response.json()
	await expect(
		page.getByText('Зміни збережено. Чернетка ще не опублікована у магазині.')
	).toBeVisible()
	await page
		.getByRole('button', { name: /^Редагувати FL-/ })
		.first()
		.click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('Ціна, грн', { exact: true }).fill('1750.25')
	await dialog.getByLabel('Залишок', { exact: true }).fill('7')
	await dialog.getByLabel('Вага для пошти, г', { exact: true }).fill('1200')
	const priced = page.waitForResponse(
		r => r.url().endsWith('/admin/typed-draft') && r.request().method() === 'PATCH'
	)
	await dialog.getByRole('button', { name: 'Зберегти варіант', exact: true }).click()
	expect((await priced).status()).toBe(200)
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await page.reload()
	await page.getByRole('button', { name: 'Автомат резерву тест', exact: true }).click()
	await expect(editor.locator('.ql-editor')).toContainText('Автомат резерву для дому')
	const variants = page.getByRole('region', { name: 'Варіанти', exact: true })
	await expect(variants.getByRole('row').nth(1)).toContainText('1750.25 ₴')
	await page
		.getByRole('button', { name: /^Редагувати FL-/ })
		.first()
		.click()
	await expect(page.getByRole('dialog').getByLabel('Ціна, грн', { exact: true })).toHaveValue(
		'1750.25'
	)
	await page.keyboard.press('Escape')
	const result = await (
		await request.get(`${API}/products/${receipt.product_id}/admin/typed-draft`, {
			headers: { 'x-test-role': 'ADMIN' }
		})
	).json()
	expect(result.details.variants[0]).toMatchObject({ price: 1750.25, stock: 7, weight_g: 1200 })
	expect(result.variants.map((row: { slug: string }) => row.slug).sort()).toEqual([
		'avtomat-rezervu-test-0-a',
		'avtomat-rezervu-test-32-a'
	])
	await page.setViewportSize({ width: 390, height: 844 })
	await expect
		.poll(() =>
			page.locator('aside').evaluate(element => element.getBoundingClientRect().right)
		)
		.toBeLessThanOrEqual(0)
	for (const region of [editor, variants])
		await expect
			.poll(() => region.evaluate(element => element.scrollWidth <= element.clientWidth))
			.toBe(true)
	await editor.scrollIntoViewIfNeeded()
	await page.screenshot({ path: '/tmp/fillando-product-details-mobile.png' })
})

test('uses Products for typed editing, adds, archives and restores a variant with a stable deep link', async ({
	page,
	request
}) => {
	await page.setExtraHTTPHeaders({ 'x-test-role': 'ADMIN' })
	await page.goto('/admin/products')
	await expect(page.getByRole('heading', { name: 'Товари каталогу', exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Створити категорію', exact: true })).toHaveCount(
		0
	)
	// The categories are a folded filter over the product list (owner, 2026-11-03).
	await page.getByRole('button', { name: /^Категорія:/ }).click()
	await page.getByRole('button', { name: /^Приклад АВР/ }).click()
	await page.getByRole('button', { name: 'Автомат резерву тест', exact: true }).click()
	const editor = page.getByRole('region', { name: 'Варіанти', exact: true })
	await editor.getByRole('button', { name: 'Додати варіант', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('Значення нового варіанта', { exact: true }).fill('63')
	await dialog.getByLabel('Ціна нового варіанта, грн', { exact: true }).fill('2500')
	await dialog.getByLabel('Залишок нового варіанта', { exact: true }).fill('3')
	const saved = page.waitForResponse(
		r => r.url().endsWith('/admin/typed-draft') && r.request().method() === 'PATCH'
	)
	await dialog.getByRole('button', { name: 'Створити новий варіант', exact: true }).click()
	const response = await saved
	expect(response.status()).toBe(200)
	const receipt = await response.json()
	await expect(
		page.getByText('Зміни збережено. Чернетка ще не опублікована у магазині.')
	).toBeVisible()
	await page.goto(`/admin/products/${receipt.product_id}/edit`)
	const read = async () =>
		await (
			await request.get(`${API}/products/${receipt.product_id}/admin/typed-draft`, {
				headers: { 'x-test-role': 'ADMIN' }
			})
		).json()
	const before = await read()
	expect(before.readiness.data_ready).toBe(false)
	expect(before.readiness.issues).toEqual(
		expect.arrayContaining([expect.objectContaining({ code: 'IMAGE_REQUIRED' })])
	)
	await expect(
		page.getByRole('region', { name: 'Готовність даних товару', exact: true })
	).toContainText('Додайте фото варіанта')
	const added = before.variants.find((row: { variant_value: number }) => row.variant_value === 63)
	expect(added).toMatchObject({ slug: 'avtomat-rezervu-test-63-a', status: 'draft' })
	await editor.getByRole('button', { name: `Архівувати ${added.sku}`, exact: true }).click()
	await expect(
		editor.getByRole('button', { name: `Відновити ${added.sku}`, exact: true })
	).toBeVisible()
	expect(
		(await read()).variants.find((row: { id: string }) => row.id === added.id)
	).toMatchObject({ ...added, status: 'archived' })
	await editor.getByRole('button', { name: `Відновити ${added.sku}`, exact: true }).click()
	await expect(
		editor.getByRole('button', { name: `Архівувати ${added.sku}`, exact: true })
	).toBeVisible()
	const after = await read()
	expect(after.variants).toEqual(before.variants)
	expect(after.details.variants).toEqual(before.details.variants)
	await page.reload()
	await expect(
		editor.getByRole('button', { name: `Архівувати ${added.sku}`, exact: true })
	).toBeVisible()
})

test('publishes a ready typed product through the admin and shows it in the storefront with URL filters', async ({
	page,
	request
}) => {
	const headers = { 'x-test-role': 'ADMIN' }
	const list = await (
		await request.get(
			`${API}/products/admin/typed-drafts?category_id=000000000000000000000003`,
			{ headers }
		)
	).json()
	const fixture = list.items.find((item: { name: string }) => item.name === 'АВР універсальний') // renamed above
	const draft = await (
		await request.get(`${API}/products/${fixture.id}/admin/typed-draft`, { headers })
	).json()
	// Fill only what the shop's readiness check requires: description, photo and price.
	const saved = await request.patch(`${API}/products/${fixture.id}/admin/typed-draft`, {
		headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
		data: {
			expected_revision: draft.revision,
			name: draft.name,
			attributes_v2: draft.attributes_v2,
			variant_axis: draft.variant_axis,
			variants: draft.variants.map((row: { id: string; variant_value: unknown }) => ({
				id: row.id,
				variant_value: row.variant_value
			})),
			details: {
				token: draft.details.token,
				description: { html: '<p>Тестовий АВР для вітрини.</p>', json: {} },
				variants: draft.details.variants.map((row: object) => ({
					...row,
					images: [`${STOREFRONT}/Fillando-logo.png`]
				}))
			}
		}
	})
	expect(saved.status()).toBe(200)

	await page.setExtraHTTPHeaders(headers)
	await page.goto('/admin/categories')
	await page.getByRole('button', { name: /^Електротовари/ }).click()
	await page.getByRole('button', { name: 'Опублікувати', exact: true }).click()
	await expect(page.getByText(/^Опубліковано\./)).toBeVisible()
	await page.getByRole('button', { name: /^Приклад АВР/ }).click()
	await page.getByRole('button', { name: 'Опублікувати', exact: true }).click()
	await expect(page.getByText(/Варіантів відкрито покупцям: [1-9]/)).toBeVisible()

	await page.goto('/example-avr')
	await expect(page.getByRole('heading', { level: 1, name: 'Приклад АВР' })).toBeVisible()
	const trail = page.getByRole('navigation', { name: 'Хлібні крихти' })
	await expect(trail).toContainText('Каталог')
	await expect(trail).toContainText('Електротовари')
	const aside = page.locator('aside')
	// The range has a two-thumb slider and two fields with the same names; type into the fields.
	await aside.getByRole('textbox', { name: 'Номінальний струм: від' }).fill('30')
	const upTo = aside.getByRole('textbox', { name: 'Номінальний струм: до' })
	await upTo.fill('40')
	// No «Застосувати» (owner, 2026-11-14): typed bounds apply on Enter or on leaving the pair.
	await expect(aside.getByRole('button', { name: 'Застосувати' })).toHaveCount(0)
	await upTo.press('Enter')
	await expect(page).toHaveURL(/f\.current\.min=30&f\.current\.max=40/)
	const cards = page.locator('main a[href^="/products/"]').filter({ hasText: 'А' })
	await expect(cards.first()).toContainText('32 А')
	for (const text of await cards.allTextContents()) expect(text).toContain('32 А')
	await page.reload()
	await expect(
		page.getByRole('button', { name: /Прибрати фільтр Номінальний струм/ })
	).toBeVisible()

	await cards.first().click()
	await expect(page).toHaveURL(/\/products\//)
	await expect(page.getByRole('heading', { level: 1 })).toContainText('32 А')
	await expect(page.getByRole('navigation', { name: 'Хлібні крихти' })).toContainText(
		'Приклад АВР'
	)
	await page.goto('/group-1')
	await expect(page.getByRole('link', { name: /Приклад АВР/ }).first()).toBeVisible()
	const status = await request.get(`${STOREFRONT}/example-avr?bogus=1`)
	// A real status, not a streamed soft-404 (no loading.tsx on these routes).
	expect(status.status()).toBe(404)
})
