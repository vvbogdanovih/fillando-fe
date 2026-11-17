import { sitemapPart, urlsetResponse } from '@/common/utils/sitemap-files'

export const dynamic = 'force-dynamic'

/** `/sitemap/<n>.xml` — one part of the sitemap index (see `/sitemap.xml`). */
export async function GET(_request: Request, context: { params: Promise<{ part: string }> }) {
	const match = /^(0|[1-9]\d{0,4})\.xml$/.exec((await context.params).part)
	const entries = match ? await sitemapPart(Number(match[1])) : null
	if (!entries) return new Response('Not Found', { status: 404 })
	return urlsetResponse(entries)
}
