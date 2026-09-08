'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import {
	catalogFacets,
	getCatalogProducts,
	getCategoryBySlug,
	type CatalogResponse
} from './catalog.api'
import { FilterSidebar } from './components/FilterSidebar'
import { FilterDrawer } from './components/FilterDrawer'
import { ProductGrid } from './components/ProductGrid'
import { Pagination } from './components/Pagination'
import { PerPageSelector } from './components/PerPageSelector'
import { SORT_OPTIONS, SortSelector, type SortValue } from './components/SortSelector'
import { ActiveFilterChips, clearableFilterKeys } from './components/ActiveFilterChips'
import { PopularLandings, type PopularLanding } from './components/PopularLandings'
import { FAMILY_LABELS } from './components/ColorFilter'
import { attributeValueLabel } from './filter-labels'
import { formatUah, productsCount } from '@/common/utils'
import { catalogItemName } from '@/common/utils/color.utils'
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

/**
 * One end of a price narrowing, formatted the way every price on the site is. A bound that is
 * not a number is printed as it stands: the line has to name what the URL actually filters by
 * rather than print «NaN ₴».
 */
const priceBound = (value: string | null): string | null => {
	if (value === null || value.trim() === '') return null
	const amount = Number(value)
	return Number.isFinite(amount) ? formatUah(amount) : value
}

/** The price narrowing in words: «ціна 240 ₴ – 900 ₴», or one open end. */
const priceFilterLabels = (min: string | null, max: string | null): string[] => {
	const from = priceBound(min)
	const to = priceBound(max)
	if (from && to) return [`ціна ${from} – ${to}`]
	if (from) return [`ціна від ${from}`]
	if (to) return [`ціна до ${to}`]
	return []
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

	/**
	 * The SSR response seeds the cache for the parameters it was fetched with — and only those.
	 * `initialData` applies to every new query key, and the key holds `params`, so without the
	 * guard each click would create the new key already "successful" with the unfiltered SSR
	 * catalogue: the grid, the facet counts and the number on the drawer button would flash the
	 * whole category before the real response replaced it (TD-0008 §5.4.3). With the guard a new
	 * key keeps the previous narrowing on screen as placeholder data instead, and `isFetching`
	 * says that it is stale.
	 */
	const [initialParamsKey] = useState(() => JSON.stringify(params))
	const isInitialParams = JSON.stringify(params) === initialParamsKey

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ['catalog', category?._id, params],
		queryFn: () => getCatalogProducts({ category_id: category!._id, ...params }),
		enabled: !!category,
		initialData: isInitialParams ? (initialCatalog ?? undefined) : undefined,
		placeholderData: keepPreviousData
	})

	/**
	 * How many products this page is about, which is not the same number as how many are on
	 * screen. `pagination.total` is counted after every filter, so once the visitor ticks
	 * «Чорний» it becomes 42 — and the heading would then claim the whole category holds 42,
	 * while the line below it said «Знайдено 42» twice over.
	 *
	 * So the heading takes the total of the page's own scope: the category, or the landing's
	 * pinned filters. That costs a second request only while something is actually narrowed;
	 * with nothing selected the main query already answers it.
	 */
	const narrowingKeys = [...searchParams.keys()].filter(
		key => !['page', 'limit', 'sort'].includes(key) && !pinnedKeys.includes(key)
	)
	const hasNarrowed = narrowingKeys.length > 0
	const scopeParams: Record<string, string> = { limit: '1' }
	for (const [key, values] of Object.entries(pinned)) {
		if (values.length > 0) scopeParams[key] = values.join(',')
	}

	const { data: scope } = useQuery({
		queryKey: ['catalog-scope', category?._id, scopeParams],
		queryFn: () => getCatalogProducts({ category_id: category!._id, ...scopeParams }),
		enabled: !!category && hasNarrowed
	})
	const scopeTotal = hasNarrowed ? scope?.pagination.total : data?.pagination.total

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

	const clearable = clearableFilterKeys(params, pinned)
	const clearAll = () => updateParams(Object.fromEntries(clearable.map(key => [key, null])))

	/**
	 * What the visitor chose themselves, for the «Знайдено N за фільтром …» line. Pinned
	 * dimensions are excluded: they are the page, not a narrowing of it, so naming them here
	 * would read as though the shopper had filtered.
	 *
	 * Every narrowing has to be named, not only the category's own dimensions and colour. A
	 * price range narrows the grid, and so does a key the sidebar cannot name — the backend
	 * filters by any unreserved key, so an old `?material=PLA` link returns a filtered listing.
	 * A line that stays silent there is a filtered page that looks unfiltered.
	 */
	const namedKeys = new Set([
		...category.required_attributes.map(attr => attr.key),
		'color_family',
		'price_min',
		'price_max'
	])
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
			.map(family => FAMILY_LABELS[family] ?? family),
		...priceFilterLabels(searchParams.get('price_min'), searchParams.get('price_max')),
		...clearable
			.filter(key => !namedKeys.has(key))
			.flatMap(key => (params[key] ?? '').split(',').filter(Boolean))
	].join(', ')

	/**
	 * The number for that line — `null` while the answer for this narrowing is still in flight.
	 * `keepPreviousData` leaves the previous narrowing's response on screen, so printing its
	 * total beside the new filter name would state a count for a filter that never returned it
	 * (the drawer button follows the same rule, TD-0008 §5.4.5).
	 */
	const foundTotal = !isFetching && data ? data.pagination.total : null

	/**
	 * A way out of an empty result. On a category it removes the same keys «Очистити все» does.
	 * A landing's pinned dimensions are its address and cannot be dropped, so there the action
	 * leads to the landing itself, without the extra narrowing; with nothing extra to drop there
	 * is no action at all.
	 */
	const emptyAction =
		clearable.length === 0 ? undefined : landing ? (
			<Link
				href={`/${categorySlug}/${landing.slug}`}
				className='border-border/50 bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
			>
				Скинути додаткові фільтри
			</Link>
		) : (
			<button
				type='button'
				onClick={clearAll}
				className='border-border/50 bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
			>
				Скинути фільтри
			</button>
		)

	const filterSidebarProps = {
		// A pinned dimension is part of the address, so it is shown as fixed rather than as a
		// control the visitor can clear.
		requiredAttributes: category.required_attributes.filter(
			attr => !pinnedKeys.includes(attr.key)
		),
		allAttributes: category.required_attributes,
		pinnedFilters: pinned,
		priceRange: data?.price_range ?? { min: 0, max: 0 },
		facets: catalogFacets(data),
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
							// The same string the card renders: markup that disagrees with the
							// visible content is the one thing structured data must never do,
							// and the two differ on any row migrated before the naming change.
							name: catalogItemName(item)
						}))
					}}
				/>
			)}
			<div className='mb-6 flex items-center justify-between gap-4'>
				<div className='flex flex-wrap items-baseline gap-3'>
					<h1 className='text-3xl font-bold'>{landing?.h1 ?? category.name}</h1>
					{scopeTotal !== undefined && (
						<span className='text-muted-foreground text-sm'>
							{productsCount(scopeTotal)}
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

			{/* Intro copy sits under the H1, above the filters — the landing reads as a page with
			    a lead, not as a listing with a note wedged into its left column. Capped at a
			    readable measure, and it scrolls inside itself rather than widening the page if
			    the copy ever contains something that will not wrap. */}
			{landing?.intro_html && (
				// Sanitized server-side on write (`sanitizeRichText`), which is why this is safe
				// to inject; never render unsanitised admin HTML here.
				<div
					className='description mb-8 max-w-[70ch] overflow-x-auto'
					dangerouslySetInnerHTML={{ __html: landing.intro_html }}
				/>
			)}

			<FilterDrawer
				open={isFilterOpen}
				onClose={() => setIsFilterOpen(false)}
				total={data?.pagination.total}
				isFetching={isFetching}
				onClearAll={clearable.length > 0 ? clearAll : undefined}
				alwaysAvailable={!!landing}
			>
				<FilterSidebar {...filterSidebarProps} idPrefix='mobile-' />
			</FilterDrawer>

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
					    count next to the H1 already says how many there are in total. It is not
					    gated on `data`: with the answer still in flight the line still has to
					    name the filter, it just has no number to give yet. */}
					{chosenFilterText && (
						<p className='text-muted-foreground mb-4 text-sm' aria-busy={isFetching}>
							{foundTotal === null
								? `Шукаємо товари за фільтром «${chosenFilterText}»`
								: `Знайдено ${productsCount(foundTotal)} за фільтром «${chosenFilterText}»`}
						</p>
					)}
					<ProductGrid
						items={data?.items ?? []}
						isLoading={isLoading}
						emptyAction={emptyAction}
					/>
					{/* Nothing to page through and nothing to resize: an empty listing gets the
					    empty state alone, without «Показано 0–0 з 0» under it. */}
					{data && data.pagination.total > 0 && (
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
			    stack on a narrow screen, and either one alone simply takes the full width. A
			    category has neither, so the grid is not rendered there at all. */}
			{landing && (landing.bottom_html || landing.faq.length > 0) && (
				<div className='mt-12 grid gap-6 lg:grid-cols-[1.2fr_1fr]'>
					{landing?.bottom_html && (
						/*
						 * `min-w-0` and `overflow-x-auto` are load-bearing, not tidiness: a grid
						 * item's automatic minimum is its content's, so one paragraph that cannot
						 * wrap reports its whole length as the track's minimum and takes the page
						 * sideways with it. Between them, admin-authored copy that will not wrap
						 * scrolls inside its own card and the document never does. The
						 * `description` class is the second belt — it carries the same
						 * `overflow-wrap` product descriptions rely on, and it is what actually
						 * styles this copy: `prose` was a dead class, the typography plugin is not
						 * installed, and Tailwind's reset had flattened every heading into body
						 * text.
						 */
						<div className='bg-card border-border/50 min-w-0 overflow-x-auto rounded-xl border p-6'>
							<div
								className='description'
								dangerouslySetInnerHTML={{ __html: landing.bottom_html }}
							/>
						</div>
					)}

					{landing && landing.faq.length > 0 && (
						<section className='bg-card border-border/50 min-w-0 overflow-x-auto rounded-xl border p-6'>
							<h2 className='mb-4 text-xl font-bold'>Часті запитання</h2>
							{/* `<details>` keeps every answer in the HTML whether it is open or
							    not, which is what makes the FAQPage markup below truthful. The
							    first question opens by default so the block reads as an answer
							    rather than as three closed rows, and the native marker is
							    replaced by the chevron the mock draws. */}
							<div className='divide-border/50 divide-y'>
								{landing.faq.map((item, index) => (
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
			)}
		</div>
	)
}
