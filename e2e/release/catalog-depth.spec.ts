import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
	ADMIN,
	API,
	createCategory,
	createProduct,
	defaultBrand,
	largeMenu,
	ok,
	publish,
	purgesSettled,
	storefrontHtml,
	typedDraft
} from './real-api'

/**
 * Plan-0010 §5 «Категорія на 5+ рівні» (owner decision 31.10.2026): a category at level 5 is
 * created and moved in the admin panel, reached through the header menu — the whole tree in a
 * small catalogue, branch by branch in a large one — and its breadcrumbs, visible and structured,
 * follow it to level 6. Nothing in the code knows a level number.
 */

type TreeRow = { _id: string; slug: string; name: string }

async function idOf(request: APIRequestContext, slug: string) {
	const tree = await ok<{ items: TreeRow[] }>(
		await request.get(`${API}/categories/admin/tree?limit=1000`, { headers: ADMIN })
	)
	const row = tree.items.find(item => item.slug === slug)
	if (!row) throw Error(`No category ${slug}`)
	return row._id
}

/** The admin selects use ids; pick the option by its visible name. */
async function selectParent(page: Page, name: string) {
	const parent = page.getByLabel('Батьківська група')
	const option = parent.locator('option').filter({ hasText: ` ${name} (рівень` })
	await parent.selectOption((await option.getAttribute('value'))!)
}

async function createInAdmin(
	page: Page,
	input: { name: string; slug: string; kind: 'group' | 'product'; parent: string | null }
) {
	await page.getByRole('button', { name: 'Створити категорію', exact: true }).click()
	await page.getByLabel('Назва', { exact: true }).fill(input.name)
	await page.getByLabel('Адреса (slug)', { exact: false }).fill(input.slug)
	await page.getByLabel('Тип категорії').selectOption(input.kind)
	if (input.parent) await selectParent(page, input.parent)
	await page.getByRole('button', { name: 'Створити чернетку' }).click()
	await expect(
		page.getByRole('button', { name: new RegExp(`^${input.name}`) }).first()
	).toBeVisible()
}

/** Visible breadcrumbs, in order, and the names of the structured `BreadcrumbList`. */
async function crumbs(page: Page) {
	const trail = page.getByRole('navigation', { name: 'Хлібні крихти' })
	const visible = (await trail.innerText())
		.split('/')
		.map(text => text.trim())
		.filter(Boolean)
	const structured = (await page.locator('script[type="application/ld+json"]').allTextContents())
		.map(text => JSON.parse(text) as { '@type'?: string; itemListElement?: { name: string }[] })
		.find(data => data['@type'] === 'BreadcrumbList')
	return { visible, structured: structured?.itemListElement?.map(item => item.name) ?? [] }
}

const LEVELS = ['Рівень 1', 'Рівень 2', 'Рівень 3', 'Рівень 4', 'Рівень 5']

test('a level-5 category: created and moved in the admin, in the menu and breadcrumbs', async ({
	page,
	request
}) => {
	await page.setExtraHTTPHeaders(ADMIN)
	await page.goto('/admin/categories')
	for (const [index, name] of LEVELS.entries())
		await createInAdmin(page, {
			name,
			slug: `e2e-level-${index + 1}`,
			kind: index === 4 ? 'product' : 'group',
			parent: index ? LEVELS[index - 1] : null
		})
	await expect(page.getByRole('button', { name: /^Рівень 5/ })).toContainText('рівень 5')

	const ids = await Promise.all(LEVELS.map((_, index) => idOf(request, `e2e-level-${index + 1}`)))
	const productId = await createProduct(request, {
		category_id: ids[4],
		name: 'Товар п’ятого рівня',
		variant_axis: null,
		attributes_v2: [(await defaultBrand(request, ids[4]))('Глибина')],
		variants: [{ variant_value: null, price: 300, stock: 2 }]
	})
	for (const id of ids) await publish(request, id)
	const [sku] = (await typedDraft(request, productId)).variants

	// A shopper: the header menu down to level 5, then the category's breadcrumbs.
	await page.setExtraHTTPHeaders({})
	await page.goto('/')
	await page.getByRole('button', { name: 'Категорії каталогу' }).click()
	await page.getByRole('link', { name: 'Рівень 5', exact: true }).click()
	await expect(page).toHaveURL(/\/e2e-level-5$/)
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Рівень 5')
	expect(await crumbs(page)).toEqual({
		visible: ['Головна', 'Каталог', ...LEVELS],
		structured: ['Головна', 'Каталог', ...LEVELS]
	})
	await page.goto(`/products/${sku.slug}`)
	expect(await crumbs(page)).toEqual({
		visible: ['Головна', 'Каталог', ...LEVELS, 'Товар п’ятого рівня'],
		structured: ['Головна', 'Каталог', ...LEVELS, 'Товар п’ятого рівня']
	})

	// The admin moves level 3 (with levels 4 and 5) under a new published level-3 group.
	await page.setExtraHTTPHeaders(ADMIN)
	await page.goto('/admin/categories')
	await createInAdmin(page, {
		name: 'Проміжна група',
		slug: 'e2e-level-between',
		kind: 'group',
		parent: 'Рівень 2'
	})
	await publish(request, await idOf(request, 'e2e-level-between'))
	await page.reload()
	await page.getByRole('button', { name: /^Рівень 3/ }).click()
	await selectParent(page, 'Проміжна група')
	await page.getByRole('button', { name: 'Зберегти', exact: true }).click()
	await expect(page.getByRole('button', { name: /^Рівень 5/ })).toContainText('рівень 6')

	// The same addresses, the new path: the move purges the storefront's category cache.
	await page.setExtraHTTPHeaders({})
	const moved = [
		'Головна',
		'Каталог',
		'Рівень 1',
		'Рівень 2',
		'Проміжна група',
		'Рівень 3',
		'Рівень 4'
	]
	await expect
		.poll(
			async () => {
				await page.goto('/e2e-level-5')
				return (await crumbs(page)).visible
			},
			{ timeout: 30_000 }
		)
		.toEqual([...moved, 'Рівень 5'])
	expect((await crumbs(page)).structured).toEqual([...moved, 'Рівень 5'])
	const product = await page.goto(`/products/${sku.slug}`)
	expect(product?.status()).toBe(200)
	expect((await crumbs(page)).visible).toEqual([...moved, 'Рівень 5', 'Товар п’ятого рівня'])
	await storefrontHtml(request, '/', html => html.includes('Проміжна група'))
	await page.goto('/')
	await page.getByRole('button', { name: 'Категорії каталогу' }).click()
	const between = page
		.getByRole('listitem')
		.filter({ has: page.getByRole('link', { name: 'Проміжна група', exact: true }) })
	await expect(between.getByRole('link', { name: 'Рівень 5', exact: true })).toBeVisible()
})

test('a large catalogue: the menu opens a level-5 branch on demand', async ({ page, request }) => {
	const names = ['Лінива 1', 'Лінива 2', 'Лінива 3', 'Лінива 4', 'Лінива 5']
	const ids: string[] = []
	for (const [index, name] of names.entries())
		ids.push(
			await createCategory(request, {
				name,
				slug: `e2e-lazy-${index + 1}`,
				kind: index === 4 ? 'product' : 'group',
				parent_id: index ? ids[index - 1] : null
			})
		)
	await createProduct(request, {
		category_id: ids[4],
		name: 'Товар лінивої гілки',
		variant_axis: null,
		attributes_v2: [(await defaultBrand(request, ids[4]))('Лінь')],
		variants: [{ variant_value: null, price: 150, stock: 1 }]
	})
	for (const id of ids) await publish(request, id)
	await purgesSettled(request)
	await storefrontHtml(request, '/', html => html.includes('Лінива 1'))

	await largeMenu(request, true)
	try {
		// Over 150 links: the page carries roots and their sub-categories, deeper ones load on demand.
		await expect
			.poll(
				async () => {
					await page.goto('/')
					// The closed panel is hidden, so count the element, not the accessible link.
					return page.locator('a', { hasText: /^Усі \(121\)/ }).count()
				},
				{ timeout: 30_000 }
			)
			.toBe(1)
		const html = await (await request.get('http://127.0.0.1:19200/')).text()
		expect(html).toContain('Лінива 2')
		expect(html).not.toContain('Лінива 3')

		await page.getByRole('button', { name: 'Категорії каталогу' }).click()
		for (const name of names.slice(1, 4)) {
			await page.getByRole('button', { name: `Показати підкатегорії: ${name}` }).click()
			await expect(page.getByRole('button', { name: `Згорнути: ${name}` })).toHaveAttribute(
				'aria-expanded',
				'true'
			)
		}
		await page.getByRole('link', { name: 'Лінива 5', exact: true }).click()
		await expect(page).toHaveURL(/\/e2e-lazy-5$/)
		expect((await crumbs(page)).visible).toEqual(['Головна', 'Каталог', ...names])
	} finally {
		await largeMenu(request, false)
	}
})
