import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogPage } from '../CatalogPage'
import { readPageNumber } from '../page-number'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import { CACHE_TAGS } from '@/common/constants'
import { listingIndexing } from '@/common/utils/seo.utils'
import type { Category } from '@/app/admin/categories/categories.schema'
import type { CatalogResponse } from '../catalog.api'
import { TypedRoute, typedRouteMetadata, type TypedLanding } from '../../catalog/typed-route'
import type { PublicCategory } from '../../catalog/typed-catalog.types'
import { redirectIfMoved } from '@/common/utils/moved-route.server'

interface LandingResponse {
	_id: string
	slug: string
	h1: string
	title: string
	meta_description: string
	intro_html: string
	bottom_html: string
	faq: { q: string; a: string }[]
	filters: Record<string, string[]>
	/** Typed pins of a landing under a v2 category (TD-0013); absent on v1. */
	filters_v2?: TypedLanding['filters_v2']
	contract_version?: number
	category_slug: string
	category_name: string
}

/** Same URL and tag array as the category route's reads — one Data Cache entry. */
const loadCategory = (category: string) =>
	serverFetch<Category & Partial<PublicCategory>>(`/categories/slug/${category}`, {
		next: { tags: [CACHE_TAGS.CATEGORIES] }
	})

/** A landing of a v2 category renders the typed listing with its `filters_v2` pinned. */
const typedPair = (
	category: (Category & Partial<PublicCategory>) | null,
	landing: LandingResponse | null
) =>
	category &&
	landing?.filters_v2 &&
	(category.kind === 'group' || category.attribute_contract_version === 2)
		? {
				category: category as unknown as PublicCategory,
				landing: landing as unknown as TypedLanding
			}
		: null

interface PageProps {
	params: Promise<{ category: string; landing: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

const landingPath = (category: string, landing: string) => `/${category}/${landing}`

/**
 * The public endpoint returns active landings only, so an unknown address and a draft are the
 * same 404 here — a visitor cannot tell that an unpublished page exists.
 *
 * Tagged because this is the copy an admin edits: without it the hour-long `serverFetch`
 * window is how long a saved text stays invisible. One helper feeds both `generateMetadata`
 * and the page body, so the tag covers the title and the H1 together.
 */
async function loadLanding(category: string, landing: string) {
	return serverFetch<LandingResponse>(`/landings/slug/${category}/${landing}`, {
		next: { tags: [CACHE_TAGS.LANDINGS] }
	})
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
	const { category, landing } = await params
	const sp = await searchParams

	let data: LandingResponse | null
	try {
		data = await loadLanding(category, landing)
	} catch {
		// Upstream outage rather than a missing landing: neutral metadata WITHOUT noindex, or
		// the blip gets indexed as "not found". Same reasoning as `[category]/page.tsx`.
		return { title: 'Fillando' }
	}

	// The streamed response commits a 200 before `notFound()` can change the status, so an
	// unknown or draft address has to say `noindex` here or it is indexed as a soft 404.
	if (!data) {
		// An old landing address (its own or its category's slug changed) redirects once (B07).
		await redirectIfMoved([category, landing], sp)
		return { title: 'Сторінку не знайдено', robots: { index: false, follow: false } }
	}
	const typed = typedPair(await loadCategory(category), data)
	if (typed) return typedRouteMetadata(typed.category, sp, typed.landing)

	const { canonical, robots } = listingIndexing(landingPath(category, landing), sp)

	// Page 2 says so in the title, exactly as the category does: `?page=N` is indexable and
	// self-canonical, so without the number the two indexed URLs carry one and the same
	// <title>. The stored title is already a finished SEO title, so the number goes after it
	// rather than in front of the brand.
	const page = readPageNumber(sp.page)
	const title = page > 1 ? `${data.title} — сторінка ${page}` : data.title

	return {
		// `absolute`: the stored title is a finished SEO title that already carries the brand,
		// which is what the admin's 60-character counter measures. Letting the root layout's
		// `%s | Fillando` template wrap it again printed «… | Fillando | Fillando».
		title: { absolute: title },
		description: data.meta_description,
		alternates: { canonical },
		...(robots && { robots }),
		openGraph: {
			title,
			description: data.meta_description,
			url: canonical,
			type: 'website'
		}
	}
}

export default async function LandingRoutePage({ params, searchParams }: PageProps) {
	const { category, landing } = await params
	const sp = await searchParams

	const [categoryData, landingData] = await Promise.all([
		// Same URL as the two tagged reads in the category route, so the tag array must match
		// byte for byte — `next.tags` is not part of the cache key (Plan-0005 I-h).
		loadCategory(category),
		loadLanding(category, landing)
	])
	if (!categoryData || !landingData) {
		await redirectIfMoved([category, landing], sp)
		notFound()
	}
	const typed = typedPair(categoryData, landingData)
	if (typed)
		return <TypedRoute category={typed.category} searchParams={sp} landing={typed.landing} />

	// The pinned filters win over anything in the query string, so the listing can never be
	// wider than the address promises.
	const query = new URLSearchParams()
	query.set('category_id', categoryData._id)
	query.set('limit', String(sp.limit ?? '12'))
	for (const [key, value] of Object.entries(sp)) {
		if (typeof value === 'string' && key !== 'limit') query.set(key, value)
	}
	for (const [key, values] of Object.entries(landingData.filters)) {
		if (values.length > 0) query.set(key, values.join(','))
	}

	const initialCatalog = await serverFetch<CatalogResponse>(
		`/products/catalog?${query.toString()}`,
		{ next: { tags: [CACHE_TAGS.PRODUCTS] } }
	)

	return (
		<Suspense>
			<CatalogPage
				categorySlug={category}
				initialCategory={categoryData}
				initialCatalog={initialCatalog}
				pinnedFilters={landingData.filters}
				landing={{
					h1: landingData.h1,
					intro_html: landingData.intro_html,
					bottom_html: landingData.bottom_html,
					faq: landingData.faq,
					slug: landingData.slug
				}}
			/>
		</Suspense>
	)
}
