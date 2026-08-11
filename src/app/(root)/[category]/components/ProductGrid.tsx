import { CatalogItem } from '../catalog.api'
import { CatalogProductCard } from './CatalogProductCard'

interface ProductGridProps {
	items: CatalogItem[]
	isLoading: boolean
}

// First-row cards render above the fold, so they preload instead of lazy-loading.
// Keep in sync with the widest column count in the grid classes below.
const EAGER_CARDS = 3

const SkeletonCard = () => (
	<div className='bg-card border-border/50 animate-pulse overflow-hidden rounded-xl border'>
		<div className='bg-foreground/10 aspect-square' />
		<div className='space-y-2 p-3'>
			<div className='bg-foreground/10 h-4 w-3/4 rounded' />
			<div className='bg-foreground/10 h-4 w-1/3 rounded' />
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
			{items.map((item, i) => (
				<CatalogProductCard
					key={item.id}
					item={item}
					href={`/products/${item.slug}`}
					priority={i < EAGER_CARDS}
				/>
			))}
		</div>
	)
}
