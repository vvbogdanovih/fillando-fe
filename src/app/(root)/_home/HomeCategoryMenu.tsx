import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Percent, Sparkles } from 'lucide-react'
import { UI_URLS, type NavLink } from '@/common/constants'
import { HUB_SECTIONS } from '../catalog/catalog-hub'

/** A first-level category with its photo from the admin, the menu's icon (`null`: a plain tile). */
export type MenuCategory = Pick<NavLink, 'href' | 'label'> & { image: string | null }

/**
 * At most `MENU_ROOTS` categories: the menu shares its row with the banner, and a longer list would
 * stretch both; the rest are one click away in «Усі товари» and the header's «Каталог».
 */
export const MENU_ROOTS = 10

const row =
	'hover:bg-muted flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors'
const mark = 'grid size-[26px] shrink-0 place-items-center overflow-hidden rounded-lg'
const chevron = (
	<ChevronRight className='text-muted-foreground ml-auto size-4 shrink-0' aria-hidden />
)

/**
 * The home page's menu (TD-0015, as in the sketch): «Акції» (only while something is on sale) and
 * «Новинки» — the catalogue hub's strips — then the first level of the public category tree in its
 * order, each with its photo, then the whole catalogue and the price sheet. On a phone the header's
 * «Меню» stands in for it.
 */
export function HomeCategoryMenu({
	categories,
	onSale,
	newest
}: {
	categories: readonly MenuCategory[]
	onSale: boolean
	newest: boolean
}) {
	const separator = <div className='bg-border mx-1 my-1.5 h-px' aria-hidden />
	return (
		<nav
			aria-label='Категорії'
			className='bg-card hidden content-start gap-0.5 rounded-2xl border p-2 md:grid'
		>
			{onSale && (
				<Link
					href={`${UI_URLS.CATALOG.ROOT}#${HUB_SECTIONS.onSale}`}
					className={`${row} text-primary-strong font-semibold`}
				>
					<span className={`${mark} bg-primary/10`} aria-hidden>
						<Percent className='size-3.5' />
					</span>
					Акції
					{chevron}
				</Link>
			)}
			{newest && (
				<Link href={`${UI_URLS.CATALOG.ROOT}#${HUB_SECTIONS.newest}`} className={row}>
					<span className={`${mark} bg-[#e6f0fb] text-[#1890db]`} aria-hidden>
						<Sparkles className='size-3.5' />
					</span>
					Новинки
					{chevron}
				</Link>
			)}
			{(onSale || newest) && separator}
			{categories.slice(0, MENU_ROOTS).map(link => (
				<Link key={link.href} href={link.href} className={row}>
					<span className={`${mark} bg-muted`} aria-hidden>
						{link.image && (
							<Image
								src={link.image}
								alt=''
								width={128}
								height={128}
								sizes='26px'
								className='size-full object-cover'
							/>
						)}
					</span>
					<span className='min-w-0 truncate'>{link.label}</span>
					{chevron}
				</Link>
			))}
			{separator}
			<Link href={UI_URLS.CATALOG.ROOT} className={row}>
				Усі товари
				{chevron}
			</Link>
			<Link href={UI_URLS.PRICE_SHEET} className={row}>
				Прайс-лист
				{chevron}
			</Link>
		</nav>
	)
}
