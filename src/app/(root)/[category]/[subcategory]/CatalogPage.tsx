'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal, X } from 'lucide-react'
import { getCatalogProducts, getCategoryBySlug } from './catalog.api'
import { FilterSidebar } from './components/FilterSidebar'
import { ProductGrid } from './components/ProductGrid'
import { Pagination } from './components/Pagination'
import { PerPageSelector } from './components/PerPageSelector'
import { JsonLd } from '@/common/components/JsonLd'
import { SITE_URL } from '@/common/constants/seo.constants'

interface CatalogPageProps {
	categorySlug: string
	subcategorySlug: string
}

export const CatalogPage = ({ categorySlug, subcategorySlug }: CatalogPageProps) => {
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const router = useRouter()
	const searchParams = useSearchParams()

	const currentLimit = Number(searchParams.get('limit')) || 12
	const params = Object.fromEntries(searchParams.entries())
	if (!params.limit) params.limit = String(currentLimit)

	const { data: category } = useQuery({
		queryKey: ['category', categorySlug],
		queryFn: () => getCategoryBySlug(categorySlug)
	})

	const subcategory = category?.subcategories.find(s => s.slug === subcategorySlug)

	const { data, isLoading } = useQuery({
		queryKey: ['catalog', subcategory?._id, params],
		queryFn: () => getCatalogProducts({ subcategory_id: subcategory!._id, ...params }),
		enabled: !!subcategory
	})

	const updateParams = (changes: Record<string, string | null>) => {
		const next = new URLSearchParams(searchParams.toString())
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === '') {
				next.delete(key)
			} else {
				next.set(key, value)
			}
		}
		next.delete('page')
		router.replace(`?${next.toString()}`)
	}

	const setPage = (page: number) => {
		const next = new URLSearchParams(searchParams.toString())
		next.set('page', String(page))
		router.replace(`?${next.toString()}`)
	}

	const setLimit = (limit: number) => {
		const next = new URLSearchParams(searchParams.toString())
		next.set('limit', String(limit))
		next.delete('page')
		router.replace(`?${next.toString()}`)
	}

	if (!subcategory) return null

	const filterSidebarProps = {
		requiredAttributes: subcategory.required_attributes,
		priceRange: data?.price_range ?? { min: 0, max: 0 },
		filterOptions: data?.filter_options ?? {},
		searchParams: params,
		onParamsChange: updateParams
	}

	const breadcrumbSchema = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
			{
				'@type': 'ListItem',
				position: 2,
				name: category?.name ?? categorySlug,
				item: `${SITE_URL}/${categorySlug}`,
			},
			{
				'@type': 'ListItem',
				position: 3,
				name: subcategory.name,
				item: `${SITE_URL}/${categorySlug}/${subcategorySlug}`,
			},
		],
	}

	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<JsonLd data={breadcrumbSchema} />
			<div className='mb-8 flex items-center justify-between'>
				<h1 className='text-3xl font-bold'>{subcategory.name}</h1>
				<button
					className='border-border/50 bg-card hover:bg-muted flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors md:hidden'
					onClick={() => setIsFilterOpen(true)}
				>
					<SlidersHorizontal size={16} />
					Фільтри
				</button>
			</div>

			{/* Mobile filter overlay */}
			<div
				className={`fixed inset-0 z-50 md:hidden ${isFilterOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
			>
				<div
					className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isFilterOpen ? 'opacity-100' : 'opacity-0'}`}
					onClick={() => setIsFilterOpen(false)}
				/>
				<div
					className={`absolute bottom-0 left-0 top-0 w-80 max-w-[85vw] overflow-y-auto bg-background shadow-2xl transition-transform duration-300 ease-in-out ${isFilterOpen ? 'translate-x-0' : '-translate-x-full'}`}
				>
					<div className='border-border/50 flex items-center justify-end border-b px-4 py-3'>
						
						<button
							className='text-muted-foreground hover:text-foreground transition-colors'
							onClick={() => setIsFilterOpen(false)}
						>
							<X size={20} />
						</button>
					</div>
					<div className='p-4'>
						<FilterSidebar {...filterSidebarProps} />
					</div>
				</div>
			</div>

			<div className='flex gap-8'>
				<aside className='hidden w-64 shrink-0 md:block'>
					<FilterSidebar {...filterSidebarProps} />
				</aside>
				<main className='min-w-0 flex-1'>
					<div className='mb-4 flex items-center justify-between'>
						{data && data.pagination.totalPages > 1 ? (
							<Pagination
								pagination={data.pagination}
								onPageChange={setPage}
							/>
						) : (
							<div />
						)}
						<PerPageSelector value={currentLimit} onChange={setLimit} />
					</div>
					<ProductGrid items={data?.items ?? []} isLoading={isLoading} />
					{data && (
						<div className='mt-8 space-y-4'>
							<div className='flex items-center justify-between'>
								<span className='text-muted-foreground text-sm'>
									Показано{' '}
									{Math.min(
										(data.pagination.page - 1) * data.pagination.limit + 1,
										data.pagination.total
									)}
									–
									{Math.min(
										data.pagination.page * data.pagination.limit,
										data.pagination.total
									)}{' '}
									з {data.pagination.total}
								</span>
								<PerPageSelector value={currentLimit} onChange={setLimit} />
							</div>
							{data.pagination.totalPages > 1 && (
								<Pagination
									pagination={data.pagination}
									onPageChange={setPage}
								/>
							)}
						</div>
					)}
				</main>
			</div>
		</div>
	)
}
