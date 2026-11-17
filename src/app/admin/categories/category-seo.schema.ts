import '@/common/lib/zod-locale'
import * as z from 'zod'

const nullableText = z.string().nullable()
export const categorySeoSchema = z.object({
	title: nullableText,
	description: nullableText,
	h1: nullableText,
	intro_html: nullableText,
	bottom_html: nullableText
})
export type CategorySeo = z.infer<typeof categorySeoSchema>
export const categorySeoReadSchema = z.object({
	category_id: z.string(),
	revision: z.number().int().nonnegative(),
	name: z.string(),
	slug: z.string(),
	kind: z.enum(['group', 'product']),
	status: z.enum(['draft', 'active']),
	seo: categorySeoSchema
})
export const categorySeoBodySchema = z.object({
	expected_revision: z.number().int().nonnegative().safe(),
	seo: categorySeoSchema
})
export type CategorySeoBody = z.infer<typeof categorySeoBodySchema>
