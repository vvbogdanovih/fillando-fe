import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { categoryNavLinks, navLevel } from './navigation.utils'
import { buildCatalogTree, type PublicTreeRow } from './catalog-tree.utils'
import { CatalogMenu } from '@/common/components/CatalogMenu'
import { MobileMenu } from '@/common/components/MobileMenu'
import { NAV_BRANCH_LINKS, NAV_FULL_LINKS } from '@/common/constants/navigation.constants'

vi.mock('next/navigation', () => ({
	usePathname: () => '/',
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
	useSearchParams: () => new URLSearchParams()
}))
afterEach(cleanup)

const row = (id: string, parent: string | null, kind: 'group' | 'product'): PublicTreeRow => ({
	_id: id,
	parent_id: parent,
	kind,
	name: `Cat ${id}`,
	slug: id,
	order: 0
})
/** `roots` sections × `groups` groups × `leaves` categories, every category with SKUs. */
const catalogue = (roots: number, groups: number, leaves: number) => {
	const rows: PublicTreeRow[] = []
	const counts = new Map<string, number>()
	for (let r = 0; r < roots; r++) {
		rows.push(row(`r${r}`, null, 'group'))
		for (let g = 0; g < groups; g++) {
			rows.push(row(`r${r}g${g}`, `r${r}`, 'group'))
			for (let l = 0; l < leaves; l++) {
				rows.push(row(`r${r}g${g}l${l}`, `r${r}g${g}`, 'product'))
				counts.set(`r${r}g${g}l${l}`, 1)
			}
		}
	}
	return buildCatalogTree(rows, counts)
}

describe('categoryNavLinks (Plan-0010 D06.5)', () => {
	it('keeps the whole tree, as before, up to the threshold', () => {
		const tree = catalogue(2, 3, 4) // 2 + 6 + 24 = 32 links
		const links = categoryNavLinks(tree)
		expect(JSON.stringify(links)).not.toContain('lazy')
		expect(links[0].children![0].children).toHaveLength(4)
		const full = catalogue(1, 9, 15) // 1 + 9 + 135 = 145
		expect(JSON.stringify(categoryNavLinks(full))).not.toContain('lazy')
		expect(NAV_FULL_LINKS).toBe(150)
	})
	it('lists two levels above it, the deeper branches marked to load on demand', () => {
		const tree = catalogue(20, 10, 49) // the 10 000-category fixture's shape
		const links = categoryNavLinks(tree)
		expect(links).toHaveLength(20)
		expect(links[0].children).toHaveLength(10)
		expect(links[0].children![0]).toEqual({
			href: '/r0g0',
			label: 'Cat r0g0',
			lazy: true,
			id: 'r0g0'
		})
		expect(links.flatMap(link => link.children ?? []).length).toBe(200)
	})
	it('caps a branch and counts what it leaves out', () => {
		const tree = catalogue(1, 40, 4) // 1 + 40 + 160 links: past the threshold
		const [root] = categoryNavLinks(tree)
		expect(root.children).toHaveLength(NAV_BRANCH_LINKS)
		expect(root.more).toBe(40 - NAV_BRANCH_LINKS)
		expect(navLevel([])).toEqual({})
	})
})

describe('lazy branches in the menus', () => {
	const links = [
		{
			href: '/r0',
			label: 'Розділ',
			children: [{ href: '/r0g0', label: 'Група', lazy: true as const, id: 'a'.repeat(24) }],
			more: 3
		}
	]
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({ links: [{ href: '/leaf', label: 'Листок' }], more: 2 })
			)
		)
	})
	it('the desktop panel loads a branch when it is opened, and offers «Усі (N)»', async () => {
		render(createElement(CatalogMenu, { categories: links }))
		expect(screen.getByText('Усі (3) →')).toHaveAttribute('href', '/r0')
		expect(screen.queryByText('Листок')).not.toBeInTheDocument()
		expect(fetch).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Показати підкатегорії: Група' }))
		expect(await screen.findByText('Листок')).toHaveAttribute('href', '/leaf')
		expect(fetch).toHaveBeenCalledWith(`/api/catalog-nav/${'a'.repeat(24)}`)
		expect(screen.getByText('Усі (2) →')).toHaveAttribute('href', '/r0g0')
	})
	it('the mobile menu does the same', async () => {
		// Its own branch id: loaded levels are cached per id for the page, across both menus.
		const links = [
			{
				href: '/r0',
				label: 'Розділ',
				children: [
					{ href: '/r0g0', label: 'Група', lazy: true as const, id: 'b'.repeat(24) }
				],
				more: 3
			}
		]
		render(createElement(MobileMenu, { navLinks: links }))
		fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
		fireEvent.click(screen.getByRole('button', { name: 'Розгорнути: Розділ' }))
		expect(screen.getByText('Усі (3) →')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Розгорнути: Група' }))
		await waitFor(() => expect(screen.getByText('Листок')).toBeInTheDocument())
		expect(fetch).toHaveBeenCalledWith(`/api/catalog-nav/${'b'.repeat(24)}`)
		expect(screen.getByText('Усі (2) →')).toHaveAttribute('href', '/r0g0')
	})
	const failing = (id: string) => [
		{
			href: '/r1',
			label: 'Розділ',
			children: [{ href: '/r1g0', label: 'Група', lazy: true as const, id }]
		}
	]
	const failOnce = () => {
		let calls = 0
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				++calls === 1
					? new Response(JSON.stringify({ links: [] }), { status: 503 })
					: Response.json({
							links: [{ href: '/leaf-2', label: 'Другий листок' }],
							more: 0
						})
			)
		)
	}
	it('the desktop panel announces loading and a failure, and retries on request', async () => {
		failOnce()
		render(createElement(CatalogMenu, { categories: failing('c'.repeat(24)) }))
		const toggle = screen.getByRole('button', { name: 'Показати підкатегорії: Група' })
		fireEvent.click(toggle)
		expect(screen.getByRole('status')).toHaveTextContent('Завантаження…')
		const controlled = document.getElementById(toggle.getAttribute('aria-controls')!)
		expect(controlled).toHaveAttribute('aria-busy', 'true')
		expect(await screen.findByRole('alert')).toHaveTextContent('Не вдалося завантажити')
		fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще' }))
		expect(await screen.findByText('Другий листок')).toHaveAttribute('href', '/leaf-2')
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(controlled).toHaveAttribute('aria-busy', 'false')
		expect(fetch).toHaveBeenCalledTimes(2)
	})
	it('the mobile menu does the same, and reopening a failed branch also retries', async () => {
		failOnce()
		render(createElement(MobileMenu, { navLinks: failing('d'.repeat(24)) }))
		fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
		fireEvent.click(screen.getByRole('button', { name: 'Розгорнути: Розділ' }))
		const toggle = screen.getByRole('button', { name: 'Розгорнути: Група' })
		fireEvent.click(toggle)
		expect(toggle).toHaveAttribute('aria-controls')
		expect(await screen.findByRole('alert')).toHaveTextContent('Не вдалося завантажити')
		fireEvent.click(screen.getByRole('button', { name: 'Згорнути: Група' }))
		fireEvent.click(screen.getByRole('button', { name: 'Розгорнути: Група' }))
		await waitFor(() => expect(screen.getByText('Другий листок')).toBeInTheDocument())
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	})
})
