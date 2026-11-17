'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Breadcrumbs, type Crumb } from '@/common/components/Breadcrumbs'
import { JsonLd } from '@/common/components/JsonLd'
import { Pagination } from '@/common/components/Pagination'
import { SITE_URL } from '@/common/constants/seo.constants'
import { formatUah, productsCount } from '@/common/utils'
import { FilterDrawer } from '@/app/(root)/[category]/components/FilterDrawer'
import { ProductGrid } from '@/app/(root)/[category]/components/ProductGrid'
import { SortSelector } from '@/app/(root)/[category]/components/SortSelector'
import type { CatalogItem } from '@/app/(root)/[category]/catalog.api'
import { TypedFilters } from './components/TypedFilters'
import { FAMILY_LABELS } from '@/app/(root)/[category]/components/ColorFilter'
import {
	PopularLandings,
	type PopularLanding
} from '@/app/(root)/[category]/components/PopularLandings'
import { getTypedCatalog } from './typed-catalog.api'
import {
	apiQuery,
	DEFAULT_LIMIT,
	emptyFilters,
	hasFilters,
	listingQuery,
	parseListingParams,
	valueLabel,
	withAttribute,
	visitorDefinitions,
	withPinned,
	type TypedFilterState,
	type TypedListingState
} from './typed-filters'
import type {
	PublicDefinition,
	TypedCatalogResponse,
	TypedCatalogItem
} from './typed-catalog.types'
import { startNavigationProgress } from '@/common/components/NavigationProgress'

export interface TypedCatalogScope {
	categoryId: string | null
	path: string
	name: string
	h1: string
	crumbs: Crumb[]
	definitions: PublicDefinition[]
	introHtml: string | null
	bottomHtml: string | null
	/** A landing's typed pins: always applied, never in the URL, not offered in the sidebar. */
	pinned: TypedFilterState | null
	/** Landing questions, rendered with their FAQPage markup. */
	faq: { q: string; a: string }[]
	/** Published landings of this product category, as entry tiles. */
	popularLandings: PopularLanding[]
	/** Category slug and name for the landing tiles. */
	categorySlug: string | null
}

interface TypedCatalogPageProps {
	scope: TypedCatalogScope
	initialResponse: TypedCatalogResponse
	initialQuery: string
}

/** The storefront card is shared with v1; a typed SKU has no legacy colour or attributes. */
const toCard = (item: TypedCatalogItem): CatalogItem => ({
	...item,
	attributes: [],
	color: item.color ?? null
})

const defaultState = (): TypedListingState => ({
	filters: emptyFilters(),
	sort: 'newest',
	limit: DEFAULT_LIMIT,
	page: 1,
	explicitFirstPage: false,
	tracking: false,
	view: false
})

/** Chips of the active narrowing, each with the state it leaves behind when removed. */
function chips(
	filters: TypedFilterState,
	definitions: PublicDefinition[],
	facets: TypedCatalogResponse['facets'] | undefined
) {
	const order = definitions.map(definition => definition.key)
	const result: { id: string; label: string; next: TypedFilterState }[] = []
	for (const filter of filters.attributes) {
		const definition = definitions.find(item => item.key === filter.key)
		if (!definition) continue
		if ('values' in filter)
			for (const value of filter.values)
				result.push({
					id: `${filter.key}:${String(value)}`,
					label: `${definition.label}: ${valueLabel(definition, value)}`,
					next: withAttribute(
						filters,
						filter.key,
						{ key: filter.key, values: filter.values.filter(item => item !== value) },
						order
					)
				})
		else
			result.push({
				id: filter.key,
				label: `${definition.label}: ${filter.min ?? '…'}–${filter.max ?? '…'}${definition.unit ? ` ${definition.unit}` : ''}`,
				next: withAttribute(filters, filter.key, null, order)
			})
	}
	const named = (rows: { id: string; label: string }[] | undefined, id: string) =>
		rows?.find(row => row.id === id)?.label ?? 'Обране значення'
	for (const id of filters.category_ids)
		result.push({
			id: `category:${id}`,
			label: named(facets?.categories, id),
			next: { ...filters, category_ids: filters.category_ids.filter(item => item !== id) }
		})
	for (const id of filters.brand_ids)
		result.push({
			id: `brand:${id}`,
			label: named(facets?.brands, id),
			next: { ...filters, brand_ids: filters.brand_ids.filter(item => item !== id) }
		})
	for (const family of filters.color_families)
		result.push({
			id: `color:${family}`,
			label: `Колір: ${FAMILY_LABELS[family] ?? family}`,
			next: {
				...filters,
				color_families: filters.color_families.filter(item => item !== family)
			}
		})
	if (filters.price)
		result.push({
			id: 'price',
			label: `Ціна: ${filters.price.min !== undefined ? formatUah(filters.price.min) : '…'} – ${filters.price.max !== undefined ? formatUah(filters.price.max) : '…'}`,
			next: { ...filters, price: undefined }
		})
	if (filters.in_stock)
		result.push({
			id: 'stock',
			label: 'Є в наявності',
			next: { ...filters, in_stock: undefined }
		})
	return result
}

/**
 * A typed listing: a v2 product category or one of its typed landings (TD-0013 F06–F07); the
 * whole catalogue and groups are the hub (`CatalogHub`, Plan-0010 P20). The URL is the state —
 * the server rendered exactly this address, and every control writes a new address rather than
 * local state, so the back button, a reload and a shared link all reproduce the same listing.
 */
export function TypedCatalogPage({ scope, initialResponse, initialQuery }: TypedCatalogPageProps) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const [filtersOpen, setFiltersOpen] = useState(false)
	// The server answered 404 for any address this parser rejects, so `null` cannot render here;
	// falling back to the plain listing keeps a client-side race from crashing the page.
	const definitions = visitorDefinitions(scope.definitions, scope.pinned)
	const state = parseListingParams(searchParams, definitions) ?? defaultState()
	const query = apiQuery(
		{ ...state, filters: withPinned(state.filters, scope.pinned) },
		scope.categoryId
	)

	// Seed only the query the server rendered: a new key without data would otherwise show the
	// previous listing as if it were the answer (see CatalogPage, TD-0008 §5.4.3).
	const { data, isFetching } = useQuery({
		queryKey: ['typed-catalog', query],
		queryFn: () => getTypedCatalog(query),
		initialData: query === initialQuery ? initialResponse : undefined,
		placeholderData: keepPreviousData
	})

	// What this page last asked for. The address is the state, but it changes a round trip after
	// the request, and a navigation issued meanwhile replaces the one on its way. A typed range
	// applies when its field loses focus — the very click on the next control — so a chip, the
	// order or a page link built on the address still on screen dropped the range (review
	// 2026-11-14). Every control builds on the last request; any new address takes over.
	const address = searchParams.toString()
	const requested = useRef<TypedListingState | null>(null)
	useEffect(() => {
		requested.current = null
	}, [address])
	const latest = () => requested.current ?? state

	const navigate = (next: Partial<TypedListingState>) => {
		const merged = { ...latest(), page: 1, ...next }
		requested.current = merged
		const search = listingQuery(merged)
		const href = search ? `${scope.path}?${search}` : scope.path
		startNavigationProgress(href)
		router.push(href, { scroll: false })
	}
	const setFilters = (filters: TypedFilterState) => navigate({ filters })
	const clearAll = () => setFilters(emptyFilters())
	// A chip is drawn from the address and removed from the last request.
	const removeChip = (id: string) => {
		const filters = latest().filters
		setFilters(
			chips(filters, definitions, data?.facets).find(chip => chip.id === id)?.next ?? filters
		)
	}
	// A page link is an address of the listing on screen: followed while another listing is on its
	// way, it would replace that request. The request is asked again instead — its first page.
	const keepRequest = (event: MouseEvent<HTMLElement>) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
		if (!(event.target as Element).closest('a')) return
		if (listingQuery(latest()) === listingQuery(state)) return
		event.preventDefault()
		navigate({})
	}

	const active = chips(state.filters, definitions, data?.facets)
	const filtered = hasFilters(state.filters)
	const total = data?.total ?? 0
	const totalPages = Math.max(1, Math.ceil(total / state.limit))
	const filterPanel = (prefix: string) => (
		<TypedFilters
			definitions={definitions}
			facets={data?.facets ?? null}
			filters={state.filters}
			onChange={setFilters}
			idPrefix={prefix}
		/>
	)

	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<Breadcrumbs items={scope.crumbs} />
			{data && data.items.length > 0 && (
				<JsonLd
					data={{
						'@context': 'https://schema.org',
						'@type': 'ItemList',
						name: scope.name,
						numberOfItems: data.total,
						itemListElement: data.items.map((item, index) => ({
							'@type': 'ListItem',
							position: (data.page - 1) * data.limit + index + 1,
							url: `${SITE_URL}/products/${item.slug}`,
							name: item.name
						}))
					}}
				/>
			)}
			<div className='mb-6 flex items-center justify-between gap-4'>
				<div className='flex flex-wrap items-baseline gap-3'>
					<h1 className='text-3xl font-bold'>{scope.h1}</h1>
					{!filtered && data && (
						<span className='text-muted-foreground text-sm'>
							{productsCount(data.total)}
						</span>
					)}
				</div>
				<button
					type='button'
					className='border-border/50 bg-card hover:bg-muted flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors md:hidden'
					onClick={() => setFiltersOpen(true)}
				>
					<SlidersHorizontal size={16} />
					Фільтри
				</button>
			</div>

			{scope.introHtml && (
				// Sanitized server-side on write; never render unsanitised admin HTML here.
				<div
					className='description mb-8 max-w-[70ch] overflow-x-auto'
					dangerouslySetInnerHTML={{ __html: scope.introHtml }}
				/>
			)}

			{scope.categorySlug && (
				<PopularLandings
					categorySlug={scope.categorySlug}
					categoryName={scope.name}
					landings={scope.popularLandings}
				/>
			)}

			<FilterDrawer
				open={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				total={data?.total}
				isFetching={isFetching}
				onClearAll={filtered ? clearAll : undefined}
			>
				{filterPanel('mobile-')}
			</FilterDrawer>

			<div className='flex gap-8'>
				<aside className='hidden w-64 shrink-0 md:block' aria-label='Фільтри'>
					{/* The same card as the legacy `FilterSidebar`; the mobile drawer has its own surface. */}
					<div className='bg-card border-border/50 overflow-hidden rounded-xl border shadow-lg shadow-black/10'>
						<div className='border-border/50 border-b px-4 py-3'>
							<h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
								Фільтри
							</h2>
						</div>
						<div className='px-4 py-4'>{filterPanel('')}</div>
					</div>
				</aside>
				<main className='min-w-0 flex-1'>
					<div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
						{totalPages > 1 ? (
							<div onClickCapture={keepRequest}>
								<Pagination
									pagination={{
										total,
										page: state.page,
										limit: state.limit,
										totalPages
									}}
								/>
							</div>
						) : (
							<div />
						)}
						<SortSelector
							value={state.sort}
							onChange={sort =>
								navigate({
									sort: (sort as TypedListingState['sort'] | null) ?? 'newest'
								})
							}
						/>
					</div>
					{active.length > 0 && (
						<div className='mb-4 flex flex-wrap items-center gap-2'>
							{active.map(chip => (
								<button
									key={chip.id}
									type='button'
									onClick={() => removeChip(chip.id)}
									className='bg-muted hover:bg-muted/70 flex items-center gap-1 rounded-full px-3 py-1 text-sm'
									aria-label={`Прибрати фільтр ${chip.label}`}
								>
									{chip.label}
									<X size={14} aria-hidden />
								</button>
							))}
							<button
								type='button'
								onClick={clearAll}
								className='text-primary text-sm font-medium hover:underline'
							>
								Очистити все
							</button>
						</div>
					)}
					{filtered && (
						<p className='text-muted-foreground mb-4 text-sm' aria-busy={isFetching}>
							{isFetching ? 'Шукаємо товари…' : `Знайдено ${productsCount(total)}`}
						</p>
					)}
					<ProductGrid
						items={(data?.items ?? []).map(toCard)}
						isLoading={!data}
						emptyAction={
							filtered ? (
								<button
									type='button'
									onClick={clearAll}
									className='border-border/50 bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
								>
									Скинути фільтри
								</button>
							) : undefined
						}
					/>
					{totalPages > 1 && (
						<div className='mt-8' onClickCapture={keepRequest}>
							<Pagination
								pagination={{
									total,
									page: state.page,
									limit: state.limit,
									totalPages
								}}
							/>
						</div>
					)}
				</main>
			</div>

			{(scope.bottomHtml || scope.faq.length > 0) && (
				<div className='mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]'>
					{scope.bottomHtml && (
						<div className='bg-card border-border/50 min-w-0 overflow-x-auto rounded-xl border p-6'>
							{/* Sanitized server-side on write. */}
							<div
								className='description'
								dangerouslySetInnerHTML={{ __html: scope.bottomHtml }}
							/>
						</div>
					)}
					{scope.faq.length > 0 && (
						<section className='bg-card border-border/50 min-w-0 rounded-xl border p-6'>
							<h2 className='mb-4 text-xl font-bold'>Часті запитання</h2>
							<div className='divide-border/50 divide-y'>
								{scope.faq.map((item, index) => (
									<details key={item.q} className='group py-3' open={index === 0}>
										<summary className='flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden'>
											{item.q}
											<ChevronDown
												size={16}
												aria-hidden
												className='text-muted-foreground shrink-0 transition-transform group-open:rotate-180'
											/>
										</summary>
										<p className='text-muted-foreground mt-2 text-sm'>
											{item.a}
										</p>
									</details>
								))}
							</div>
							{/* FAQPage markup only where the answers are on the page. */}
							<JsonLd
								data={{
									'@context': 'https://schema.org',
									'@type': 'FAQPage',
									mainEntity: scope.faq.map(item => ({
										'@type': 'Question',
										name: item.q,
										acceptedAnswer: { '@type': 'Answer', text: item.a }
									}))
								}}
							/>
						</section>
					)}
				</div>
			)}
		</div>
	)
}
