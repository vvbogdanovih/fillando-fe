import {
	sitemapIndex,
	sitemapIndexResponse,
	sitemapPart,
	urlsetResponse
} from '@/common/utils/sitemap-files'

// The Data Cache in sitemap-files owns the artifact. Do not fetch the live backend during builds.
export const dynamic = 'force-dynamic'

/**
 * `/sitemap.xml` — what robots.txt names. One part (fewer than ~20 000 URLs, today's catalogue):
 * the `<urlset>` itself, as before the split. More: a sitemap index of `/sitemap/<n>.xml`.
 */
export async function GET() {
	const index = await sitemapIndex()
	if (index.parts.length > 1) return sitemapIndexResponse(index.parts.length)
	const entries = await sitemapPart(0)
	if (!entries) throw new Error('Sitemap index lost its only part')
	return urlsetResponse(entries)
}
