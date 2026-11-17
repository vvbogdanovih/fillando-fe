import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import {
	storefrontPublicSchema,
	type StorefrontPublic
} from '@/app/admin/storefront/storefront.schema'

/**
 * SERVER ONLY. `GET /storefront-settings` (Plan-0010 B09): home categories and collections.
 * Tagged `categories` — the backend revalidates that tag after a settings save — and `landings`:
 * a collection pointing at a typed landing embeds that landing's pins, address and status, and a
 * landing save purges only `landings` (audit 2026-11-11: the strip kept the old pins and its link
 * a 404 for up to the hour). The one caller of this URL, so the array stays one.
 *
 * `null` is an older backend without the endpoint (a 404), or an answer of a shape this storefront
 * does not know; an outage throws. This is the home page's own read (review 2026-11-14): that page
 * is prerendered and kept for an hour, and with the outage caught one failed read during a
 * regeneration was cached as a page without its copy, its H1 and its shelves — thrown, the
 * regeneration fails and the previous page stays, as with the page's first «Новинки» read.
 */
export async function readStorefrontSettings(): Promise<StorefrontPublic | null> {
	const raw = await serverFetch<unknown>(API_URLS.STOREFRONT_SETTINGS.BASE, {
		next: { tags: [CACHE_TAGS.CATEGORIES, CACHE_TAGS.LANDINGS] }
	})
	const parsed = storefrontPublicSchema.safeParse(raw)
	return parsed.success ? parsed.data : null
}

/**
 * SERVER ONLY. The same read as decoration (docs/http-service.md, «decoration» catch) — the layout
 * every storefront page passes through and the catalogue hub: an outage must not take those pages
 * down, it only drops these blocks.
 */
export async function loadStorefrontSettings(): Promise<StorefrontPublic | null> {
	try {
		return await readStorefrontSettings()
	} catch {
		return null
	}
}
