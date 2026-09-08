import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { isNavLinkActive } from './navigation.utils'
import { Header } from '@/common/components/Header'
import { MobileMenu } from '@/common/components/MobileMenu'
import { FALLBACK_CATEGORY_LINKS, STATIC_NAV_LINKS } from '@/common/constants/navigation.constants'
import { UI_URLS } from '@/common/constants/ui-routes.constants'

let currentPath = '/'

vi.mock('next/navigation', () => ({
	usePathname: () => currentPath,
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
	useSearchParams: () => new URLSearchParams()
}))

describe('isNavLinkActive', () => {
	it('matches the address exactly', () => {
		expect(isNavLinkActive('/filament', '/filament')).toBe(true)
		expect(isNavLinkActive('/faq', UI_URLS.FAQ)).toBe(true)
	})

	it('keeps the category lit on its landings', () => {
		// The artboards show «Філамент» highlighted on /filament/pla-silk as well.
		expect(isNavLinkActive('/filament/pla-silk', '/filament')).toBe(true)
		expect(isNavLinkActive('/filament/pla-silk/anything', '/filament')).toBe(true)
	})

	it('does not light a sibling slug that merely shares the prefix', () => {
		// The whole reason this is not a `startsWith`: /filament-x and /filaments are other
		// categories, and a prefix match would highlight «Філамент» on both.
		expect(isNavLinkActive('/filament-x', '/filament')).toBe(false)
		expect(isNavLinkActive('/filaments', '/filament')).toBe(false)
		expect(isNavLinkActive('/filament-pla', '/filament')).toBe(false)
	})

	it('treats a trailing slash as the same address', () => {
		expect(isNavLinkActive('/filament/', '/filament')).toBe(true)
		expect(isNavLinkActive('/filament', '/filament/')).toBe(true)
	})

	it('activates the home link only on the home page', () => {
		// Every path is a descendant of '/', so the ancestor rule cannot apply there.
		expect(isNavLinkActive(UI_URLS.HOME, UI_URLS.HOME)).toBe(true)
		expect(isNavLinkActive('/filament', UI_URLS.HOME)).toBe(false)
		expect(isNavLinkActive('/faq', UI_URLS.HOME)).toBe(false)
	})

	it('leaves unrelated pages inactive', () => {
		expect(isNavLinkActive('/faq', '/filament')).toBe(false)
		expect(isNavLinkActive('/products/pla-basic-black', '/filament')).toBe(false)
		expect(isNavLinkActive('/contacts', UI_URLS.WHOLESALE)).toBe(false)
	})
})

describe('main navigation composition', () => {
	it('lists the static items the artboard shows, in order', () => {
		expect(STATIC_NAV_LINKS.map(l => l.label)).toEqual(['Прайс-лист', 'Опт', 'FAQ', 'Контакти'])
	})

	it('points «Контакти» at the existing page rather than only the footer', () => {
		expect(STATIC_NAV_LINKS.find(l => l.label === 'Контакти')?.href).toBe(UI_URLS.CONTACTS)
	})

	it('labels the category fallback the way the shopper normally sees it', () => {
		// The fallback only renders while the category endpoint is down; an outage must not
		// also rename «Філамент» to something that appears nowhere else on the site.
		expect(FALLBACK_CATEGORY_LINKS.map(l => l.label)).toEqual(['Філамент'])
	})
})

/**
 * The two consumers of the rule. `createElement` rather than JSX because this spec is a `.ts`
 * file; there is no JSX pragma to add and the trees are two nodes deep.
 */
describe('the header and the mobile menu mark the active item', () => {
	const NAV_LINKS = [
		{ href: '/filament', label: 'Філамент' },
		{ href: '/filament-x', label: 'Філамент X' },
		...STATIC_NAV_LINKS
	]

	const renderHeader = () => render(createElement(Header, { navLinks: NAV_LINKS }))

	const openMobileMenu = () => {
		render(createElement(MobileMenu, { navLinks: NAV_LINKS }))
		fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
	}

	afterEach(() => {
		cleanup()
		currentPath = '/'
	})

	it('gives the current category aria-current and the artboard weight', () => {
		currentPath = '/filament'
		renderHeader()

		const active = screen.getByRole('link', { name: 'Філамент' })
		expect(active).toHaveAttribute('aria-current', 'page')
		expect(active).toHaveClass('text-foreground', 'font-semibold')
	})

	it('leaves every other item without aria-current', () => {
		currentPath = '/filament'
		renderHeader()

		expect(screen.getByRole('link', { name: 'FAQ' })).not.toHaveAttribute('aria-current')
		expect(screen.getByRole('link', { name: 'Опт' })).not.toHaveAttribute('aria-current')
		expect(screen.getByRole('link', { name: 'Контакти' })).not.toHaveAttribute('aria-current')
		expect(screen.getByRole('link', { name: 'Філамент X' })).not.toHaveAttribute('aria-current')
	})

	it('keeps the category marked on its landing', () => {
		currentPath = '/filament/pla-silk'
		renderHeader()

		expect(screen.getByRole('link', { name: 'Філамент' })).toHaveAttribute(
			'aria-current',
			'page'
		)
	})

	it('does not mark the category on a sibling slug sharing its prefix', () => {
		currentPath = '/filament-x'
		renderHeader()

		expect(screen.getByRole('link', { name: 'Філамент' })).not.toHaveAttribute('aria-current')
		expect(screen.getByRole('link', { name: 'Філамент X' })).toHaveAttribute(
			'aria-current',
			'page'
		)
	})

	it('marks nothing when the page is not in the menu', () => {
		currentPath = '/products/pla-basic-black'
		renderHeader()

		expect(document.querySelectorAll('[aria-current]')).toHaveLength(0)
	})

	it('marks the same item in the mobile menu, landings included', () => {
		currentPath = '/filament/pla-silk'
		openMobileMenu()

		expect(screen.getByRole('link', { name: 'Філамент' })).toHaveAttribute(
			'aria-current',
			'page'
		)
		expect(screen.getByRole('link', { name: 'Прайс-лист' })).not.toHaveAttribute('aria-current')
	})
})
