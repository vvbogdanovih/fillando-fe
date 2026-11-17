import {
	FALLBACK_CATEGORY_LINKS,
	NAV_BRANCH_LINKS,
	NAV_FULL_LINKS,
	type NavLink
} from '@/common/constants/navigation.constants'
import { UI_URLS } from '@/common/constants/ui-routes.constants'
import { loadCatalogTree } from './catalog-tree.server'
import type { CatalogTreeNode } from './catalog-tree.utils'

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
 * Storefront categories as navigation links, for the header, the mobile menu and the footer —
 * the public tree's non-empty root nodes, with their non-empty branches nested below them.
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
	let tree: CatalogTreeNode[]
	try {
		tree = await loadCatalogTree()
	} catch {
		return FALLBACK_CATEGORY_LINKS
	}
	if (tree.length === 0) return FALLBACK_CATEGORY_LINKS
	return categoryNavLinks(tree)
}

/**
 * The tree as navigation links (Plan-0010 D06.5, owner 30.10.2026): up to `NAV_FULL_LINKS`
 * category links the whole non-empty tree, exactly as before; above it the roots and their
 * sub-categories (at most `NAV_BRANCH_LINKS` each, the rest «Усі (N)») — a deeper branch opens on
 * demand. At 10 000 categories the whole tree was ~2.3 MB of HTML on every page.
 */
export function categoryNavLinks(tree: CatalogTreeNode[]): NavLink[] {
	let links = 0
	for (const stack = [...tree]; stack.length; links++) stack.push(...stack.pop()!.children)
	if (links <= NAV_FULL_LINKS) return tree.map(toNavLink)
	return tree.map(root => ({ href: root.href, label: root.name, ...navLevel(root.children) }))
}

/** One level of a large catalogue's menu: the first sub-categories, deeper ones on demand. */
export function navLevel(nodes: CatalogTreeNode[]): Pick<NavLink, 'children' | 'more'> {
	if (!nodes.length) return {}
	return {
		children: nodes.slice(0, NAV_BRANCH_LINKS).map(node => ({
			href: node.href,
			label: node.name,
			...(node.children.length ? { lazy: true as const, id: node.id } : {})
		})),
		...(nodes.length > NAV_BRANCH_LINKS ? { more: nodes.length - NAV_BRANCH_LINKS } : {})
	}
}

/** A tree node as a link, its non-empty descendants nested at any depth (TD-0013 F06). */
const toNavLink = (node: CatalogTreeNode): NavLink => ({
	href: node.href,
	label: node.name,
	...(node.children.length ? { children: node.children.map(toNavLink) } : {})
})
