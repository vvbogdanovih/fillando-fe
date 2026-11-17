import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Package } from 'lucide-react'
import { Breadcrumbs, type Crumb } from '@/common/components/Breadcrumbs'
import { JsonLd } from '@/common/components/JsonLd'
import { UI_URLS } from '@/common/constants'
import { SITE_URL } from '@/common/constants/seo.constants'
import { productsCount } from '@/common/utils'
import { PopularLandings } from '@/app/(root)/[category]/components/PopularLandings'
import { FeaturedProducts } from '@/app/(root)/_home/FeaturedProducts'
import { HUB_SECTIONS } from './catalog-hub'
import type { HubData } from './catalog-hub.server'

interface CatalogHubProps {
	h1: string
	crumbs: Crumb[]
	/** Active SKUs below the scope; 0 is the known empty state (noindex). */
	total: number
	introHtml: string | null
	bottomHtml: string | null
	data: HubData
	root: boolean
}

const serviceLink =
	'text-primary-strong inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80'

/**
 * The catalogue hub (Plan-0010 P20): `/catalog` and every group — one column, the width of the
 * page (owner, 2026-11-14). The entry tiles are the navigation: one is a row, two share it, more
 * make an even grid, and a tile sizes itself by its own width (`@container`). The left column that
 * repeated them is gone — it took a quarter of the page from the strips below; «Прайс-лист» and
 * «Опт» stand beside the heading. Then the landings as pills («Популярні добірки»; never a
 * category's sub-categories — owner, 2026-11-10) and the product strips, every heading in the one
 * display face. No product grid and no filters — those belong to a product category, where the
 * characteristics are. The tree's deeper links are the header's «Каталог» menu, in the HTML of
 * every page.
 */
export function CatalogHub({
	h1,
	crumbs,
	total,
	introHtml,
	bottomHtml,
	data,
	root
}: CatalogHubProps) {
	const { tiles, landings, onSale, newest, collections, single } = data
	return (
		<div className='container mx-auto max-w-7xl px-4 py-8'>
			<Breadcrumbs items={crumbs} />
			{tiles.length > 0 && (
				<JsonLd
					data={{
						'@context': 'https://schema.org',
						'@type': 'ItemList',
						name: h1,
						numberOfItems: tiles.length,
						itemListElement: tiles.map((tile, index) => ({
							'@type': 'ListItem',
							position: index + 1,
							url: `${SITE_URL}${tile.href}`,
							name: tile.name
						}))
					}}
				/>
			)}
			<div className='mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1'>
				<div className='flex flex-wrap items-baseline gap-x-3.5 gap-y-1'>
					<h1 className='font-display text-2xl leading-tight font-semibold md:text-[28px]'>
						{h1}
					</h1>
					{total > 0 && (
						<span className='text-muted-foreground text-sm'>
							{productsCount(total)}
						</span>
					)}
				</div>
				{root && total > 0 && (
					<ul className='flex gap-6'>
						<li>
							<Link href={UI_URLS.PRICE_SHEET} className={serviceLink}>
								Прайс-лист
								<ArrowRight size={16} aria-hidden />
							</Link>
						</li>
						<li>
							<Link href={UI_URLS.WHOLESALE} className={serviceLink}>
								Опт
								<ArrowRight size={16} aria-hidden />
							</Link>
						</li>
					</ul>
				)}
			</div>

			{total === 0 ? (
				<div className='bg-card border-border/50 rounded-xl border p-8 text-center'>
					<p className='mb-4 font-medium'>Тут поки немає товарів.</p>
					<Link
						href={root ? UI_URLS.HOME : UI_URLS.CATALOG.ROOT}
						className='text-primary-strong text-sm font-medium hover:underline'
					>
						{root ? 'На головну' : 'До каталогу'}
					</Link>
				</div>
			) : (
				<>
					{introHtml && (
						// Storefront copy (`catalog-intro.ts`) or the group's sanitized SEO text.
						<div
							className='description mb-6 max-w-[70ch] overflow-x-auto'
							dangerouslySetInnerHTML={{ __html: introHtml }}
						/>
					)}

					<nav aria-label={root ? 'Категорії' : `Розділи: ${h1}`} className='mb-10'>
						{/* As many columns as fit at 300 px, each stretched: no empty column beside
						    one or two tiles. */}
						<ul className='grid grid-cols-[repeat(auto-fit,minmax(min(100%,18.75rem),1fr))] gap-4'>
							{tiles.map(tile => (
								<li key={tile.id} className='@container'>
									<Link
										href={tile.href}
										className='border-border bg-card hover:border-primary group flex h-full items-center gap-3.5 rounded-2xl border p-3.5 transition-colors @md:gap-5 @md:p-4'
									>
										{tile.image ? (
											<Image
												src={tile.image}
												alt=''
												width={128}
												height={128}
												className='size-20 shrink-0 rounded-xl object-cover @md:size-28'
											/>
										) : (
											<span
												aria-hidden
												className='bg-secondary text-muted-foreground flex size-20 shrink-0 items-center justify-center rounded-xl @md:size-28'
											>
												<Package size={30} strokeWidth={1.6} />
											</span>
										)}
										<span className='min-w-0 flex-1'>
											<span className='font-display group-hover:text-primary-strong block text-base font-semibold transition-colors @md:text-xl'>
												{tile.name}
											</span>
											<span className='text-muted-foreground mt-1.5 block text-sm'>
												{productsCount(tile.count)}
											</span>
											{tile.children && (
												<span className='text-muted-foreground mt-1 line-clamp-2 text-[13px] leading-snug'>
													{tile.children}
												</span>
											)}
										</span>
										<span
											aria-hidden
											className='bg-secondary hidden size-11 shrink-0 items-center justify-center rounded-full @md:flex'
										>
											<ArrowRight size={18} />
										</span>
									</Link>
								</li>
							))}
						</ul>
					</nav>

					<PopularLandings title='Популярні добірки' landings={landings} display />

					{/* «Новинки» before «Акції» (owner, 2026-11-11). */}
					{newest.length > 0 && (
						<FeaturedProducts
							id={HUB_SECTIONS.newest}
							items={newest}
							// The hub itself is not «all products»: the one category is, if there is one.
							href={single?.href ?? null}
							linkLabel='Дивитися всі'
						/>
					)}
					{onSale.length > 0 && (
						<FeaturedProducts
							id={HUB_SECTIONS.onSale}
							title='Акції'
							items={onSale}
							href={null}
						/>
					)}
					{collections.map(({ collection, items }) => (
						<FeaturedProducts
							key={collection.id}
							items={items}
							title={collection.title}
							href={collection.path ?? null}
							linkLabel='Дивитися всі'
						/>
					))}

					{bottomHtml && (
						<div className='bg-card border-border/50 mt-8 overflow-x-auto rounded-xl border p-6'>
							{/* Sanitized server-side on write. */}
							<div
								className='description'
								dangerouslySetInnerHTML={{ __html: bottomHtml }}
							/>
						</div>
					)}
				</>
			)}
		</div>
	)
}
