import { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { SITE_URL } from '@/common/constants/seo.constants'

const API = process.env.NEXT_PUBLIC_API_BASE_URL!

// Only re-fetches when count (cache key) changes
const fetchSitemapEntries = unstable_cache(
	async (_count: number): Promise<MetadataRoute.Sitemap> => {
		const [variantsRes, categoriesRes] = await Promise.allSettled([
			fetch(`${API}/products/variants/slugs`).then(r => r.json()),
			fetch(`${API}/categories`).then(r => r.json())
		])

		const variants: { slug: string; updatedAt?: string }[] =
			variantsRes.status === 'fulfilled' ? (variantsRes.value ?? []) : []
		const categories: any[] =
			categoriesRes.status === 'fulfilled' ? (categoriesRes.value ?? []) : []

		const productRoutes = variants.map(p => ({
			url: `${SITE_URL}/products/${p.slug}`,
			lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
			changeFrequency: 'daily' as const,
			priority: 0.9
		}))

		const categoryRoutes = categories.map(cat => ({
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

export const revalidate = 86400 // check count once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const countData = await fetch(`${API}/products/variants/count`)
		.then(r => r.json())
		.catch(() => null)
	const count: number = countData?.count ?? -1
	return fetchSitemapEntries(count)
}
