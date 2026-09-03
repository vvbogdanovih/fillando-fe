import { serverFetch } from '@/common/utils/server-fetch.utils'
import type { Category } from '@/app/admin/categories/categories.schema'
import type { CatalogItem, CatalogResponse } from './[category]/catalog.api'
import { WholesaleBlock } from '@/common/components/wholesale/WholesaleBlock'
import { Hero } from './_home/Hero'
import { BrandStrip } from './_home/BrandStrip'
import { ValueProps } from './_home/ValueProps'
import { FeaturedProducts } from './_home/FeaturedProducts'

// Fallback hero image when the Філамент category has no image set.
const FILAMENT_FALLBACK =
	'https://fillando.s3.eu-north-1.amazonaws.com/categories/69b7c553ff27ba94157052db/bb2bfe7d-cd2d-45fd-8534-0cd888757962.png'

export const Home = async () => {
	// serverFetch throws on non-404 upstream failures (→ root error boundary); null means 404 only.
	const categories = (await serverFetch<Category[]>('/categories')) ?? []
	const featuredCategory = categories.find(c => c.slug === 'filament') ?? categories[0] ?? null
	const heroImage = featuredCategory?.image ?? FILAMENT_FALLBACK

	let newest: CatalogItem[] = []
	if (featuredCategory) {
		const catalog = await serverFetch<CatalogResponse>(
			`/products/catalog?category_id=${featuredCategory._id}&limit=8&sort=newest`
		)
		newest = catalog?.items ?? []
	}

	return (
		<div className='container mx-auto max-w-7xl px-4'>
			<Hero imageUrl={heroImage} />
			<BrandStrip />
			<ValueProps />
			<WholesaleBlock />
			{newest.length > 0 && <FeaturedProducts items={newest} />}
		</div>
	)
}
