import { expect, test, type Browser } from '@playwright/test'
import {
	createProduct,
	feedCategory,
	feedItem,
	feedTag,
	holdPurges,
	publish,
	purges,
	purgesSettled,
	saveDetails,
	typedDraft
} from './real-api'

/**
 * Plan-0010 §5 «Ціна/акція/наявність» — cache invalidation (owner decision 31.10.2026): an admin
 * price change reaches the product card, the product page, its structured data and the Google
 * feed, all equal, through the storefront purge the backend sends. The control: while the purge
 * is held the production build keeps serving the old price, so the test does depend on the purge.
 *
 * Read with JavaScript off: the server's HTML — what Google and Merchant read, and what the
 * purge refreshes. A shopper's product page also re-reads the API after hydration (React Query),
 * so its live DOM is not a cache probe.
 */

async function shown(browser: Browser, slug: string) {
	const context = await browser.newContext({
		baseURL: 'http://127.0.0.1:19200',
		javaScriptEnabled: false
	})
	const page = await context.newPage()
	await page.goto(`/products/${slug}`)
	const product = (await page.locator('script[type="application/ld+json"]').allTextContents())
		.map(text => JSON.parse(text) as { '@type'?: string; offers?: { price: number } })
		.find(data => data['@type'] === 'Product')
	await page.goto('/e2e-torches')
	const card = await page.locator(`main a[href="/products/${slug}"]`).innerText()
	await context.close()
	return { structured: product?.offers?.price, card: card.replace(/\s/g, '') }
}

test('an admin price change: card, page, structured data and feed equal after the purge', async ({
	browser,
	page,
	request
}) => {
	const category = await feedCategory(request, {
		name: 'Ліхтарі',
		slug: 'e2e-torches',
		parent_id: null
	})
	const productId = await createProduct(request, {
		category_id: category.id,
		name: 'Ліхтар кишеньковий',
		variant_axis: null,
		attributes_v2: [category.brand('Промінь')],
		variants: [{ variant_value: null, price: 500, stock: 5 }]
	})
	await publish(request, category.id)
	const [sku] = (await typedDraft(request, productId)).variants
	// Every purge of the set-up has landed, and the pages are cached at the first price.
	await purgesSettled(request)
	await expect
		.poll(async () => (await shown(browser, sku.slug)).structured, { timeout: 30_000 })
		.toBe(500)
	expect(feedTag(await feedItem(request, sku.sku), 'g:price')).toBe('500.00 UAH')

	await holdPurges(request, true)
	try {
		const before = (await purges(request)).purges.length
		await saveDetails(request, productId, row => ({ ...row, price: 650 }))
		const requested = (await purges(request)).purges.slice(before)
		expect(requested).toContainEqual(
			expect.objectContaining({
				resource: 'products',
				trigger: expect.stringMatching(/edit/)
			})
		)
		// The feed is rebuilt by the backend itself; the storefront still has the old price cached.
		expect(
			feedTag(
				await feedItem(request, sku.sku, item => feedTag(item, 'g:price') === '650.00 UAH'),
				'g:price'
			)
		).toBe('650.00 UAH')
		const stale = await shown(browser, sku.slug)
		expect(stale.structured).toBe(500)
		expect(stale.card).toContain('500')
	} finally {
		await holdPurges(request, false)
	}

	await expect
		.poll(async () => (await shown(browser, sku.slug)).structured, { timeout: 30_000 })
		.toBe(650)
	const fresh = await shown(browser, sku.slug)
	expect(fresh.card).toContain('650')
	expect(fresh.card).not.toContain('500')
	await page.goto(`/products/${sku.slug}`)
	await expect(page.locator('main')).toContainText(/650/)
	expect(feedTag(await feedItem(request, sku.sku), 'g:price')).toBe('650.00 UAH')
})
