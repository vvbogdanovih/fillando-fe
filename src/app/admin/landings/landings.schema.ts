import '@/common/lib/zod-locale'
import * as z from 'zod'

export const LANDING_STATUSES = ['draft', 'active'] as const
export type LandingStatus = (typeof LANDING_STATUSES)[number]

/**
 * Google truncates around these lengths. They are guidance, not validation — a longer title is
 * allowed, the counter just turns amber so the editor knows it will be cut.
 */
export const TITLE_SOFT_LIMIT = 60
export const META_DESCRIPTION_SOFT_LIMIT = 160

const faqItemSchema = z.object({
	q: z.string().min(1, 'Питання не може бути порожнім'),
	a: z.string().min(1, 'Відповідь не може бути порожньою')
})

// --- Response ---

export const landingSchema = z.object({
	_id: z.string(),
	category_id: z.string(),
	slug: z.string(),
	h1: z.string(),
	title: z.string(),
	meta_description: z.string(),
	intro_html: z.string().default(''),
	bottom_html: z.string().default(''),
	faq: z.array(faqItemSchema).default([]),
	filters: z.record(z.string(), z.array(z.string())).default({}),
	price_min: z.number().nullable().default(null),
	price_max: z.number().nullable().default(null),
	image: z.string().nullable().default(null),
	order: z.number().default(0),
	status: z.enum(LANDING_STATUSES),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional()
})

export const landingsListSchema = z.array(landingSchema)
export type Landing = z.infer<typeof landingSchema>

// --- Form ---

export const landingFormSchema = z.object({
	category_id: z.string().min(1, 'Оберіть категорію'),
	slug: z
		.string()
		.min(1, 'Адреса є обов’язковою')
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Лише латиниця, цифри та дефіс'),
	h1: z.string().min(1, 'Заголовок є обов’язковим'),
	title: z.string().min(1, 'Title є обов’язковим'),
	meta_description: z.string().min(1, 'Опис є обов’язковим'),
	intro_html: z.string().optional(),
	bottom_html: z.string().optional(),
	// No `.default()` here on purpose: a default makes Zod's input and output types diverge,
	// and react-hook-form is typed against one of them. `defaultValues` supplies the empties.
	faq: z.array(faqItemSchema),
	filters: z.record(z.string(), z.array(z.string())),
	order: z.number().int().min(0).optional(),
	status: z.enum(LANDING_STATUSES)
})

export type LandingFormValues = z.infer<typeof landingFormSchema>
