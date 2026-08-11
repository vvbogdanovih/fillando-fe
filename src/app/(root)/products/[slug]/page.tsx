import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductPage } from './ProductPage'
import { serverFetchOrThrow } from '@/common/utils/server-fetch.utils'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { SITE_URL } from '@/common/constants/seo.constants'
import type { ProductDetailData } from '@/app/(root)/[category]/catalog.api'

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
	const data = await serverFetchOrThrow<ProductDetailData>(API_URLS.PRODUCTS.BY_SLUG(slug))
	// Streamed responses commit a 200 before notFound() can set the status, so keep
	// soft-404s out of the index explicitly.
	if (!data) return { title: 'Товар не знайдено', robots: { index: false, follow: false } }

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
			...(image && { images: [{ url: image, alt: title }] })
		},
		twitter: { card: 'summary_large_image', title, description }
	}
}

export default async function ProductDetailPage({ params }: PageProps) {
	const { slug } = await params
	const initialData = await serverFetchOrThrow<ProductDetailData>(API_URLS.PRODUCTS.BY_SLUG(slug))
	if (!initialData) notFound()

	return (
		<Suspense>
			<ProductPage slug={slug} initialData={initialData} />
		</Suspense>
	)
}
