import Link from 'next/link'
import { JsonLd } from '@/common/components/JsonLd'
import { SITE_URL } from '@/common/constants/seo.constants'

export interface Crumb {
	name: string
	/** Absolute path from the site root. Required on every crumb: the last one is not a link on
	 * the page, but `BreadcrumbList` still needs its address. */
	href: string
}

/**
 * The visible trail and its `BreadcrumbList` markup, generated from one array.
 *
 * They used to be written separately, and had drifted: the product page showed two crumbs
 * (category → product) while telling Google there were three (home → category → product).
 * Structured data that disagrees with the page is what Google penalises, so the shape of this
 * component is the fix — there is no way to update one and forget the other.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
	const schema = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			item: `${SITE_URL}${crumb.href}`
		}))
	}

	return (
		<>
			<JsonLd data={schema} />
			<nav
				aria-label='Хлібні крихти'
				className='text-muted-foreground mb-6 flex flex-wrap items-center gap-2 text-sm'
			>
				{items.map((crumb, index) => {
					const isCurrent = index === items.length - 1
					return (
						<span key={crumb.href} className='flex items-center gap-2'>
							{index > 0 && <span aria-hidden='true'>/</span>}
							{isCurrent ? (
								<span className='text-foreground' aria-current='page'>
									{crumb.name}
								</span>
							) : (
								<Link
									href={crumb.href}
									className='hover:text-foreground transition-colors'
								>
									{crumb.name}
								</Link>
							)}
						</span>
					)
				})}
			</nav>
		</>
	)
}
