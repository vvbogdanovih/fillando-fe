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
