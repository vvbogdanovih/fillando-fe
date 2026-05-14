import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CatalogPage } from './CatalogPage'
import { SITE_URL } from '@/common/constants/seo.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import type { Category } from '@/app/admin/categories/categories.schema'
import type { CatalogResponse } from './catalog.api'

interface PageProps {
	params: Promise<{ category: string; subcategory: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

const formatSlug = (slug: string) =>
	slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { category, subcategory } = await params
	const label = formatSlug(subcategory)
	const title = `${label} — купити у Fillando`
	const description = `Каталог ${label.toLowerCase()}. Широкий вибір філаменту та витратних матеріалів для 3D-друку.`
	const canonical = `${SITE_URL}/${category}/${subcategory}`

	return {
		title,
		description,
		alternates: { canonical },
		openGraph: { title, description, url: canonical, type: 'website' },
	}
}

export default async function CategorySubcategoryPage({ params, searchParams }: PageProps) {
	const { category, subcategory } = await params
	const sp = await searchParams

	const categoryData = await serverFetch<Category>(`/categories/slug/${category}`)
	const sub = categoryData?.subcategories.find(s => s.slug === subcategory)

	let initialCatalog: CatalogResponse | null = null
	if (sub) {
		const query = new URLSearchParams()
		query.set('subcategory_id', sub._id)
		query.set('limit', String(sp.limit ?? '12'))
		for (const [key, value] of Object.entries(sp)) {
			if (typeof value === 'string' && key !== 'limit') {
				query.set(key, value)
			}
		}
		initialCatalog = await serverFetch<CatalogResponse>(`/products/catalog?${query.toString()}`)
	}

	return (
		<Suspense>
			<CatalogPage
				categorySlug={category}
				subcategorySlug={subcategory}
				initialCategory={categoryData}
				initialCatalog={initialCatalog}
			/>
		</Suspense>
	)
}
