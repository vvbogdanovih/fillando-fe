import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ProductPage } from './ProductPage'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { SITE_URL } from '@/common/constants/seo.constants'
import type { ProductDetailData } from '@/app/(root)/[category]/[subcategory]/catalog.api'

interface PageProps {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { slug } = await params
	const data = await serverFetch<ProductDetailData>(API_URLS.PRODUCTS.BY_SLUG(slug))
	if (!data) return { title: 'Товар не знайдено' }

	const { variant, product } = data
	const title = variant.v_value ? `${product.name} — ${variant.v_value}` : variant.name
	const rawDescription = product.description?.html?.replace(/<[^>]*>/g, '').slice(0, 155) ?? null
	const description = rawDescription ?? `Купити ${title} у Fillando`
	const image = variant.images?.[0]
	const canonical = `${SITE_URL}/products/${slug}`

	return {
		title,
		description,
		alternates: { canonical },
		openGraph: {
			title,
			description,
			url: canonical,
			type: 'website',
			...(image && { images: [{ url: image, alt: title }] }),
		},
		twitter: { card: 'summary_large_image', title, description },
	}
}

export default async function ProductDetailPage({ params }: PageProps) {
	const { slug } = await params

	return (
		<Suspense>
			<ProductPage slug={slug} />
		</Suspense>
	)
}
