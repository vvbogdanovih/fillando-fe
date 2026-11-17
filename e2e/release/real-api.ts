import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'

/**
 * The release rehearsal's backend (fillando-be `test/release-e2e-server.ts`): the whole API on a
 * disposable database, admin by the `x-test-role` header. Fixtures go through the same admin
 * endpoints the admin panel calls, so they hold what a real edit would.
 */
export const API = 'http://127.0.0.1:19201'
export const ADMIN = { 'x-test-role': 'ADMIN' } as const
/** A photo the shop's readiness check accepts (served by the storefront itself). */
export const PHOTO = 'http://127.0.0.1:19200/Fillando-logo.png'
const VENDOR = '000000000000000000000010'

const keyed = () => ({ ...ADMIN, 'Idempotency-Key': crypto.randomUUID() })

export async function ok<T>(response: APIResponse): Promise<T> {
	if (!response.ok())
		throw Error(`${response.url()} → ${response.status()} ${await response.text()}`)
	return (await response.json()) as T
}

/** The catalogue revision every admin write is checked against. */
export async function revision(request: APIRequestContext) {
	return (
		await ok<{ revision: number }>(
			await request.get(`${API}/categories/admin/tree?limit=1`, { headers: ADMIN })
		)
	).revision
}

export async function createCategory(
	request: APIRequestContext,
	body: { name: string; slug: string; kind: 'group' | 'product'; parent_id: string | null }
) {
	const receipt = await ok<{ category_id: string }>(
		await request.post(`${API}/categories/drafts`, {
			headers: keyed(),
			data: { order: 0, ...body, expected_revision: await revision(request) }
		})
	)
	return receipt.category_id
}

type Definition = {
	label: string
	is_required?: boolean
	semantic?: 'generic' | 'brand' | 'material' | 'size' | 'color'
	value_type?: 'string' | 'number' | 'boolean' | 'enum'
	unit?: string | null
	filter_type?: 'multi-select' | 'range' | null
	options?: { label: string; order: number }[]
}

/**
 * Sets a product category's characteristics; returns the keys the server created, by label. The
 * Google feed takes the brand from the characteristic marked «Бренд» (owner, 2026-11-05) — an item
 * without one is left out — and a variation axis must be a required characteristic (2026-11-06).
 */
export async function defineCharacteristics(
	request: APIRequestContext,
	categoryId: string,
	definitions: Definition[]
) {
	await ok(
		await request.patch(`${API}/categories/${categoryId}/admin/definitions`, {
			headers: keyed(),
			data: {
				expected_revision: await revision(request),
				definitions: definitions.map((definition, order) => ({
					value_type: 'string',
					unit: null,
					is_required: false,
					filter_enabled: !!definition.filter_type,
					filter_type: null,
					visible_in_specs: true,
					multiple: false,
					semantic: 'generic',
					options: [],
					...definition,
					order
				}))
			}
		})
	)
	return definitionKeys(request, categoryId)
}

/** The keys of a category's characteristics, by label. */
async function definitionKeys(request: APIRequestContext, categoryId: string) {
	const configuration = await ok<{ definitions: { key: string; label: string }[] }>(
		await request.get(`${API}/categories/${categoryId}/admin/configuration`, {
			headers: ADMIN
		})
	)
	return Object.fromEntries(configuration.definitions.map(row => [row.label, row.key]))
}

/**
 * A new product category starts with «Виробник» — brand, required (owner, 2026-11-09): a product
 * without its value never goes on sale, and its branch never reaches the menu. Returns the value
 * builder for `attributes_v2`.
 */
export async function defaultBrand(request: APIRequestContext, categoryId: string) {
	const key = (await definitionKeys(request, categoryId))['Виробник']
	return (value: string) => ({ k: key, v: value })
}

/**
 * A product category with «Виробник» marked «Бренд» and required — what a new category starts with
 * (owner, 2026-11-09) — so its products are feed items; returns its id and keys.
 */
export async function feedCategory(
	request: APIRequestContext,
	body: { name: string; slug: string; parent_id: string | null },
	definitions: Definition[] = []
) {
	const id = await createCategory(request, { ...body, kind: 'product' })
	const keys = await defineCharacteristics(request, id, [
		{ label: 'Виробник', semantic: 'brand', is_required: true },
		...definitions
	])
	return { id, keys, brand: (value: string) => ({ k: keys['Виробник'], v: value }) }
}

export async function publish(request: APIRequestContext, categoryId: string) {
	return ok<{ changed_variants?: number | null }>(
		await request.post(`${API}/categories/${categoryId}/admin/publication`, {
			headers: keyed(),
			data: { action: 'publish', expected_revision: await revision(request) }
		})
	)
}

export type SeedVariant = {
	variant_value: string | number | boolean | null
	price: number
	stock: number
	promo_percent?: number
	promo_ends_at?: string
}
type TypedDraft = {
	revision: number
	name: string
	attributes_v2: unknown[]
	variant_axis: unknown
	variants: { id: string; sku: string; slug: string; variant_value: unknown; status: string }[]
	details: {
		token: string
		variants: ({ id: string; price: number } & Record<string, unknown>)[]
	}
}

export async function typedDraft(request: APIRequestContext, productId: string) {
	return ok<TypedDraft>(
		await request.get(`${API}/products/${productId}/admin/typed-draft`, { headers: ADMIN })
	)
}

/** Saves the product's card: description, photo, prices, stock, promotion (TD-0012). */
export async function saveDetails(
	request: APIRequestContext,
	productId: string,
	variants: (row: Record<string, unknown>, variantValue: unknown) => Record<string, unknown>
) {
	const draft = await typedDraft(request, productId)
	const valueOf = (id: string) => draft.variants.find(row => row.id === id)?.variant_value
	return ok<{ product_id: string }>(
		await request.patch(`${API}/products/${productId}/admin/typed-draft`, {
			headers: keyed(),
			data: {
				expected_revision: draft.revision,
				name: draft.name,
				attributes_v2: draft.attributes_v2,
				variant_axis: draft.variant_axis,
				variants: draft.variants.map(row => ({
					id: row.id,
					variant_value: row.variant_value
				})),
				details: {
					token: draft.details.token,
					description: {
						html: `<p>${draft.name}: опис для перевірки релізу.</p>`,
						json: {}
					},
					variants: draft.details.variants.map(row => variants(row, valueOf(row.id)))
				}
			}
		})
	)
}

/**
 * A typed product with its card filled as the shop's readiness check asks — description, photo,
 * price — so publishing its category opens it to shoppers.
 */
export async function createProduct(
	request: APIRequestContext,
	input: {
		category_id: string
		name: string
		variant_axis: { key: string } | null
		attributes_v2?: { k: string; v: unknown }[]
		variants: SeedVariant[]
	}
) {
	const { product_id } = await ok<{ product_id: string }>(
		await request.post(`${API}/products/admin/typed-drafts`, {
			headers: keyed(),
			data: {
				expected_revision: await revision(request),
				category_id: input.category_id,
				vendor_id: VENDOR,
				name: input.name,
				attributes_v2: input.attributes_v2 ?? [],
				variant_axis: input.variant_axis,
				variants: input.variants.map(({ variant_value, price, stock }) => ({
					variant_value,
					price,
					stock
				}))
			}
		})
	)
	await saveDetails(request, product_id, (row, value) => {
		const seed = input.variants.find(variant => variant.variant_value === value)
		return {
			...row,
			images: [PHOTO],
			...(seed?.promo_percent
				? { promo_percent: seed.promo_percent, promo_ends_at: seed.promo_ends_at ?? null }
				: {})
		}
	})
	return product_id
}

/**
 * Opens a product's draft SKUs to shoppers. A product added to a category that is already published
 * is a draft until it is complete and made active (owner, 2026-11-15) — publishing the category is
 * what opens the ones created before it.
 */
export async function activate(request: APIRequestContext, productId: string) {
	const drafts = (await typedDraft(request, productId)).variants.filter(
		row => row.status === 'draft'
	)
	for (const { id } of drafts) {
		const draft = await typedDraft(request, productId)
		await ok<{ product_id: string }>(
			await request.patch(`${API}/products/${productId}/admin/typed-draft`, {
				headers: keyed(),
				data: {
					expected_revision: draft.revision,
					name: draft.name,
					attributes_v2: draft.attributes_v2,
					variant_axis: draft.variant_axis,
					variants: draft.variants.map(row => ({
						id: row.id,
						variant_value: row.variant_value
					})),
					variant_action: { type: 'status', id, status: 'active' }
				}
			})
		)
	}
}

/** The Google feed's `<item>` of one SKU, once the feed has been rebuilt to satisfy `ready`. */
export async function feedItem(
	request: APIRequestContext,
	sku: string,
	ready: (item: string) => boolean = () => true
) {
	let found = ''
	await expect
		.poll(
			async () => {
				const response = await request.get(`${API}/feeds/google-shopping.xml`)
				if (!response.ok()) return false
				const item = (await response.text())
					.split('<item>')
					.slice(1)
					.map(row => row.split('</item>')[0])
					.find(row => row.includes(`<g:id>${sku}</g:id>`))
				found = item ?? ''
				return !!item && ready(item)
			},
			{ timeout: 60_000, intervals: [1000, 2000, 5000] }
		)
		.toBe(true)
	return found
}

/** One tag of a feed item, e.g. `tag(item, 'g:price')` → `1750.25 UAH`. */
export const feedTag = (item: string, name: string) =>
	item.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null

export type RecordedEmail = { method: string; args: unknown[] }
export async function recordedEmails(request: APIRequestContext) {
	return ok<RecordedEmail[]>(await request.get(`${API}/__e2e/emails`))
}

export async function holdPurges(request: APIRequestContext, hold: boolean) {
	await ok(await request.post(`${API}/__e2e/purges/hold`, { data: { hold } }))
}
export async function purges(request: APIRequestContext) {
	return ok<{
		held: boolean
		pending: number
		purges: { resource: string; trigger: string; at: string }[]
	}>(await request.get(`${API}/__e2e/purges`))
}

/**
 * Waits until the backend's purge outbox owes nothing — every requested purge delivered and its
 * echo sent 10 s later (P12/P15) — so an earlier save cannot purge in the middle of a later check.
 * The last request must also be a second old: it reaches the outbox just after it is recorded.
 */
export async function purgesSettled(request: APIRequestContext) {
	await expect
		.poll(
			async () => {
				const state = await purges(request)
				const last = state.purges.at(-1)
				return state.pending === 0 && (!last || Date.now() - Date.parse(last.at) > 1000)
			},
			{ timeout: 60_000, intervals: [1000] }
		)
		.toBe(true)
}

/**
 * Waits until the storefront's server HTML of `path` (no browser cache, no client refetch) passes
 * `check` — the purges of the preceding writes have landed and the page re-rendered with them.
 */
export async function storefrontHtml(
	request: APIRequestContext,
	path: string,
	check: (html: string) => boolean
) {
	let html = ''
	await expect
		.poll(
			async () => {
				html = await (await request.get(`http://127.0.0.1:19200${path}`)).text()
				return check(html)
			},
			{ timeout: 30_000, intervals: [1000, 2000] }
		)
		.toBe(true)
	return html
}

/** 151 one-SKU categories on or off: above 150 links the header menu loads deeper levels lazily. */
export async function largeMenu(request: APIRequestContext, on: boolean) {
	await ok(await request.post(`${API}/__e2e/large-menu`, { data: { on } }))
}
