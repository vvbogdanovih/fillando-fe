import { UI_URLS } from './ui-routes.constants'

/** Основна навігація магазину — хедер (desktop) та мобільне меню */
export const NAV_LINKS = [
	{ href: UI_URLS.CATALOG.FILAMENT, label: 'Матеріали' },
	{ href: UI_URLS.PRICE_SHEET, label: 'Прайс-лист' },
	{ href: UI_URLS.WHOLESALE, label: 'Співпраця' },
	{ href: UI_URLS.FAQ, label: 'FAQ' }
] as const
