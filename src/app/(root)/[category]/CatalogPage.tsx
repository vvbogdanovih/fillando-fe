'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal, X } from 'lucide-react'
import { getCatalogProducts, getCategoryBySlug, type CatalogResponse } from './catalog.api'
import { FilterSidebar } from './components/FilterSidebar'
import { ProductGrid } from './components/ProductGrid'
import { Pagination } from './components/Pagination'
import { PerPageSelector } from './components/PerPageSelector'
import { SORT_OPTIONS, SortSelector, type SortValue } from './components/SortSelector'
import { ActiveFilterChips } from './components/ActiveFilterChips'
import { PopularLandings, type PopularLanding } from './components/PopularLandings'
import { FAMILY_LABELS } from './components/ColorFilter'
import { attributeValueLabel } from './filter-labels'
import { productsCount } from '@/common/utils'
import { JsonLd } from '@/common/components/JsonLd'
import { SITE_URL } from '@/common/constants/seo.constants'
import { Breadcrumbs } from '@/common/components/Breadcrumbs'
import type { Category } from '@/app/admin/categories/categories.schema'

export interface LandingContent {
	h1: string
	intro_html: string
	bottom_html: string
	faq: { q: string; a: string }[]
	slug: string
}

interface CatalogPageProps {
	categorySlug: string
	initialCategory?: Category | null
	initialCatalog?: CatalogResponse | null
	/**
	 * Filters a landing pins. Always applied, never removable, and never written to the URL —
	 * the address already expresses them, and repeating them as query parameters would give one
	 * listing two addresses.
	 */
	pinnedFilters?: Record<string, string[]>
	landing?: LandingContent
	/** Published landings of this category, shown as entry tiles. Empty on a landing itself. */
	popularLandings?: PopularLanding[]
}

export const CatalogPage = ({
	categorySlug,
	initialCategory,
	initialCatalog,
	pinnedFilters,
	landing,
	popularLandings = []
}: CatalogPageProps) => {
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const router = useRouter()
	const searchParams = useSearchParams()

	const currentLimit = Number(searchParams.get('limit')) || 12
	const pinned = pinnedFilters ?? {}
	const pinnedKeys = Object.keys(pinned)
	const params = Object.fromEntries(searchParams.entries())
	if (!params.limit) params.limit = String(currentLimit)
	// Pinned last, so a hand-typed `?polymer=PETG` on `/filament/pla` cannot widen the landing
	// beyond what its address promises.
	for (const [key, values] of Object.entries(pinned)) {
		if (values.length > 0) params[key] = values.join(',')
	}

	const { data: category } = useQuery({
		queryKey: ['category', categorySlug],
		queryFn: () => getCategoryBySlug(categorySlug),
		initialData: initialCategory ?? undefined
	})

	const { data, isLoading } = useQuery({
		queryKey: ['catalog', category?._id, params],
		queryFn: () => getCatalogProducts({ category_id: category!._id, ...params }),
		enabled: !!category,
		initialData: initialCatalog ?? undefined
	})

	const updateParams = (changes: Record<string, string | null>) => {
		const next = new URLSearchParams(searchParams.toString())
		for (const [key, value] of Object.entries(changes)) {
			// A pinned dimension has no control to change it; guard the writer too.
			if (pinnedKeys.includes(key)) continue
			if (value === null || value === '') {
				next.delete(key)
			} else {
				next.set(key, value)
			}
		}
		next.delete('page')
		router.push(`?${next.toString()}`)
	}

	const setLimit = (limit: number) => {
		const next = new URLSearchParams(searchParams.toString())
		next.set('limit', String(limit))
		next.delete('page')
		router.push(`?${next.toString()}`)
	}

	const sortParam = searchParams.get('sort') ?? 'newest'
	const currentSort: SortValue = SORT_OPTIONS.some(o => o.value === sortParam)
		? (sortParam as SortValue)
		: 'newest'

	if (!category) return null

	/**
	 * What the visitor chose themselves, for the «Знайдено N за фільтром …» line. Pinned
	 * dimensions are excluded: they are the page, not a narrowing of it, so naming them here
	 * would read as though the shopper had filtered.
	 */
	const chosenFilterText = [
		...category.required_attributes
			.filter(attr => !pinnedKeys.includes(attr.key))
			.flatMap(attr =>
				(searchParams.get(attr.key) ?? '')
					.split(',')
					.filter(Boolean)
					.map(value => attributeValueLabel(attr.key, value))
			),
		...(searchParams.get('color_family') ?? '')
			.split(',')
			.filter(Boolean)
			.map(family => FAMILY_LABELS[family] ?? family)
	].join(', ')

	const filterSidebarProps = {
		// A pinned dimension is part of the address, so it is shown as fixed rather than as a
		// control the visitor can clear.
		requiredAttributes: category.required_attributes.filter(
			attr => !pinnedKeys.includes(attr.key)
		),
		pinnedFilters: pinned,
		priceRange: data?.price_range ?? { min: 0, max: 0 },
		filterOptions: data?.filter_options ?? {},
		colorOptions: data?.color_options ?? [],
		searchParams: params,
		onParamsChange: updateParams
	}

	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<Breadcrumbs
				items={[
					{ name: 'Головна', href: '/' },
					{ name: category.name, href: `/${categorySlug}` },
					...(landing
						? [{ name: landing.h1, href: `/${categorySlug}/${landing.slug}` }]
						: [])
				]}
			/>
			{data && data.items.length > 0 && (
				<JsonLd
					data={{
						'@context': 'https://schema.org',
						'@type': 'ItemList',
						name: category.name,
						numberOfItems: data.pagination.total,
						itemListElement: data.items.map((item, index) => ({
							'@type': 'ListItem',
							// Absolute across the whole listing, not within the page: on page 2
							// the first product is not position 1.
							position:
								(data.pagination.page - 1) * data.pagination.limit + index + 1,
							url: `${SITE_URL}/products/${item.slug}`,
							name: item.name
						}))
					}}
				/>
			)}
			<div className='mb-6 flex items-center justify-between gap-4'>
				<div className='flex flex-wrap items-baseline gap-3'>
					<h1 className='text-3xl font-bold'>{landing?.h1 ?? category.name}</h1>
					{data && (
						<span className='text-muted-foreground text-sm'>
							{productsCount(data.pagination.total)}
						</span>
					)}
				</div>
				{/* A landing has no sidebar column — the artboard puts its grid across the full
				    width — so the drawer is its only way to narrow further, at every width. */}
				<button
					className={`border-border/50 bg-card hover:bg-muted flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
						landing ? '' : 'md:hidden'
					}`}
					onClick={() => setIsFilterOpen(true)}
				>
					<SlidersHorizontal size={16} />
					Фільтри
				</button>
			</div>

			{/* Intro copy sits full width under the H1, above the filters — the landing reads as
			    a page with a lead, not as a listing with a note wedged into its left column. */}
			{landing?.intro_html && (
				// Sanitized server-side on write (`sanitizeRichText`), which is why this is safe
				// to inject; never render unsanitised admin HTML here.
				<div
					className='prose prose-sm mb-8 max-w-none'
					dangerouslySetInnerHTML={{ __html: landing.intro_html }}
				/>
			)}

			{/* Mobile filter overlay */}
			<div
				className={`fixed inset-0 z-50 ${landing ? '' : 'md:hidden'} ${
					isFilterOpen ? 'pointer-events-auto' : 'pointer-events-none'
				}`}
			>
				<div
					className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isFilterOpen ? 'opacity-100' : 'opacity-0'}`}
					onClick={() => setIsFilterOpen(false)}
				/>
				<div
					className={`bg-background absolute top-0 bottom-0 left-0 w-80 max-w-[85vw] overflow-y-auto shadow-2xl transition-transform duration-300 ease-in-out ${isFilterOpen ? 'translate-x-0' : '-translate-x-full'}`}
				>
					<div className='border-border/50 flex items-center justify-end border-b px-4 py-3'>
						<button
							className='text-muted-foreground hover:text-foreground transition-colors'
							onClick={() => setIsFilterOpen(false)}
							aria-label='Закрити фільтри'
						>
							<X size={20} />
						</button>
					</div>
					<div className='p-4'>
						<FilterSidebar {...filterSidebarProps} idPrefix='mobile-' />
					</div>
				</div>
			</div>

			{/* Entry points into the landings: a shopper looking for "PLA Silk" gets there in one
			    click, and the crawler gets an internal link to every published landing. */}
			<PopularLandings
				categorySlug={categorySlug}
				categoryName={category.name}
				landings={popularLandings}
			/>

			<div className='flex gap-8'>
				{/* The landing's grid runs the full width: its filters are the chips above it. */}
				{!landing && (
					<aside className='hidden w-64 shrink-0 md:block'>
						<FilterSidebar {...filterSidebarProps} />
					</aside>
				)}
				<main className='min-w-0 flex-1'>
					<div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
						{data && data.pagination.totalPages > 1 ? (
							<Pagination pagination={data.pagination} />
						) : (
							<div />
						)}
						<div className='flex flex-wrap items-center gap-3'>
							<SortSelector
								value={currentSort}
								onChange={sort => updateParams({ sort })}
							/>
							<PerPageSelector value={currentLimit} onChange={setLimit} />
						</div>
					</div>
					<ActiveFilterChips
						attributes={category.required_attributes}
						pinnedFilters={pinned}
						searchParams={params}
						onParamsChange={updateParams}
					/>
					{/* «Знайдено N за фільтром …» — only once something narrows the listing; the
					    count next to the H1 already says how many there are in total. */}
					{data && chosenFilterText && (
						<p className='text-muted-foreground mb-4 text-sm'>
							Знайдено {productsCount(data.pagination.total)} за фільтром «
							{chosenFilterText}»
						</p>
					)}
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
								<Pagination pagination={data.pagination} />
							)}
						</div>
					)}
				</main>
			</div>

			{/* Two cards side by side at the foot of a landing: the SEO copy and the FAQ. They
			    stack on a narrow screen, and either one alone simply takes the full width. */}
			<div className='mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]'>
				{landing?.bottom_html && (
					<div className='bg-card border-border/50 rounded-xl border p-6'>
						<div
							className='prose prose-sm max-w-none'
							dangerouslySetInnerHTML={{ __html: landing.bottom_html }}
						/>
					</div>
				)}

				{landing && landing.faq.length > 0 && (
					<section className='bg-card border-border/50 rounded-xl border p-6'>
						<h2 className='mb-4 text-xl font-bold'>Часті питання</h2>
						<div className='divide-border/50 divide-y'>
							{landing.faq.map(item => (
								<details key={item.q} className='py-3'>
									<summary className='cursor-pointer font-medium'>
										{item.q}
									</summary>
									<p className='text-muted-foreground mt-2 text-sm'>{item.a}</p>
								</details>
							))}
						</div>
						{/* FAQPage markup is only valid where the answers are on the page. */}
						<JsonLd
							data={{
								'@context': 'https://schema.org',
								'@type': 'FAQPage',
								mainEntity: landing.faq.map(item => ({
									'@type': 'Question',
									name: item.q,
									acceptedAnswer: { '@type': 'Answer', text: item.a }
								}))
							}}
						/>
					</section>
				)}
			</div>
		</div>
	)
}
