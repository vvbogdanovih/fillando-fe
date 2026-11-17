import '@/common/lib/zod-locale'
import * as z from 'zod'

const id = z.string().regex(/^[a-f0-9]{24}$/)
/** A category (optionally one of its typed landings) or an explicit list of products (B09). */
export const storefrontCollectionSchema = z.object({
	id: z.string().uuid().optional(),
	title: z.string(),
	category_id: id.nullable(),
	landing_id: id.nullable(),
	product_ids: z.array(id).optional()
})
export type StorefrontCollection = z.infer<typeof storefrontCollectionSchema>
/**
 * The home page's copy (TD-0015, owner 2026-11-09): the strip above the header, the banner (its
 * title is the page's H1, `accent` the highlighted part of it), the card beside it — the wholesale
 * form or a link — and the band between the strips (`null`: none). The backend answers defaults until
 * they are saved, so the storefront never carries copy of its own.
 */
export const storefrontContentSchema = z.object({
	strip: z.array(z.string()),
	banner: z.object({
		eyebrow: z.string(),
		title: z.string(),
		accent: z.string(),
		text: z.string(),
		button_label: z.string(),
		button_href: z.string()
	}),
	side_promo: z.object({
		title: z.string(),
		text: z.string(),
		button_label: z.string(),
		action: z.enum(['wholesale-form', 'link']),
		button_href: z.string().nullable()
	}),
	band: z
		.object({
			title: z.string(),
			text: z.string(),
			button_label: z.string(),
			button_href: z.string()
		})
		.nullable()
})
export type StorefrontContent = z.infer<typeof storefrontContentSchema>
export const storefrontAdminSchema = storefrontContentSchema.extend({
	revision: z.number().int().nonnegative(),
	collections: z.array(storefrontCollectionSchema)
})
export type StorefrontAdmin = z.infer<typeof storefrontAdminSchema>
export type StorefrontSettingsBody = Omit<StorefrontAdmin, 'revision'> & {
	expected_revision: number
}
export const storefrontReceiptSchema = z.object({
	operation_id: z.string().uuid(),
	revision: z.number().int().nonnegative()
})
/** `GET /storefront-settings` — what the storefront renders (visible targets only). */
export const storefrontPublicSchema = storefrontContentSchema.extend({
	collections: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			// A product list has neither: its `filters` carry `product_ids`.
			category_id: id.nullable(),
			path: z.string().nullable(),
			filters: z.record(z.string(), z.unknown()).nullable()
		})
	)
})
export type StorefrontPublic = z.infer<typeof storefrontPublicSchema>
