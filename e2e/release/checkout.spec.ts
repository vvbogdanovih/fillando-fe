import { expect, test, type Page } from '@playwright/test'
import {
	ADMIN,
	API,
	createProduct,
	feedCategory,
	feedItem,
	feedTag,
	ok,
	publish,
	recordedEmails,
	typedDraft
} from './real-api'

/**
 * Plan-0010 §5 «Товар без варіантів» and «Ціна/акція/наявність» against the real backend (owner
 * decision 31.10.2026): the shopper's path from the listing to a placed order — self-pickup and
 * cash, so no Nova Post or LiqPay — and the same price and availability on the card, the product
 * page, its structured data, the cart, the checkout, the order and the Google feed. The backend
 * records the order emails instead of sending them.
 */

type JsonLd = Record<string, unknown> & { '@type'?: string }

/** Every JSON-LD block of the page, flattened (`@graph` included). */
async function structuredData(page: Page): Promise<JsonLd[]> {
	const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
	return blocks
		.map(text => JSON.parse(text) as JsonLd | JsonLd[])
		.flatMap(data => (Array.isArray(data) ? data : [data]))
		.flatMap(data => (Array.isArray(data['@graph']) ? (data['@graph'] as JsonLd[]) : [data]))
}
const productLd = async (page: Page) =>
	(await structuredData(page)).find(block => block['@type'] === 'Product') as
		| (JsonLd & { offers: JsonLd | JsonLd[] })
		| undefined
const offersOf = (product: { offers: JsonLd | JsonLd[] }) =>
	Array.isArray(product.offers) ? product.offers : [product.offers]
/** «1 250 ₴», «1250,50 ₴» — the storefront's formatting, whatever its spaces. */
const money = (value: number) =>
	new RegExp(
		value
			.toFixed(2)
			.replace(/\.00$/, '')
			.replace('.', ',')
			.replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?')
	)

async function placeOrder(page: Page) {
	await page.getByLabel('ПІБ').fill('Тест Релізу')
	await page.getByLabel('Телефон').fill('+380991234567')
	await page.getByLabel('Email', { exact: true }).fill('release-e2e@example.invalid')
	await page.getByRole('radio', { name: 'Самовивіз', exact: true }).check()
	await page.getByRole('radio', { name: /^Готівка/ }).check()
	const placed = page.waitForResponse(
		response => response.url() === `${API}/orders` && response.request().method() === 'POST'
	)
	await page.getByRole('button', { name: 'Замовити', exact: true }).click()
	const response = await placed
	expect(response.status()).toBe(201)
	await expect(page).toHaveURL(/\/checkout\/success/)
	return (await response.json()) as { _id?: string; id?: string; order_number: string }
}

test('a product without variants: card, page, structured data, cart, checkout and feed', async ({
	page,
	request
}) => {
	const category = await feedCategory(request, {
		name: 'Ковдри',
		slug: 'e2e-blankets',
		parent_id: null
	})
	const productId = await createProduct(request, {
		category_id: category.id,
		name: 'Ковдра вовняна',
		variant_axis: null,
		attributes_v2: [category.brand('Карпатська вовна')],
		variants: [{ variant_value: null, price: 1250, stock: 4 }]
	})
	await publish(request, category.id)
	const [sku] = (await typedDraft(request, productId)).variants
	expect(sku.status).toBe('active')

	await page.goto('/e2e-blankets')
	const card = page.locator('main a[href^="/products/"]').filter({ hasText: 'Ковдра вовняна' })
	await expect(card).toHaveCount(1)
	await expect(card).toContainText(money(1250))
	await expect(card).toHaveAttribute('href', `/products/${sku.slug}`)

	await card.click()
	await expect(page).toHaveURL(new RegExp(`/products/${sku.slug}$`))
	// No axis: no value appended to the name, no variant switcher, no colour anywhere.
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ковдра вовняна')
	await expect(page.getByRole('radiogroup')).toHaveCount(0)
	const product = await productLd(page)
	expect(product).toBeDefined()
	expect(product).not.toHaveProperty('color')
	const offers = offersOf(product!)
	expect(offers).toHaveLength(1)
	expect(offers[0]).toMatchObject({
		price: 1250,
		priceCurrency: 'UAH',
		availability: 'https://schema.org/InStock'
	})
	await expect(page.locator('main')).toContainText(money(1250))

	await page.getByRole('button', { name: /Додати в кошик/ }).click()
	await page.getByRole('button', { name: 'Кошик', exact: true }).click()
	const drawer = page.getByRole('dialog')
	await expect(drawer).toContainText('Ковдра вовняна')
	await expect(drawer).toContainText(money(1250))
	await drawer.getByRole('link', { name: 'Оформити замовлення' }).click()
	await expect(page).toHaveURL(/\/checkout$/)
	await expect(page.locator('form')).toContainText('Ковдра вовняна')
	await expect(page.locator('form')).toContainText(money(1250))

	const order = await placeOrder(page)
	const orderId = order._id ?? order.id
	const stored = await ok<{ items: Record<string, unknown>[]; total_price: number }>(
		await request.get(`${API}/orders/${orderId}`, { headers: ADMIN })
	)
	expect(stored.items).toHaveLength(1)
	expect(stored.items[0]).toMatchObject({ sku: sku.sku, price: 1250, quantity: 1 })
	expect(stored.total_price).toBe(1250)
	const emails = await recordedEmails(request)
	expect(emails.map(email => email.method)).toContain('sendOrderCashConfirmation')
	expect(JSON.stringify(emails)).toContain(order.order_number)

	const item = await feedItem(request, sku.sku)
	expect(feedTag(item, 'g:price')).toBe('1250.00 UAH')
	expect(feedTag(item, 'g:availability')).toBe('in_stock')
	expect(feedTag(item, 'link')).toBe(`http://127.0.0.1:19200/products/${sku.slug}`)
	expect(feedTag(item, 'g:brand')).toBe('Карпатська вовна')
	expect(item).not.toContain('<g:color>')
	expect(item).not.toContain('<g:item_group_id>')
})

test('a promotion and an empty stock: the same price and availability everywhere', async ({
	page,
	request
}) => {
	const category = await feedCategory(
		request,
		{ name: 'Пледи', slug: 'e2e-throws', parent_id: null },
		[{ label: 'Розмір', value_type: 'number', unit: 'см', is_required: true }]
	)
	const ends = new Date(Date.now() + 7 * 86_400_000).toISOString()
	const productId = await createProduct(request, {
		category_id: category.id,
		name: 'Плед флісовий',
		variant_axis: { key: category.keys['Розмір'] },
		attributes_v2: [category.brand('Затишок')],
		variants: [
			{ variant_value: 150, price: 900, stock: 3, promo_percent: 20, promo_ends_at: ends },
			{ variant_value: 200, price: 1100, stock: 0 }
		]
	})
	await publish(request, category.id)
	const variants = (await typedDraft(request, productId)).variants
	const onPromo = variants.find(row => row.variant_value === 150)!
	const empty = variants.find(row => row.variant_value === 200)!

	// The product page decides the shopper's price; every other place must say the same.
	await page.goto(`/products/${onPromo.slug}`)
	const offer = offersOf((await productLd(page))!)[0] as { price: number; availability: string }
	expect(offer).toMatchObject({ price: 720, availability: 'https://schema.org/InStock' })
	const main = page.locator('main')
	await expect(main).toContainText(money(720))
	await expect(main).toContainText(money(900))

	await page.goto('/e2e-throws')
	const card = page.locator(`main a[href="/products/${onPromo.slug}"]`)
	await expect(card).toContainText(money(720))
	await expect(card).toContainText(money(900))

	await page.goto(`/products/${empty.slug}`)
	expect(offersOf((await productLd(page))!)[0]).toMatchObject({
		price: 1100,
		availability: 'https://schema.org/OutOfStock'
	})
	await expect(page.getByRole('button', { name: /Додати в кошик/ })).toHaveCount(0)

	await page.goto(`/products/${onPromo.slug}`)
	await page.getByRole('button', { name: /Додати в кошик/ }).click()
	await page.getByRole('button', { name: 'Кошик', exact: true }).click()
	const drawer = page.getByRole('dialog')
	await expect(drawer).toContainText(money(720))
	await drawer.getByRole('link', { name: 'Оформити замовлення' }).click()
	await expect(page.locator('form')).toContainText(money(720))
	const order = await placeOrder(page)
	const stored = await ok<{ items: Record<string, unknown>[]; total_price: number }>(
		await request.get(`${API}/orders/${order._id ?? order.id}`, { headers: ADMIN })
	)
	expect(stored.items[0]).toMatchObject({ sku: onPromo.sku, price: 720, quantity: 1 })
	expect(stored.total_price).toBe(720)

	const promoItem = await feedItem(request, onPromo.sku)
	expect(feedTag(promoItem, 'g:price')).toBe('900.00 UAH')
	expect(feedTag(promoItem, 'g:sale_price')).toBe('720.00 UAH')
	expect(feedTag(promoItem, 'g:availability')).toBe('in_stock')
	expect(feedTag(promoItem, 'g:item_group_id')).not.toBeNull()
	const emptyItem = await feedItem(request, empty.sku)
	expect(feedTag(emptyItem, 'g:price')).toBe('1100.00 UAH')
	expect(feedTag(emptyItem, 'g:availability')).toBe('out_of_stock')
	expect(emptyItem).not.toContain('<g:sale_price>')
})
