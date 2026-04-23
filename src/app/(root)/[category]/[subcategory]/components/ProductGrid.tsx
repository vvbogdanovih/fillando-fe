import { CatalogItem } from '../catalog.api'
import { CatalogProductCard } from './CatalogProductCard'

interface ProductGridProps {
	items: CatalogItem[]
	isLoading: boolean
}

const SkeletonCard = () => (
	<div className='bg-card border-border/50 animate-pulse overflow-hidden rounded-xl border'>
		<div className='bg-muted aspect-square' />
		<div className='space-y-2 p-3'>
			<div className='bg-muted h-4 w-3/4 rounded' />
			<div className='bg-muted h-4 w-1/3 rounded' />
		</div>
	</div>
)

export const ProductGrid = ({ items, isLoading }: ProductGridProps) => {
	if (isLoading) {
		return (
			<div className='grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{Array.from({ length: 8 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
		)
	}

	if (items.length === 0) {
		return (
			<div className='flex items-center justify-center py-24'>
				<p className='text-muted-foreground'>Товарів не знайдено</p>
			</div>
		)
	}

	return (
		<div className='grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
			{items.map(item => (
				<CatalogProductCard key={item.id} item={item} href={`/products/${item.slug}`} />
			))}
		</div>
	)
}
