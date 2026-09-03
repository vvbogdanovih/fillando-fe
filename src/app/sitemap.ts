import { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { SITE_URL } from '@/common/constants/seo.constants'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'

interface VariantSlug {
	slug: string
	updatedAt?: string
}

// Only re-fetches when count (cache key) changes
const fetchSitemapEntries = unstable_cache(
	async (_count: number): Promise<MetadataRoute.Sitemap> => {
		// `unstable_cache` owns caching here (Next forces fetches inside it to
		// no-store anyway), hence `revalidate: 0`. Upstream failures deliberately
		// throw instead of collapsing into `[]`: a stale entry keeps being served
		// while the failed re-run is logged, and a cache miss errors the route —
		// either beats caching an empty sitemap for a day. `null` (404) is the
		// only "no entries" case.
		const [variants, categories] = await Promise.all([
			serverFetch<VariantSlug[]>('/products/variants/slugs', { next: { revalidate: 0 } }),
			serverFetch<{ slug: string }[]>(API_URLS.CATEGORIES.BASE, { next: { revalidate: 0 } })
		])

		const productRoutes = (variants ?? []).map(p => ({
			url: `${SITE_URL}/products/${p.slug}`,
			lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
			changeFrequency: 'daily' as const,
			priority: 0.9
		}))

		const categoryRoutes = (categories ?? []).map(cat => ({
			url: `${SITE_URL}/${cat.slug}`,
			lastModified: new Date(),
			changeFrequency: 'daily' as const,
			priority: 0.8
		}))

		return [
			{ url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
			{
				url: `${SITE_URL}/faq`,
				lastModified: new Date(),
				changeFrequency: 'monthly',
				priority: 0.5
			},
			{
				url: `${SITE_URL}/wholesale`,
				lastModified: new Date(),
				changeFrequency: 'monthly',
				priority: 0.5
			},
			...categoryRoutes,
			...productRoutes
		]
	},
	['sitemap-entries'],
	// Re-fetched when count (cache key) changes, and at most daily otherwise —
	// category/slug changes don't affect the count, so a hard `false` here
	// would keep serving stale URLs forever.
	{ revalidate: 86400 }
)

// The count check below is a `revalidate: 0` fetch. Without `force-static` Next
// treats such a fetch at route level as dynamic usage (markCurrentScopeAsDynamic
// in next/dist/server/lib/patch-fetch) and drops the route out of ISR; with it
// the fetch simply re-runs on each daily regeneration, as the bare `fetch` did.
export const dynamic = 'force-static'
export const revalidate = 86400 // check count once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// The count is only the cache key for `fetchSitemapEntries`, so collapsing
	// any failure (404, 5xx, network) to -1 is fine here.
	const countData = await serverFetch<{ count: number }>('/products/variants/count', {
		next: { revalidate: 0 }
	}).catch(() => null)
	const count = countData?.count ?? -1
	return fetchSitemapEntries(count)
}
