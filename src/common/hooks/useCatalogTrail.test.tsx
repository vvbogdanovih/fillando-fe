import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CatalogMenu } from '@/common/components/CatalogMenu'
import { MobileMenu } from '@/common/components/MobileMenu'

/**
 * A large catalogue's deep page (P09, owner decision 02.11.2026): the header HTML lists two levels
 * only, so «Каталог» is lit and the mobile branches open from where the page sits in the tree —
 * read once from `/api/catalog-nav/trail`.
 */
const { pathname } = vi.hoisted(() => ({ pathname: { value: '/deep-leaf' } }))
vi.mock('next/navigation', () => ({
	usePathname: () => pathname.value,
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
	useSearchParams: () => new URLSearchParams()
}))
afterEach(cleanup)

const large = (id: string) => [
	{
		href: '/root',
		label: 'Розділ',
		children: [{ href: '/mid', label: 'Група', lazy: true as const, id }],
		more: 3
	}
]
const answer = (url: string) =>
	url.startsWith('/api/catalog-nav/trail')
		? url.includes('slug=deep-leaf')
			? Response.json({ hrefs: ['/root', '/mid', '/deep-leaf'] })
			: Response.json({ hrefs: [] }, { status: 404 })
		: Response.json({ links: [{ href: '/deep-leaf', label: 'Глибока' }], more: 0 })
beforeEach(() => {
	pathname.value = '/deep-leaf'
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => answer(url))
	)
})

describe('a deep page of a large catalogue (P09)', () => {
	it('lights «Каталог» in the header', async () => {
		render(createElement(CatalogMenu, { categories: large('c'.repeat(24)) }))
		await waitFor(() =>
			expect(screen.getByRole('link', { name: 'Каталог' })).toHaveClass('font-semibold')
		)
		expect(fetch).toHaveBeenCalledWith('/api/catalog-nav/trail?slug=deep-leaf')
	})

	it('opens the mobile branches down to the page', async () => {
		render(createElement(MobileMenu, { navLinks: large('d'.repeat(24)) }))
		fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Згорнути: Розділ' })).toBeInTheDocument()
		)
		expect(await screen.findByRole('button', { name: 'Згорнути: Група' })).toBeInTheDocument()
		expect(await screen.findByText('Глибока')).toHaveAttribute('aria-current', 'page')
	})

	it('reads nothing for a page outside the catalogue or a small catalogue', async () => {
		pathname.value = '/faq'
		render(createElement(CatalogMenu, { categories: large('e'.repeat(24)) }))
		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
		expect(screen.getByRole('link', { name: 'Каталог' })).not.toHaveClass('font-semibold')
		cleanup()
		vi.mocked(fetch).mockClear()
		pathname.value = '/deep-leaf'
		render(
			createElement(CatalogMenu, {
				categories: [
					{ href: '/root', label: 'Розділ', children: [{ href: '/mid', label: 'Група' }] }
				]
			})
		)
		expect(fetch).not.toHaveBeenCalled()
	})
})
