import legacyProductSlugs from '../constants/legacy-product-slugs.json'

// Product addresses Google indexed before the 3k rename (TD-0002 §3k) → today's slug.
// Built from the production run's `slug-map.json`, with rename chains already collapsed so
// every entry is one hop: a 301 onto another 301 wastes crawl budget and Google follows only
// a few. Renaming a product again means adding its old slug here (and repointing any entry
// whose target was that slug) — nothing writes this file automatically.
//
// Imported by next.config.ts, so it uses a relative import rather than the `@/` alias.
export const LEGACY_PRODUCT_SLUGS: Readonly<Record<string, string>> = legacyProductSlugs

export function legacyProductRedirects() {
	return Object.entries(LEGACY_PRODUCT_SLUGS).map(([from, to]) => ({
		source: `/products/${from}`,
		destination: `/products/${to}`,
		permanent: true
	}))
}
