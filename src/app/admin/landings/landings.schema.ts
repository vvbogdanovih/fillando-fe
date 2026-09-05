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

export type Landing = z.infer<typeof landingSchema>

/**
 * What `GET /landings/admin` adds to each row: how many catalogue variants the landing's pinned
 * filters currently match. A zero is the reading that matters — that landing may not be
 * published, and the API refuses it — and it is the only thing on the screen that says which of
 * the fourteen seeded landings are still empty.
 *
 * The write endpoints answer with the landing alone, so `Landing` stays the shape of a
 * create/update response and only the listing carries the count.
 */
export const adminLandingSchema = landingSchema.extend({
	product_count: z.number().int().nonnegative()
})

export const adminLandingsListSchema = z.array(adminLandingSchema)
export type AdminLanding = z.infer<typeof adminLandingSchema>

/**
 * Text, not markup.
 *
 * The editor is Quill, and an editor that was typed into and cleared again does not come back
 * as an empty string — it emits `<p></p>` or `<p><br></p>`, and the backend's sanitizer keeps
 * both `p` and `br`. Measuring the raw string would count seven characters of nothing as copy,
 * which is precisely backwards for the column that exists to say which landings still need
 * writing.
 */
const hasText = (html: string): boolean =>
	html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.trim().length > 0

/**
 * «Контент» in the listing: a landing counts as written only when both texts and at least one
 * FAQ pair are there. Anything less and the page renders as a bare product grid under an H1,
 * which is the state the seeded drafts start in.
 */
export const hasContent = (landing: Landing): boolean =>
	hasText(landing.intro_html) && hasText(landing.bottom_html) && landing.faq.length > 0

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
	// The tile image the category's «Популярні види» block shows. Nullable rather than optional:
	// clearing it has to reach the API as an explicit null.
	image: z.string().nullable(),
	order: z.number().int().min(0).optional(),
	status: z.enum(LANDING_STATUSES)
})

export type LandingFormValues = z.infer<typeof landingFormSchema>
