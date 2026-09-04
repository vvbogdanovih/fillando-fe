import { UI_URLS } from './ui-routes.constants'

export interface NavLink {
	href: string
	label: string
}

/**
 * The part of the main navigation that is not a category. Categories are fetched at request
 * time by `getCategoryNavLinks` and prepended, so adding one in the admin puts it in the header,
 * the mobile menu and the footer without a deploy.
 */
export const STATIC_NAV_LINKS: readonly NavLink[] = [
	{ href: UI_URLS.PRICE_SHEET, label: 'Прайс-лист' },
	{ href: UI_URLS.WHOLESALE, label: 'Співпраця' },
	{ href: UI_URLS.FAQ, label: 'FAQ' }
]

/** Used when the category endpoint is unreachable — the menu degrades, it does not disappear. */
export const FALLBACK_CATEGORY_LINKS: readonly NavLink[] = [
	{ href: UI_URLS.CATALOG.FILAMENT, label: 'Матеріали' }
]
