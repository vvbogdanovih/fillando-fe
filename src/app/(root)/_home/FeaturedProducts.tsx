'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { CatalogItem } from '../[category]/catalog.api'
import { CatalogProductCard } from '../[category]/components/CatalogProductCard'
import { UI_URLS } from '@/common/constants'
import { StaggerGroup, StaggerItem } from '@/common/components/motion'

interface FeaturedProductsProps {
	items: CatalogItem[]
}

export function FeaturedProducts({ items }: FeaturedProductsProps) {
	return (
		<section className='py-8 md:py-12'>
			<div className='mb-6 flex items-end justify-between'>
				<p className='text-muted-foreground text-xs font-semibold tracking-widest uppercase'>
					Новинки
				</p>
				<Link
					href={UI_URLS.CATALOG.FILAMENT}
					className='text-primary inline-flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80'
				>
					Усі товари
					<ArrowRight className='size-4' />
				</Link>
			</div>
			<StaggerGroup className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
				{items.map(item => (
					<StaggerItem key={item.id} className='h-full'>
						<CatalogProductCard item={item} href={`/products/${item.slug}`} />
					</StaggerItem>
				))}
			</StaggerGroup>
		</section>
	)
}
