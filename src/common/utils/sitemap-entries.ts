import '@/common/lib/zod-locale'
import * as z from 'zod'
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/common/constants/seo.constants'
import { UI_URLS } from '@/common/constants/ui-routes.constants'
const slug = z
	.string()
	.min(1)
	.regex(/^[^\s/\\?#%]+$/)
	.refine(value => value !== '.' && value !== '..')
const entry = z.object({ slug, updatedAt: z.string().datetime({ offset: true }).nullish() })
const stamp = {
	initialized: z.boolean(),
	revision: z.number().int().nonnegative(),
	epoch: z.number().int().nonnegative()
}
const snapshot = z.object({
	...stamp,
	variants: z.array(entry),
	categories: z.array(entry),
	landings: z.array(entry.extend({ category_slug: slug }))
})
/**
 * `GET /catalog/sitemap`: the parts of one URL set under one revision. The first part (`from`
 * null) carries the categories and landings, the rest are consecutive SKU slug ranges; each part
 * stays below Google's 50 000 URLs per file (backend `SITEMAP_PART_PLAN`).
 */
const index = z.object({
	...stamp,
	parts: z
		.array(
			z.object({
				from: z.string().min(1).nullable(),
				to: z.string().min(1).nullable(),
				urls: z.number().int().nonnegative()
			})
		)
		.min(1)
		.refine(
			parts =>
				parts[0].from === null &&
				parts.at(-1)!.to === null &&
				parts.every(
					(part, n) => n === 0 || (part.from !== null && part.from === parts[n - 1].to)
				)
		)
})
export type SitemapIndex = z.infer<typeof index>
/** Reject a malformed index rather than publishing a sitemap with parts missing. */
export function parseSitemapIndex(input: unknown): SitemapIndex {
	return index.parse(input)
}
/**
 * Reject malformed/incomplete exports instead of publishing a truncated sitemap. One part of the
 * index: the home and static pages go into the first file only, `/catalog` with the categories
 * (also the first), so the files together list every URL exactly once.
 */
export function buildSitemapEntries(
	input: unknown,
	{ first = true }: { first?: boolean } = {}
): MetadataRoute.Sitemap {
	const data = snapshot.parse(input)
	const modified = (value?: string | null) => (value ? { lastModified: new Date(value) } : {})
	const staticRoutes = [
		{ path: UI_URLS.FAQ, priority: 0.5 },
		{ path: UI_URLS.WHOLESALE, priority: 0.5 },
		{ path: UI_URLS.PRICE_SHEET, priority: 0.6 },
		{ path: UI_URLS.CONTACTS, priority: 0.4 },
		{ path: UI_URLS.OFFER, priority: 0.3 },
		{ path: UI_URLS.RETURNS, priority: 0.3 },
		{ path: UI_URLS.PRIVACY, priority: 0.3 }
	]
	return [
		...(first
			? [
					{ url: SITE_URL, changeFrequency: 'weekly' as const, priority: 1 },
					...staticRoutes.map(({ path, priority }) => ({
						url: `${SITE_URL}${path}`,
						changeFrequency: 'monthly' as const,
						priority
					}))
				]
			: []),
		// The whole catalogue, while it lists anything: `categories` holds only public non-empty
		// listings (TD-0013 SEO matrix — `/catalog` with published categories is in the sitemap).
		...(data.categories.length
			? [
					{
						url: `${SITE_URL}${UI_URLS.CATALOG.ROOT}`,
						changeFrequency: 'daily' as const,
						priority: 0.8
					}
				]
			: []),
		...data.categories.map(cat => ({
			url: `${SITE_URL}/${encodeURIComponent(cat.slug)}`,
			changeFrequency: 'daily' as const,
			priority: 0.8,
			...modified(cat.updatedAt)
		})),
		...data.landings.map(landing => ({
			url: `${SITE_URL}/${encodeURIComponent(landing.category_slug)}/${encodeURIComponent(landing.slug)}`,
			changeFrequency: 'weekly' as const,
			priority: 0.85,
			...modified(landing.updatedAt)
		})),
		...data.variants.map(variant => ({
			url: `${SITE_URL}${UI_URLS.PRODUCT(variant.slug)}`,
			changeFrequency: 'daily' as const,
			priority: 0.9,
			...modified(variant.updatedAt)
		}))
	]
}
