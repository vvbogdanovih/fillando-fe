import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchPage } from './SearchPage'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import type { SearchResponse } from './search.api'

interface PageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
	const sp = await searchParams
	const q = typeof sp.q === 'string' ? sp.q : ''
	const title = q ? `Пошук: ${q} — Fillando` : 'Пошук — Fillando'
	return { title, robots: { index: false } }
}

export default async function SearchResultsPage({ searchParams }: PageProps) {
	const sp = await searchParams
	const q = typeof sp.q === 'string' ? sp.q : ''
	const page = typeof sp.page === 'string' ? sp.page : '1'
	const limit = typeof sp.limit === 'string' ? sp.limit : '20'

	let initialData: SearchResponse | null = null
	if (q.length >= 2) {
		const query = new URLSearchParams({ q, page, limit })
		initialData = await serverFetch<SearchResponse>(`/products/search?${query.toString()}`)
	}

	return (
		<Suspense>
			<SearchPage q={q} initialData={initialData} />
		</Suspense>
	)
}
