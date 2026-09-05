import { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { SITE_URL } from '@/common/constants/seo.constants'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { UI_URLS } from '@/common/constants/ui-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'

interface VariantSlug {
	slug: string
	updatedAt?: string
}

interface LandingSlug {
	category_slug: string
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
		const [variants, categories, landings] = await Promise.all([
			serverFetch<VariantSlug[]>('/products/variants/slugs', { next: { revalidate: 0 } }),
			serverFetch<{ slug: string }[]>(API_URLS.CATEGORIES.BASE, { next: { revalidate: 0 } }),
			// Active landings only — the endpoint filters drafts, so an unpublished page is
			// never advertised to Google.
			serverFetch<LandingSlug[]>(API_URLS.LANDINGS.SLUGS, { next: { revalidate: 0 } })
		])

		const productRoutes = (variants ?? []).map(p => ({
			url: `${SITE_URL}/products/${p.slug}`,
			lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
			changeFrequency: 'daily' as const,
			priority: 0.9
		}))

		const landingRoutes = (landings ?? []).map(landing => ({
			url: `${SITE_URL}/${landing.category_slug}/${landing.slug}`,
			lastModified: landing.updatedAt ? new Date(landing.updatedAt) : new Date(),
			changeFrequency: 'weekly' as const,
			// Above a bare category: a landing has its own copy and targets a real query.
			priority: 0.85
		}))

		const categoryRoutes = (categories ?? []).map(cat => ({
			url: `${SITE_URL}/${cat.slug}`,
			lastModified: new Date(),
			changeFrequency: 'daily' as const,
			priority: 0.8
		}))

		// Static pages that exist and are indexable. `/price-sheet` is listed only because
		// Plan-0003 PR-2 stopped it leaking draft and archived variants — advertising it to
		// Google before that would have indexed the leak.
		const staticRoutes: MetadataRoute.Sitemap = [
			{ path: '/faq', priority: 0.5 },
			{ path: UI_URLS.WHOLESALE, priority: 0.5 },
			{ path: UI_URLS.PRICE_SHEET, priority: 0.6 },
			{ path: UI_URLS.CONTACTS, priority: 0.4 },
			{ path: UI_URLS.OFFER, priority: 0.3 },
			{ path: UI_URLS.RETURNS, priority: 0.3 },
			{ path: UI_URLS.PRIVACY, priority: 0.3 }
		].map(({ path, priority }) => ({
			url: `${SITE_URL}${path}`,
			lastModified: new Date(),
			changeFrequency: 'monthly' as const,
			priority
		}))

		return [
			{ url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
			...staticRoutes,
			...categoryRoutes,
			...landingRoutes,
			...productRoutes
		]
	},
	['sitemap-entries'],
	// Re-fetched when count (cache key) changes, and at most daily otherwise —
	// category/slug changes don't affect the count, so a hard `false` here
	// would keep serving stale URLs forever. The tag is the on-demand escape from
	// exactly that: publishing a landing adds a URL without moving the variant count,
	// so nothing else would invalidate this entry for a day. It has to sit on the
	// options object — `keyParts` are not tags, and the inner fetches pass
	// `revalidate: 0`, so they never reach the Data Cache to carry one.
	{ revalidate: 86400, tags: [CACHE_TAGS.SITEMAP] }
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
