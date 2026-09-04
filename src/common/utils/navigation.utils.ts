import { API_URLS } from '@/common/constants/api-routes.constants'
import { FALLBACK_CATEGORY_LINKS, type NavLink } from '@/common/constants/navigation.constants'
import { serverFetch } from './server-fetch.utils'

interface NavCategory {
	slug: string
	name: string
	order?: number
}

/**
 * SERVER ONLY — imports serverFetch, which must never reach the browser bundle.
 *
 * Storefront categories as navigation links, for the header, the mobile menu and the footer.
 *
 * These were hard-coded to a single `/filament` entry, so a new category was invisible to both
 * shoppers and crawlers until someone remembered to edit two components.
 *
 * This is the third deliberate `try/catch` around `serverFetch` (see `docs/http-service.md`),
 * and it needs the same justification as the other two: the call sits in the root storefront
 * layout, so letting it throw would take `/faq`, `/contacts`, `/offer` and every other page
 * that needs nothing from the API down with the category endpoint. Navigation is decoration on
 * those pages, and a stale-but-working menu beats a 500. Pages that genuinely need the API
 * still fail loudly, because they fetch it themselves without a catch.
 */
export async function getCategoryNavLinks(): Promise<readonly NavLink[]> {
	let categories: NavCategory[] | null = null
	try {
		categories = await serverFetch<NavCategory[]>(API_URLS.CATEGORIES.BASE)
	} catch {
		return FALLBACK_CATEGORY_LINKS
	}

	if (!categories || categories.length === 0) return FALLBACK_CATEGORY_LINKS

	return [...categories]
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'uk'))
		.map(category => ({ href: `/${category.slug}`, label: category.name }))
}
