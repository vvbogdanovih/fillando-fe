import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogPage } from './CatalogPage'
import { SITE_URL } from '@/common/constants/seo.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import type { Category } from '@/app/admin/categories/categories.schema'
import type { CatalogResponse } from './catalog.api'

interface PageProps {
	params: Promise<{ category: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

const formatSlug = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { category } = await params
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
	const title = `${label} — купити у Fillando`
	const description = `Каталог ${label.toLowerCase()}. Широкий вибір філаменту та витратних матеріалів для 3D-друку.`
	const canonical = `${SITE_URL}/${category}`

	return {
		title,
		description,
		alternates: { canonical },
		openGraph: { title, description, url: canonical, type: 'website' }
	}
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
	const initialCatalog = await serverFetch<CatalogResponse>(
		`/products/catalog?${query.toString()}`
	)

	return (
		<Suspense>
			<CatalogPage
				categorySlug={category}
				initialCategory={categoryData}
				initialCatalog={initialCatalog}
			/>
		</Suspense>
	)
}
