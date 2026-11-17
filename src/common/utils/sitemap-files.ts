import type { MetadataRoute } from 'next'
import { revalidateTag, unstable_cache } from 'next/cache'
import { resolveRouteData } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { SITE_URL } from '@/common/constants/seo.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import {
	buildSitemapEntries,
	parseSitemapIndex,
	type SitemapIndex
} from '@/common/utils/sitemap-entries'

/**
 * The storefront sitemap as files (Plan-0010 B05/F10): the backend splits the URL set into parts
 * of fewer than 50 000 URLs under one revision; `/sitemap.xml` is the one file itself while there
 * is one part (today's catalogue) and a sitemap index of `/sitemap/<n>.xml` once there are more.
 *
 * Both reads sit in the Data Cache under the same tags as before, so a catalogue write purges
 * them together (`/api/revalidate`). One backend read barrier covers each part, and every part is
 * read with the revision of the index it belongs to: a part of another revision is a 409, never a
 * mix of two catalogue states. Even a 404 is an export failure, not permission to publish static
 * pages only.
 */
const TAGS = [CACHE_TAGS.SITEMAP, CACHE_TAGS.PRODUCTS, CACHE_TAGS.CATEGORIES]

const readIndex = async () =>
	parseSitemapIndex(await serverFetch<unknown>(API_URLS.CATALOG_SITEMAP, { cache: 'no-store' }))
const readPart = async (index: SitemapIndex, n: number) => {
	const { from, to } = index.parts[n]
	const query = new URLSearchParams({
		revision: String(index.revision),
		epoch: String(index.epoch),
		...(from === null ? {} : { from }),
		...(to === null ? {} : { to })
	})
	return buildSitemapEntries(
		await serverFetch<unknown>(`${API_URLS.CATALOG_SITEMAP_PART}?${query}`, {
			cache: 'no-store'
		}),
		{ first: n === 0 }
	)
}

const cachedIndex = unstable_cache(readIndex, ['catalog-sitemap-index-v2'], {
	revalidate: 86400,
	tags: TAGS
})
// Keyed by the index's revision and the part's own range (the arguments), not by its number.
const cachedPart = unstable_cache(
	async (index: SitemapIndex, n: number) => readPart(index, n),
	['catalog-sitemap-part-v2'],
	{ revalidate: 86400, tags: TAGS }
)

export async function sitemapIndex(): Promise<SitemapIndex> {
	return cachedIndex()
}

/**
 * The entries of `/sitemap/<n>.xml`, or `null` past the last part. A part the backend refuses as
 * of another revision (409: the catalogue changed after the cached index was read) is served from
 * a fresh index, and the cached one is dropped for the next request.
 */
export async function sitemapPart(n: number): Promise<MetadataRoute.Sitemap | null> {
	const index = await cachedIndex()
	if (!Number.isSafeInteger(n) || n < 0 || n >= index.parts.length) return null
	try {
		return await cachedPart(index, n)
	} catch (error) {
		if (!String((error as Error)?.message).startsWith('Upstream 409')) throw error
		revalidateTag(CACHE_TAGS.SITEMAP, { expire: 0 })
		const fresh = await readIndex()
		return n < fresh.parts.length ? readPart(fresh, n) : null
	}
}

const XML_HEADERS = {
	'Content-Type': 'application/xml',
	// What Next's own metadata sitemap route sends in production.
	'Cache-Control': 'public, max-age=0, must-revalidate'
}

/** A `<urlset>` exactly as Next's `sitemap.ts` metadata route renders one. */
export function urlsetResponse(entries: MetadataRoute.Sitemap) {
	return new Response(resolveRouteData(entries, 'sitemap'), { headers: XML_HEADERS })
}

/** A `<sitemapindex>` of the part files. */
export function sitemapIndexResponse(parts: number) {
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...Array.from(
			{ length: parts },
			(_, n) => `<sitemap>\n<loc>${SITE_URL}/sitemap/${n}.xml</loc>\n</sitemap>`
		),
		'</sitemapindex>',
		''
	].join('\n')
	return new Response(body, { headers: XML_HEADERS })
}
