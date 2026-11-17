import { UI_URLS } from './ui-routes.constants'

export interface NavLink {
	href: string
	label: string
	/** Sub-categories, any depth; the desktop panel and the mobile menu nest them. */
	children?: NavLink[]
	/**
	 * A large catalogue (Plan-0010 D06.5): this link has sub-categories that are not in the page —
	 * the menu loads them from `/api/catalog-nav/<id>` when the branch is opened.
	 */
	lazy?: true
	/** The category id behind a `lazy` link. */
	id?: string
	/** Sub-categories beyond those listed: the menu offers «Усі (N)» — the category's own page. */
	more?: number
}

/**
 * Up to this many category links the whole non-empty tree is in every page, as it always was;
 * above it the server HTML carries two levels and the rest opens on demand (owner, 30.10.2026).
 */
export const NAV_FULL_LINKS = 150
/** Sub-categories listed per branch in a large catalogue; the rest are «Усі (N)». */
export const NAV_BRANCH_LINKS = 30

/** The whole-catalogue entry: the common target for «до каталогу», not a fixed category. */
export const CATALOG_NAV_LINK: NavLink = { href: UI_URLS.CATALOG.ROOT, label: 'Каталог' }

/**
 * The part of the main navigation that is not a category. Categories are fetched at request
 * time by `getCategoryNavLinks` and prepended, so adding one in the admin puts it in the header,
 * the mobile menu and the footer without a deploy.
 */
export const STATIC_NAV_LINKS: readonly NavLink[] = [
	{ href: UI_URLS.PRICE_SHEET, label: 'Прайс-лист' },
	{ href: UI_URLS.WHOLESALE, label: 'Опт' },
	{ href: UI_URLS.FAQ, label: 'FAQ' },
	{ href: UI_URLS.CONTACTS, label: 'Контакти' }
]

/**
 * Used when the category endpoint is unreachable — the menu degrades, it does not disappear.
 * The label has to be the one the shopper normally sees for `/filament` («Філамент», as the
 * category is named in the admin), otherwise an outage silently renames the menu item.
 */
export const FALLBACK_CATEGORY_LINKS: readonly NavLink[] = [
	{ href: UI_URLS.CATALOG.FILAMENT, label: 'Філамент' }
]
