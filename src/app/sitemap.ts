import { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { SITE_URL } from '@/common/constants/seo.constants'

const API = process.env.NEXT_PUBLIC_API_BASE_URL!

// Only re-fetches when count (cache key) changes
const fetchSitemapEntries = unstable_cache(
    async (_count: number): Promise<MetadataRoute.Sitemap> => {
        const [variantsRes, categoriesRes] = await Promise.allSettled([
            fetch(`${API}/products/variants/slugs`).then(r => r.json()),
            fetch(`${API}/categories/with-subcategories`).then(r => r.json()),
        ])

        const variants: { slug: string; updatedAt?: string }[] =
            variantsRes.status === 'fulfilled' ? (variantsRes.value ?? []) : []
        const categories: any[] =
            categoriesRes.status === 'fulfilled' ? (categoriesRes.value ?? []) : []

        const productRoutes = variants.map(p => ({
            url: `${SITE_URL}/products/${p.slug}`,
            lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        }))

        const categoryRoutes = categories.flatMap(cat =>
            (cat.subcategories ?? []).map((sub: any) => ({
                url: `${SITE_URL}/${cat.slug}/${sub.slug}`,
                lastModified: new Date(),
                changeFrequency: 'daily' as const,
                priority: 0.8,
            }))
        )

        return [
            { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
            ...categoryRoutes,
            ...productRoutes,
        ]
    },
    ['sitemap-entries'],
    { revalidate: false } // invalidated only when count changes (new cache key)
)

export const revalidate = 86400 // check count once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const countData = await fetch(`${API}/products/variants/count`).then(r => r.json()).catch(() => null)
    const count: number = countData?.count ?? -1
    return fetchSitemapEntries(count)
}
