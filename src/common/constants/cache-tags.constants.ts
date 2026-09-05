/**
 * Data-cache tags for `revalidateTag`, and the resources `POST /api/revalidate` will act on.
 *
 * A tag only bites when the string a fetch was made with is byte-identical to the string a
 * purge names, so both sides read them from here rather than repeating a literal.
 *
 * Coarse on purpose. Create, edit, rename, category move, publish, unpublish and delete all
 * arrive through the one admin save mutation, and a single string covers every one of them —
 * no old-slug/new-slug tuple to carry, and no dependency on the `['categories']` query that
 * renders «…» until it resolves. With fourteen landings, per-slug precision buys one avoided
 * re-fetch and costs a class of bug.
 */
export const CACHE_TAGS = {
	LANDINGS: 'landings', // every serverFetch that reads landing data
	SITEMAP: 'sitemap' // the `unstable_cache` memo behind /sitemap.xml
} as const

/** The closed set of resources the revalidation endpoint accepts. */
export const REVALIDATE_RESOURCES = ['landings'] as const

export type RevalidateResource = (typeof REVALIDATE_RESOURCES)[number]
