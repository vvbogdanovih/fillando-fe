import {
	typedProductBodySchema,
	typedProductCreateBodySchema,
	type TypedProductCreateBody,
	typedProductReadSchema,
	typedProductPageSchema,
	typedProductReceiptSchema,
	typedProductTransferBodySchema,
	typedProductTransferReceiptSchema,
	transferPreviewSchema,
	type TypedProductBody,
	type TypedProductTransferBody
} from './typed-product.schema'
import {
	categorySeoBodySchema,
	categorySeoReadSchema,
	type CategorySeoBody
} from './category-seo.schema'
import {
	categoryExportBodySchema,
	categoryExportReadSchema,
	type CategoryExportBody
} from './category-export.schema'
import {
	typedLandingBodySchema,
	typedLandingListSchema,
	typedLandingReceiptSchema,
	type TypedLandingBody
} from './typed-landing.schema'
import {
	configurationSchema,
	definitionUsageSchema,
	definitionsInputSchema,
	type DefinitionInput
} from './category-definitions.schema'
import '@/common/lib/zod-locale'
import * as z from 'zod'
import { httpService } from '@/common/services/http.service'
import { API_URLS, CATEGORY_TREE_PAGE_MAX } from '@/common/constants'

const id = z.string().regex(/^[a-f0-9]{24}$/)
export const treeItemSchema = z.object({
	_id: id,
	parent_id: id.nullable(),
	name: z.string(),
	slug: z.string(),
	kind: z.enum(['group', 'product']),
	status: z.enum(['draft', 'active', 'archived']),
	order: z.number().int().nonnegative(),
	attribute_contract_version: z.union([z.literal(1), z.literal(2)]),
	/** Tile image (admin tree only); older backends omit it. */
	image: z.string().nullable().optional()
})
const pageSchema = z.object({
	revision: z.number().int().nonnegative(),
	items: z.array(treeItemSchema),
	next_cursor: z.string().nullable()
})
const capabilitiesSchema = z.object({
	draft_writes_enabled: z.boolean(),
	legacy_writes_enabled: z.boolean()
})
const receiptSchema = z.object({
	operation_id: z.string().uuid(),
	revision: z.number().int().nonnegative(),
	category_id: id
})
/** A slug change answers without an entity id: the caller knows what it changed. */
const routeReceiptSchema = z.object({
	operation_id: z.string().uuid(),
	revision: z.number().int().nonnegative()
})
const operationSchema = z.object({
	operation_id: z.string().uuid(),
	status: z.enum([
		'pending',
		'completed',
		'rejected',
		'aborted',
		'rolled_back',
		'recovery_required'
	]),
	result_revision: z.number().nullable(),
	error_code: z.string().nullable()
})
/** Receipt of a publication; counts are null on a replayed key (the first answer was lost). */
export const publicationReceiptSchema = receiptSchema.extend({
	action: z.enum(['publish', 'unpublish']),
	changed_variants: z.number().int().nonnegative().nullable(),
	skipped_products: z
		.array(z.object({ id, name: z.string(), issues: z.array(z.string()) }))
		.nullable()
})
export type PublicationReceipt = z.infer<typeof publicationReceiptSchema>
export type TreeItem = z.infer<typeof treeItemSchema>
export type TreeSnapshot = { revision: number; items: TreeItem[] }
export type CategoryCommand =
	| { type: 'product-create'; body: TypedProductCreateBody }
	| { type: 'product'; id: string; body: TypedProductBody }
	| { type: 'transfer'; id: string; body: TypedProductTransferBody }
	| { type: 'product-delete'; id: string; body: { expected_revision: number } }
	| {
			type: 'definitions'
			id: string
			body: { expected_revision: number; definitions: DefinitionInput[] }
	  }
	| {
			type: 'create'
			body: {
				name: string
				slug: string
				kind: 'group' | 'product'
				parent_id: string | null
				order: number
				expected_revision: number
			}
	  }
	| {
			type: 'details'
			id: string
			body: { name: string; image?: string | null; expected_revision: number }
	  }
	| {
			type: 'publication'
			id: string
			body: { action: 'publish' | 'unpublish'; expected_revision: number }
	  }
	| {
			type: 'move'
			id: string
			body: { parent_id: string | null; order: number; expected_revision: number }
	  }
	| { type: 'delete'; id: string; body: { expected_revision: number } }
	| { type: 'seo'; id: string; body: CategorySeoBody }
	| { type: 'export'; id: string; body: CategoryExportBody }
	| {
			type: 'slug'
			target: 'variants' | 'categories' | 'landings'
			id: string
			body: { slug: string; expected_revision: number }
	  }
	| { type: 'landing-create'; body: TypedLandingBody & { category_id: string } }
	| { type: 'landing-update'; id: string; body: TypedLandingBody }
	| { type: 'landing-delete'; id: string; body: { expected_revision: number } }
	| {
			type: 'convert'
			id: string
			body: { kind: 'group' | 'product'; expected_revision: number; plan_id?: string }
	  }
const revisionSchema = z.number().int().nonnegative().safe()
const placementSchema = z.object({
	parent_id: id.nullable(),
	order: revisionSchema,
	expected_revision: revisionSchema
})
export const pendingCategoryCommandSchema = z.object({
	key: z.string().uuid(),
	command: z.discriminatedUnion('type', [
		z.object({ type: z.literal('product-create'), body: typedProductCreateBodySchema }),
		z.object({ type: z.literal('product'), id, body: typedProductBodySchema }),
		z.object({ type: z.literal('transfer'), id, body: typedProductTransferBodySchema }),
		z.object({
			type: z.literal('product-delete'),
			id,
			body: z.object({ expected_revision: revisionSchema })
		}),
		z.object({
			type: z.literal('definitions'),
			id,
			body: z.object({
				expected_revision: revisionSchema,
				definitions: definitionsInputSchema
			})
		}),
		z.object({
			type: z.literal('create'),
			body: placementSchema.extend({
				name: z.string().trim().min(1).max(200),
				slug: z
					.string()
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
					.max(200),
				kind: z.enum(['group', 'product'])
			})
		}),
		z.object({
			type: z.literal('details'),
			id,
			body: z.object({
				name: z.string().trim().min(1).max(200),
				image: z.string().url().max(2000).nullable().optional(),
				expected_revision: revisionSchema
			})
		}),
		z.object({
			type: z.literal('publication'),
			id,
			body: z.object({
				action: z.enum(['publish', 'unpublish']),
				expected_revision: revisionSchema
			})
		}),
		z.object({ type: z.literal('move'), id, body: placementSchema }),
		z.object({
			type: z.literal('delete'),
			id,
			body: z.object({ expected_revision: revisionSchema })
		}),
		z.object({
			type: z.literal('landing-create'),
			body: typedLandingBodySchema.extend({ category_id: id })
		}),
		z.object({ type: z.literal('landing-update'), id, body: typedLandingBodySchema }),
		z.object({ type: z.literal('seo'), id, body: categorySeoBodySchema }),
		z.object({ type: z.literal('export'), id, body: categoryExportBodySchema }),
		z.object({
			type: z.literal('slug'),
			target: z.enum(['variants', 'categories', 'landings']),
			id,
			body: z.object({
				slug: z
					.string()
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
					.max(200),
				expected_revision: revisionSchema
			})
		}),
		z.object({
			type: z.literal('landing-delete'),
			id,
			body: z.object({ expected_revision: revisionSchema })
		}),
		z.object({
			type: z.literal('convert'),
			id,
			body: z.object({
				kind: z.enum(['group', 'product']),
				expected_revision: revisionSchema,
				plan_id: z.string().uuid().optional()
			})
		})
	])
})
/** A product category → group distribution as the server checked it (TD-0013 mutations §5). */
export const conversionPlanSchema = z.object({
	plan_id: z.string().uuid().nullable(),
	category_id: id,
	revision: revisionSchema,
	executable: z.boolean(),
	counts: z.object({
		products: z.number(),
		variants: z.number(),
		landings: z.number(),
		targets: z.number(),
		variants_to_draft: z.number(),
		routes: z.number(),
		patches: z.number()
	}),
	products: z.array(
		z.object({
			product_id: id,
			name: z.string(),
			target_category_id: id,
			mapped: z.number(),
			variants: z.number()
		})
	),
	landings: z.array(
		z.object({
			landing_id: id,
			slug: z.string(),
			status: z.string(),
			target_category_id: id,
			from_path: z.string(),
			to_path: z.string()
		})
	),
	problems: z.array(
		z.object({
			code: z.string(),
			product_id: id.optional(),
			landing_id: id.optional(),
			target_category_id: id.optional(),
			dropped: z
				.array(z.object({ key: z.string(), label: z.string(), value_label: z.string() }))
				.optional(),
			missing_required: z.array(z.string()).optional(),
			detail: z.string().optional(),
			/** CONVERSION_PLAN_TOO_LARGE: the most one operation holds (the server's journal). */
			limit: z.number().int().positive().optional()
		})
	),
	warnings: z.array(
		z.object({
			code: z.string(),
			landing_id: id.optional(),
			target_category_id: id.optional(),
			count: z.number().optional()
		})
	)
})
export type ConversionPlan = z.infer<typeof conversionPlanSchema>
export type ConversionPlanBody = {
	target_kind: 'group'
	assignments: { product_id: string; target_category_id: string }[]
	landing_assignments: { landing_id: string; target_category_id: string }[]
	adopt_targets: boolean
}
export type PendingCategoryCommand = z.infer<typeof pendingCategoryCommandSchema>
export const filterPreviewSchema = z.object({
	category_id: z.string(),
	revision: z.number().int().nonnegative(),
	total_variants: z.number().int().nonnegative(),
	total_products: z.number().int().nonnegative(),
	sample_variant_ids: z.array(z.string()).max(50),
	facets: z.array(
		z.object({
			key: z.string(),
			values: z.array(
				z.object({
					value: z.union([z.string(), z.number(), z.boolean()]),
					count: z.number().int().nonnegative()
				})
			),
			min: z.number().nullable(),
			max: z.number().nullable()
		})
	)
})
export type FilterPreview = z.infer<typeof filterPreviewSchema>
export type PreviewFilter =
	| { key: string; values: (string | number | boolean)[] }
	| { key: string; min?: number; max?: number }
export const categoryTreeApi = {
	typedProduct: (id: string) =>
		httpService.get(API_URLS.PRODUCTS.TYPED_DRAFT(id), {
			schema: typedProductReadSchema,
			skipErrorToast: true
		}),
	transferPreview: (productId: string, target_category_id: string) =>
		httpService.get(API_URLS.PRODUCTS.TYPED_TRANSFER(productId), {
			params: { target_category_id },
			schema: transferPreviewSchema,
			skipErrorToast: true
		}),
	typedProducts: (category_id: string, cursor?: string) =>
		httpService.get(API_URLS.PRODUCTS.TYPED_DRAFT_LIST, {
			params: { category_id, ...(cursor ? { cursor } : {}) },
			schema: typedProductPageSchema,
			skipErrorToast: true
		}),
	/** The products screen: a numbered page of 25 and a name search over the whole category. */
	typedProductPage: (category_id: string, page: number, q?: string) =>
		httpService.get(API_URLS.PRODUCTS.TYPED_DRAFT_LIST, {
			params: { category_id, page: String(page), ...(q ? { q } : {}) },
			schema: typedProductPageSchema,
			skipErrorToast: true
		}),
	filterPreview: (id: string, attributes: PreviewFilter[]) =>
		httpService.post(
			API_URLS.CATEGORIES.ADMIN_FILTER_PREVIEW(id),
			{ attributes },
			{ schema: filterPreviewSchema, skipErrorToast: true }
		),
	categoryExport: (id: string) =>
		httpService.get(API_URLS.CATEGORIES.ADMIN_EXPORT(id), {
			schema: categoryExportReadSchema,
			skipErrorToast: true
		}),
	categorySeo: (id: string) =>
		httpService.get(API_URLS.CATEGORIES.ADMIN_SEO(id), {
			schema: categorySeoReadSchema,
			skipErrorToast: true
		}),
	conversionPlan: (categoryId: string, body: ConversionPlanBody) =>
		httpService.post(API_URLS.CATEGORIES.ADMIN_CONVERSION_PLAN(categoryId), body, {
			schema: conversionPlanSchema,
			skipErrorToast: true
		}),
	typedLandings: (category_id: string) =>
		httpService.get(API_URLS.LANDINGS.TYPED_ADMIN, {
			params: { category_id },
			schema: typedLandingListSchema,
			skipErrorToast: true
		}),
	definitionUsage: (id: string) =>
		httpService.get(API_URLS.CATEGORIES.ADMIN_DEFINITION_USAGE(id), {
			schema: definitionUsageSchema,
			skipErrorToast: true
		}),
	configuration: (id: string) =>
		httpService.get(API_URLS.CATEGORIES.ADMIN_CONFIGURATION(id), {
			schema: configurationSchema,
			skipErrorToast: true
		}),
	capabilities: () =>
		httpService.get(API_URLS.CATEGORIES.ADMIN_CAPABILITIES, {
			schema: capabilitiesSchema,
			skipErrorToast: true
		}),
	async tree(): Promise<TreeSnapshot> {
		const items: TreeItem[] = [],
			cursors = new Set<string>(),
			ids = new Set<string>()
		let revision: number | undefined,
			cursor: string | null = null
		do {
			const page: z.infer<typeof pageSchema> = await httpService.get(
				API_URLS.CATEGORIES.ADMIN_TREE,
				{
					params: { limit: CATEGORY_TREE_PAGE_MAX, ...(cursor ? { cursor } : {}) },
					schema: pageSchema,
					skipErrorToast: true
				}
			)
			if (revision !== undefined && revision !== page.revision)
				throw Error('Дерево змінилося. Оновіть список.')
			revision = page.revision
			for (const item of page.items) {
				if (ids.has(item._id))
					throw Error('Список категорій містить повтори. Оновіть його.')
				ids.add(item._id)
				items.push(item)
			}
			cursor = page.next_cursor
			if (cursor && cursors.has(cursor)) throw Error('Не вдалося завантажити повне дерево.')
			if (cursor) cursors.add(cursor)
		} while (cursor)
		return { revision: revision!, items }
	},
	execute({ key, command }: PendingCategoryCommand) {
		if (command.type === 'product-create')
			return httpService.post(API_URLS.PRODUCTS.TYPED_DRAFT_LIST, command.body, {
				headers: { 'Idempotency-Key': key },
				schema: typedProductReceiptSchema,
				skipErrorToast: true
			})
		if (command.type === 'transfer')
			return httpService.post(API_URLS.PRODUCTS.TYPED_TRANSFER(command.id), command.body, {
				headers: { 'Idempotency-Key': key },
				schema: typedProductTransferReceiptSchema,
				skipErrorToast: true
			})
		if (command.type === 'product-delete')
			return httpService.post(API_URLS.PRODUCTS.TYPED_DELETION(command.id), command.body, {
				headers: { 'Idempotency-Key': key },
				schema: typedProductReceiptSchema,
				skipErrorToast: true
			})
		if (command.type === 'product')
			return httpService.patch(API_URLS.PRODUCTS.TYPED_DRAFT(command.id), command.body, {
				headers: { 'Idempotency-Key': key },
				schema: typedProductReceiptSchema,
				skipErrorToast: true
			})
		const config = {
			headers: { 'Idempotency-Key': key },
			schema: receiptSchema,
			skipErrorToast: true
		}
		if (command.type === 'create')
			return httpService.post(API_URLS.CATEGORIES.DRAFT_CREATE, command.body, config)
		if (command.type === 'slug')
			return httpService.post(
				API_URLS.ROUTES.SLUG_CHANGE(command.target, command.id),
				command.body,
				{
					...config,
					schema: routeReceiptSchema
				}
			)
		if (command.type === 'export')
			return httpService.patch(
				API_URLS.CATEGORIES.ADMIN_EXPORT(command.id),
				command.body,
				config
			)
		if (command.type === 'seo')
			return httpService.patch(
				API_URLS.CATEGORIES.ADMIN_SEO(command.id),
				command.body,
				config
			)
		if (command.type === 'landing-create')
			return httpService.post(API_URLS.LANDINGS.TYPED_ADMIN, command.body, {
				...config,
				schema: typedLandingReceiptSchema
			})
		if (command.type === 'landing-update')
			return httpService.patch(API_URLS.LANDINGS.TYPED_ADMIN_ITEM(command.id), command.body, {
				...config,
				schema: typedLandingReceiptSchema
			})
		if (command.type === 'landing-delete')
			return httpService.post(
				API_URLS.LANDINGS.TYPED_ADMIN_DELETION(command.id),
				command.body,
				{ ...config, schema: typedLandingReceiptSchema }
			)
		if (command.type === 'delete')
			return httpService.post(
				API_URLS.CATEGORIES.DRAFT_DELETION(command.id),
				command.body,
				config
			)
		if (command.type === 'convert')
			return httpService.post(
				API_URLS.CATEGORIES.DRAFT_CONVERSION(command.id),
				command.body,
				config
			)
		if (command.type === 'publication')
			return httpService.post(
				API_URLS.CATEGORIES.ADMIN_PUBLICATION(command.id),
				command.body,
				{
					...config,
					schema: publicationReceiptSchema
				}
			)
		return httpService.patch(
			command.type === 'definitions'
				? API_URLS.CATEGORIES.ADMIN_DEFINITIONS(command.id)
				: command.type === 'details'
					? API_URLS.CATEGORIES.ADMIN_DETAILS(command.id)
					: API_URLS.CATEGORIES.DRAFT_PLACEMENT(command.id),
			command.body,
			config
		)
	},
	status: (key: string) =>
		httpService.get(API_URLS.CATEGORIES.OPERATION(key), {
			schema: operationSchema,
			skipErrorToast: true
		})
}
