import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductPage } from './ProductPage'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { SITE_URL } from '@/common/constants/seo.constants'
import type { ProductDetailData } from '@/app/(root)/[category]/catalog.api'
import { variantLabel } from '@/common/utils/color.utils'
import { productPageTitle, productDisplayName } from './product-title.utils'
import { stripHtml } from './product-jsonld.utils'
import { redirectIfMoved } from '@/common/utils/moved-route.server'
import { loadCategoryAncestors } from '@/common/utils/catalog-tree.server'

interface PageProps {
	params: Promise<{ slug: string }>
}

// Opting the route into the full route cache: nothing here reads a dynamic API,
// so without this Next renders it on demand and sends `cache-control: no-store`,
// which also disqualifies the page from the browser's bfcache.
export async function generateStaticParams() {
	return []
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { slug } = await params
	// Deliberately the same URL as the page-body fetch, so both share one Data Cache entry and
	// the backend is queried once per render. `next.tags` is NOT part of the fetch cache key:
	// whichever call renders first writes the entry with its own tags and the other's are
	// silently dropped, so the two arrays must stay byte-identical. Do not "improve" one.
	const data = await serverFetch<ProductDetailData>(API_URLS.PRODUCTS.BY_SLUG(slug), {
		next: { tags: [CACHE_TAGS.PRODUCTS] }
	})
	// Streamed responses commit a 200 before notFound() can set the status, so keep
	// soft-404s out of the index explicitly.
	if (!data) {
		// An old SKU address redirects to the SKU's current one (B07).
		await redirectIfMoved(['products', slug])
		return { title: 'Товар не знайдено', robots: { index: false, follow: false } }
	}

	const { variant, product } = data
	const variantValue = variantLabel(variant)
	// A v2 page (it always answers `attribute_notice`) is titled like its H1: the name as written,
	// then the variation. A v1 page keeps the category name before the variation (TD-0013).
	const title =
		data.attribute_notice !== undefined || !variantValue
			? productDisplayName(variantValue ? product.name : variant.name, variantValue)
			: productPageTitle(product.name, variantValue, data.category_name)
	// An emptied editor stores `<p><br></p>`, which strips to '' — not nullish, so `??` shipped
	// that empty string as the whole meta description instead of the generated fallback.
	const stripped = product.description?.html ? stripHtml(product.description.html) : ''
	const description = stripped ? stripped.slice(0, 155) : `Купити ${title} у Fillando`
	const image = variant.images?.[0]
	const canonical = `${SITE_URL}/products/${slug}`

	const archived = variant.status === 'archived'
	return {
		title,
		description,
		// A discontinued product stays reachable for live ads and backlinks but leaves the index;
		// its links still pass on (TD-0006 §5.4). No canonical beside the noindex — contradictory
		// signals (TD-0013 SEO matrix, «Архівний SKU»; owner decision 31.10.2026). A draft never
		// gets here — the API answers 404.
		...(archived ? { robots: { index: false, follow: true } } : { alternates: { canonical } }),
		openGraph: {
			title,
			description,
			url: canonical,
			type: 'website',
			...(image && { images: [{ url: image, alt: title }] })
		},
		twitter: { card: 'summary_large_image', title, description }
	}
}

export default async function ProductDetailPage({ params }: PageProps) {
	const { slug } = await params
	// Tags identical to the `generateMetadata` fetch above — same URL, one cache entry. This is
	// the read behind the price, the stock badge, the `Product` JSON-LD and the archived
	// variant's `noindex`, all of which a crawler and Merchant see only as rendered HTML.
	const initialData = await serverFetch<ProductDetailData>(API_URLS.PRODUCTS.BY_SLUG(slug), {
		next: { tags: [CACHE_TAGS.PRODUCTS] }
	})
	if (!initialData) {
		await redirectIfMoved(['products', slug])
		notFound()
	}
	// A path too long to embed comes marked (Plan-0010 D06.4): read it whole here, once, so the
	// trail and its BreadcrumbList stay complete whatever the client re-reads.
	const category = initialData.category_path?.at(-1)
	const ancestors =
		initialData.category_path_paged && category
			? await loadCategoryAncestors(category._id)
			: undefined
	// Hidden since the detail was read: the SKU is no longer public either.
	if (ancestors === null) notFound()
	const categoryPath = ancestors && category ? [...ancestors, category] : null

	return (
		<Suspense>
			<ProductPage
				slug={slug}
				initialData={initialData}
				renderedAt={new Date().toISOString()}
				categoryPath={categoryPath}
			/>
		</Suspense>
	)
}
