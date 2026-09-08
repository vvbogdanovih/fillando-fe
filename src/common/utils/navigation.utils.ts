import { API_URLS } from '@/common/constants/api-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { FALLBACK_CATEGORY_LINKS, type NavLink } from '@/common/constants/navigation.constants'
import { UI_URLS } from '@/common/constants/ui-routes.constants'
import { serverFetch } from './server-fetch.utils'

interface NavCategory {
	slug: string
	name: string
	order?: number
}

/** `/filament/` and `/filament` are the same address; compare them as one. */
const stripTrailingSlash = (path: string) =>
	path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path

/**
 * Whether a navigation link points at the page currently open.
 *
 * Two traps this exists to avoid:
 *
 * 1. A bare `startsWith` also lights up a sibling that merely shares the prefix — `/filament-x`
 *    would be highlighted together with `/filament`. The match has to land on a segment
 *    boundary, so only `/filament` itself and `/filament/<something>` count.
 * 2. A landing lives under its category (`/filament/pla-silk`), and the artboards show
 *    «Філамент» highlighted there too — so a descendant path activates its ancestor link.
 *
 * `/` is the exception: every path is its descendant, so it matches exactly or not at all.
 */
export function isNavLinkActive(pathname: string, href: string): boolean {
	const path = stripTrailingSlash(pathname)
	const target = stripTrailingSlash(href)

	if (target === UI_URLS.HOME) return path === UI_URLS.HOME

	return path === target || path.startsWith(`${target}/`)
}

/**
 * SERVER ONLY — the only export of this module that is. `isNavLinkActive` above is pure and is
 * imported by the client header and mobile menu; that is safe because `server-fetch.utils.ts`
 * holds no secret (its single module-level value is the public `NEXT_PUBLIC_API_BASE_URL`) and
 * no server-only API, so the unused export shakes out. Do not add one that does.
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
		// The same URL, and therefore the same Data Cache entry, as the reads in `Home` and in
		// the category route. `next.tags` is not part of the cache key, so an untagged call here
		// would overwrite that entry with an untagged one and the `categories` purge would stop
		// biting for everyone (Plan-0005 I-h).
		categories = await serverFetch<NavCategory[]>(API_URLS.CATEGORIES.BASE, {
			next: { tags: [CACHE_TAGS.CATEGORIES] }
		})
	} catch {
		return FALLBACK_CATEGORY_LINKS
	}

	if (!categories || categories.length === 0) return FALLBACK_CATEGORY_LINKS

	return [...categories]
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'uk'))
		.map(category => ({ href: `/${category.slug}`, label: category.name }))
}
