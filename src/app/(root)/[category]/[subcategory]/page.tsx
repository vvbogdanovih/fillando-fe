import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CatalogPage } from './CatalogPage'
import { SITE_URL } from '@/common/constants/seo.constants'

interface PageProps {
	params: Promise<{ category: string; subcategory: string }>
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

export default async function CategorySubcategoryPage({ params }: PageProps) {
	const { category, subcategory } = await params

	return (
		<Suspense>
			<CatalogPage categorySlug={category} subcategorySlug={subcategory} />
		</Suspense>
	)
}
