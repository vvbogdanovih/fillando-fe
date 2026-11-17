import type { Metadata } from 'next'
import { TypedRoute, typedRouteMetadata } from './typed-route'

interface PageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The whole catalogue: every visible product category, the common target of «до каталогу». */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
	return typedRouteMetadata(null, await searchParams)
}

export default async function CatalogRootPage({ searchParams }: PageProps) {
	return <TypedRoute category={null} searchParams={await searchParams} />
}
