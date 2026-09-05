import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogPage } from './CatalogPage'
import {
	findMatchingLanding,
	listingIndexing,
	type LandingCanonical
} from '@/common/utils/seo.utils'
import { SITE_URL } from '@/common/constants/seo.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import { CACHE_TAGS } from '@/common/constants'
import type { Category } from '@/app/admin/categories/categories.schema'
import type { CatalogResponse } from './catalog.api'

interface PageProps {
	params: Promise<{ category: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

const formatSlug = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
	const { category } = await params
	const sp = await searchParams
	let categoryData: Category | null
	try {
		categoryData = await serverFetch<Category>(`/categories/slug/${category}`)
	} catch {
		// Upstream outage (429/5xx/network), not a missing category: the page itself
		// throws into the error boundary, so return neutral metadata WITHOUT noindex —
		// otherwise the blip would be indexed (and ISR-cached) as "not found".
		return { title: `${formatSlug(category)} — купити у Fillando` }
	}
	// This dynamic segment catches every unknown top-level path. The streamed
	// response is committed with a 200 before notFound() can change the status,
	// so mark unknown slugs noindex to keep the soft-404 out of the index.
	if (!categoryData) {
		return { title: 'Сторінку не знайдено', robots: { index: false, follow: false } }
	}
	const label = categoryData.name ?? formatSlug(category)
	let { canonical, robots } = listingIndexing(`/${category}`, sp)

	// A filter combination that a landing already covers should point at the landing: the two
	// return the same products, and the landing is the one with a heading and copy (TD-0002 §5.4).
	if (robots) {
		// Same URL as the page-body fetch below, so both share one Data Cache entry: `next.tags`
		// is not part of the fetch cache key, whichever call renders first writes the entry with
		// its own tags and the other's are silently dropped. Keep the two tag arrays identical.
		const landings = await serverFetch<LandingCanonical[]>(
			`/landings?category_id=${categoryData._id}`,
			{ next: { tags: [CACHE_TAGS.LANDINGS] } }
		).catch(() => null)
		const match = landings ? findMatchingLanding(landings, sp) : null
		if (match) canonical = `${SITE_URL}/${category}/${match.slug}`
	}
	// Page 2 says so in the title: two pages of one category with the same <title> are a
	// duplicate-content signal, and the number is what tells a searcher which one they landed on.
	const page = readPageNumber(sp.page)
	const title =
		page > 1
			? `${label} — сторінка ${page} — купити у Fillando`
			: `${label} — купити у Fillando`
	const description = `Каталог ${label.toLowerCase()}. Широкий вибір філаменту та витратних матеріалів для 3D-друку.`

	return {
		title,
		description,
		alternates: { canonical },
		...(robots && { robots }),
		openGraph: { title, description, url: canonical, type: 'website' }
	}
}

/** Mirrors the page parsing in `listingIndexing`; used only to label the title. */
function readPageNumber(value: string | string[] | undefined): number {
	const raw = Array.isArray(value) ? value[0] : value
	const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN
	return Number.isFinite(parsed) && parsed > 1 ? parsed : 1
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
	const { category } = await params
	const sp = await searchParams

	// `null` means 404 only — a 429/5xx throws into the error boundary instead of
	// rendering (and caching) a not-found page.
	const categoryData = await serverFetch<Category>(`/categories/slug/${category}`)
	// This dynamic segment catches every unknown top-level path — unknown slugs
	// must 404, not render an empty page.
	if (!categoryData) notFound()

	const query = new URLSearchParams()
	query.set('category_id', categoryData._id)
	query.set('limit', String(sp.limit ?? '12'))
	for (const [key, value] of Object.entries(sp)) {
		if (typeof value === 'string' && key !== 'limit') {
			query.set(key, value)
		}
	}
	const [initialCatalog, landings] = await Promise.all([
		serverFetch<CatalogResponse>(`/products/catalog?${query.toString()}`),
		// Published landings only (the endpoint filters drafts). A failure here must not take
		// the catalogue down, so the tiles simply do not render.
		//
		// Tags must stay byte-identical to the `generateMetadata` fetch above — same URL, one
		// cache entry.
		serverFetch<
			{
				slug: string
				h1: string
				order: number
				image: string | null
				product_count: number
			}[]
		>(`/landings?category_id=${categoryData._id}`, {
			next: { tags: [CACHE_TAGS.LANDINGS] }
		}).catch(() => null)
	])

	return (
		<Suspense>
			<CatalogPage
				categorySlug={category}
				initialCategory={categoryData}
				initialCatalog={initialCatalog}
				popularLandings={(landings ?? []).map(({ slug, h1, image, product_count }) => ({
					slug,
					h1,
					image: image ?? null,
					// An older backend has no such field; a tile reading "0 товарів" would be a
					// lie, so an absent count prints nothing rather than a zero.
					product_count: product_count ?? null
				}))}
			/>
		</Suspense>
	)
}
