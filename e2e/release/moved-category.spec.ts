import { expect, test } from '@playwright/test'
import {
	ADMIN,
	API,
	createCategory,
	createProduct,
	defineCharacteristics,
	ok,
	publish,
	purgesSettled,
	revision
} from './real-api'

/**
 * An old address of a moved category is one hop to its final page (P03, owner decision
 * 02.11.2026; SEO matrix «Старий URL — один hop до 200»): a filter equal to a landing goes straight
 * to the landing with its attribution, a page past the end is a 404 at the old address.
 */
const STOREFRONT = 'http://127.0.0.1:19200'
const keyed = () => ({ ...ADMIN, 'Idempotency-Key': crypto.randomUUID() })

test('a moved category with a landing filter: one permanent redirect to the landing', async ({
	request
}) => {
	const category = await createCategory(request, {
		name: 'Тарілки',
		slug: 'e2e-plates',
		kind: 'product',
		parent_id: null
	})
	const keys = await defineCharacteristics(request, category, [
		{ label: 'Виробник' },
		{ label: 'Матеріал', filter_type: 'multi-select' }
	])
	const material = keys['Матеріал']
	await createProduct(request, {
		category_id: category,
		name: 'Тарілка скляна',
		variant_axis: null,
		attributes_v2: [
			{ k: keys['Виробник'], v: 'Посуд Україна' },
			{ k: material, v: 'Скло' }
		],
		variants: [{ variant_value: null, price: 220, stock: 6 }]
	})
	await publish(request, category)
	await ok(
		await request.post(`${API}/landings/admin/typed`, {
			headers: keyed(),
			data: {
				expected_revision: await revision(request),
				category_id: category,
				slug: 'glass',
				h1: 'Скляні тарілки',
				title: 'Скляні тарілки — купити',
				meta_description: 'Скляні тарілки з доставкою',
				filters_v2: { attributes: [{ key: material, values: ['Скло'] }] },
				status: 'active'
			}
		})
	)
	await ok(
		await request.post(`${API}/routes/categories/${category}/slug-change`, {
			headers: keyed(),
			data: { expected_revision: await revision(request), slug: 'e2e-dishes' }
		})
	)
	await purgesSettled(request)

	const at = (path: string) => request.get(`${STOREFRONT}${path}`, { maxRedirects: 0 })
	const landing = await at(`/e2e-plates?f.${material}=${encodeURIComponent('Скло')}&gclid=abc`)
	expect(landing.status()).toBe(308)
	expect(landing.headers().location).toBe('/e2e-dishes/glass?gclid=abc')
	expect((await at(landing.headers().location)).status()).toBe(200)

	const plain = await at('/e2e-plates?gclid=abc')
	expect(plain.status()).toBe(308)
	expect(plain.headers().location).toBe('/e2e-dishes?gclid=abc')

	expect((await at('/e2e-plates?page=99')).status()).toBe(404)
})
