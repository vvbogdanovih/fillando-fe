/**
 * Data-cache tags for `revalidateTag`, and the resources `POST /api/revalidate` will act on.
 *
 * A tag only bites when the string a fetch was made with is byte-identical to the string a
 * purge names, so both sides read them from here rather than repeating a literal.
 *
 * Coarse on purpose. Create, edit, rename, category move, publish, unpublish, archive and
 * delete all arrive through the one admin save mutation, and a single string covers every one
 * of them — no old-slug/new-slug tuple to carry, and no dependency on the `['categories']`
 * query that renders «…» until it resolves. Per-slug precision buys one avoided re-fetch and
 * costs a class of bug: a purge naming the wrong slug is silent, and the page it missed stays
 * wrong for the rest of the hour.
 */
export const CACHE_TAGS = {
	LANDINGS: 'landings', // every serverFetch that reads landing data
	PRODUCTS: 'products', // catalogue, product detail and the sitemap's product URLs
	CATEGORIES: 'categories', // category docs, the nav menu and the sitemap's category URLs
	SITEMAP: 'sitemap' // the `unstable_cache` memo behind /sitemap.xml
} as const

/**
 * The closed set of resources the revalidation endpoint accepts. The backend names these exact
 * strings after a landing, product/variant or category write; a name it does not find here is a
 * 400, so a request can never reach a tag of its own choosing.
 */
export const REVALIDATE_RESOURCES = ['landings', 'products', 'categories'] as const

export type RevalidateResource = (typeof REVALIDATE_RESOURCES)[number]
