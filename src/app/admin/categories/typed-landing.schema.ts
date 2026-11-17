import '@/common/lib/zod-locale'
import * as z from 'zod'

const id = z.string().regex(/^[a-f0-9]{24}$/)
const scalar = z.union([z.string(), z.number(), z.boolean()])
/** The catalogue `filters` object a typed landing pins (`filters_v2`). */
export const typedPinsSchema = z.object({
	attributes: z
		.array(
			z.union([
				z.object({ key: z.string(), values: z.array(scalar) }),
				z.object({
					key: z.string(),
					min: z.number().optional(),
					max: z.number().optional()
				})
			])
		)
		.default([]),
	category_ids: z.array(z.string()).default([]),
	brand_ids: z.array(z.string()).default([]),
	color_families: z.array(z.string()).default([]),
	price: z.object({ min: z.number().optional(), max: z.number().optional() }).optional()
})
export type TypedPins = z.infer<typeof typedPinsSchema>
const faqSchema = z.object({ q: z.string(), a: z.string() })
export const typedLandingSchema = z.object({
	_id: id,
	category_id: id,
	slug: z.string(),
	h1: z.string(),
	title: z.string(),
	meta_description: z.string(),
	intro_html: z.string(),
	bottom_html: z.string(),
	faq: z.array(faqSchema),
	filters_v2: typedPinsSchema.nullable(),
	contract_version: z.number().nullable(),
	image: z.string().nullable(),
	order: z.number(),
	status: z.enum(['draft', 'active']),
	product_count: z.number().int().nonnegative()
})
export type TypedLanding = z.infer<typeof typedLandingSchema>
export const typedLandingListSchema = z.object({
	category_id: id,
	revision: z.number().int().nonnegative(),
	items: z.array(typedLandingSchema),
	/** The server lists at most 500 landings of a category (P06); an older one never says. */
	truncated: z.boolean().default(false)
})
export const typedLandingBodySchema = z.object({
	expected_revision: z.number().int().nonnegative().safe(),
	slug: z
		.string()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		.max(200),
	h1: z.string().trim().min(1).max(300),
	title: z.string().trim().min(1).max(300),
	meta_description: z.string().trim().min(1).max(1000),
	intro_html: z.string().max(100000),
	bottom_html: z.string().max(200000),
	faq: z.array(z.object({ q: z.string().trim().min(1), a: z.string().trim().min(1) })).max(50),
	filters_v2: typedPinsSchema,
	image: z.string().url().nullable(),
	order: z.number().int().nonnegative(),
	status: z.enum(['draft', 'active'])
})
export type TypedLandingBody = z.infer<typeof typedLandingBodySchema>
export const typedLandingReceiptSchema = z.object({
	operation_id: z.string().uuid(),
	revision: z.number().int().nonnegative(),
	landing_id: id
})
